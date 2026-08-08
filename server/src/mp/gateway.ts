import type { Server, Socket } from 'socket.io';
import { getBird } from '../data/birds.js';
import { MAX_GUESSES } from '../game/session.js';
import type { ConservationSystem, Difficulty } from '../types.js';
import { MatchQueue } from './match.js';
import * as R from './room.js';
import { MemoryRoomStore } from './store.js';
import type { Room } from './types.js';

const TOKEN_RE = /^[A-Za-z0-9-]{8,64}$/;
const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];
const CONSERVATIONS: ConservationSystem[] = ['iucn', 'china'];

export interface GatewayOptions {
  store?: MemoryRoomStore;
  queue?: MatchQueue;
  /** 默认 5000ms；测试可缩短 */
  sweepIntervalMs?: number;
}

function validName(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length >= 1 && v.trim().length <= 16;
}

function nameOf(room: Room, token: string | null): string | null {
  if (token == null) return null;
  return (
    room.players.find((p) => p.token === token)?.name ??
    room.spectators.find((s) => s.token === token)?.name ??
    null
  );
}

/** 把多人对战网关挂到 Socket.IO 服务上；返回清理函数（测试用） */
export function attachGateway(io: Server, opts: GatewayOptions = {}): () => void {
  const store = opts.store ?? new MemoryRoomStore();
  const queue = opts.queue ?? new MatchQueue();
  /** socketId → 所在房间与身份（跨连接共享，匹配建房时需要写入他人 ctx） */
  const contexts = new Map<string, { code?: string; token?: string }>();

  const broadcastUpdate = (room: Room) => {
    io.to(room.code).emit('room-update', { room: R.roomPublic(room) });
  };

  const emitGameStarted = (room: Room) => {
    io.to(room.code).emit('game-started', {
      roundNumber: room.roundNumber,
      bestOf: room.config.bestOf,
      maxGuesses: MAX_GUESSES,
      deadline: room.round!.startedAt + R.ROUND_TIME_LIMIT_MS,
      serverNow: Date.now(),
    });
  };

  const emitRoundEnd = (room: Room, reason: 'won' | 'draw' | 'timeout') => {
    const winner = room.round!.winner;
    io.to(room.code).emit('round-end', {
      roundNumber: room.roundNumber,
      winner,
      winnerName: winner === 'draw' ? null : nameOf(room, winner),
      reason,
      answer: getBird(room.round!.answerId),
      roundWins: room.roundWins,
    });
  };

  const emitMatchEnd = (room: Room, reason: 'score' | 'forfeit') => {
    io.to(room.code).emit('match-end', {
      winner: room.matchWinner,
      winnerName: nameOf(room, room.matchWinner),
      roundWins: room.roundWins,
      reason,
    });
  };

  /** 尝试配对：成功则建房并把双方拉入 */
  const tryMatchAndCreate = () => {
    const pair = queue.tryMatch(Date.now());
    if (!pair) return;
    const [e1, e2] = pair;
    const s1 = io.sockets.sockets.get(e1.socketId);
    const s2 = io.sockets.sockets.get(e2.socketId);
    // 配对瞬间一方已离线：丢弃离线者，另一方重新入队
    if (!s1 || !s2) {
      if (s1) queue.add(e1);
      if (s2) queue.add(e2);
      return;
    }
    const room = R.createRoom(store, {
      token: e1.token,
      name: e1.name,
      socketId: e1.socketId,
      config: { difficulty: e1.difficulty, bestOf: e1.bestOf },
    });
    R.joinRoom(room, { token: e2.token, name: e2.name, socketId: e2.socketId });
    for (const [e, s] of [
      [e1, s1],
      [e2, s2],
    ] as const) {
      void s.join(room.code);
      // 注意：必须原地更新，连接处理器持有同一对象的引用
      const ctx = contexts.get(s.id);
      if (ctx) {
        ctx.code = room.code;
        ctx.token = e.token;
      } else {
        contexts.set(s.id, { code: room.code, token: e.token });
      }
      s.emit('match-found', {
        roomCode: room.code,
        room: R.roomPublic(room),
        self: { token: e.token, role: 'player' },
      });
    }
  };

  io.on('connection', (socket: Socket) => {
    contexts.set(socket.id, {});
    const ctx = contexts.get(socket.id)!;
    const err = (code: R.MpError) => socket.emit('error', { code });

    const findRoom = (code: unknown): Room | undefined => {
      const c = typeof code === 'string' ? code.toUpperCase() : ctx.code;
      return c ? store.get(c) : undefined;
    };

    socket.on('create-room', (payload: unknown) => {
      const { playerName, token, difficulty, bestOf } = (payload ?? {}) as Record<string, unknown>;
      if (!validName(playerName) || typeof token !== 'string' || !TOKEN_RE.test(token)) {
        return err('invalid_payload');
      }
      if (!DIFFICULTIES.includes(difficulty as Difficulty)) return err('invalid_payload');
      if (bestOf !== 3 && bestOf !== 5) return err('invalid_payload');
      const room = R.createRoom(store, {
        token,
        name: playerName.trim(),
        socketId: socket.id,
        config: { difficulty: difficulty as Difficulty, bestOf },
      });
      ctx.code = room.code;
      ctx.token = token;
      void socket.join(room.code);
      socket.emit('room-created', { roomCode: room.code, room: R.roomPublic(room) });
    });

    socket.on('join-room', (payload: unknown) => {
      const { roomCode, playerName, token } = (payload ?? {}) as Record<string, unknown>;
      if (!validName(playerName) || typeof token !== 'string' || !TOKEN_RE.test(token)) {
        return err('invalid_payload');
      }
      const room = findRoom(roomCode);
      if (!room) return err('room_not_found');
      const role = R.joinRoom(room, { token, name: playerName.trim(), socketId: socket.id });
      ctx.code = room.code;
      ctx.token = token;
      void socket.join(room.code);
      socket.emit('room-update', { room: R.roomPublic(room), self: { token, role } });
      socket.to(room.code).emit('player-joined', { player: { token, name: playerName.trim() }, role });
      broadcastUpdate(room);
    });

    socket.on('queue-join', (payload: unknown) => {
      const { playerName, token, difficulty, bestOf } = (payload ?? {}) as Record<string, unknown>;
      if (!validName(playerName) || typeof token !== 'string' || !TOKEN_RE.test(token)) {
        return err('invalid_payload');
      }
      if (!DIFFICULTIES.includes(difficulty as Difficulty)) return err('invalid_payload');
      if (bestOf !== 3 && bestOf !== 5) return err('invalid_payload');
      queue.add({
        token,
        name: playerName.trim(),
        socketId: socket.id,
        difficulty: difficulty as Difficulty,
        bestOf,
      });
      socket.emit('queue-joined', { difficulty, bestOf });
      tryMatchAndCreate();
    });

    socket.on('queue-leave', () => {
      if (ctx.token) queue.remove(ctx.token);
      socket.emit('queue-left', {});
    });

    socket.on('start-game', (payload: unknown) => {
      const room = findRoom((payload as Record<string, unknown> | null)?.roomCode);
      if (!room) return err('room_not_found');
      if (!ctx.token) return err('not_in_room');
      const result = R.startMatch(room, ctx.token);
      if (!result.ok) return err(result.error);
      emitGameStarted(room);
      broadcastUpdate(room);
    });

    socket.on('player-ready', (payload: unknown) => {
      const room = findRoom((payload as Record<string, unknown> | null)?.roomCode);
      if (!room) return err('room_not_found');
      if (!ctx.token) return err('not_in_room');
      const result = R.markReady(room, ctx.token);
      if (!result.ok) return err(result.error);
      if (result.value.nextRoundStarted) emitGameStarted(room);
      broadcastUpdate(room);
    });

    socket.on('submit-guess', (payload: unknown) => {
      const { roomCode, birdId, conservation } = (payload ?? {}) as Record<string, unknown>;
      const room = findRoom(roomCode);
      if (!room) return err('room_not_found');
      if (!ctx.token) return err('not_in_room');
      if (typeof birdId !== 'number' || !Number.isInteger(birdId)) return err('bird_not_found');
      // 保护等级体系按猜测者自己的选择判定；缺省 iucn
      const system = conservation === undefined ? 'iucn' : conservation;
      if (!CONSERVATIONS.includes(system as ConservationSystem)) return err('invalid_payload');
      const result = R.submitGuess(room, ctx.token, birdId, system as ConservationSystem);
      if (!result.ok) return err(result.error);
      const { row, roundEnded, roundWinner, matchEnded } = result.value;
      const count = room.round?.guesses[ctx.token]?.length ?? 0;
      // 本人收全量行，其他人收脱敏行
      socket.emit('new-guess', { token: ctx.token, row, count });
      socket.to(room.code).emit('new-guess', { token: ctx.token, row: R.redactRow(row, Date.now()), count });
      if (roundEnded) emitRoundEnd(room, roundWinner === 'draw' ? 'draw' : 'won');
      if (matchEnded) emitMatchEnd(room, 'score');
      broadcastUpdate(room);
    });

    socket.on('request-reconnect', (payload: unknown) => {
      const { roomCode, playerToken } = (payload ?? {}) as Record<string, unknown>;
      const room = findRoom(roomCode);
      if (!room || typeof playerToken !== 'string') return err('reconnect_failed');
      const result = R.reconnect(room, playerToken, socket.id);
      if (!result.ok) return err(result.error);
      ctx.code = room.code;
      ctx.token = playerToken;
      void socket.join(room.code);
      const myGuesses =
        result.value.role === 'player' && room.round ? (room.round.guesses[playerToken] ?? []) : [];
      socket.emit('reconnect-success', {
        room: R.roomPublic(room),
        myGuesses,
        self: { token: playerToken, role: result.value.role },
      });
      socket.to(room.code).emit('player-joined', {
        player: { token: playerToken, name: nameOf(room, playerToken) },
        role: result.value.role,
        reconnected: true,
      });
      broadcastUpdate(room);
    });

    socket.on('leave-room', () => {
      const room = findRoom(undefined);
      if (!room || !ctx.token) return;
      if (room.status === 'playing') {
        const { matchEndedByForfeit } = R.forfeit(room, ctx.token);
        socket.to(room.code).emit('player-left', { token: ctx.token, reason: 'forfeit' });
        if (matchEndedByForfeit) emitMatchEnd(room, 'forfeit');
      } else {
        R.handleDisconnect(room, ctx.token);
        socket.to(room.code).emit('player-left', { token: ctx.token, reason: 'left' });
      }
      broadcastUpdate(room);
      void socket.leave(room.code);
      ctx.code = undefined;
      ctx.token = undefined;
    });

    socket.on('disconnect', () => {
      queue.removeBySocket(socket.id);
      contexts.delete(socket.id);
      if (!ctx.code || !ctx.token) return;
      const room = store.get(ctx.code);
      if (!room) return;
      const { removed } = R.handleDisconnect(room, ctx.token);
      io.to(room.code).emit('player-left', {
        token: ctx.token,
        reason: removed ? 'left' : 'disconnected',
      });
      broadcastUpdate(room);
    });
  });

  const sweepTimer = setInterval(() => {
    for (const ev of R.sweepRooms(store, Date.now())) {
      if (ev.type === 'forfeit' && ev.token) {
        const room = store.get(ev.code);
        io.to(ev.code).emit('player-left', { token: ev.token, reason: 'forfeit' });
        if (room) {
          if (room.status === 'ended' && room.matchWinner) emitMatchEnd(room, 'forfeit');
          broadcastUpdate(room);
        }
      } else if (ev.type === 'round_timeout') {
        const room = store.get(ev.code);
        if (room?.round) {
          emitRoundEnd(room, 'timeout');
          broadcastUpdate(room);
        }
      }
      // room_destroyed 无需广播（房间里已无人）
    }
    tryMatchAndCreate();
  }, opts.sweepIntervalMs ?? 5000);
  sweepTimer.unref();

  return () => clearInterval(sweepTimer);
}
