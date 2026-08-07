import type { AttrCell, Bird, ConservationSystem, Feedback, GuessRow } from '../types.js';

/** 有序等级表：索引越大保护级别越高/越濒危 */
const SCALES: Record<ConservationSystem, string[]> = {
  iucn: ['LC', 'NT', 'VU', 'EN', 'CR'],
  china: ['未列入', '三有', '国家二级', '国家一级'],
};

/** 数值型：相等绿，相差 ≤20%（以答案为基准）黄；附带方向提示 */
function compareNumeric(guess: number, answer: number, unit: string): AttrCell {
  const value = `${guess} ${unit}`;
  if (guess === answer) return { value, feedback: 'green' };
  const close = Math.abs(guess - answer) <= answer * 0.2;
  return {
    value,
    feedback: close ? 'yellow' : 'gray',
    direction: answer > guess ? 'up' : 'down',
  };
}

/** 集合型：完全相等绿，有交集黄 */
function compareSet(guess: string[], answer: string[]): AttrCell {
  const value = guess.join('、');
  const g = new Set(guess);
  const a = new Set(answer);
  const equal = g.size === a.size && [...g].every((x) => a.has(x));
  if (equal) return { value, feedback: 'green' };
  const overlap = [...g].some((x) => a.has(x));
  return { value, feedback: overlap ? 'yellow' : 'gray' };
}

function compareExact<T>(guess: T, answer: T, display: string): AttrCell {
  return { value: display, feedback: guess === answer ? 'green' : 'gray' };
}

/** 保护等级：相同绿，相邻黄；方向表示答案更濒危/更受保护(up)或反之(down) */
function compareConservation(guess: string, answer: string, scale: string[]): AttrCell {
  if (guess === answer) return { value: guess, feedback: 'green' };
  const gi = scale.indexOf(guess);
  const ai = scale.indexOf(answer);
  const feedback: Feedback = Math.abs(gi - ai) === 1 ? 'yellow' : 'gray';
  return { value: guess, feedback, direction: ai > gi ? 'up' : 'down' };
}

/** 科：只有一致（绿）与不一致（灰）两种状态 */
function compareFamily(guess: Bird, answer: Bird): AttrCell {
  return { value: guess.family, feedback: guess.family === answer.family ? 'green' : 'gray' };
}

/** 属（中文属名）：只有一致（绿）与不一致（灰）两种状态 */
function compareGenus(guess: Bird, answer: Bird): AttrCell {
  return { value: guess.genus, feedback: guess.genus === answer.genus ? 'green' : 'gray' };
}

/** 逐属性对比一次猜测与答案，生成一行反馈；conservation 列按选用体系取值 */
export function compareBirds(guess: Bird, answer: Bird, system: ConservationSystem = 'iucn'): GuessRow {
  const guessLevel = system === 'iucn' ? guess.iucn : guess.chinaProtection;
  const answerLevel = system === 'iucn' ? answer.iucn : answer.chinaProtection;
  return {
    bird: { id: guess.id, name: guess.name, sciName: guess.sciName },
    cells: {
      order: compareExact(guess.order, answer.order, guess.order),
      family: compareFamily(guess, answer),
      genus: compareGenus(guess, answer),
      length: compareNumeric(guess.lengthCm, answer.lengthCm, 'cm'),
      wingspan: compareNumeric(guess.wingspanCm, answer.wingspanCm, 'cm'),
      residence: compareSet(guess.residence, answer.residence),
      habitats: compareSet(guess.habitats, answer.habitats),
      diet: compareSet(guess.diet, answer.diet),
      conservation: compareConservation(guessLevel, answerLevel, SCALES[system]),
      endemic: compareExact(guess.endemic, answer.endemic, guess.endemic ? '是' : '否'),
    },
  };
}
