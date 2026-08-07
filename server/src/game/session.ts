import { randomUUID } from 'node:crypto';
import { birds, getBird } from '../data/birds.js';
import { recordGame } from '../db.js';
import type { Bird, ConservationSystem, Difficulty, GameStatus, GuessRow } from '../types.js';
import { compareBirds } from './compare.js';

export const MAX_GUESSES = 8;
/** 进行中对局 30 分钟无操作过期（仅清理内存，战绩已即时落库） */
const SESSION_TTL_MS = 30 * 60 * 1000;

/** 难度池（累计制）：简单=easy，普通=easy+normal，困难=全部 */
const RANK: Record<Difficulty, number> = { easy: 0, normal: 1, hard: 2 };
const POOLS: Record<Difficulty, Bird[]> = {
  easy: birds.filter((b) => RANK[b.difficulty] <= 0),
  normal: birds.filter((b) => RANK[b.difficulty] <= 1),
  hard: birds,
};

export function poolOf(difficulty: Difficulty): Bird[] {
  return POOLS[difficulty];
}

function dateKeyOf(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface Session {
  id: string;
  difficulty: Difficulty;
  conservation: ConservationSystem;
  guestId: string;
  answerId: number;
  date: string;
  guesses: GuessRow[];
  status: GameStatus;
  touchedAt: number;
}

const sessions = new Map<string, Session>();

function sweep(): void {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (s.status === 'playing' && now - s.touchedAt > SESSION_TTL_MS) sessions.delete(id);
  }
}

export interface PublicGame {
  gameId: string;
  difficulty: Difficulty;
  conservation: ConservationSystem;
  maxGuesses: number;
  status: GameStatus;
  guesses: GuessRow[];
  answer?: Bird;
}

function toPublic(s: Session): PublicGame {
  const base: PublicGame = {
    gameId: s.id,
    difficulty: s.difficulty,
    conservation: s.conservation,
    maxGuesses: MAX_GUESSES,
    status: s.status,
    guesses: s.guesses,
  };
  if (s.status !== 'playing') base.answer = getBird(s.answerId);
  return base;
}

export function startGame(
  difficulty: Difficulty,
  guestId: string,
  conservation: ConservationSystem = 'iucn',
): PublicGame {
  sweep();
  const pool = POOLS[difficulty];
  const session: Session = {
    id: randomUUID(),
    difficulty,
    conservation,
    guestId,
    answerId: pool[Math.floor(Math.random() * pool.length)].id,
    date: dateKeyOf(),
    guesses: [],
    status: 'playing',
    touchedAt: Date.now(),
  };
  sessions.set(session.id, session);
  return toPublic(session);
}

export type GuessOutcome =
  | { ok: true; game: PublicGame }
  | {
      ok: false;
      error: 'game_not_found' | 'game_over' | 'bird_not_found' | 'not_in_pool' | 'forbidden' | 'duplicate_guess';
    };

function findSession(gameId: string, guestId: string): Session | { error: 'game_not_found' | 'forbidden' | 'game_over' } {
  const s = sessions.get(gameId);
  if (!s) return { error: 'game_not_found' };
  if (s.guestId !== guestId) return { error: 'forbidden' };
  if (s.status !== 'playing') return { error: 'game_over' };
  return s;
}

function finish(s: Session, status: GameStatus): void {
  s.status = status;
  recordGame({
    guestId: s.guestId,
    difficulty: s.difficulty,
    birdId: s.answerId,
    won: status === 'won',
    guessCount: s.guesses.length,
    date: s.date,
  });
}

export function submitGuess(gameId: string, guestId: string, birdId: number): GuessOutcome {
  sweep();
  const found = findSession(gameId, guestId);
  if ('error' in found) return { ok: false, error: found.error };
  const s = found;

  const guess = getBird(birdId);
  if (!guess) return { ok: false, error: 'bird_not_found' };
  if (!POOLS[s.difficulty].some((b) => b.id === birdId)) return { ok: false, error: 'not_in_pool' };
  if (s.guesses.some((g) => g.bird.id === birdId)) return { ok: false, error: 'duplicate_guess' };

  const answer = getBird(s.answerId)!;
  s.guesses.push(compareBirds(guess, answer, s.conservation));
  s.touchedAt = Date.now();

  if (guess.id === answer.id) finish(s, 'won');
  else if (s.guesses.length >= MAX_GUESSES) finish(s, 'lost');

  return { ok: true, game: toPublic(s) };
}

/** 看答案：对局直接结束并揭晓，记为负场 */
export function revealAnswer(gameId: string, guestId: string): GuessOutcome {
  sweep();
  const found = findSession(gameId, guestId);
  if ('error' in found) return { ok: false, error: found.error };
  finish(found, 'revealed');
  return { ok: true, game: toPublic(found) };
}
