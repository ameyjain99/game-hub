import { expect, test } from 'vitest';
import { reachableRooms } from '../../../src/games/cluedo/engine/board';

test('with a roll of 1 you can reach only the directly adjacent rooms', () => {
  // Hall has no secret passage; it is adjacent to Study and Lounge.
  expect(reachableRooms('Hall', 1).sort()).toEqual(['Lounge', 'Study']);
});

test('a larger roll reaches rooms further around the board', () => {
  const r = reachableRooms('Study', 2);
  expect(r).toContain('Lounge'); // Study → Hall → Lounge
  expect(r).toContain('Billiard Room'); // Study → Library → Billiard Room
});

test('a secret passage is reachable from a corner room even with a roll of 1', () => {
  // Study ↔ Kitchen via secret passage (otherwise 5 steps away).
  expect(reachableRooms('Study', 1)).toContain('Kitchen');
});

test('you cannot stay in your own room', () => {
  expect(reachableRooms('Study', 3)).not.toContain('Study');
});
