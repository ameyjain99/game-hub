import { describe, expect, test } from 'vitest';
import { IllegalMove } from '../../../src/games/kit/engine';
import { geometry, isLand } from '../../../src/games/catan/board';
import {
  SEAFARERS_WIN_POINTS,
  createCatan,
  catanKit,
  legalSettlementSpots,
  legalRoadSpots,
  legalShipSpots,
  longestRoadOf,
  movableShips,
  rollDice,
  tileEdges,
  victoryPoints,
  type CatanAction,
  type CatanState,
} from '../../../src/games/catan/engine';

const seats = (n: number, ai = false) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI: ai, difficulty: 'normal' }));
const actor = (s: CatanState) => catanKit.actor(s)!;
const play = (s: CatanState, a: CatanAction, id = actor(s)) => catanKit.apply(s, a, id);
const geo = geometry('newShores');
const sea = (s: CatanState) => createCatan(seats(s.players.length), 1, { mode: 'seafarers' });
void sea;

function setUp(s: CatanState): CatanState {
  while (s.phase === 'setup') {
    const id = actor(s);
    s = s.setup!.needRoad ? play(s, { type: 'BUILD_ROAD', edge: legalRoadSpots(s, id)[0] }) : play(s, { type: 'BUILD_SETTLEMENT', vertex: legalSettlementSpots(s, id)[0] });
  }
  return s;
}

/** p0's build phase after setup, with plenty of cards. */
function building(seed = 3): CatanState {
  const s = setUp(createCatan(seats(3), seed, { mode: 'seafarers' }));
  return {
    ...s,
    phase: 'main',
    dice: [2, 3],
    players: s.players.map((p, i) => (i === 0 ? { ...p, hand: { lumber: 9, brick: 9, wool: 9, grain: 9, ore: 9 } } : p)),
  };
}

/** A coastal corner of the home island, and a sea edge leaving it. */
function coastal(s: CatanState): { v: number; e: number } {
  for (let v = 0; v < geo.vertices.length; v++) {
    const vx = geo.vertices[v];
    if (!vx.tiles.some((t) => geo.tiles[t].island === 0) || s.buildings[v] || vx.neighbours.some((n) => s.buildings[n])) continue;
    const e = vx.edges.find((x) => geo.edges[x].tiles.some((t) => s.board.terrain[t] === 'sea') && s.roads[x] === null && s.ships[x] === null && !geo.edges[x].tiles.includes(s.board.pirate!));
    if (e !== undefined) return { v, e };
  }
  throw new Error('no coastal corner');
}

describe('the New Shores map', () => {
  test('a home island of 19 tiles, three outer islands of 3 tiles, and sea between them', () => {
    const b = createCatan(seats(3), 4, { mode: 'seafarers' }).board;
    expect(b.layout).toBe('newShores');
    expect(geo.tiles).toHaveLength(58);
    const land = geo.tiles.filter((_, i) => isLand(b.terrain[i]));
    expect(land.filter((t) => t.island === 0)).toHaveLength(19);
    for (const k of [1, 2, 3]) expect(geo.tiles.filter((t) => t.island === k)).toHaveLength(3);
    expect(b.terrain.filter((t) => t === 'gold')).toHaveLength(2);
    // No two islands touch.
    geo.tiles.forEach((t) => {
      if (t.island < 0) return;
      for (const n of t.neighbours) if (geo.tiles[n].island >= 0) expect(geo.tiles[n].island).toBe(t.island);
    });
    expect(geo.harborEdges).toHaveLength(9);
    expect(b.terrain[b.pirate!]).toBe('sea');
  });
});

describe('ships', () => {
  test('setup is on the home island, and the second piece of a placement may be a ship', () => {
    let s = createCatan(seats(3), 5, { mode: 'seafarers' });
    for (const v of legalSettlementSpots(s, 'p0')) expect(geo.vertices[v].tiles.some((t) => geo.tiles[t].island === 0)).toBe(true);
    const { v } = coastal(s);
    s = play(s, { type: 'BUILD_SETTLEMENT', vertex: v });
    const ships = legalShipSpots(s, 'p0');
    expect(ships.length).toBeGreaterThan(0);
    s = play(s, { type: 'BUILD_SHIP', edge: ships[0] });
    expect(s.ships[ships[0]]).toBe('p0');
  });

  test('a ship costs lumber and wool, goes on a sea side next to your building or ship, and links to a road only through a building', () => {
    let s = building();
    const { v, e } = coastal(s);
    s = { ...s, buildings: s.buildings.map((b, i) => (i === v ? { player: 'p0', city: false } : b)) };
    expect(legalShipSpots(s, 'p0')).toContain(e);
    const before = s.players[0].hand;
    s = play(s, { type: 'BUILD_SHIP', edge: e });
    expect(s.players[0].hand.lumber).toBe(before.lumber - 1);
    expect(s.players[0].hand.wool).toBe(before.wool - 1);
    // From the ship's far end another ship may follow, but not a road.
    const far = geo.edges[e].v.find((x) => x !== v)!;
    const next = geo.vertices[far].edges.filter((x) => x !== e);
    const shipNext = legalShipSpots(s, 'p0').filter((x) => next.includes(x));
    expect(shipNext.length).toBeGreaterThan(0);
    expect(legalRoadSpots(s, 'p0').filter((x) => next.includes(x) && s.roads.every((r, i) => !(r === 'p0' && geo.edges[i].v.includes(far))))).toEqual([]);
  });

  test('one ship a turn may move: from the open end of a line, and not on the turn it was built', () => {
    let s = building();
    const { v, e } = coastal(s);
    s = { ...s, buildings: s.buildings.map((b, i) => (i === v ? { player: 'p0', city: false } : b)) };
    s = play(s, { type: 'BUILD_SHIP', edge: e });
    expect(movableShips(s, 'p0')).toEqual([]);
    s = { ...s, newShips: [] };
    expect(movableShips(s, 'p0')).toContain(e);
    const to = legalShipSpots(s, 'p0', e).find((x) => x !== e)!;
    s = play(s, { type: 'MOVE_SHIP', from: e, to });
    expect(s.ships[to]).toBe('p0');
    expect(s.ships[e]).toBeNull();
    expect(() => play(s, { type: 'MOVE_SHIP', from: to, to: e })).toThrow(IllegalMove);
  });

  test('roads and ships make one Longest Trade Route only through your own building', () => {
    let s = building();
    const { v, e } = coastal(s);
    s = { ...s, buildings: s.buildings.map((b, i) => (i === v ? { player: 'p0', city: false } : b)) };
    const land = geo.vertices[v].edges.find((x) => x !== e && geo.edges[x].tiles.some((t) => isLand(s.board.terrain[t])) && s.roads[x] === null)!;
    s = { ...s, roads: s.roads.map((r, i) => (i === land ? 'p0' : r)), ships: s.ships.map((r, i) => (i === e ? 'p0' : r)) };
    const joined = longestRoadOf(s, 'p0');
    const without = longestRoadOf({ ...s, buildings: s.buildings.map((b, i) => (i === v ? null : b)) }, 'p0');
    expect(joined).toBeGreaterThan(without);
  });
});

