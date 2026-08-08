import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server as IoServer } from 'socket.io';
import { io as ioc, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { attachGateway } from './gateway.js';
import { MatchQueue } from './match.js';
import { sweepRooms } from './room.js';
import { MemoryRoomStore } from './store.js';
import type { RoomPublic } from './types.js';

let httpServer: HttpServer;
let io: IoServer;
let store: MemoryRoomStore;
let queue: MatchQueue;
let cleanup: () => void;
let port: number;

function client(): Socket {
  return ioc(`http://localhost:${port}`, { transports: ['websocket'] });
}

function waitFor<T>(socket: Socket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting "${event}"`)), timeoutMs);
    socket.once(event as never, ((data: T) => {
      clearTimeout(timer);
      resolve(data);
    }) as never);
  });
}

function connected(socket: Socket): Promise<void> {
  return new Promise((resolve) => socket.on('connect', () => resolve()));
}

/** 当前轮次的答案 id（测试直接从内存 store 读，保证确定性） */
function answerId(roomCode: string): number {
  return store.get(roomCode)!.round!.answerId;
}

/** 一个不等于答案的 easy 池鸟 id（easy 池为 id 1-100） */
function wrongId(code: string, ...exclude: number[]): number {
  const ans = answerId(code);
  for (let id = 1; id <= 100; id++) {
    if (id !== ans && !exclude.includes(id)) return id;
  }
  throw new Error('no wrong id');
}

const T1 = 'player-token-0001';
const T2 = 'player-token-0002';
const T3 = 'player-token-0003';

beforeAll(async () => {
  httpServer = createServer();
  io = new IoServer(httpServer);
  store = new MemoryRoomStore();
  queue = new MatchQueue();
  cleanup = attachGateway(io, { store, queue, sweepIntervalMs: 50 });
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  port = (httpServer.address() as AddressInfo).port;
});

afterAll(async () => {
  cleanup();
  io.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

describe('多人对战流程', () => {
  it('建房→加入→观战→开局→猜测→BO3 整场', async () => {
    const s1 = client();
    await connected(s1);

    // 建房
    const created = waitFor<{ roomCode: string; room: RoomPublic }>(s1, 'room-created');
    s1.emit('create-room', {
      playerName: '房主',
      token: T1,
      difficulty: 'easy',
      bestOf: 3,
    });
    const { roomCode, room } = await created;
    expect(roomCode).toMatch(/^[A-Z2-9]{5}$/);
    expect(room.players[0].isHost).toBe(true);

    // 非法 payload
    const badCreate = waitFor<{ code: string }>(s1, 'error');
    s1.emit('create-room', { playerName: 'x', token: 'bad', difficulty: 'easy', bestOf: 3 });
    expect((await badCreate).code).toBe('invalid_payload');

    // 第二人加入
    const s2 = client();
    await connected(s2);
    const joinedNotice = waitFor<{ player: { token: string }; role: string }>(s1, 'player-joined');
    s2.emit('join-room', { roomCode, playerName: '挑战者', token: T2 });
    expect((await joinedNotice).role).toBe('player');

    // 第三人 → 观战
    const s3 = client();
    await connected(s3);
    const spectate = waitFor<{ self: { role: string } }>(s3, 'room-update');
    s3.emit('join-room', { roomCode, playerName: '围观', token: T3 });
    expect((await spectate).self.role).toBe('spectator');

    // 不存在的房间
    const sX = client();
    await connected(sX);
    const noRoom = waitFor<{ code: string }>(sX, 'error');
    sX.emit('join-room', { roomCode: 'XXXXX', playerName: '路人', token: 'player-token-0009' });
    expect((await noRoom).code).toBe('room_not_found');
    sX.close();

    // 非房主用旧 start-game 事件 → not_host（该事件保留但客户端已不再使用）
    const notHost = waitFor<{ code: string }>(s2, 'error');
    s2.emit('start-game', { roomCode });
    expect((await notHost).code).toBe('not_host');

    // 双方都准备 → 自动开局，玩家和观战者都收到 game-started
    const started2 = waitFor<{ roundNumber: number }>(s2, 'game-started');
    const started3 = waitFor<{ roundNumber: number }>(s3, 'game-started');
    s1.emit('player-ready', { roomCode });
    s2.emit('player-ready', { roomCode });
    expect((await started2).roundNumber).toBe(1);
    expect((await started3).roundNumber).toBe(1);

    // 观战者不能猜
    const specGuess = waitFor<{ code: string }>(s3, 'error');
    s3.emit('submit-guess', { roomCode, birdId: 1 });
    expect((await specGuess).code).toBe('not_in_room');

    // p2 猜错（自带 china 体系）：本人收全量（带鸟名、国保中文等级），对手/观战者收脱敏版（无鸟名）
    const w1 = wrongId(roomCode);
    const selfGuess = waitFor<{ row: { bird: { name: string }; cells: { conservation: { value: string } } } }>(s2, 'new-guess');
    const peerGuess = waitFor<{ row: { bird?: unknown; cells: Record<string, { feedback: string }> } }>(s1, 'new-guess');
    const specView = waitFor<{ row: { bird?: unknown } }>(s3, 'new-guess');
    s2.emit('submit-guess', { roomCode, birdId: w1, conservation: 'china' });
    const selfRow = (await selfGuess).row;
    expect(selfRow.bird.name).toBeTruthy();
    expect(['国家一级', '国家二级', '三有', '未列入']).toContain(selfRow.cells.conservation.value);
    expect((await peerGuess).row.bird).toBeUndefined();
    expect((await specView).row.bird).toBeUndefined();

    // 重复猜 / 池外鸟
    const dup = waitFor<{ code: string }>(s2, 'error');
    s2.emit('submit-guess', { roomCode, birdId: w1, conservation: 'china' });
    expect((await dup).code).toBe('duplicate_guess');
    const outPool = waitFor<{ code: string }>(s2, 'error');
    s2.emit('submit-guess', { roomCode, birdId: 425 }); // 彩鹮，hard 池
    expect((await outPool).code).toBe('not_in_pool');

    // 第 1 局：p2 猜中 → round-end，答案公布
    const round1End = waitFor<{ winner: string; winnerName: string; answer: { name: string }; roundWins: Record<string, number> }>(s1, 'round-end');
    s2.emit('submit-guess', { roomCode, birdId: answerId(roomCode) });
    const r1 = await round1End;
    expect(r1.winner).toBe(T2);
    expect(r1.winnerName).toBe('挑战者');
    expect(r1.answer.name).toBeTruthy();
    expect(r1.roundWins[T2]).toBe(1);

    // 局后不能继续猜
    const afterRound = waitFor<{ code: string }>(s1, 'error');
    s1.emit('submit-guess', { roomCode, birdId: wrongId(roomCode) });
    expect((await afterRound).code).toBe('round_over');

    // 双方 ready → 第 2 局（答案不重复）
    const ans1 = answerId(roomCode);
    const round2Start = waitFor<{ roundNumber: number }>(s1, 'game-started');
    s1.emit('player-ready', { roomCode });
    s2.emit('player-ready', { roomCode });
    expect((await round2Start).roundNumber).toBe(2);
    expect(answerId(roomCode)).not.toBe(ans1);

    // 第 2 局：p1 猜中，1-1
    const round2End = waitFor<{ winner: string }>(s1, 'round-end');
    s1.emit('submit-guess', { roomCode, birdId: answerId(roomCode) });
    expect((await round2End).winner).toBe(T1);

    // 第 3 局：p2 再胜 → BO3 整场结束
    const round3Start = waitFor<{ roundNumber: number }>(s1, 'game-started');
    s1.emit('player-ready', { roomCode });
    s2.emit('player-ready', { roomCode });
    await round3Start;
    const matchEnd = waitFor<{ winner: string; winnerName: string; reason: string }>(s1, 'match-end');
    const matchEndSpec = waitFor<{ winner: string }>(s3, 'match-end');
    s2.emit('submit-guess', { roomCode, birdId: answerId(roomCode) });
    const me = await matchEnd;
    expect(me.winner).toBe(T2);
    expect(me.reason).toBe('score');
    expect((await matchEndSpec).winner).toBe(T2);

    // 整场结束后再猜 → not_playing
    const afterMatch = waitFor<{ code: string }>(s2, 'error');
    s2.emit('submit-guess', { roomCode, birdId: 1 });
    expect((await afterMatch).code).toBe('not_playing');

    s1.close();
    s2.close();
    s3.close();
  }, 20000);

  it('双方 8 次未中 → 流局 draw，不加分', async () => {
    const s1 = client();
    await connected(s1);
    const created = waitFor<{ roomCode: string }>(s1, 'room-created');
    s1.emit('create-room', { playerName: 'A', token: T1, difficulty: 'easy', bestOf: 3 });
    const { roomCode } = await created;
    const s2 = client();
    await connected(s2);
    s2.emit('join-room', { roomCode, playerName: 'B', token: T2 });
    await waitFor(s1, 'player-joined');
    s1.emit('start-game', { roomCode });
    await waitFor(s1, 'game-started');

    const roundEnd = waitFor<{ winner: string; roundWins: Record<string, number> }>(s1, 'round-end');
    // 双方各猜 8 只非答案鸟
    for (const [s] of [[s1], [s2]] as const) {
      const used: number[] = [];
      for (let i = 0; i < 8; i++) {
        const id = wrongId(roomCode, ...used);
        used.push(id);
        s.emit('submit-guess', { roomCode, birdId: id });
        await new Promise((r) => setTimeout(r, 20));
      }
    }
    const re = await roundEnd;
    expect(re.winner).toBe('draw');
    expect(Object.values(re.roundWins).every((n) => n === 0)).toBe(true);

    s1.close();
    s2.close();
  }, 15000);

  it('断线重连恢复 + 断线超时判负', async () => {
    const s1 = client();
    await connected(s1);
    const created = waitFor<{ roomCode: string }>(s1, 'room-created');
    s1.emit('create-room', { playerName: 'A', token: T1, difficulty: 'hard', bestOf: 5 });
    const { roomCode } = await created;

    const s2 = client();
    await connected(s2);
    s2.emit('join-room', { roomCode, playerName: 'B', token: T2 });
    await waitFor(s1, 'player-joined');
    s1.emit('start-game', { roomCode });
    await waitFor(s1, 'game-started');

    // B 猜一次后断线
    const guessed = waitFor(s2, 'new-guess');
    s2.emit('submit-guess', { roomCode, birdId: 201 });
    await guessed;
    const disc1 = waitFor<{ token: string; reason: string }>(s1, 'player-left');
    s2.disconnect();
    expect((await disc1).reason).toBe('disconnected');

    // 30 秒内重连 → 恢复身份与猜测历史
    const s2b = client();
    await connected(s2b);
    const reconnected = waitFor<{ self: { role: string }; myGuesses: unknown[] }>(s2b, 'reconnect-success');
    s2b.emit('request-reconnect', { roomCode, playerToken: T2 });
    const rc = await reconnected;
    expect(rc.self.role).toBe('player');
    expect(rc.myGuesses).toHaveLength(1);

    // 错误 token 重连 → reconnect_failed
    const sX = client();
    await connected(sX);
    const fail = waitFor<{ code: string }>(sX, 'error');
    sX.emit('request-reconnect', { roomCode, playerToken: 'player-token-9999' });
    expect((await fail).code).toBe('reconnect_failed');
    sX.close();

    // B 再次断线：先等 disconnected 广播，再把时间戳改到 31 秒前，等 sweep 判负
    const disc2 = waitFor<{ reason: string }>(s1, 'player-left');
    s2b.disconnect();
    expect((await disc2).reason).toBe('disconnected');
    const room = store.get(roomCode)!;
    room.players.find((x) => x.token === T2)!.disconnectedAt = Date.now() - 31_000;
    const forfeitNotice = waitFor<{ token: string; reason: string }>(s1, 'player-left');
    const matchEndNotice = waitFor<{ reason: string; winner: string }>(s1, 'match-end');
    expect((await forfeitNotice).reason).toBe('forfeit');
    const me = await matchEndNotice;
    expect(me.reason).toBe('forfeit');
    expect(me.winner).toBe(T1);

    s1.close();
  }, 15000);

  it('局超时 2 分钟 → 流局公布答案，可开下一局', async () => {
    const s1 = client();
    await connected(s1);
    const created = waitFor<{ roomCode: string }>(s1, 'room-created');
    s1.emit('create-room', { playerName: 'A', token: T1, difficulty: 'easy', bestOf: 3 });
    const { roomCode } = await created;
    const s2 = client();
    await connected(s2);
    s2.emit('join-room', { roomCode, playerName: 'B', token: T2 });
    await waitFor(s1, 'player-joined');
    const started = waitFor<{ deadline: number; serverNow: number }>(s1, 'game-started');
    s1.emit('player-ready', { roomCode });
    s2.emit('player-ready', { roomCode });
    const st = await started;
    expect(st.deadline).toBeGreaterThan(st.serverNow);

    // 把局开始时间拨到 121 秒前，等 sweep 判定超时流局
    store.get(roomCode)!.round!.startedAt = Date.now() - 121_000;
    const roundEnd = waitFor<{ winner: string; reason: string; answer: { name: string } }>(s1, 'round-end');
    const re = await roundEnd;
    expect(re.winner).toBe('draw');
    expect(re.reason).toBe('timeout');
    expect(re.answer.name).toBeTruthy();

    // 双方 ready → 下一局正常开始
    const next = waitFor<{ roundNumber: number }>(s1, 'game-started');
    s1.emit('player-ready', { roomCode });
    s2.emit('player-ready', { roomCode });
    expect((await next).roundNumber).toBe(2);

    s1.close();
    s2.close();
  }, 15000);

  it('匹配：同偏好自动配对建房；不同偏好等放宽后配对', async () => {
    // 同偏好配对
    const s1 = client();
    await connected(s1);
    const q1 = waitFor(s1, 'queue-joined');
    s1.emit('queue-join', { playerName: '甲', token: T1, difficulty: 'easy', bestOf: 3 });
    await q1;

    const s2 = client();
    await connected(s2);
    const m1 = waitFor<{ roomCode: string; self: { role: string } }>(s1, 'match-found');
    const m2 = waitFor<{ roomCode: string; self: { role: string } }>(s2, 'match-found');
    s2.emit('queue-join', { playerName: '乙', token: T2, difficulty: 'easy', bestOf: 3 });
    const [r1, r2] = await Promise.all([m1, m2]);
    expect(r1.roomCode).toBe(r2.roomCode);
    expect(r1.self.role).toBe('player');
    const room = store.get(r1.roomCode)!;
    expect(room.players).toHaveLength(2);
    expect(room.config).toMatchObject({ difficulty: 'easy', bestOf: 3 });

    // 匹配建房后可以直接 ready 开局
    const started = waitFor(s1, 'game-started');
    s1.emit('player-ready', { roomCode: r1.roomCode });
    s2.emit('player-ready', { roomCode: r1.roomCode });
    await started;
    s1.close();
    s2.close();

    // 不同偏好：不能立即配对；把等待时长拨过 30 秒放宽线后由 sweep 配对
    const s3 = client();
    await connected(s3);
    s3.emit('queue-join', { playerName: '丙', token: T3, difficulty: 'hard', bestOf: 5 });
    await waitFor(s3, 'queue-joined');
    const s4 = client();
    await connected(s4);
    s4.emit('queue-join', { playerName: '丁', token: 'player-token-0004', difficulty: 'easy', bestOf: 3 });
    await waitFor(s4, 'queue-joined');
    // 先挂监听（只挂一次，避免遗留 once 监听器吃掉事件）
    const m3 = waitFor<{ roomCode: string }>(s3, 'match-found', 5000);
    const m4 = waitFor<{ roomCode: string }>(s4, 'match-found', 5000);
    let matchedEarly = false;
    void Promise.race([m3, m4]).then(() => (matchedEarly = true));
    await new Promise((r) => setTimeout(r, 450));
    expect(matchedEarly).toBe(false);
    // 拨过放宽线
    for (const e of queue.entries.values()) e.joinedAt = Date.now() - 31_000;
    const [r3, r4] = await Promise.all([m3, m4]);
    expect(r3.roomCode).toBe(r4.roomCode);
    s3.close();
    s4.close();
  }, 15000);

  it('sweepRooms：全员离开 5 分钟后销毁房间', () => {
    const room = [...store.values()][0];
    expect(room).toBeDefined();
    for (const p of room.players) {
      p.connected = false;
      p.disconnectedAt = Date.now() - 31_000;
    }
    room.spectators.splice(0);
    room.emptySince = Date.now() - 6 * 60_000;
    const events = sweepRooms(store, Date.now());
    expect(events.some((e) => e.type === 'room_destroyed' && e.code === room.code)).toBe(true);
    expect(store.get(room.code)).toBeUndefined();
  });
});
