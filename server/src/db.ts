import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// 兼容 tsx（src/）与编译产物（dist/）两种运行位置
const dbPath = process.env.DB_PATH ?? join(here, '..', 'birdle.db');
mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_id TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    bird_id INTEGER NOT NULL,
    won INTEGER NOT NULL,
    guess_count INTEGER NOT NULL,
    date TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_games_guest ON games(guest_id, id);
`);

export interface GameRecord {
  guestId: string;
  difficulty: string;
  birdId: number;
  won: boolean;
  guessCount: number;
  date: string;
}

export function recordGame(r: GameRecord): void {
  db.prepare(
    'INSERT INTO games (guest_id, difficulty, bird_id, won, guess_count, date) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(r.guestId, r.difficulty, r.birdId, r.won ? 1 : 0, r.guessCount, r.date);
}

export interface RecentGame {
  date: string;
  difficulty: string;
  won: boolean;
  guessCount: number;
}

export interface Stats {
  played: number;
  wins: number;
  winRate: number;
  guessDistribution: Record<number, number>;
  currentStreak: number;
  maxStreak: number;
  recentGames: RecentGame[];
}

export function getStats(guestId: string): Stats {
  const rows = db
    .prepare('SELECT won, guess_count FROM games WHERE guest_id = ? ORDER BY id ASC')
    .all(guestId) as unknown as { won: number; guess_count: number }[];

  const played = rows.length;
  const wins = rows.filter((r) => r.won === 1).length;
  const guessDistribution: Record<number, number> = {};
  for (const r of rows) {
    if (r.won === 1) guessDistribution[r.guess_count] = (guessDistribution[r.guess_count] ?? 0) + 1;
  }

  let maxStreak = 0;
  let streak = 0;
  for (const r of rows) {
    streak = r.won === 1 ? streak + 1 : 0;
    if (streak > maxStreak) maxStreak = streak;
  }

  const recentGames = (
    db
      .prepare('SELECT date, difficulty, won, guess_count FROM games WHERE guest_id = ? ORDER BY id DESC LIMIT 10')
      .all(guestId) as unknown as { date: string; difficulty: string; won: number; guess_count: number }[]
  ).map((r) => ({ date: r.date, difficulty: r.difficulty, won: r.won === 1, guessCount: r.guess_count }));

  return {
    played,
    wins,
    winRate: played === 0 ? 0 : Math.round((wins / played) * 100),
    guessDistribution,
    currentStreak: streak,
    maxStreak,
    recentGames,
  };
}
