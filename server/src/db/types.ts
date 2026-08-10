export interface GameRecord {
  guestId: string;
  difficulty: string;
  birdId: number;
  won: boolean;
  guessCount: number;
  date: string;
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

export interface User {
  id: number;
  username: string;
  passwordHash: string;
}

/** 存储接口：本地开发用 SQLite 实现，生产用 Postgres 实现 */
export interface Db {
  recordGame(r: GameRecord): Promise<void>;
  getStats(guestId: string): Promise<Stats>;
  /** 用户名已存在时返回 null */
  createUser(username: string, passwordHash: string): Promise<User | null>;
  findUser(username: string): Promise<User | null>;
  findUserById(id: number): Promise<User | null>;
  /** 把 fromGuestId 的战绩并入 toGuestId，返回并入条数 */
  mergeGames(fromGuestId: string, toGuestId: string): Promise<number>;
  close(): Promise<void>;
}
