import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Db, GameRecord, Stats, User } from './types.js';

/** 本地开发默认实现：Node 内置 SQLite，零外部依赖 */
export function createSqliteDb(dbPath?: string): Db {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = dbPath ?? process.env.DB_PATH ?? join(here, '..', '..', 'birdle.db');
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });

  const db = new DatabaseSync(path);
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
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  return {
    async recordGame(r: GameRecord): Promise<void> {
      db.prepare(
        'INSERT INTO games (guest_id, difficulty, bird_id, won, guess_count, date) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(r.guestId, r.difficulty, r.birdId, r.won ? 1 : 0, r.guessCount, r.date);
    },

    async getStats(guestId: string): Promise<Stats> {
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
          .prepare(
            'SELECT date, difficulty, won, guess_count FROM games WHERE guest_id = ? ORDER BY id DESC LIMIT 10',
          )
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
    },

    async createUser(username: string, passwordHash: string): Promise<User | null> {
      try {
        const result = db
          .prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)')
          .run(username, passwordHash, new Date().toISOString());
        return { id: Number(result.lastInsertRowid), username, passwordHash };
      } catch {
        return null; // UNIQUE 冲突
      }
    },

    async findUser(username: string): Promise<User | null> {
      const row = db
        .prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
        .get(username) as { id: number; username: string; password_hash: string } | undefined;
      return row ? { id: row.id, username: row.username, passwordHash: row.password_hash } : null;
    },

    async findUserById(id: number): Promise<User | null> {
      const row = db
        .prepare('SELECT id, username, password_hash FROM users WHERE id = ?')
        .get(id) as { id: number; username: string; password_hash: string } | undefined;
      return row ? { id: row.id, username: row.username, passwordHash: row.password_hash } : null;
    },

    async mergeGames(fromGuestId: string, toGuestId: string): Promise<number> {
      const result = db
        .prepare('UPDATE games SET guest_id = ? WHERE guest_id = ?')
        .run(toGuestId, fromGuestId);
      return Number(result.changes);
    },

    async close(): Promise<void> {
      db.close();
    },
  };
}
