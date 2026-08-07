import type { Difficulty, GuessRow, Bird } from '../types.js';

export type RoomStatus = 'waiting' | 'playing' | 'ended';

export interface MpPlayer {
  token: string;
  name: string;
  socketId: string | null;
  connected: boolean;
  ready: boolean;
  isHost: boolean;
  /** 断线时刻，用于 30 秒判负；在线时为 null */
  disconnectedAt: number | null;
}

export interface Spectator {
  token: string;
  name: string;
  socketId: string;
}

export interface Round {
  answerId: number;
  startedAt: number;
  /** 每位玩家的猜测历史（全量 GuessRow，仅在结算时向他人公开） */
  guesses: Record<string, GuessRow[]>;
  /** 已结束本轮的玩家：won 猜中 / out 8 次用完 */
  done: Record<string, 'won' | 'out'>;
  /** 本轮胜者 token，'draw' 流局，null 进行中 */
  winner: string | 'draw' | null;
}

export interface RoomConfig {
  difficulty: Difficulty;
  bestOf: 3 | 5;
}

export interface Room {
  code: string;
  status: RoomStatus;
  config: RoomConfig;
  players: MpPlayer[];
  spectators: Spectator[];
  roundNumber: number;
  round: Round | null;
  roundWins: Record<string, number>;
  usedAnswerIds: number[];
  matchWinner: string | null;
  emptySince: number | null;
  createdAt: number;
}

/** 对其他玩家/观战者脱敏后的单行猜测：无鸟名，仅反馈矩阵 */
export interface RedactedRow {
  cells: Record<string, { feedback: string; direction?: string }>;
  at: number;
}

export interface RoomPublic {
  code: string;
  status: RoomStatus;
  config: RoomConfig;
  players: { token: string; name: string; connected: boolean; ready: boolean; isHost: boolean }[];
  spectators: { token: string; name: string }[];
  roundNumber: number;
  roundWins: Record<string, number>;
  matchWinner: string | null;
  /** 对战中每位玩家已用次数（猜中/出局状态） */
  roundProgress: Record<string, { count: number; done?: 'won' | 'out' }> | null;
  /** 脱敏后的他人猜测（viewer 本人除外，由调用方单独发全量） */
  redactedGuesses: Record<string, RedactedRow[]>;
  /** 结算后公布的答案 */
  lastAnswer: Bird | null;
}
