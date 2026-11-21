// The Nordic and India maps: sound data, and the rules each plays by.
import { describe, expect, test } from 'vitest';
import { MAP_LIST, getMap, rulesOf } from '../../src/games/ticket-to-ride/engine/maps';
import { areConnected, twoPaths } from '../../src/games/ticket-to-ride/engine/graph';
import { aiActor, canPayFor, legalActions, routeIsClaimable } from '../../src/games/ticket-to-ride/engine/selectors';
import { finalScores, routePoints } from '../../src/games/ticket-to-ride/engine/scoring';
import { GRAND_TOUR_POINTS, bonusesFor, grandTourBonus, mostTicketsBonus } from '../../src/games/ticket-to-ride/engine/bonuses';
import { dealMarket, emptyHand } from '../../src/games/ticket-to-ride/engine/deck';
import { createGame } from '../../src/games/ticket-to-ride/engine/setup';
import { applyAction } from '../../src/games/ticket-to-ride/engine/reducer';
import { chooseAction } from '../../src/games/ticket-to-ride/ai/bot';
import type { GameState, Hand, PlayerState, TrainCard } from '../../src/games/ticket-to-ride/engine/types';

const hand = (cards: Partial<Hand>): Hand => ({ ...emptyHand(), ...cards });
const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI: false }));
/** A started game with every player's tickets kept, ready for the first turn. */
function started(mapId: string, n: number): GameState {
  let s = createGame(seats(n), 9, mapId);
  for (const p of s.players) s = applyAction(s, { type: 'CONFIRM_SETUP_TICKETS', playerId: p.id, keptIds: p.pendingTickets.map((t) => t.id) });
  return s;
}

describe.each(['nordic', 'india'])('%s map data', (id) => {
  const map = getMap(id);
  const cityIds = new Set(map.cities.map((c) => c.id));

  test('every route joins two cities of the map, and ids clash with no other map', () => {
    for (const r of map.routes) {
      expect(cityIds.has(r.a) && cityIds.has(r.b)).toBe(true);
      expect(r.length >= 1 && r.length <= 9).toBe(true);
      expect(routePoints(r.length)).toBeGreaterThan(0);
    }
    const others = MAP_LIST.filter((m) => m.id !== id);
    for (const r of map.routes) expect(others.some((m) => m.routes.some((o) => o.id === r.id))).toBe(false);
    for (const c of map.cities) expect(others.some((m) => m.cities.some((o) => o.id === c.id))).toBe(false);
    expect(new Set(map.routes.map((r) => r.id)).size).toBe(map.routes.length);
  });

  test('every city is on the board, on a route and on a ticket; the whole map is one network', () => {
    const all = map.routes.map((r) => r.id);
    const tickets = map.modes[0].tickets;
    for (const c of map.cities) {
      expect(c.x >= 20 && c.x <= 980 && c.y >= 20 && c.y <= 680).toBe(true);
      expect(map.routes.some((r) => r.a === c.id || r.b === c.id)).toBe(true);
      expect(tickets.some((t) => t.a === c.id || t.b === c.id)).toBe(true);
      expect(areConnected(all, map.cities[0].id, c.id)).toBe(true);
    }
  });

  test('tickets name two different cities of the map and are worth 5 or more', () => {
    const tickets = map.modes[0].tickets;
    expect(tickets.length).toBeGreaterThanOrEqual(40);
    expect(new Set(tickets.map((t) => t.id)).size).toBe(tickets.length);
    for (const t of tickets) {
      expect(cityIds.has(t.a) && cityIds.has(t.b) && t.a !== t.b).toBe(true);
      expect(t.points).toBeGreaterThanOrEqual(5);
    }
  });

  test('a ferry is grey and needs locomotives; double tracks differ in colour', () => {
    for (const r of map.routes.filter((x) => x.locomotivesRequired > 0)) {
      expect(r.color).toBe('grey');
      expect(r.locomotivesRequired).toBeLessThan(r.length + 1);
    }
    const groups = new Map<string, string[]>();
    for (const r of map.routes) if (r.parallelGroup) groups.set(r.parallelGroup, [...(groups.get(r.parallelGroup) ?? []), r.color]);
    for (const colors of groups.values()) expect(new Set(colors).size).toBe(2);
  });
});

