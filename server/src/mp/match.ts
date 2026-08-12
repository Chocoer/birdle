import { getRedis, withRedisLock } from '../redis.js';
import type { Difficulty } from '../types.js';

export interface QueueEntry {
  token: string;
  name: string;
  socketId: string;
  difficulty: Difficulty;
  bestOf: 3 | 5;
  joinedAt: number;
}

type MaybePromise<T> = T | Promise<T>;

export interface MatchQueueStore {
  add(entry: Omit<QueueEntry, 'joinedAt'>): MaybePromise<void>;
  remove(token: string): MaybePromise<boolean>;
  removeBySocket(socketId: string): MaybePromise<void>;
  tryMatch(now: number): MaybePromise<[QueueEntry, QueueEntry] | null>;
}

/** 等待超过该时长后放宽偏好，可与任何人配对 */
export const MATCH_RELAX_MS = 30_000;

/** 从队列快照中挑出一对；存储实现负责原子删除。 */
function findMatch(entries: QueueEntry[], now: number): [QueueEntry, QueueEntry] | null {
  if (entries.length < 2) return null;
  const sorted = [...entries].sort((a, b) => a.joinedAt - b.joinedAt);
  const oldest = sorted[0];
  const rest = sorted.slice(1);
  const exact = rest.find(
    (entry) => entry.difficulty === oldest.difficulty && entry.bestOf === oldest.bestOf,
  );
  const relaxed = now - oldest.joinedAt > MATCH_RELAX_MS ? rest[0] : undefined;
  const partner = exact ?? relaxed;
  return partner ? [oldest, partner] : null;
}

/** 快速匹配队列（本地开发和测试使用） */
export class MatchQueue implements MatchQueueStore {
  /** token → 排队项（公开以便测试操纵等待时长） */
  readonly entries = new Map<string, QueueEntry>();

  add(entry: Omit<QueueEntry, 'joinedAt'>): void {
    this.entries.set(entry.token, { ...entry, joinedAt: Date.now() });
  }

  remove(token: string): boolean {
    return this.entries.delete(token);
  }

  removeBySocket(socketId: string): void {
    for (const [token, entry] of this.entries) {
      if (entry.socketId === socketId) this.entries.delete(token);
    }
  }

  has(token: string): boolean {
    return this.entries.has(token);
  }

  size(): number {
    return this.entries.size;
  }

  /** 优先相同偏好；等待超过 30 秒后按入队顺序放宽。 */
  tryMatch(now: number): [QueueEntry, QueueEntry] | null {
    const pair = findMatch([...this.entries.values()], now);
    if (!pair) return null;
    this.entries.delete(pair[0].token);
    this.entries.delete(pair[1].token);
    return pair;
  }
}

const QUEUE_KEY = 'birdle:match-queue';

/** Redis 队列在一个短锁中更新；当前规模只需一个 JSON 列表。 */
export class RedisMatchQueue implements MatchQueueStore {
  private readonly redis = getRedis()!;

  private async mutate<T>(change: (entries: QueueEntry[]) => T): Promise<T> {
    return withRedisLock('match-queue', async () => {
      const raw = await this.redis.get(QUEUE_KEY);
      const entries = raw ? (JSON.parse(raw) as QueueEntry[]) : [];
      const value = change(entries);
      await this.redis.set(QUEUE_KEY, JSON.stringify(entries), 'EX', 60 * 60);
      return value;
    });
  }

  async add(entry: Omit<QueueEntry, 'joinedAt'>): Promise<void> {
    await this.mutate((entries) => {
      const existing = entries.findIndex((item) => item.token === entry.token);
      if (existing >= 0) entries.splice(existing, 1);
      entries.push({ ...entry, joinedAt: Date.now() });
    });
  }

  async remove(token: string): Promise<boolean> {
    return this.mutate((entries) => {
      const before = entries.length;
      entries.splice(0, entries.length, ...entries.filter((entry) => entry.token !== token));
      return entries.length !== before;
    });
  }

  async removeBySocket(socketId: string): Promise<void> {
    await this.mutate((entries) => {
      entries.splice(0, entries.length, ...entries.filter((entry) => entry.socketId !== socketId));
    });
  }

  async tryMatch(now: number): Promise<[QueueEntry, QueueEntry] | null> {
    return this.mutate((entries) => {
      const pair = findMatch(entries, now);
      if (!pair) return null;
      const tokens = new Set(pair.map((entry) => entry.token));
      entries.splice(0, entries.length, ...entries.filter((entry) => !tokens.has(entry.token)));
      return pair;
    });
  }
}

export function createMatchQueue(): MatchQueueStore {
  return getRedis() ? new RedisMatchQueue() : new MatchQueue();
}
