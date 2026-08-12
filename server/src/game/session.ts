import { randomUUID } from 'node:crypto';
import { birds, getBird } from '../data/birds.js';
import { db } from '../db/index.js';
import { getRedis, withRedisLock } from '../redis.js';
import type { Bird, ConservationSystem, Difficulty, GameStatus, GuessRow } from '../types.js';
import { compareBirds } from './compare.js';

export const MAX_GUESSES = 8;
/** 进行中对局 30 分钟无操作过期 */
const SESSION_TTL_MS = 30 * 60 * 1000;

/** 难度池（累计制）：简单=easy，普通=easy+normal，困难=全部 */
const RANK: Record<Difficulty, number> = { easy: 0, normal: 1, hard: 2 };
const POOLS: Record<Difficulty, Bird[]> = {
  easy: birds.filter((bird) => RANK[bird.difficulty] <= 0),
  normal: birds.filter((bird) => RANK[bird.difficulty] <= 1),
  hard: birds,
};

export function poolOf(difficulty: Difficulty): Bird[] {
  return POOLS[difficulty];
}

function dateKeyOf(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
const sessionKey = (id: string) => `birdle:session:${id}`;

function sweepMemory(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (session.status === 'playing' && now - session.touchedAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

async function loadSession(id: string): Promise<Session | undefined> {
  const redis = getRedis();
  if (!redis) return sessions.get(id);
  const raw = await redis.get(sessionKey(id));
  return raw ? (JSON.parse(raw) as Session) : undefined;
}

async function saveSession(session: Session): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    sessions.set(session.id, session);
    return;
  }
  await redis.set(sessionKey(session.id), JSON.stringify(session), 'PX', SESSION_TTL_MS);
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

function toPublic(session: Session): PublicGame {
  const game: PublicGame = {
    gameId: session.id,
    difficulty: session.difficulty,
    conservation: session.conservation,
    maxGuesses: MAX_GUESSES,
    status: session.status,
    guesses: session.guesses,
  };
  if (session.status !== 'playing') game.answer = getBird(session.answerId);
  return game;
}

export async function startGame(
  difficulty: Difficulty,
  guestId: string,
  conservation: ConservationSystem = 'iucn',
): Promise<PublicGame> {
  if (!getRedis()) sweepMemory();
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
  await saveSession(session);
  return toPublic(session);
}

type GuessError =
  | 'game_not_found'
  | 'game_over'
  | 'bird_not_found'
  | 'not_in_pool'
  | 'forbidden'
  | 'duplicate_guess';

export type GuessOutcome =
  | { ok: true; game: PublicGame; error?: never }
  | { ok: false; error: GuessError; game?: never };
type MutationOutcome = { ok: true } | { ok: false; error: GuessError };

function validateSession(
  session: Session | undefined,
  guestId: string,
): Session | { error: 'game_not_found' | 'forbidden' | 'game_over' } {
  if (!session) return { error: 'game_not_found' };
  if (session.guestId !== guestId) return { error: 'forbidden' };
  if (session.status !== 'playing') return { error: 'game_over' };
  return session;
}

/** 完成后等待战绩写库再响应；写库失败仍不改变已经完成的对局。 */
async function recordFinished(session: Session, identity?: string): Promise<void> {
  await db
    .recordGame({
      guestId: identity ?? session.guestId,
      difficulty: session.difficulty,
      birdId: session.answerId,
      won: session.status === 'won',
      guessCount: session.guesses.length,
      date: session.date,
    })
    .catch((error) => console.error('[birdle] recordGame 失败', error));
}

/** 在同一 Session 锁内完成校验、变更与持久化，防止并发猜测覆盖。 */
async function mutateSession(
  gameId: string,
  guestId: string,
  identity: string | undefined,
  mutate: (session: Session) => MutationOutcome,
): Promise<GuessOutcome> {
  if (!getRedis()) sweepMemory();
  let finished: Session | undefined;
  const apply = async (): Promise<GuessOutcome> => {
    const found = validateSession(await loadSession(gameId), guestId);
    if ('error' in found) return { ok: false, error: found.error };
    const result = mutate(found);
    if (!result.ok) return result;
    found.touchedAt = Date.now();
    await saveSession(found);
    if (found.status !== 'playing') finished = found;
    return { ok: true, game: toPublic(found) };
  };

  const outcome = getRedis() ? await withRedisLock(`session:${gameId}`, apply) : await apply();
  if (finished) await recordFinished(finished, identity);
  return outcome;
}

export async function submitGuess(
  gameId: string,
  guestId: string,
  birdId: number,
  identity?: string,
): Promise<GuessOutcome> {
  return mutateSession(gameId, guestId, identity, (session) => {
    const guess = getBird(birdId);
    if (!guess) return { ok: false, error: 'bird_not_found' };
    if (!POOLS[session.difficulty].some((bird) => bird.id === birdId)) {
      return { ok: false, error: 'not_in_pool' };
    }
    if (session.guesses.some((row) => row.bird.id === birdId)) {
      return { ok: false, error: 'duplicate_guess' };
    }

    const answer = getBird(session.answerId)!;
    session.guesses.push(compareBirds(guess, answer, session.conservation));
    if (guess.id === answer.id) session.status = 'won';
    else if (session.guesses.length >= MAX_GUESSES) session.status = 'lost';
    return { ok: true };
  });
}

/** 看答案：对局直接结束并揭晓，记为负场。 */
export async function revealAnswer(
  gameId: string,
  guestId: string,
  identity?: string,
): Promise<GuessOutcome> {
  return mutateSession(gameId, guestId, identity, (session) => {
    session.status = 'revealed';
    return { ok: true };
  });
}
