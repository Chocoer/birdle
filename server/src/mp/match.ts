import type { Difficulty } from '../types.js';

export interface QueueEntry {
  token: string;
  name: string;
  socketId: string;
  difficulty: Difficulty;
  bestOf: 3 | 5;
  joinedAt: number;
}

/** 等待超过该时长后放宽偏好，可与任何人配对 */
export const MATCH_RELAX_MS = 30_000;

/** 快速匹配队列（内存实现，单实例够用） */
export class MatchQueue {
  /** token → 排队项（公开以便测试操纵等待时长） */
  readonly entries = new Map<string, QueueEntry>();

  /** 入队；同 token 重复入队则更新偏好 */
  add(entry: Omit<QueueEntry, 'joinedAt'>): void {
    this.entries.set(entry.token, { ...entry, joinedAt: Date.now() });
  }

  remove(token: string): boolean {
    return this.entries.delete(token);
  }

  removeBySocket(socketId: string): void {
    for (const [token, e] of this.entries) {
      if (e.socketId === socketId) this.entries.delete(token);
    }
  }

  has(token: string): boolean {
    return this.entries.has(token);
  }

  size(): number {
    return this.entries.size;
  }

  /**
   * 尝试配对：优先难度+赛制完全相同的两人；
   * 等待最久的人超过放宽时长后，与队中任意一人配对（用其偏好建房）。
   * 成功时把两人移出队列并返回。
   */
  tryMatch(now: number): [QueueEntry, QueueEntry] | null {
    if (this.entries.size < 2) return null;
    const sorted = [...this.entries.values()].sort((a, b) => a.joinedAt - b.joinedAt);
    const oldest = sorted[0];
    const rest = sorted.slice(1);

    // 1) 精确匹配：与最久者难度和赛制都相同的人
    const exact = rest.find(
      (e) => e.difficulty === oldest.difficulty && e.bestOf === oldest.bestOf,
    );
    // 2) 放宽匹配：最久者等超时，与队首下一人配对
    const relaxed = now - oldest.joinedAt > MATCH_RELAX_MS ? rest[0] : undefined;
    const partner = exact ?? relaxed;
    if (!partner) return null;

    this.entries.delete(oldest.token);
    this.entries.delete(partner.token);
    return [oldest, partner];
  }
}
