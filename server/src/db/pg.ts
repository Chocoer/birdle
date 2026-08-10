import { Pool } from 'pg';
import type { Db, GameRecord, Stats, User } from './types.js';

/** 生产实现：Postgres（Neon 等），DATABASE_URL 驱动 */
export function createPgDb(databaseUrl: string): Db {
  const pool = new Pool({
    connectionString: databaseUrl,
    // Neon 等云 Postgres 需要 TLS
    ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 4,
  });

  const ready = pool.query(`
    CREATE TABLE IF NOT EXISTS games (
      id SERIAL PRIMARY KEY,
      guest_id TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      bird_id INTEGER NOT NULL,
      won BOOLEAN NOT NULL,
      guess_count INTEGER NOT NULL,
      date TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_games_guest ON games(guest_id, id);
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  return {
    async recordGame(r: GameRecord): Promise<void> {
      await ready;
      await pool.query(
        'INSERT INTO games (guest_id, difficulty, bird_id, won, guess_count, date) VALUES ($1, $2, $3, $4, $5, $6)',
        [r.guestId, r.difficulty, r.birdId, r.won, r.guessCount, r.date],
      );
    },

    async getStats(guestId: string): Promise<Stats> {
      await ready;
      const { rows } = await pool.query<{ won: boolean; guess_count: number }>(
        'SELECT won, guess_count FROM games WHERE guest_id = $1 ORDER BY id ASC',
        [guestId],
      );

      const played = rows.length;
      const wins = rows.filter((r) => r.won).length;
      const guessDistribution: Record<number, number> = {};
      for (const r of rows) {
        if (r.won) guessDistribution[r.guess_count] = (guessDistribution[r.guess_count] ?? 0) + 1;
      }

      let maxStreak = 0;
      let streak = 0;
      for (const r of rows) {
        streak = r.won ? streak + 1 : 0;
        if (streak > maxStreak) maxStreak = streak;
      }

      const recent = await pool.query<{
        date: string;
        difficulty: string;
        won: boolean;
        guess_count: number;
      }>(
        'SELECT date, difficulty, won, guess_count FROM games WHERE guest_id = $1 ORDER BY id DESC LIMIT 10',
        [guestId],
      );

      return {
        played,
        wins,
        winRate: played === 0 ? 0 : Math.round((wins / played) * 100),
        guessDistribution,
        currentStreak: streak,
        maxStreak,
        recentGames: recent.rows.map((r) => ({
          date: r.date,
          difficulty: r.difficulty,
          won: r.won,
          guessCount: r.guess_count,
        })),
      };
    },

    async createUser(username: string, passwordHash: string): Promise<User | null> {
      await ready;
      const { rows } = await pool.query<{ id: number }>(
        'INSERT INTO users (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING RETURNING id',
        [username, passwordHash],
      );
      return rows[0] ? { id: rows[0].id, username, passwordHash } : null;
    },

    async findUser(username: string): Promise<User | null> {
      await ready;
      const { rows } = await pool.query<{ id: number; username: string; password_hash: string }>(
        'SELECT id, username, password_hash FROM users WHERE username = $1',
        [username],
      );
      const r = rows[0];
      return r ? { id: r.id, username: r.username, passwordHash: r.password_hash } : null;
    },

    async findUserById(id: number): Promise<User | null> {
      await ready;
      const { rows } = await pool.query<{ id: number; username: string; password_hash: string }>(
        'SELECT id, username, password_hash FROM users WHERE id = $1',
        [id],
      );
      const r = rows[0];
      return r ? { id: r.id, username: r.username, passwordHash: r.password_hash } : null;
    },

    async mergeGames(fromGuestId: string, toGuestId: string): Promise<number> {
      await ready;
      const result = await pool.query('UPDATE games SET guest_id = $1 WHERE guest_id = $2', [
        toGuestId,
        fromGuestId,
      ]);
      return result.rowCount ?? 0;
    },

    async close(): Promise<void> {
      await pool.end();
    },
  };
}
