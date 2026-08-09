export type Feedback = 'green' | 'yellow' | 'gray';
export type Direction = 'up' | 'down';

export interface AttrCell {
  value: string;
  feedback: Feedback;
  /** up 表示答案更高/更濒危（显示 ↑），down 显示 ↓ */
  direction?: Direction;
}

export const CELL_KEYS = [
  'order',
  'family',
  'genus',
  'length',
  'wingspan',
  'residence',
  'habitats',
  'diet',
  'conservation',
  'endemic',
] as const;

export type CellKey = (typeof CELL_KEYS)[number];

export interface GuessRow {
  bird: { id: number; name: string; sciName: string };
  cells: Record<CellKey, AttrCell>;
}

export type Iucn = 'LC' | 'NT' | 'VU' | 'EN' | 'CR';
export type ChinaProtection = '国家一级' | '国家二级' | '三有' | '未列入';
export type Conservation = 'iucn' | 'china';

export interface Bird {
  id: number;
  name: string;
  sciName: string;
  pinyin: string;
  order: string;
  family: string;
  lengthCm: number;
  wingspanCm: number;
  residence: string[];
  habitats: string[];
  diet: string[];
  iucn: Iucn;
  chinaProtection: ChinaProtection;
  endemic: boolean;
}

export type GameStatus = 'playing' | 'won' | 'lost' | 'revealed';
export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '简单',
  normal: '普通',
  hard: '困难',
};

export interface GameStateResponse {
  gameId: string;
  difficulty: Difficulty;
  conservation: Conservation;
  maxGuesses: number;
  status: GameStatus;
  guesses: GuessRow[];
  answer?: Bird;
}

export interface SearchResult {
  id: number;
  name: string;
  sciName: string;
}

export interface StatsData {
  played: number;
  wins: number;
  winRate: number;
  guessDistribution: Record<string, number>;
  currentStreak: number;
  maxStreak: number;
  recentGames: { date: string; difficulty: string; won: boolean; guessCount: number }[];
}

export const IUCN_LABELS: Record<Iucn, string> = {
  LC: '无危',
  NT: '近危',
  VU: '易危',
  EN: '濒危',
  CR: '极危',
};
