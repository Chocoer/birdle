import type { Room } from './types.js';

/** 房间存储抽象：第一阶段内存实现，后期可替换为 RedisRoomStore 同接口实现 */
export interface RoomStore {
  get(code: string): Room | undefined;
  set(room: Room): void;
  delete(code: string): void;
  values(): Room[];
}

export class MemoryRoomStore implements RoomStore {
  private rooms = new Map<string, Room>();

  get(code: string): Room | undefined {
    return this.rooms.get(code);
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
