import { create } from 'zustand';
import { getSocket } from './socket';
import { useStore } from './store';
import type { Bird, Difficulty, Direction, Feedback, GuessRow } from './types';

const MP_ROOM_KEY = 'birdle-mp-room';
export const MP_NAME_KEY = 'birdle-mp-name';
const FLIP_DURATION_MS = 10 * 120 + 600;

export type MpRole = 'player' | 'spectator';
export type MpPhase = 'idle' | 'waiting' | 'playing' | 'roundEnd' | 'matchEnd';

export interface MpPlayer {
  token: string;
  name: string;
  connected: boolean;
  ready: boolean;
  isHost: boolean;
}

export interface RedactedCell {
  feedback: Feedback;
  direction?: Direction;
}

export interface RedactedRow {
  cells: Record<string, RedactedCell>;
  at: number;
}

export interface RoomPublic {
  code: string;
  status: 'waiting' | 'playing' | 'ended';
  config: { difficulty: Difficulty; bestOf: 3 | 5 };
  players: MpPlayer[];
  spectators: { token: string; name: string }[];
  roundNumber: number;
  roundWins: Record<string, number>;
  matchWinner: string | null;
  roundProgress: Record<string, { count: number; done?: 'won' | 'out' }> | null;
  redactedGuesses: Record<string, RedactedRow[]>;
  roundDeadline: number | null;
  lastAnswer: Bird | null;
}

export interface RoundResult {
  roundNumber: number;
  winner: string;
  winnerName: string;
  reason?: 'won' | 'draw' | 'timeout';
  answer: Bird;
  roundWins: Record<string, number>;
}

export interface MatchResult {
  winner: string;
  winnerName: string;
  roundWins: Record<string, number>;
  reason: 'score' | 'forfeit';
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_payload: '请求参数有误',
  room_not_found: '房间不存在',
  not_host: '只有房主可以操作',
  not_in_room: '你不在该房间中',
  already_playing: '对局已在进行中',
  not_playing: '对局尚未开始',
  round_over: '本局已结束',
  duplicate_guess: '已经猜过这只鸟了',
  not_in_pool: '这只鸟不在当前难度范围内',
  bird_not_found: '没有找到这种鸟',
  reconnect_failed: '恢复房间失败，房间可能已解散',
  need_two_players: '需要两名玩家才能开始',
  server_unavailable: '联机服务暂时不可用，请稍后重试',
};

interface MpStore {
  connected: boolean;
  room: RoomPublic | null;
  selfRole: MpRole | null;
  myGuesses: GuessRow[];
  /** 其他玩家的脱敏猜测（new-guess 累积，room-update 全量覆盖） */
  redacted: Record<string, RedactedRow[]>;
  animatingRow: number;
  roundResult: RoundResult | null;
  matchResult: MatchResult | null;
  /** 当前局截止时间戳（服务端毫秒），无局为 null */
  roundDeadline: number | null;
  /** 服务端-客户端时钟偏移（用于倒计时校准） */
  clockOffset: number;
  /** 匹配队列状态 */
  queueStatus: 'idle' | 'queued';
  init: () => void;
  createRoom: (opts: {
    playerName: string;
    difficulty: Difficulty;
    bestOf: 3 | 5;
  }) => void;
  joinRoom: (roomCode: string, playerName: string) => void;
  joinQueue: (opts: { playerName: string; difficulty: Difficulty; bestOf: 3 | 5 }) => void;
  leaveQueue: () => void;
  startGame: () => void;
  ready: () => void;
  submitGuess: (birdId: number) => void;
  leaveRoom: () => void;
}

export function getPhase(s: Pick<MpStore, 'room' | 'roundResult' | 'matchResult'>): MpPhase {
  if (!s.room) return 'idle';
  if (s.matchResult) return 'matchEnd';
  if (s.roundResult) return 'roundEnd';
  return s.room.status === 'playing' ? 'playing' : 'waiting';
}

let initialized = false;
let flipTimer: ReturnType<typeof setTimeout> | undefined;

function toast(message: string) {
  useStore.getState().showToast(message);
}

function selfToken(): string {
  return useStore.getState().guestId;
}

function rememberRoom(code: string) {
  localStorage.setItem(MP_ROOM_KEY, code);
}

function forgetRoom() {
  localStorage.removeItem(MP_ROOM_KEY);
}

