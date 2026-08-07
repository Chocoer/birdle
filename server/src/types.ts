export type Iucn = 'LC' | 'NT' | 'VU' | 'EN' | 'CR';
/** 中国保护等级：国家一级/二级重点保护、三有名录、未列入 */
export type ChinaProtection = '国家一级' | '国家二级' | '三有' | '未列入';
/** 对局使用的保护等级体系 */
export type ConservationSystem = 'iucn' | 'china';

export interface Bird {
  id: number;
  name: string;
  sciName: string;
  pinyin: string;
  /** 中文名拼音首字母缩写，如 "zjbj"，用于首字母搜索 */
  abbr: string;
  order: string;
  family: string;
  /** 中文属名，如 "珠颈斑鸠属" */
  genus: string;
  lengthCm: number;
  wingspanCm: number;
  residence: string[];
  habitats: string[];
  diet: string[];
  iucn: Iucn;
  chinaProtection: ChinaProtection;
  endemic: boolean;
  /** 作为答案的稀有程度：easy 知名常见，normal 观鸟入门，hard 冷门 */
  difficulty: Difficulty;
}

export type Feedback = 'green' | 'yellow' | 'gray';
export type Direction = 'up' | 'down';

export interface AttrCell {
  value: string;
  feedback: Feedback;
  /** 仅数值/等级型属性：up 表示答案比猜测更高（或更濒危），down 反之 */
  direction?: Direction;
}

export interface GuessRow {
  bird: { id: number; name: string; sciName: string };
  cells: {
    order: AttrCell;
    family: AttrCell;
    /** 属（取学名第一个词，拉丁属名） */
    genus: AttrCell;
    length: AttrCell;
    wingspan: AttrCell;
    residence: AttrCell;
    habitats: AttrCell;
    diet: AttrCell;
    /** 保护等级（内容取决于对局选用的体系：IUCN 或中国国保） */
    conservation: AttrCell;
    endemic: AttrCell;
  };
}

export type GameStatus = 'playing' | 'won' | 'lost' | 'revealed';
export type Difficulty = 'easy' | 'normal' | 'hard';
