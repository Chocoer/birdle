import type { Server, Socket } from 'socket.io';
import { getBird } from '../data/birds.js';
import { MAX_GUESSES } from '../game/session.js';
import type { ConservationSystem, Difficulty } from '../types.js';
import { createMatchQueue, type MatchQueueStore } from './match.js';
import * as R from './room.js';
import { createRoomStore, type RoomStore } from './store.js';
import type { Room } from './types.js';

const TOKEN_RE = /^[A-Za-z0-9-]{8,64}$/;
const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];
const CONSERVATIONS: ConservationSystem[] = ['iucn', 'china'];

export interface GatewayOptions {
  store?: RoomStore;
  queue?: MatchQueueStore;
  /** 默认 5000ms；测试可缩短 */
  sweepIntervalMs?: number;
}

function validName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 16;
}

function codeOf(value: unknown): string | undefined {
  return typeof value === 'string' ? value.toUpperCase() : undefined;
}

function tokenOf(room: Room, socketId: string): string | undefined {
  return (
    room.players.find((player) => player.socketId === socketId)?.token ??
    room.spectators.find((spectator) => spectator.socketId === socketId)?.token
  );
}

function nameOf(room: Room, token: string | null): string | null {
  if (token == null) return null;
  return (
    room.players.find((player) => player.token === token)?.name ??
    room.spectators.find((spectator) => spectator.token === token)?.name ??
    null
  );
}

