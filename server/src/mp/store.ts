import { getRedis, withRedisLock } from '../redis.js';
import { createRoom, EMPTY_ROOM_TTL_MS, generateRoomCode, type RoomInit } from './room.js';
import type { Room } from './types.js';

type MaybePromise<T> = T | Promise<T>;

export interface RoomStore {
  create(init: RoomInit): MaybePromise<Room>;
  get(code: string): MaybePromise<Room | undefined>;
  update<T>(
    code: string,
    mutate: (room: Room) => T,
  ): MaybePromise<{ room: Room; value: T } | undefined>;
  delete(code: string): MaybePromise<void>;
  values(): MaybePromise<Room[]>;
}

export class MemoryRoomStore implements RoomStore {
  private rooms = new Map<string, Room>();

  create(init: RoomInit): Room {
    for (let i = 0; i < 100; i++) {
      const code = generateRoomCode();
      if (this.rooms.has(code)) continue;
      const room = createRoom(code, init);
      this.rooms.set(code, room);
      return room;
    }
    throw new Error('code_exhausted');
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  update<T>(code: string, mutate: (room: Room) => T): { room: Room; value: T } | undefined {
    const room = this.rooms.get(code);
    return room ? { room, value: mutate(room) } : undefined;
  }

  set(room: Room): void {
    this.rooms.set(room.code, room);
  }

  delete(code: string): void {
    this.rooms.delete(code);
  }

  values(): Room[] {
    return [...this.rooms.values()];
  }
}

const ROOM_TTL_SECONDS = 6 * 60 * 60;
const ROOM_INDEX_KEY = 'birdle:rooms';
const roomKey = (code: string) => `birdle:room:${code}`;

/** Redis 房间存储：每次状态变更在房间级锁内完成，避免多函数实例互相覆盖。 */
export class RedisRoomStore implements RoomStore {
  private readonly redis = getRedis()!;

  async create(init: RoomInit): Promise<Room> {
    for (let i = 0; i < 100; i++) {
      const room = createRoom(generateRoomCode(), init);
      const created = await this.redis.set(
        roomKey(room.code),
        JSON.stringify(room),
        'EX',
        ROOM_TTL_SECONDS,
        'NX',
      );
      if (created !== 'OK') continue;
      await this.redis.sadd(ROOM_INDEX_KEY, room.code);
      return room;
    }
    throw new Error('code_exhausted');
  }

  async get(code: string): Promise<Room | undefined> {
    const raw = await this.redis.get(roomKey(code));
    if (raw) return JSON.parse(raw) as Room;
    await this.redis.srem(ROOM_INDEX_KEY, code);
    return undefined;
  }

  async update<T>(
    code: string,
    mutate: (room: Room) => T,
  ): Promise<{ room: Room; value: T } | undefined> {
    return withRedisLock(`room:${code}`, async () => {
      const raw = await this.redis.get(roomKey(code));
      if (!raw) {
        await this.redis.srem(ROOM_INDEX_KEY, code);
        return undefined;
      }
      const room = JSON.parse(raw) as Room;
      const value = mutate(room);
      const expiredEmptyRoom =
        room.emptySince != null &&
        Date.now() - room.emptySince > EMPTY_ROOM_TTL_MS &&
        !room.players.some((player) => player.connected) &&
        room.spectators.length === 0;
      if (expiredEmptyRoom) {
        await this.redis.multi().del(roomKey(code)).srem(ROOM_INDEX_KEY, code).exec();
        return { room, value };
      }
      await this.redis.set(roomKey(code), JSON.stringify(room), 'EX', ROOM_TTL_SECONDS);
      return { room, value };
    });
  }

  async delete(code: string): Promise<void> {
    await this.redis.multi().del(roomKey(code)).srem(ROOM_INDEX_KEY, code).exec();
  }

  async values(): Promise<Room[]> {
    const codes = await this.redis.smembers(ROOM_INDEX_KEY);
    if (codes.length === 0) return [];
    const values = await this.redis.mget(...codes.map(roomKey));
    const stale: string[] = [];
    const rooms: Room[] = [];
    for (let i = 0; i < codes.length; i++) {
      if (values[i]) rooms.push(JSON.parse(values[i]!) as Room);
      else stale.push(codes[i]);
    }
    if (stale.length > 0) await this.redis.srem(ROOM_INDEX_KEY, ...stale);
    return rooms;
  }
}

export function createRoomStore(): RoomStore {
  return getRedis() ? new RedisRoomStore() : new MemoryRoomStore();
}
