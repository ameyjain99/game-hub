import { expect, test } from 'vitest';
import { makeRng } from '../../../src/shared/rng';
import { setupCluedo } from '../../../src/games/cluedo/engine/setup';
import { SUSPECTS, WEAPONS, ROOMS } from '../../../src/games/cluedo/engine/cards';

test('the solution is exactly one suspect, one weapon, and one room', () => {
  const g = setupCluedo(['a', 'b', 'c'], makeRng(1));
  expect(SUSPECTS).toContain(g.solution.suspect);
  expect(WEAPONS).toContain(g.solution.weapon);
  expect(ROOMS).toContain(g.solution.room);
});

test('every non-solution card is dealt exactly once, and no hand holds a solution card', () => {
  const g = setupCluedo(['a', 'b', 'c'], makeRng(7));
  const dealt = Object.values(g.hands).flat();
  expect(dealt).toHaveLength(18); // 21 cards - 3 in the envelope
  expect(new Set(dealt).size).toBe(18); // no duplicates
  for (const c of [g.solution.suspect, g.solution.weapon, g.solution.room]) {
    expect(dealt).not.toContain(c);
  }
});

test('cards are dealt round-robin, as evenly as possible', () => {
  const g = setupCluedo(['a', 'b', 'c'], makeRng(3));
  const sizes = Object.values(g.hands).map((h) => h.length);
  expect(sizes).toEqual([6, 6, 6]); // 18 / 3
});

test('an uneven player count still deals all cards with sizes differing by at most one', () => {
  const g = setupCluedo(['a', 'b', 'c', 'd'], makeRng(5));
  const sizes = Object.values(g.hands).map((h) => h.length);
  expect(sizes.reduce((a, b) => a + b, 0)).toBe(18);
  expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
});
