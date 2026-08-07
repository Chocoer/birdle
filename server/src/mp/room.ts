import { getBird } from '../data/birds.js';
import { compareBirds } from '../game/compare.js';
import { MAX_GUESSES, poolOf } from '../game/session.js';
import type { Bird, ConservationSystem } from '../types.js';
import type { MemoryRoomStore } from './store.js';
import type { MpPlayer, RedactedRow, Room, RoomConfig, RoomPublic, Round } from './types.js';

/** 断线后重连宽限期（毫秒），超时判负 */
export const RECONNECT_GRACE_MS = 30_000;
/** 全员离开后房间保留时间（毫秒） */
export const EMPTY_ROOM_TTL_MS = 5 * 60_000;

/** 去掉易混淆字符（0/O/1/I/L） */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export type MpError =
  | 'room_not_found'
  | 'not_host'
  | 'not_in_room'
  | 'already_playing'
  | 'not_playing'
  | 'round_over'
  | 'duplicate_guess'
  | 'not_in_pool'
  | 'bird_not_found'
  | 'reconnect_failed'
  | 'need_two_players'
  | 'invalid_payload';

export type MpResult<T> = { ok: true; value: T } | { ok: false; error: MpError };

function generateCode(store: MemoryRoomStore): string {
  for (let i = 0; i < 100; i++) {
    const code = Array.from(
      { length: 5 },
      () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
    ).join('');
    if (!store.get(code)) return code;
  }
  throw new Error('code_exhausted');
}

export function playerOf(room: Room, token: string): MpPlayer | undefined {
  return room.players.find((p) => p.token === token);
}

export function createRoom(
  store: MemoryRoomStore,
  init: { token: string; name: string; socketId: string; config: RoomConfig },
): Room {
  const room: Room = {
    code: generateCode(store),
    status: 'waiting',
    config: init.config,
    players: [
      {
        token: init.token,
        name: init.name,
        socketId: init.socketId,
        connected: true,
        ready: false,
        isHost: true,
        disconnectedAt: null,
      },
    ],
    spectators: [],
    roundNumber: 0,
    round: null,
    roundWins: {},
    usedAnswerIds: [],
    matchWinner: null,
    emptySince: null,
    createdAt: Date.now(),
  };
  store.set(room);
  return room;
}

/** 加入房间：未满 2 人成为玩家，否则成为观战者 */
export function joinRoom(
  room: Room,
  guest: { token: string; name: string; socketId: string },
): 'player' | 'spectator' {
  // 同 token 重复加入：刷新连接信息即可
  const existing = playerOf(room, guest.token);
  if (existing) {
    existing.socketId = guest.socketId;
    existing.connected = true;
    existing.disconnectedAt = null;
    return 'player';
  }
  const spec = room.spectators.find((s) => s.token === guest.token);
  if (spec) {
    spec.socketId = guest.socketId;
    return 'spectator';
  }
  if (room.players.length < 2 && room.status === 'waiting') {
    room.players.push({
      token: guest.token,
      name: guest.name,
      socketId: guest.socketId,
      connected: true,
      ready: false,
      isHost: false,
      disconnectedAt: null,
    });
    room.roundWins[guest.token] = room.roundWins[guest.token] ?? 0;
    return 'player';
  }
  room.spectators.push({ token: guest.token, name: guest.name, socketId: guest.socketId });
  return 'spectator';
}

function pickAnswerId(room: Room): number {
  const pool = poolOf(room.config.difficulty).filter((b) => !room.usedAnswerIds.includes(b.id));
  return pool[Math.floor(Math.random() * pool.length)].id;
}

function startRound(room: Room): void {
  const answerId = pickAnswerId(room);
  room.usedAnswerIds.push(answerId);
  room.roundNumber += 1;
  room.round = {
    answerId,
    startedAt: Date.now(),
    guesses: Object.fromEntries(room.players.map((p) => [p.token, []])),
    done: {},
    winner: null,
  };
  for (const p of room.players) p.ready = false;
}

/** 房主开始整场对局 */
export function startMatch(room: Room, byToken: string): MpResult<null> {
  const host = room.players.find((p) => p.isHost);
  if (!host || host.token !== byToken) return { ok: false, error: 'not_host' };
  if (room.status === 'playing') return { ok: false, error: 'already_playing' };
  if (room.players.length < 2) return { ok: false, error: 'need_two_players' };
  room.status = 'playing';
  room.matchWinner = null;
  room.roundWins = Object.fromEntries(room.players.map((p) => [p.token, 0]));
  startRound(room);
  return { ok: true, value: null };
}

