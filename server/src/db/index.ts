import { createPgDb } from './pg.js';
import { createSqliteDb } from './sqlite.js';
import type { Db } from './types.js';

/** 有 DATABASE_URL 走 Postgres（生产），否则本地 SQLite（开发） */
export const db: Db = process.env.DATABASE_URL
  ? createPgDb(process.env.DATABASE_URL)
  : createSqliteDb();

export type { Db, GameRecord, RecentGame, Stats, User } from './types.js';