export const useMpStore = create<MpStore>((set, get) => ({
  connected: false,
  room: null,
  selfRole: null,
  myGuesses: [],
  redacted: {},
  animatingRow: -1,
  roundResult: null,
  matchResult: null,
  roundDeadline: null,
  clockOffset: 0,
  queueStatus: 'idle',

  init: () => {
    if (initialized) return;
    initialized = true;
    const socket = getSocket();

    socket.on('connect', () => {
      set({ connected: true });
      const saved = localStorage.getItem(MP_ROOM_KEY);
      const { room } = get();
      if (saved && room?.code !== saved) {
        socket.emit('request-reconnect', { roomCode: saved, playerToken: selfToken() });
      }
    });

    socket.on('disconnect', () => set({ connected: false }));

    socket.on('room-created', (p: { roomCode: string; room: RoomPublic }) => {
      rememberRoom(p.roomCode);
      // 防御性清理：避免上一场对局的结算状态污染新房间的 phase 判定
      set({ room: p.room, selfRole: 'player', roundResult: null, matchResult: null, myGuesses: [], redacted: {}, animatingRow: -1 });
      useStore.getState().setView('mproom');
      toast('房间已创建');
    });

    socket.on('room-update', (p: { room: RoomPublic; self?: { token: string; role: MpRole } }) => {
      if (p.self) {
        rememberRoom(p.room.code);
        set({ selfRole: p.self.role });
        useStore.getState().setView('mproom');
      }
      set({ room: p.room, redacted: p.room.redactedGuesses ?? {} });
    });

    socket.on(
      'player-joined',
      (p: { player: { token: string; name: string }; role: MpRole; reconnected?: boolean }) => {
        if (p.player.token === selfToken()) return;
        toast(p.reconnected ? `${p.player.name} 已重连` : `${p.player.name} 加入了房间`);
      },
    );

    socket.on('player-left', (p: { token: string; reason: 'disconnected' | 'forfeit' | 'left' }) => {
      if (p.token === selfToken()) return;
      if (p.reason === 'disconnected') toast('对手掉线，等待 30 秒重连…');
      else if (p.reason === 'forfeit') toast('对手已认输');
      else toast('对手离开了房间');
    });

    socket.on('game-started', (p: { roundNumber: number; bestOf: number; maxGuesses: number; deadline: number; serverNow: number }) => {
      if (flipTimer) clearTimeout(flipTimer);
      set({
        roundResult: null,
        matchResult: null,
        myGuesses: [],
        redacted: {},
        animatingRow: -1,
        roundDeadline: p.deadline,
        clockOffset: p.serverNow - Date.now(),
      });
      toast(`第 ${p.roundNumber} 局开始`);
    });

    socket.on('match-found', (p: { roomCode: string; room: RoomPublic; self: { token: string; role: MpRole } }) => {
      rememberRoom(p.roomCode);
      set({
        room: p.room,
        selfRole: p.self.role,
        queueStatus: 'idle',
        roundResult: null,
        matchResult: null,
        myGuesses: [],
        redacted: {},
        animatingRow: -1,
        roundDeadline: null,
      });
      useStore.getState().setView('mproom');
      toast('匹配成功，进入房间！');
    });

    socket.on('queue-joined', () => set({ queueStatus: 'queued' }));
    socket.on('queue-left', () => set({ queueStatus: 'idle' }));

    socket.on(
      'new-guess',
      (p: { token: string; row: GuessRow | RedactedRow; count: number }) => {
        if (p.token === selfToken()) {
          const row = p.row as GuessRow;
          set((s) => ({ myGuesses: [...s.myGuesses, row], animatingRow: s.myGuesses.length }));
          if (flipTimer) clearTimeout(flipTimer);
          flipTimer = setTimeout(() => set({ animatingRow: -1 }), FLIP_DURATION_MS);
        } else {
          const row = p.row as RedactedRow;
          set((s) => {
            const existing = s.redacted[p.token] ?? [];
            if (p.count <= existing.length) return s;
            return { redacted: { ...s.redacted, [p.token]: [...existing, row] } };
          });
        }
      },
    );

    socket.on('round-end', (p: RoundResult) => {
      set((s) => ({
        roundResult: p,
        roundDeadline: null,
        room: s.room ? { ...s.room, roundWins: p.roundWins } : s.room,
      }));
    });

    socket.on('match-end', (p: MatchResult) => {
      forgetRoom();
      set((s) => ({
        matchResult: p,
        roundDeadline: null,
        room: s.room ? { ...s.room, roundWins: p.roundWins, matchWinner: p.winner } : s.room,
      }));
    });

    socket.on(
      'reconnect-success',
      (p: { room: RoomPublic; myGuesses: GuessRow[]; self: { token: string; role: MpRole } }) => {
        set({
          room: p.room,
          myGuesses: p.myGuesses,
          redacted: p.room.redactedGuesses ?? {},
          selfRole: p.self.role,
          animatingRow: -1,
          roundDeadline: p.room.roundDeadline ?? null,
        });
        useStore.getState().setView('mproom');
        toast('已恢复房间');
      },
    );

    socket.on('error', (p: { code: string }) => {
      if (p.code === 'reconnect_failed') forgetRoom();
      toast(ERROR_MESSAGES[p.code] ?? '操作失败，请稍后再试');
    });
  },

  createRoom: ({ playerName, difficulty, bestOf }) => {
    get().init();
    getSocket().emit('create-room', {
      playerName,
      token: selfToken(),
      difficulty,
      bestOf,
    });
  },

  joinRoom: (roomCode, playerName) => {
    get().init();
    getSocket().emit('join-room', { roomCode, playerName, token: selfToken() });
  },

  joinQueue: ({ playerName, difficulty, bestOf }) => {
    get().init();
    getSocket().emit('queue-join', { playerName, token: selfToken(), difficulty, bestOf });
  },

  leaveQueue: () => {
    getSocket().emit('queue-leave');
    set({ queueStatus: 'idle' });
  },

  startGame: () => {
    const { room } = get();
    if (room) getSocket().emit('start-game', { roomCode: room.code });
  },

  ready: () => {
    const { room } = get();
    if (room) getSocket().emit('player-ready', { roomCode: room.code });
  },

  submitGuess: (birdId) => {
    const { room } = get();
    // 保护等级体系按自己的设置判定与显示
    if (room) {
      getSocket().emit('submit-guess', {
        roomCode: room.code,
        birdId,
        conservation: useStore.getState().conservation,
      });
    }
  },

  leaveRoom: () => {
    getSocket().emit('leave-room', { roomCode: get().room?.code });
    forgetRoom();
    if (flipTimer) clearTimeout(flipTimer);
    set({
      room: null,
      selfRole: null,
      myGuesses: [],
      redacted: {},
      animatingRow: -1,
      roundResult: null,
      matchResult: null,
      roundDeadline: null,
    });
  },
}));
