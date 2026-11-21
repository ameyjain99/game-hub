import { expect, test } from 'vitest';
import { createGame } from '../../src/games/ticket-to-ride/engine/setup';
import { trainsNeeded } from '../../src/games/ticket-to-ride/engine/reach';
import { getMap } from '../../src/games/ticket-to-ride/engine/maps';

const game = () =>
  createGame(
    [
      { name: 'A', isAI: false, avatar: '' },
      { name: 'B', isAI: false, avatar: '' },
    ],
    1,
  );

test('a route you own costs nothing, one you could claim costs its length, one taken blocks the way', () => {
  const s = game();
  const routes = getMap(s.mapId).routes;
  const r = routes.find((x) => !x.parallelGroup)!;
  const direct = trainsNeeded(s, 'p0', r.a, r.b);
  expect(direct).toBeLessThanOrEqual(r.length);

  // Own it: joining its two cities needs no more trains.
  const mine = { ...s, claimedBy: { ...s.claimedBy, [r.id]: 'p0' } };
  expect(trainsNeeded(mine, 'p0', r.a, r.b)).toBe(0);

  // The other player owns it: the way round is no shorter, and may not exist.
  const theirs = { ...s, claimedBy: { ...s.claimedBy, [r.id]: 'p1' } };
  expect(trainsNeeded(theirs, 'p0', r.a, r.b)).toBeGreaterThanOrEqual(direct);
});

test('a city cut off on every side cannot be reached at all', () => {
  const s = game();
  const routes = getMap(s.mapId).routes;
  const city = routes[0].a;
  const claimedBy = Object.fromEntries(routes.filter((r) => r.a === city || r.b === city).map((r) => [r.id, 'p1']));
  const far = routes.find((r) => r.a !== city && r.b !== city)!.a;
  expect(trainsNeeded({ ...s, claimedBy }, 'p0', city, far)).toBe(Infinity);
});