describe('the pirate, gold fields and island bonus', () => {
  test('a 7 may send the pirate to sea instead of the robber; no ship can be built beside it', () => {
    let s = building();
    const { v, e } = coastal(s);
    s = { ...s, buildings: s.buildings.map((b, i) => (i === v ? { player: 'p0', city: false } : b)) };
    const target = geo.edges[e].tiles.find((t) => s.board.terrain[t] === 'sea')!;
    s = { ...s, phase: 'robber', afterRobber: 'main' };
    const robber = s.board.robber;
    s = play(s, { type: 'MOVE_ROBBER', tile: target });
    expect(s.board.pirate).toBe(target);
    expect(s.board.robber).toBe(robber);
    expect(legalShipSpots(s, 'p0')).not.toContain(e);
    for (const x of tileEdges(s, target)) expect(legalShipSpots(s, 'p0')).not.toContain(x);
  });

  test('a gold field pays the resources its owners pick', () => {
    let s = building();
    const gold = s.board.terrain.indexOf('gold');
    const corner = geo.tiles[gold].corners[0];
    const n = s.board.numbers[gold]!;
    let seed = 1;
    while (rollDice(seed)[0][0] + rollDice(seed)[0][1] !== n) seed++;
    s = { ...s, phase: 'roll', dice: null, seed, buildings: s.buildings.map((b, i) => (i === corner ? { player: 'p1', city: true } : b)) };
    s = play(s, { type: 'ROLL' }, 'p0');
    expect(s.phase).toBe('gold');
    expect(actor(s)).toBe('p1');
    expect(() => play(s, { type: 'PICK_GOLD', cards: { ore: 1 } }, 'p1')).toThrow(IllegalMove);
    const before = s.players[1].hand.ore;
    s = play(s, { type: 'PICK_GOLD', cards: { ore: 2 } }, 'p1');
    expect(s.players[1].hand.ore).toBe(before + 2);
    expect(s.phase).toBe('main');
  });

  test('your first settlement on each outer island is worth 2 more points', () => {
    let s = building();
    const island = geo.vertices.findIndex((vx) => vx.tiles.some((t) => geo.tiles[t].island === 1 && isLand(s.board.terrain[t])));
    const e = geo.vertices[island].edges.find((x) => geo.edges[x].tiles.some((t) => s.board.terrain[t] === 'sea'))!;
    s = { ...s, ships: s.ships.map((r, i) => (i === e ? 'p0' : r)) };
    const before = victoryPoints(s, 'p0');
    s = play(s, { type: 'BUILD_SETTLEMENT', vertex: island });
    expect(victoryPoints(s, 'p0')).toBe(before + 3);
    expect(s.islandBonus.p0).toEqual([1]);
  });

  test(`the game is won at ${SEAFARERS_WIN_POINTS} points`, () => {
    const s = building();
    expect(catanKit.seatError(5, { mode: 'seafarers' })).not.toBeNull();
    expect(catanKit.seatError(4, { mode: 'seafarers' })).toBeNull();
    // Ten points is not enough at sea.
    const ten = { ...s, buildings: s.buildings.map((b) => (b?.player === 'p0' ? { ...b, city: true } : b)), islandBonus: { ...s.islandBonus, p0: [1, 2] } };
    const after = play(ten, { type: 'BANK_TRADE', give: 'lumber', get: 'brick' });
    expect(victoryPoints(after, 'p0')).toBeLessThan(SEAFARERS_WIN_POINTS);
    expect(after.over).toBe(false);
  });
});

test('bots play Seafarers to the end, and some sail to the outer islands', () => {
  let islandBonuses = 0;
  for (let seed = 1; seed <= 6; seed++) {
    let s = createCatan(seats(3, true), seed, { mode: 'seafarers' });
    for (let i = 0; i < 40000 && !s.over; i++) s = catanKit.apply(s, catanKit.bot(s), actor(s));
    expect(s.over, `seed ${seed}`).toBe(true);
    islandBonuses += Object.values(s.islandBonus).reduce((t, l) => t + l.length, 0);
  }
  expect(islandBonuses).toBeGreaterThan(0);
}, 120_000);
