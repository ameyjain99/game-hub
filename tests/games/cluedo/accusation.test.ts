import { expect, test } from 'vitest';
import { isCorrectAccusation } from '../../../src/games/cluedo/engine/accusation';
import type { Triple } from '../../../src/games/cluedo/engine/cards';

const solution: Triple = { suspect: 'Professor Plum', weapon: 'Revolver', room: 'Kitchen' };

test('an accusation matching all three parts is correct', () => {
  expect(isCorrectAccusation({ ...solution }, solution)).toBe(true);
});

test('an accusation wrong on any single part is incorrect', () => {
  expect(isCorrectAccusation({ ...solution, suspect: 'Mrs White' }, solution)).toBe(false);
  expect(isCorrectAccusation({ ...solution, weapon: 'Rope' }, solution)).toBe(false);
  expect(isCorrectAccusation({ ...solution, room: 'Ballroom' }, solution)).toBe(false);
});
