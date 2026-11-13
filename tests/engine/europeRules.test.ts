import { describe, expect, it, test } from 'vitest';
import { finalScores, routePoints } from '../../src/games/ticket-to-ride/engine/scoring';
import { createGame, dealSetupTickets } from '../../src/games/ticket-to-ride/engine/setup';
import { cityById, getMap, modeFor } from '../../src/games/ticket-to-ride/engine/maps';
import { makeRng } from '../../src/shared/rng';
import type { Ticket } from '../../src/games/ticket-to-ride/engine/types';
import { applyAction } from '../../src/games/ticket-to-ride/engine/reducer';
import { IllegalActionError } from '../../src/games/ticket-to-ride/engine/actions';
import { bonusesFor } from '../../src/games/ticket-to-ride/engine/bonuses';

const twoHumans = [
  { name: 'A', isAI: false },
  { name: 'B', isAI: false },
];

test('route scoring follows the rulebook table, including 8-space routes', () => {
  expect([1, 2, 3, 4, 5, 6, 8].map(routePoints)).toEqual([1, 2, 4, 7, 10, 15, 21]);
});

describe('Europe setup tickets (rulebook: deal 4, keep at least 2, discards leave the game)', () => {
  const g = createGame(twoHumans, 1, 'europe');
  const ids = g.players[0].pendingTickets.map((t) => t.id);
  const confirm = (keptIds: string[]) =>
    applyAction(g, { type: 'CONFIRM_SETUP_TICKETS', playerId: 'p0', keptIds });

  it('deals 4 tickets to each player', () => {
    for (const p of g.players) expect(p.pendingTickets).toHaveLength(4);
  });

  it('requires keeping at least 2', () => {
    expect(() => confirm(ids.slice(0, 1))).toThrow(IllegalActionError);
    expect(confirm(ids.slice(0, 2)).players[0].tickets).toHaveLength(2);
  });

  it('removes unkept setup tickets from the game instead of returning them to the pile', () => {
    const after = confirm(ids.slice(0, 2));
    expect(after.ticketPile).toEqual(g.ticketPile);
  });
});

describe('long-route tickets (rulebook: deal 1 long + 3 regular, unused long tickets leave the game)', () => {
  const t = (i: number, long = false): Ticket => ({
    id: `${long ? 'L' : 'R'}${i}`,
    a: 'paris',
    b: 'wien',
    points: long ? 20 : 8,
    ...(long ? { long: true } : {}),
  });
  const deck = [...Array.from({ length: 40 }, (_, i) => t(i)), ...Array.from({ length: 6 }, (_, i) => t(i, true))];
  const mode = { ...modeFor('europe'), tickets: deck };

  it('deals each of 5 players 1 long and 3 regular tickets', () => {
    const { hands } = dealSetupTickets(mode, 5, makeRng(1));
    expect(hands).toHaveLength(5);
    for (const h of hands) {
      expect(h).toHaveLength(4);
      expect(h.filter((x) => x.long)).toHaveLength(1);
    }
  });

  it('leaves only regular tickets in the draw pile', () => {
    const { pile } = dealSetupTickets(mode, 5, makeRng(1));
    expect(pile).toHaveLength(40 - 5 * 3);
    expect(pile.some((x) => x.long)).toBe(false);
  });
});

test("Europe's deck is the rulebook's 46 tickets: 40 regular + 6 long", () => {
  const tickets = modeFor('europe').tickets;
  expect(tickets).toHaveLength(46);
  expect(tickets.filter((t) => t.long)).toHaveLength(6);
  expect(tickets.filter((t) => !t.long)).toHaveLength(40);
  // Enough long tickets to deal one to every player in a full game.
  expect(tickets.filter((t) => t.long).length).toBeGreaterThanOrEqual(getMap('europe').maxPlayers);
  // Unique ids, and every endpoint is a real city on the Europe map.
  expect(new Set(tickets.map((t) => t.id)).size).toBe(tickets.length);
  for (const t of tickets) {
    expect(cityById.has(t.a), t.a).toBe(true);
    expect(cityById.has(t.b), t.b).toBe(true);
  }
});

test('a ticket completed through a station counts as completed', () => {
  const g = createGame(twoHumans, 1, 'europe');
  const [p0, p1] = g.players;
  const players = [
    { ...p0, stations: ['paris'], stationsLeft: 2, tickets: [{ id: 'paris__zurich', a: 'paris', b: 'zurich', points: 5 }] },
    { ...p1, claimedRouteIds: ['paris-zurich'] },
  ];
  // Paris-Zurich is only reachable by borrowing p1's route through the Paris station.
  const scores = finalScores(players, bonusesFor('europe'));
  expect(scores.p0.tickets).toBe(5);
  expect(scores.p0.ticketsCompleted).toBe(1);
  expect(scores.p1.ticketsCompleted).toBe(0);
});
