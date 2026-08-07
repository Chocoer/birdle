import { create } from 'zustand';
import {
  ApiError,
  getStats,
  revealAnswer as apiRevealAnswer,
  startGame as apiStartGame,
  submitGuess as apiSubmitGuess,
} from './api';
import type { Bird, Conservation, Difficulty, GameStatus, GuessRow, StatsData } from './types';

export type View = 'home' | 'game' | 'stats' | 'settings' | 'rules' | 'lobby' | 'mproom';
export type Theme = 'light' | 'dark';

const GUEST_KEY = 'birdle-guestId';
const THEME_KEY = 'birdle-theme';
const CONSERVATION_KEY = 'birdle-conservation';
const GUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const FLIP_DURATION_MS = 10 * 120 + 600;

function loadGuestId(): string {
  const saved = localStorage.getItem(GUEST_KEY);
  if (saved && GUEST_ID_PATTERN.test(saved)) return saved;
  const id = crypto.randomUUID();
  localStorage.setItem(GUEST_KEY, id);
  return id;
}

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function initialTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY);
  return saved === 'light' || saved === 'dark' ? saved : systemTheme();
}

function initialConservation(): Conservation {
  return localStorage.getItem(CONSERVATION_KEY) === 'china' ? 'china' : 'iucn';
}

export interface GameState {
  gameId: string;
  difficulty: Difficulty;
  conservation: Conservation;
  maxGuesses: number;
  status: GameStatus;
  guesses: GuessRow[];
  answer?: Bird;
}

interface Store {
  view: View;
  theme: Theme;
  guestId: string;
  conservation: Conservation;
  game: GameState | null;
  stats: StatsData | null;
  statsLoading: boolean;
  starting: boolean;
  guessing: boolean;
  revealing: boolean;
  toast: string | null;
  /** 正在播放逐格翻转动画的行下标，-1 表示无 */
  animatingRow: number;
  setView: (view: View) => void;
  toggleTheme: () => void;
  syncSystemTheme: () => void;
  setConservation: (conservation: Conservation) => void;
  showToast: (message: string) => void;
  dismissToast: () => void;
  startGame: (difficulty: Difficulty) => Promise<void>;
  submitGuess: (birdId: number) => Promise<void>;
  revealAnswer: () => Promise<void>;
  loadStats: () => Promise<void>;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
let flipTimer: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<Store>((set, get) => ({
  view: 'home',
  theme: initialTheme(),
  guestId: loadGuestId(),
  conservation: initialConservation(),
  game: null,
  stats: null,
  statsLoading: false,
  starting: false,
  guessing: false,
  revealing: false,
  toast: null,
  animatingRow: -1,

  setView: (view) => set({ view }),

  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    set({ theme: next });
  },

  syncSystemTheme: () => {
    if (!localStorage.getItem(THEME_KEY)) set({ theme: systemTheme() });
  },

  setConservation: (conservation) => {
    localStorage.setItem(CONSERVATION_KEY, conservation);
    set({ conservation });
  },

  showToast: (message) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: message });
    toastTimer = setTimeout(() => set({ toast: null }), 3000);
  },

  dismissToast: () => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: null });
  },

  startGame: async (difficulty) => {
    if (get().starting) return;
    set({ starting: true });
    try {
      const state = await apiStartGame(difficulty, get().guestId, get().conservation);
      if (flipTimer) clearTimeout(flipTimer);
      set({ game: state, view: 'game', animatingRow: -1 });
    } catch {
      get().showToast('开局失败，请稍后再试');
    } finally {
      set({ starting: false });
    }
  },

  submitGuess: async (birdId) => {
    const { game, guestId, guessing } = get();
    if (!game || game.status !== 'playing' || guessing) return;
    set({ guessing: true });
    try {
      const state = await apiSubmitGuess(game.gameId, birdId, guestId);
      const newRow = state.guesses.length - 1;
      set({ game: state, animatingRow: newRow });
      if (flipTimer) clearTimeout(flipTimer);
      flipTimer = setTimeout(() => set({ animatingRow: -1 }), FLIP_DURATION_MS);
    } catch (err) {
      if (err instanceof ApiError) {
        switch (err.code) {
          case 'duplicate_guess':
            get().showToast('已经猜过这只鸟了');
            break;
          case 'game_not_found':
            set({ game: null, view: 'home' });
            get().showToast('对局已过期，请重新开始');
            break;
          case 'game_over':
            get().showToast('本局已结束');
            break;
          case 'bird_not_found':
            get().showToast('没有找到这种鸟');
            break;
          case 'not_in_pool':
            get().showToast('这只鸟不在当前难度范围内');
            break;
          case 'forbidden':
            get().showToast('无权操作该对局');
            break;
          default:
            get().showToast('提交失败，请稍后再试');
        }
      } else {
        get().showToast('网络异常，请稍后再试');
      }
    } finally {
      set({ guessing: false });
    }
  },

  revealAnswer: async () => {
    const { game, guestId, revealing } = get();
    if (!game || game.status !== 'playing' || revealing) return;
    set({ revealing: true });
    try {
      const state = await apiRevealAnswer(game.gameId, guestId);
      if (flipTimer) clearTimeout(flipTimer);
      set({ game: state, animatingRow: -1 });
    } catch (err) {
      if (err instanceof ApiError) {
        switch (err.code) {
          case 'game_not_found':
            set({ game: null, view: 'home' });
            get().showToast('对局已过期，请重新开始');
            break;
          case 'game_over':
            get().showToast('本局已结束');
            break;
          case 'forbidden':
            get().showToast('无权操作该对局');
            break;
          default:
            get().showToast('操作失败，请稍后再试');
        }
      } else {
        get().showToast('网络异常，请稍后再试');
      }
    } finally {
      set({ revealing: false });
    }
  },

  loadStats: async () => {    set({ statsLoading: true });
    try {
      const stats = await getStats(get().guestId);
      set({ stats });
    } catch {
      get().showToast('统计加载失败，请稍后再试');
    } finally {
      set({ statsLoading: false });
    }
  },
}));
