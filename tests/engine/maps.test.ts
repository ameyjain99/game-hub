import { expect, test } from 'vitest';
import { cityById, DEFAULT_MAP_ID, getMap, MAP_LIST, routeById } from '../../src/games/ticket-to-ride/engine/maps';
import { createGame } from '../../src/games/ticket-to-ride/engine/setup';

const twoPlayers = [
  { name: 'A', isAI: false },
  { name: 'B', isAI: true as const },
];

test('usa map is registered with its data', () => {
  const usa = getMap('usa');
  expect(usa.name).toBe('USA');
  expect(usa.startingTrains).toBe(45);
  expect(usa.stationsPerPlayer).toBe(0);
  expect(usa.cities.length).toBeGreaterThan(30);
  expect(usa.routes.length).toBeGreaterThan(60);
  expect(MAP_LIST.map((m) => m.id)).toContain(DEFAULT_MAP_ID);
});

test('getMap throws on an unknown map', () => {
  expect(() => getMap('atlantis')).toThrow();
});

test('createGame stamps the map id and defaults to usa', () => {
  expect(createGame(twoPlayers, 1).mapId).toBe('usa');
  expect(createGame(twoPlayers, 1, 'usa').mapId).toBe('usa');
});

test('union id lookups resolve usa routes and cities', () => {
  expect(routeById.get('boston-new-york')).toBeDefined();
  expect(cityById.get('boston')?.name).toBe('Boston');
});

const ticketIds = (g: ReturnType<typeof createGame>) =>
  [...g.ticketPile, ...g.players.flatMap((p) => p.pendingTickets)].map((t) => t.id);

test('createGame with the 1910 extension uses only the 1910 ticket set', () => {
  const ids = ticketIds(createGame(twoPlayers, 1, 'usa', '1910'));
  expect(ids.some((id) => id.startsWith('1910:'))).toBe(true);
  expect(ids.every((id) => id.startsWith('1910:'))).toBe(true);
});

test('the mega extension includes both original and 1910 tickets', () => {
  const ids = ticketIds(createGame(twoPlayers, 1, 'usa', 'mega'));
  expect(ids.some((id) => id.startsWith('1910:'))).toBe(true);
  expect(ids.some((id) => !id.startsWith('1910:'))).toBe(true);
});

test('an unknown extension falls back to the original tickets', () => {
  const ids = ticketIds(createGame(twoPlayers, 1, 'usa', 'nope'));
  expect(ids.every((id) => !id.startsWith('1910:'))).toBe(true);
});
