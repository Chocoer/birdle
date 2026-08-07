import rawBirds from './birds.json' with { type: 'json' };
import type { Bird } from '../types.js';

export const birds = rawBirds as Bird[];

const byId = new Map(birds.map((b) => [b.id, b]));

export function getBird(id: number): Bird | undefined {
  return byId.get(id);
}
