import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Redis } from 'ioredis';

let client: Redis | null | undefined;

/** 返回共享 Redis 连接；未配置 REDIS_URL 时保留本地内存运行方式。 */
export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.REDIS_URL;
  if (!url) return (client = null);
  client = new Redis(url, {
    maxRetriesPerRequest: null,
    connectTimeout: 5_000,
    commandTimeout: 5_000,
    retryStrategy: (attempt) => Math.min(attempt * 100, 2_000),
  });
  client.on('error', (error) => console.error('[birdle] Redis 连接失败', error));
  return client;
}

/**
 * 用 Redis SET NX 提供短时互斥，保护同一对局/房间的读改写。
 * 锁等待有明确上限；超时直接暴露服务不可用，避免并发覆盖真实状态。
 */
export async function withRedisLock<T>(name: string, task: () => Promise<T>): Promise<T> {
  const redis = getRedis();
  if (!redis) return task();

  const key = `birdle:lock:${name}`;
  const token = randomUUID();
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const acquired = await redis.set(key, token, 'PX', 10_000, 'NX');
    if (acquired === 'OK') {
      try {
        return await task();
      } finally {
        await redis
          .eval(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
            1,
            key,
            token,
          )
          .catch((error) => console.error('[birdle] Redis 锁释放失败', error));
      }
    }
    await delay(40);
  }
  throw new Error(`redis_lock_timeout:${name}`);
}
