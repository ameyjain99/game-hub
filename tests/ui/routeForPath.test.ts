// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { routeForPath } from '../../src/app/App';

test('the root path shows the hub', () => {
  expect(routeForPath('/')).toEqual({ kind: 'hub' });
});

test('a live game path opens that game', () => {
  expect(routeForPath('/ticket-to-ride')).toEqual({ kind: 'game', gameId: 'ticket-to-ride' });
});

test('an unknown path falls back to the hub', () => {
  expect(routeForPath('/not-a-game')).toEqual({ kind: 'hub' });
});
