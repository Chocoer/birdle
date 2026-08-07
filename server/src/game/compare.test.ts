import { describe, expect, it } from 'vitest';
import type { Bird } from '../types.js';
import { compareBirds } from './compare.js';

const base: Bird = {
  id: 1,
  name: '珠颈斑鸠',
  sciName: 'Spilopelia chinensis',
  pinyin: 'zhujingbanjiu',
  order: '鸽形目',
  family: '鸠鸽科',
  genus: '珠颈斑鸠属',
  lengthCm: 30,
  wingspanCm: 50,
  residence: ['留鸟'],
  habitats: ['城市', '农田'],
  diet: ['食谷'],
  iucn: 'LC',
  chinaProtection: '三有',
  endemic: false,
  difficulty: 'easy',
};

const bird = (patch: Partial<Bird>): Bird => ({ ...base, ...patch });

describe('compareBirds', () => {
  it('完全相同的鸟所有属性全绿', () => {
    const row = compareBirds(base, base);
    for (const cell of Object.values(row.cells)) {
      expect(cell.feedback).toBe('green');
      expect(cell.direction).toBeUndefined();
    }
  });

  it('科：只有绿（相同）和灰（不同）两种状态', () => {
    expect(compareBirds(bird({ family: '鸠鸽科' }), base).cells.family.feedback).toBe('green');
    // 同目不同科也是灰
    expect(compareBirds(bird({ family: '其他科' }), base).cells.family.feedback).toBe('gray');
    expect(
      compareBirds(bird({ order: '雀形目', family: '雀科' }), base).cells.family.feedback,
    ).toBe('gray');
  });

  it('数值：相等绿，≤20% 黄，方向指向答案', () => {
    // 答案 30cm
    expect(compareBirds(bird({ lengthCm: 30 }), base).cells.length.feedback).toBe('green');
    const near = compareBirds(bird({ lengthCm: 25 }), base).cells.length; // 差 5 ≤ 6
    expect(near.feedback).toBe('yellow');
    expect(near.direction).toBe('up');
    const far = compareBirds(bird({ lengthCm: 40 }), base).cells.length; // 差 10 > 6
    expect(far.feedback).toBe('gray');
    expect(far.direction).toBe('down');
  });

  it('属：相同绿，不同灰，无黄色', () => {
    expect(compareBirds(bird({ genus: '珠颈斑鸠属' }), base).cells.genus).toMatchObject({
      value: '珠颈斑鸠属',
      feedback: 'green',
    });
    expect(compareBirds(bird({ genus: '斑鸠属' }), base).cells.genus).toMatchObject({
      value: '斑鸠属',
      feedback: 'gray',
    });
  });

  it('集合：完全相等绿，有交集黄，无交集灰', () => {
    expect(compareBirds(bird({ habitats: ['农田', '城市'] }), base).cells.habitats.feedback).toBe(
      'green',
    );
    expect(compareBirds(bird({ habitats: ['城市', '森林'] }), base).cells.habitats.feedback).toBe(
      'yellow',
    );
    expect(compareBirds(bird({ habitats: ['海洋'] }), base).cells.habitats.feedback).toBe('gray');
  });

  it('IUCN：相同绿，相邻黄，方向表示更濒危/更安全', () => {
    // 答案 LC
    expect(compareBirds(bird({ iucn: 'NT' }), base).cells.conservation).toMatchObject({
      value: 'NT',
      feedback: 'yellow',
      direction: 'down',
    });
    expect(compareBirds(bird({ iucn: 'EN' }), base).cells.conservation).toMatchObject({
      feedback: 'gray',
      direction: 'down',
    });
    // 答案 VU
    const answer = bird({ iucn: 'VU' });
    expect(compareBirds(bird({ iucn: 'EN' }), answer).cells.conservation).toMatchObject({
      feedback: 'yellow',
      direction: 'down',
    });
    expect(compareBirds(bird({ iucn: 'NT' }), answer).cells.conservation).toMatchObject({
      feedback: 'yellow',
      direction: 'up',
    });
  });

  it('国保体系：相同绿，相邻黄，方向表示更受保护/更低', () => {
    // 答案 三有
    expect(compareBirds(bird({ chinaProtection: '三有' }), base, 'china').cells.conservation).toMatchObject({
      value: '三有',
      feedback: 'green',
    });
    expect(
      compareBirds(bird({ chinaProtection: '国家二级' }), base, 'china').cells.conservation,
    ).toMatchObject({ value: '国家二级', feedback: 'yellow', direction: 'down' });
    expect(
      compareBirds(bird({ chinaProtection: '国家一级' }), base, 'china').cells.conservation,
    ).toMatchObject({ feedback: 'gray', direction: 'down' });
    // 答案 国家一级
    const answer = bird({ chinaProtection: '国家一级' });
    expect(
      compareBirds(bird({ chinaProtection: '三有' }), answer, 'china').cells.conservation,
    ).toMatchObject({ feedback: 'gray', direction: 'up' });
    expect(
      compareBirds(bird({ chinaProtection: '国家二级' }), answer, 'china').cells.conservation,
    ).toMatchObject({ feedback: 'yellow', direction: 'up' });
  });

  it('布尔与精确枚举：相同绿，不同灰且无黄色', () => {
    expect(compareBirds(bird({ endemic: true }), base).cells.endemic.feedback).toBe('gray');
    expect(compareBirds(bird({ order: '雀形目' }), base).cells.order.feedback).toBe('gray');
  });
});
