// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { routeForPath } from '../../src/app/App';
import { gamePath } from '../../src/games/registry';

test('the root path shows the hub', () => {
  expect(routeForPath('/')).toEqual({ kind: 'hub' });
});

test('a live game path opens that game', () => {
  expect(routeForPath('/ticket-to-ride')).toEqual({ kind: 'game', gameId: 'ticket-to-ride' });
});

test('an unknown path falls back to the hub', () => {
  expect(routeForPath('/not-a-game')).toEqual({ kind: 'hub' });
});

test('the renamed games open at their own addresses, and the old working names are not addresses', () => {
  for (const id of ['uno', 'catan', 'scrabble', 'sequence', 'minecraft']) {
    expect(routeForPath(`/${id}`)).toEqual({ kind: 'game', gameId: id });
    expect(gamePath(id)).toBe(`/${id}`);
  }
  for (const old of ['last-card', 'hexstead', 'wordgrid', 'lineup', 'blockyard']) expect(routeForPath(`/${old}`)).toEqual({ kind: 'hub' });
});