/** 准备：等待室双方都 ready → 开整场；局间双方都 ready → 开下一局 */
export function markReady(room: Room, token: string): MpResult<{ nextRoundStarted: boolean }> {
  const p = playerOf(room, token);
  if (!p) return { ok: false, error: 'not_in_room' };
  p.ready = true;
  if (!room.players.every((x) => x.ready)) return { ok: true, value: { nextRoundStarted: false } };

  if (room.status === 'waiting' && room.players.length === 2) {
    // 双方就绪，开始整场（startRound 会把 ready 重置回 false）
    room.status = 'playing';
    room.matchWinner = null;
    room.roundWins = Object.fromEntries(room.players.map((x) => [x.token, 0]));
    startRound(room);
    return { ok: true, value: { nextRoundStarted: true } };
  }
  if (room.status === 'playing' && room.round?.winner != null) {
    startRound(room);
    return { ok: true, value: { nextRoundStarted: true } };
  }
  return { ok: true, value: { nextRoundStarted: false } };
}

function winsNeeded(room: Room): number {
  return Math.ceil(room.config.bestOf / 2);
}

function finishRound(room: Room, winner: string | 'draw'): void {
  room.round!.winner = winner;
  if (winner !== 'draw') {
    room.roundWins[winner] = (room.roundWins[winner] ?? 0) + 1;
    if (room.roundWins[winner] >= winsNeeded(room)) {
      room.matchWinner = winner;
      room.status = 'ended';
    }
  }
}

export interface GuessApplied {
  row: import('../types.js').GuessRow;
  roundEnded: boolean;
  roundWinner: string | 'draw' | null;
  matchEnded: boolean;
  answer: Bird | null;
}

/** 提交猜测：校验 → 按猜测者自己选用的保护等级体系判定 → 更新轮次/整场状态 */
export function submitGuess(
  room: Room,
  token: string,
  birdId: number,
  conservation: ConservationSystem,
): MpResult<GuessApplied> {
  if (room.status !== 'playing' || !room.round) return { ok: false, error: 'not_playing' };
  const p = playerOf(room, token);
  if (!p) return { ok: false, error: 'not_in_room' };
  const round = room.round;
  if (round.winner != null || round.done[token]) return { ok: false, error: 'round_over' };

  const bird = getBird(birdId);
  if (!bird) return { ok: false, error: 'bird_not_found' };
  if (!poolOf(room.config.difficulty).some((b) => b.id === birdId)) {
    return { ok: false, error: 'not_in_pool' };
  }
  const mine = round.guesses[token] ?? (round.guesses[token] = []);
  if (mine.some((g) => g.bird.id === birdId)) return { ok: false, error: 'duplicate_guess' };

  const answer = getBird(round.answerId)!;
  const row = compareBirds(bird, answer, conservation);
  mine.push(row);

  if (bird.id === answer.id) {
    round.done[token] = 'won';
    finishRound(room, token);
  } else if (mine.length >= MAX_GUESSES) {
    round.done[token] = 'out';
    if (room.players.every((x) => round.done[x.token])) finishRound(room, 'draw');
  }

  return {
    ok: true,
    value: {
      row,
      roundEnded: round.winner != null,
      roundWinner: round.winner,
      matchEnded: room.matchWinner != null,
      answer: round.winner != null ? answer : null,
    },
  };
}

/** 断线：等待中直接移出（房主离开则转让），对战中进入 30 秒宽限 */
export function handleDisconnect(room: Room, token: string): { removed: boolean } {
  const specIdx = room.spectators.findIndex((s) => s.token === token);
  if (specIdx >= 0) {
    room.spectators.splice(specIdx, 1);
    return { removed: true };
  }
  const p = playerOf(room, token);
  if (!p) return { removed: false };
  if (room.status === 'waiting') {
    removePlayer(room, token);
    return { removed: true };
  }
  p.connected = false;
  p.socketId = null;
  p.disconnectedAt = Date.now();
  return { removed: false };
}

