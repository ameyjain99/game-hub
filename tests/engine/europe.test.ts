import { expect, test } from 'vitest';
import { getMap } from '../../src/games/ticket-to-ride/engine/maps';
import { createGame } from '../../src/games/ticket-to-ride/engine/setup';
import { areConnected } from '../../src/games/ticket-to-ride/engine/graph';
import { advanceAi } from '../../src/games/ticket-to-ride/ai/driver';

const europe = getMap('europe');
const cityIds = new Set(europe.cities.map((c) => c.id));
const allRouteIds = europe.routes.map((r) => r.id);

test('every europe route connects known cities', () => {
  for (const r of europe.routes) {
    expect(cityIds.has(r.a), `route ${r.id} a`).toBe(true);
    expect(cityIds.has(r.b), `route ${r.id} b`).toBe(true);
  }
});

test('every europe ticket references known cities', () => {
  for (const t of europe.modes[0].tickets) {
    expect(cityIds.has(t.a), `ticket ${t.id} a`).toBe(true);
    expect(cityIds.has(t.b), `ticket ${t.id} b`).toBe(true);
  }
});

test('the europe route graph connects every city', () => {
  const first = europe.cities[0].id;
  for (const c of europe.cities) {
    expect(areConnected(allRouteIds, first, c.id), `${c.id} unreachable`).toBe(true);
  }
});

test('every europe ticket is completable in principle (endpoints connected)', () => {
  for (const t of europe.modes[0].tickets) {
    expect(areConnected(allRouteIds, t.a, t.b), `${t.id} not connectable`).toBe(true);
  }
});

test('europe has tunnels and ferries in its data', () => {
  expect(europe.routes.some((r) => r.isTunnel)).toBe(true);
  expect(europe.routes.some((r) => r.locomotivesRequired > 0)).toBe(true);
  expect(europe.stationsPerPlayer).toBe(3);
});

test('a full AI-vs-AI game on europe reaches game-over', () => {
  const start = createGame(
    [
      { name: 'A', isAI: true, difficulty: 'normal' },
      { name: 'B', isAI: true, difficulty: 'hard' },
    ],
    3,
    'europe',
  );
  const end = advanceAi(start); // both seats are AI, so this plays the whole game
  expect(end.phase).toBe('game-over');
});