/** 把多人对战网关挂到 Socket.IO；房间码和 socketId 是跨实例恢复身份的唯一依据。 */
export function attachGateway(io: Server, opts: GatewayOptions = {}): () => void {
  const store = opts.store ?? createRoomStore();
  const queue = opts.queue ?? createMatchQueue();

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

  const fail = (socket: Socket, error: unknown) => {
    console.error('[birdle] 联机事件处理失败', error);
    socket.emit('error', { code: 'server_unavailable' satisfies R.MpError });
  };

  /** 尝试原子出队两人，并通过 Redis Adapter 把跨实例 socket 拉进同一房间。 */
  const tryMatchAndCreate = async () => {
    const pair = await queue.tryMatch(Date.now());
    if (!pair) return;
    const [first, second] = pair;
    const [firstSockets, secondSockets] = await Promise.all([
      io.in(first.socketId).fetchSockets(),
      io.in(second.socketId).fetchSockets(),
    ]);
    if (firstSockets.length === 0 || secondSockets.length === 0) {
      if (firstSockets.length > 0) await queue.add(first);
      if (secondSockets.length > 0) await queue.add(second);
      return;
    }

    const created = await store.create({
      token: first.token,
      name: first.name,
      socketId: first.socketId,
      config: { difficulty: first.difficulty, bestOf: first.bestOf },
    });
    const joined = await store.update(created.code, (room) =>
      R.joinRoom(room, {
        token: second.token,
        name: second.name,
        socketId: second.socketId,
      }),
    );
    if (!joined) throw new Error(`matched_room_missing:${created.code}`);
    const room = joined.room;
    await Promise.all([
      io.in(first.socketId).socketsJoin(room.code),
      io.in(second.socketId).socketsJoin(room.code),
    ]);
    for (const entry of [first, second]) {
      io.to(entry.socketId).emit('match-found', {
        roomCode: room.code,
        room: R.roomPublic(room),
        self: { token: entry.token, role: 'player' },
      });
    }
  };

  io.on('connection', (socket: Socket) => {
    const err = (code: R.MpError) => socket.emit('error', { code });

    socket.on('create-room', (payload: unknown) => {
      void (async () => {
        const { playerName, token, difficulty, bestOf } = (payload ?? {}) as Record<string, unknown>;
        if (!validName(playerName) || typeof token !== 'string' || !TOKEN_RE.test(token)) {
          return err('invalid_payload');
        }
        if (!DIFFICULTIES.includes(difficulty as Difficulty)) return err('invalid_payload');
        if (bestOf !== 3 && bestOf !== 5) return err('invalid_payload');
        const room = await store.create({
          token,
          name: playerName.trim(),
          socketId: socket.id,
          config: { difficulty: difficulty as Difficulty, bestOf },
        });
        await socket.join(room.code);
        socket.emit('room-created', { roomCode: room.code, room: R.roomPublic(room) });
      })().catch((error) => fail(socket, error));
    });

    socket.on('join-room', (payload: unknown) => {
      void (async () => {
        const { roomCode, playerName, token } = (payload ?? {}) as Record<string, unknown>;
        if (!validName(playerName) || typeof token !== 'string' || !TOKEN_RE.test(token)) {
          return err('invalid_payload');
        }
        const code = codeOf(roomCode);
        if (!code) return err('room_not_found');
        const updated = await store.update(code, (room) =>
          R.joinRoom(room, { token, name: playerName.trim(), socketId: socket.id }),
        );
        if (!updated) return err('room_not_found');
        await socket.join(updated.room.code);
        socket.emit('room-update', {
          room: R.roomPublic(updated.room),
          self: { token, role: updated.value },
        });
        socket.to(updated.room.code).emit('player-joined', {
          player: { token, name: playerName.trim() },
          role: updated.value,
        });
        broadcastUpdate(updated.room);
      })().catch((error) => fail(socket, error));
    });

    socket.on('queue-join', (payload: unknown) => {
      void (async () => {
        const { playerName, token, difficulty, bestOf } = (payload ?? {}) as Record<string, unknown>;
        if (!validName(playerName) || typeof token !== 'string' || !TOKEN_RE.test(token)) {
          return err('invalid_payload');
        }
        if (!DIFFICULTIES.includes(difficulty as Difficulty)) return err('invalid_payload');
        if (bestOf !== 3 && bestOf !== 5) return err('invalid_payload');
        await queue.add({
          token,
          name: playerName.trim(),
          socketId: socket.id,
          difficulty: difficulty as Difficulty,
          bestOf,
        });
        socket.emit('queue-joined', { difficulty, bestOf });
        await tryMatchAndCreate();
      })().catch((error) => fail(socket, error));
    });

    socket.on('queue-leave', () => {
      void (async () => {
        await queue.removeBySocket(socket.id);
        socket.emit('queue-left', {});
      })().catch((error) => fail(socket, error));
    });

    socket.on('start-game', (payload: unknown) => {
      void (async () => {
        const code = codeOf((payload as Record<string, unknown> | null)?.roomCode);
        if (!code) return err('room_not_found');
        const updated = await store.update(code, (room) => {
          const token = tokenOf(room, socket.id);
          return token ? R.startMatch(room, token) : ({ ok: false, error: 'not_in_room' } as const);
        });
        if (!updated) return err('room_not_found');
        if (!updated.value.ok) return err(updated.value.error);
        emitGameStarted(updated.room);
        broadcastUpdate(updated.room);
      })().catch((error) => fail(socket, error));
    });

    socket.on('player-ready', (payload: unknown) => {
      void (async () => {
        const code = codeOf((payload as Record<string, unknown> | null)?.roomCode);
        if (!code) return err('room_not_found');
        const updated = await store.update(code, (room) => {
          const token = tokenOf(room, socket.id);
          return token ? R.markReady(room, token) : ({ ok: false, error: 'not_in_room' } as const);
        });
        if (!updated) return err('room_not_found');
        if (!updated.value.ok) return err(updated.value.error);
        if (updated.value.value.nextRoundStarted) emitGameStarted(updated.room);
        broadcastUpdate(updated.room);
      })().catch((error) => fail(socket, error));
    });

    socket.on('submit-guess', (payload: unknown) => {
      void (async () => {
        const { roomCode, birdId, conservation } = (payload ?? {}) as Record<string, unknown>;
        const code = codeOf(roomCode);
        if (!code) return err('room_not_found');
        if (typeof birdId !== 'number' || !Number.isInteger(birdId)) return err('bird_not_found');
        const system = conservation ?? 'iucn';
        if (!CONSERVATIONS.includes(system as ConservationSystem)) return err('invalid_payload');
        const updated = await store.update(code, (room) => {
          const token = tokenOf(room, socket.id);
          if (!token) return { token: null, result: { ok: false, error: 'not_in_room' } as const };
          return {
            token,
            result: R.submitGuess(room, token, birdId, system as ConservationSystem),
          };
        });
        if (!updated) return err('room_not_found');
        const { token, result } = updated.value;
        if (!result.ok) return err(result.error);
        const { row, roundEnded, roundWinner, matchEnded } = result.value;
        const count = updated.room.round?.guesses[token!]?.length ?? 0;
        socket.emit('new-guess', { token, row, count });
        socket.to(updated.room.code).emit('new-guess', {
          token,
          row: R.redactRow(row, Date.now()),
          count,
        });
        if (roundEnded) emitRoundEnd(updated.room, roundWinner === 'draw' ? 'draw' : 'won');
        if (matchEnded) emitMatchEnd(updated.room, 'score');
        broadcastUpdate(updated.room);
      })().catch((error) => fail(socket, error));
    });

    socket.on('request-reconnect', (payload: unknown) => {
      void (async () => {
        const { roomCode, playerToken } = (payload ?? {}) as Record<string, unknown>;
        const code = codeOf(roomCode);
        if (!code || typeof playerToken !== 'string') return err('reconnect_failed');
        const updated = await store.update(code, (room) =>
          R.reconnect(room, playerToken, socket.id),
        );
        if (!updated || !updated.value.ok) return err('reconnect_failed');
        await socket.join(updated.room.code);
        const myGuesses =
          updated.value.value.role === 'player' && updated.room.round
            ? (updated.room.round.guesses[playerToken] ?? [])
            : [];
        socket.emit('reconnect-success', {
          room: R.roomPublic(updated.room),
          myGuesses,
          self: { token: playerToken, role: updated.value.value.role },
        });
        socket.to(updated.room.code).emit('player-joined', {
          player: { token: playerToken, name: nameOf(updated.room, playerToken) },
          role: updated.value.value.role,
          reconnected: true,
        });
        broadcastUpdate(updated.room);
      })().catch((error) => fail(socket, error));
    });

    socket.on('leave-room', (payload: unknown) => {
      void (async () => {
        const code = codeOf((payload as Record<string, unknown> | null)?.roomCode);
        if (!code) return;
        const updated = await store.update(code, (room) => {
          const token = tokenOf(room, socket.id);
          if (!token) return { token: null, reason: 'left' as const, matchEnded: false };
          if (room.status === 'playing') {
            return {
              token,
              reason: 'forfeit' as const,
              matchEnded: R.forfeit(room, token).matchEndedByForfeit,
            };
          }
          R.handleDisconnect(room, token);
          return { token, reason: 'left' as const, matchEnded: false };
        });
        if (!updated?.value.token) return;
        socket.to(updated.room.code).emit('player-left', {
          token: updated.value.token,
          reason: updated.value.reason,
        });
        if (updated.value.matchEnded) emitMatchEnd(updated.room, 'forfeit');
        broadcastUpdate(updated.room);
        await socket.leave(updated.room.code);
      })().catch((error) => fail(socket, error));
    });

    socket.on('disconnect', () => {
      void (async () => {
        await queue.removeBySocket(socket.id);
        const room = (await store.values()).find((candidate) => tokenOf(candidate, socket.id));
        if (!room) return;
        const updated = await store.update(room.code, (current) => {
          const token = tokenOf(current, socket.id);
          return token ? { token, ...R.handleDisconnect(current, token) } : null;
        });
        if (!updated?.value) return;
        io.to(updated.room.code).emit('player-left', {
          token: updated.value.token,
          reason: updated.value.removed ? 'left' : 'disconnected',
        });
        broadcastUpdate(updated.room);
      })().catch((error) => console.error('[birdle] 断线清理失败', error));
    });
  });

  /** 周期性处理超时、断线判负、空房间销毁和放宽匹配。 */
  const sweep = async () => {
    const now = Date.now();
    for (const snapshot of await store.values()) {
      const updated = await store.update(snapshot.code, (room) => R.sweepRoom(room, now));
      if (!updated) continue;
      if (updated.value.destroy) await store.delete(updated.room.code);
      for (const event of updated.value.events) {
        if (event.type === 'forfeit' && event.token) {
          io.to(event.code).emit('player-left', { token: event.token, reason: 'forfeit' });
          if (updated.room.status === 'ended' && updated.room.matchWinner) {
            emitMatchEnd(updated.room, 'forfeit');
          }
          broadcastUpdate(updated.room);
        } else if (event.type === 'round_timeout' && updated.room.round) {
          emitRoundEnd(updated.room, 'timeout');
          broadcastUpdate(updated.room);
        }
      }
    }
    await tryMatchAndCreate();
  };

  const sweepTimer = setInterval(() => {
    void sweep().catch((error) => console.error('[birdle] 联机状态清扫失败', error));
  }, opts.sweepIntervalMs ?? 5000);
  sweepTimer.unref();

  return () => clearInterval(sweepTimer);
}