function removePlayer(room: Room, token: string): void {
  const idx = room.players.findIndex((p) => p.token === token);
  if (idx < 0) return;
  const wasHost = room.players[idx].isHost;
  room.players.splice(idx, 1);
  delete room.roundWins[token];
  if (wasHost && room.players.length > 0) room.players[0].isHost = true;
}

/** 主动离开 / 断线超时判负：对战中对手直接赢整场 */
export function forfeit(room: Room, token: string): { matchEndedByForfeit: boolean } {
  const wasPlaying = room.status === 'playing';
  if (wasPlaying) {
    const opponent = room.players.find((p) => p.token !== token);
    if (opponent) {
      room.matchWinner = opponent.token;
      room.status = 'ended';
    }
  }
  removePlayer(room, token);
  return { matchEndedByForfeit: wasPlaying && room.status === 'ended' };
}

/** 断线重连：恢复玩家或观战者身份 */
export function reconnect(
  room: Room,
  token: string,
  socketId: string,
): MpResult<{ role: 'player' | 'spectator' }> {
  const p = playerOf(room, token);
  if (p) {
    p.socketId = socketId;
    p.connected = true;
    p.disconnectedAt = null;
    return { ok: true, value: { role: 'player' } };
  }
  const s = room.spectators.find((x) => x.token === token);
  if (s) {
    s.socketId = socketId;
    return { ok: true, value: { role: 'spectator' } };
  }
  return { ok: false, error: 'reconnect_failed' };
}

/** 定期清扫：断线超时判负、空房间销毁。返回需要广播的事件 */
export interface SweepEvent {
  code: string;
  type: 'forfeit' | 'room_destroyed';
  token?: string;
}

export function sweepRooms(store: MemoryRoomStore, now: number): SweepEvent[] {
  const events: SweepEvent[] = [];
  for (const room of store.values()) {
    for (const p of [...room.players]) {
      if (p.disconnectedAt != null && now - p.disconnectedAt > RECONNECT_GRACE_MS) {
        forfeit(room, p.token);
        events.push({ code: room.code, type: 'forfeit', token: p.token });
      }
    }
    const anyoneHere =
      room.players.some((p) => p.connected) || room.spectators.length > 0;
    if (!anyoneHere) {
      room.emptySince = room.emptySince ?? now;
      if (now - room.emptySince > EMPTY_ROOM_TTL_MS) {
        store.delete(room.code);
        events.push({ code: room.code, type: 'room_destroyed' });
      }
    } else {
      room.emptySince = null;
    }
  }
  return events;
}

/** 单行脱敏：只保留各格 feedback/direction，不带鸟名 */
export function redactRow(row: import('../types.js').GuessRow, at: number): RedactedRow {
  const cells: RedactedRow['cells'] = {};
  for (const [k, v] of Object.entries(row.cells)) {
    cells[k] = { feedback: v.feedback };
    if (v.direction) cells[k].direction = v.direction;
  }
  return { cells, at };
}

/** 房间公开视图：所有人的猜测均为脱敏版；本人全量由专用事件单独下发 */
export function roomPublic(room: Room): RoomPublic {
  const round = room.round;
  const redactedGuesses: RoomPublic['redactedGuesses'] = {};
  const roundProgress: NonNullable<RoomPublic['roundProgress']> = {};
  if (round) {
    for (const [token, rows] of Object.entries(round.guesses)) {
      redactedGuesses[token] = rows.map((r, i) => redactRow(r, round.startedAt + i));
    }
    for (const p of room.players) {
      roundProgress[p.token] = {
        count: round.guesses[p.token]?.length ?? 0,
        done: round.done[p.token],
      };
    }
  }
  const lastAnswer =
    round?.winner != null ? getBird(round.answerId)! : room.status === 'ended' && round ? getBird(round.answerId)! : null;
  return {
    code: room.code,
    status: room.status,
    config: room.config,
    players: room.players.map((p) => ({
      token: p.token,
      name: p.name,
      connected: p.connected,
      ready: p.ready,
      isHost: p.isHost,
    })),
    spectators: room.spectators.map((s) => ({ token: s.token, name: s.name })),
    roundNumber: room.roundNumber,
    roundWins: room.roundWins,
    matchWinner: room.matchWinner,
    roundProgress: round ? roundProgress : null,
    redactedGuesses,
    lastAnswer,
  };
}