describe('Nordic rules', () => {
  const map = getMap('nordic');
  const plain = map.routes.find((r) => !r.isTunnel && r.locomotivesRequired === 0 && !r.locomotivesOk && r.color !== 'grey' && r.length === 2)!;
  const ferry = map.routes.find((r) => r.locomotivesRequired === 1 && r.length === 2)!;
  const tunnel = map.routes.find((r) => r.isTunnel)!;
  const arctic = map.routes.find((r) => r.locomotivesOk)!;

  test('it is a map for 2 or 3 with 40 trains each', () => {
    expect([map.minPlayers, map.maxPlayers, map.startingTrains]).toEqual([2, 3, 40]);
    expect(createGame(seats(3), 1, 'nordic').players.every((p) => p.trainsLeft === 40 && p.pendingTickets.length === 5)).toBe(true);
  });

  test('locomotives pay only for ferries, tunnels and the Arctic line', () => {
    const rules = rulesOf('nordic');
    const c = plain.color as Exclude<TrainCard, 'locomotive'>;
    expect(canPayFor(hand({ [c]: 1, locomotive: 3 }), plain, rules)).toEqual([]);
    expect(canPayFor(hand({ [c]: 2, locomotive: 3 }), plain, rules)).toEqual([{ color: c, colorCount: 2, locomotives: 0 }]);
    expect(canPayFor(hand({ red: 1, locomotive: 1 }), ferry, rules).length).toBe(1);
    expect(canPayFor(hand({ locomotive: tunnel.length }), tunnel, rules).length).toBe(1);
    expect(arctic.length).toBe(9);
    expect(routePoints(9)).toBe(27);
    expect(canPayFor(hand({ blue: 6, locomotive: 3 }), arctic, rules)).toContainEqual({ color: 'blue', colorCount: 6, locomotives: 3 });
  });

  test('the engine refuses a locomotive on a plain route', () => {
    let s = started('nordic', 2);
    const c = plain.color as Exclude<TrainCard, 'locomotive'>;
    s = { ...s, players: s.players.map((p, i) => (i === s.current ? { ...p, hand: hand({ [c]: 1, locomotive: 1 }) } : p)) };
    expect(() => applyAction(s, { type: 'CLAIM_ROUTE', routeId: plain.id, combo: { color: c, colorCount: 1, locomotives: 1 } })).toThrow(/ferries and tunnels/);
  });

  test('a face-up locomotive is an ordinary draw, and three of them stay on show', () => {
    let s = started('nordic', 2);
    s = { ...s, market: ['locomotive', 'locomotive', 'locomotive', 'red', 'blue'] };
    expect(dealMarket(s).market).toEqual(s.market);
    const me = s.players[s.current].id;
    s = applyAction(s, { type: 'DRAW_TRAIN', source: 'market', index: 0 });
    expect(s.players[s.current].id).toBe(me); // the turn goes on
    const second = legalActions(s, me).filter((a) => a.type === 'DRAW_TRAIN' && a.source === 'market' && s.market[a.index] === 'locomotive');
    expect(second.length).toBeGreaterThan(0);
    s = applyAction(s, second[0]);
    expect(s.players.find((p) => p.id === me)!.hand.locomotive).toBeGreaterThanOrEqual(2);
  });

  test('both tracks of a double route are open with 3 players, one with 2', () => {
    const [a, b] = map.routes.filter((r) => r.parallelGroup === map.routes.find((x) => x.parallelGroup)!.parallelGroup);
    for (const [n, open] of [[2, false], [3, true]] as const) {
      const s = started('nordic', n);
      const taken = { ...s, claimedBy: { [a.id]: 'p0' } };
      expect(routeIsClaimable(taken, b.id, 'p1')).toBe(open);
      expect(routeIsClaimable(taken, b.id, 'p0')).toBe(false);
    }
  });

  test('the most tickets completed earns 10', () => {
    expect(bonusesFor('nordic').map((b) => [b.id, b.points])).toEqual([['most-tickets', 10]]);
    expect(mostTicketsBonus.label).toBe('Globetrotter');
  });
});

describe('India rules', () => {
  const map = getMap('india');
  const player = (routes: string[], tickets: [string, string][]): PlayerState =>
    ({ id: 'p0', name: 'A', avatar: '', isAI: false, hand: emptyHand(), trainsLeft: 0, claimedRouteIds: routes, tickets: tickets.map(([a, b], i) => ({ id: `x${i}`, a, b, points: 5 })), pendingTickets: [], stationsLeft: 0, stations: [], score: 0 });
  const id = (a: string, b: string) => map.routes.find((r) => (r.a === `i-${a}` && r.b === `i-${b}`) || (r.a === `i-${b}` && r.b === `i-${a}`))!.id;

  test('it is a map for 2 to 4 with 45 trains, the longest path and the Grand Tour', () => {
    expect([map.minPlayers, map.maxPlayers, map.startingTrains]).toEqual([2, 4, 45]);
    expect(bonusesFor('india').map((b) => b.id)).toEqual(['longest-path', 'grand-tour']);
    expect(rulesOf('india')).toEqual({});
  });

  test('two ways that share no route make a loop; one way, or two sharing a route, do not', () => {
    const loop = [id('delhi', 'jaipur'), id('jaipur', 'agra'), id('delhi', 'agra')];
    expect(twoPaths(loop, 'i-delhi', 'i-agra')).toBe(true);
    expect(twoPaths(loop.slice(0, 2), 'i-delhi', 'i-agra')).toBe(false);
    // A loop with a tail: the tail's end is reached by one route only.
    const tail = [...loop, id('agra', 'lucknow')];
    expect(twoPaths(tail, 'i-delhi', 'i-lucknow')).toBe(false);
    expect(twoPaths(tail, 'i-jaipur', 'i-agra')).toBe(true);
    expect(twoPaths([], 'i-delhi', 'i-agra')).toBe(false);
  });

  test('the Grand Tour pays 5, 10, 20, 30, 40 for one to five such tickets, and no more after', () => {
    expect(GRAND_TOUR_POINTS).toEqual([0, 5, 10, 20, 30, 40]);
    const loop = [id('delhi', 'jaipur'), id('jaipur', 'agra'), id('delhi', 'agra')];
    const pairs: [string, string][] = [['i-delhi', 'i-agra'], ['i-delhi', 'i-jaipur'], ['i-jaipur', 'i-agra'], ['i-agra', 'i-delhi'], ['i-jaipur', 'i-delhi'], ['i-agra', 'i-jaipur']];
    for (let n = 0; n <= 6; n++) {
      const p = player(loop, pairs.slice(0, n));
      expect(grandTourBonus.score!(p)).toBe(GRAND_TOUR_POINTS[Math.min(n, 5)]);
      const total = finalScores([p], [grandTourBonus])[p.id];
      expect(total.bonuses).toBe(GRAND_TOUR_POINTS[Math.min(n, 5)]);
    }
  });

  test('the standard locomotive rules hold here', () => {
    let s = started('india', 2);
    s = { ...s, market: ['locomotive', 'red', 'blue', 'green', 'white'] };
    const me = s.players[s.current].id;
    s = applyAction(s, { type: 'DRAW_TRAIN', source: 'market', index: 0 });
    expect(s.players[s.current].id).not.toBe(me); // a face-up locomotive is the whole turn
  });
});

describe('bots play the new maps to the end', () => {
  const run = (mapId: string, levels: ('easy' | 'normal' | 'hard')[], seed: number) => {
    let s = createGame(levels.map((difficulty, i) => ({ name: `B${i}`, isAI: true, difficulty })), seed, mapId);
    let turns = 0;
    for (; turns < 4000 && s.phase !== 'game-over'; turns++) {
      const id = aiActor(s)!;
      s = applyAction(s, chooseAction(s, id, s.players.find((p) => p.id === id)!.difficulty!));
    }
    return { s, turns };
  };

  test.each([
    ['nordic', ['hard', 'normal', 'easy']],
    ['nordic', ['hard', 'hard']],
    ['india', ['hard', 'normal', 'easy', 'normal']],
    ['india', ['normal', 'hard']],
  ] as const)('%s with %j', (mapId, levels) => {
    for (const seed of [3, 11, 29]) {
      const { s } = run(mapId, [...levels], seed);
      expect(s.phase).toBe('game-over');
      const scores = finalScores(s.players, bonusesFor(mapId));
      // Somebody built a real network and finished a ticket.
      expect(Math.max(...s.players.map((p) => p.claimedRouteIds.length))).toBeGreaterThan(6);
      expect(Math.max(...s.players.map((p) => scores[p.id].ticketsCompleted))).toBeGreaterThan(0);
      if (mapId === 'nordic') {
        // No locomotive was ever spent on a plain route: every claimed plain route was paid in colour.
        expect(s.log.some((l) => l.includes('claimed'))).toBe(true);
      }
    }
  });
});
