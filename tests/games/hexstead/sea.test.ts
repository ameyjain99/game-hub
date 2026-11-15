import { describe, expect, test } from 'vitest';
import { IllegalMove } from '../../../src/games/kit/engine';
import { geometry, isLand } from '../../../src/games/hexstead/board';
import {
  SEA_WIN_POINTS,
  createHexstead,
  hexKit,
  legalHomesteadSpots,
  legalRoadSpots,
  legalShipSpots,
  longestRoadOf,
  movableShips,
  rollDice,
  tileEdges,
  victoryPoints,
  type HxAction,
  type HxState,
} from '../../../src/games/hexstead/engine';

const seats = (n: number, ai = false) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI: ai, difficulty: 'normal' }));
const actor = (s: HxState) => hexKit.actor(s)!;
const play = (s: HxState, a: HxAction, id = actor(s)) => hexKit.apply(s, a, id);
const geo = geometry('newShores');
const sea = (s: HxState) => createHexstead(seats(s.players.length), 1, { mode: 'sea' });
void sea;

function setUp(s: HxState): HxState {
  while (s.phase === 'setup') {
    const id = actor(s);
    s = s.setup!.needRoad ? play(s, { type: 'BUILD_ROAD', edge: legalRoadSpots(s, id)[0] }) : play(s, { type: 'BUILD_HOMESTEAD', vertex: legalHomesteadSpots(s, id)[0] });
  }
  return s;
}

/** p0's build phase after setup, with plenty of cards. */
function building(seed = 3): HxState {
  const s = setUp(createHexstead(seats(3), seed, { mode: 'sea' }));
  return {
    ...s,
    phase: 'main',
    dice: [2, 3],
    players: s.players.map((p, i) => (i === 0 ? { ...p, hand: { timber: 9, clay: 9, wool: 9, grain: 9, stone: 9 } } : p)),
  };
}

/** A coastal corner of the home island, and a sea edge leaving it. */
function coastal(s: HxState): { v: number; e: number } {
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
    const b = createHexstead(seats(3), 4, { mode: 'sea' }).board;
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
    let s = createHexstead(seats(3), 5, { mode: 'sea' });
    for (const v of legalHomesteadSpots(s, 'p0')) expect(geo.vertices[v].tiles.some((t) => geo.tiles[t].island === 0)).toBe(true);
    const { v } = coastal(s);
    s = play(s, { type: 'BUILD_HOMESTEAD', vertex: v });
    const ships = legalShipSpots(s, 'p0');
    expect(ships.length).toBeGreaterThan(0);
    s = play(s, { type: 'BUILD_SHIP', edge: ships[0] });
    expect(s.ships[ships[0]]).toBe('p0');
  });

  test('a ship costs timber and wool, goes on a sea side next to your building or ship, and links to a road only through a building', () => {
    let s = building();
    const { v, e } = coastal(s);
    s = { ...s, buildings: s.buildings.map((b, i) => (i === v ? { player: 'p0', town: false } : b)) };
    expect(legalShipSpots(s, 'p0')).toContain(e);
    const before = s.players[0].hand;
    s = play(s, { type: 'BUILD_SHIP', edge: e });
    expect(s.players[0].hand.timber).toBe(before.timber - 1);
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
    s = { ...s, buildings: s.buildings.map((b, i) => (i === v ? { player: 'p0', town: false } : b)) };
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

  test('roads and ships make one Longest Route only through your own building', () => {
    let s = building();
    const { v, e } = coastal(s);
    s = { ...s, buildings: s.buildings.map((b, i) => (i === v ? { player: 'p0', town: false } : b)) };
    const land = geo.vertices[v].edges.find((x) => x !== e && geo.edges[x].tiles.some((t) => isLand(s.board.terrain[t])) && s.roads[x] === null)!;
    s = { ...s, roads: s.roads.map((r, i) => (i === land ? 'p0' : r)), ships: s.ships.map((r, i) => (i === e ? 'p0' : r)) };
    const joined = longestRoadOf(s, 'p0');
    const without = longestRoadOf({ ...s, buildings: s.buildings.map((b, i) => (i === v ? null : b)) }, 'p0');
    expect(joined).toBeGreaterThan(without);
  });
});

describe('the corsair, goldfields and landfall', () => {
  test('a 7 may send the corsair to sea instead of the raider; no ship can be built beside it', () => {
    let s = building();
    const { v, e } = coastal(s);
    s = { ...s, buildings: s.buildings.map((b, i) => (i === v ? { player: 'p0', town: false } : b)) };
    const target = geo.edges[e].tiles.find((t) => s.board.terrain[t] === 'sea')!;
    s = { ...s, phase: 'raider', afterRaider: 'main' };
    const raider = s.board.raider;
    s = play(s, { type: 'MOVE_RAIDER', tile: target });
    expect(s.board.pirate).toBe(target);
    expect(s.board.raider).toBe(raider);
    expect(legalShipSpots(s, 'p0')).not.toContain(e);
    for (const x of tileEdges(s, target)) expect(legalShipSpots(s, 'p0')).not.toContain(x);
  });

  test('a goldfield pays the resources its owners pick', () => {
    let s = building();
    const gold = s.board.terrain.indexOf('gold');
    const corner = geo.tiles[gold].corners[0];
    const n = s.board.numbers[gold]!;
    let seed = 1;
    while (rollDice(seed)[0][0] + rollDice(seed)[0][1] !== n) seed++;
    s = { ...s, phase: 'roll', dice: null, seed, buildings: s.buildings.map((b, i) => (i === corner ? { player: 'p1', town: true } : b)) };
    s = play(s, { type: 'ROLL' }, 'p0');
    expect(s.phase).toBe('gold');
    expect(actor(s)).toBe('p1');
    expect(() => play(s, { type: 'PICK_GOLD', cards: { stone: 1 } }, 'p1')).toThrow(IllegalMove);
    const before = s.players[1].hand.stone;
    s = play(s, { type: 'PICK_GOLD', cards: { stone: 2 } }, 'p1');
    expect(s.players[1].hand.stone).toBe(before + 2);
    expect(s.phase).toBe('main');
  });

  test('your first homestead on each outer island is worth 2 more points', () => {
    let s = building();
    const island = geo.vertices.findIndex((vx) => vx.tiles.some((t) => geo.tiles[t].island === 1 && isLand(s.board.terrain[t])));
    const e = geo.vertices[island].edges.find((x) => geo.edges[x].tiles.some((t) => s.board.terrain[t] === 'sea'))!;
    s = { ...s, ships: s.ships.map((r, i) => (i === e ? 'p0' : r)) };
    const before = victoryPoints(s, 'p0');
    s = play(s, { type: 'BUILD_HOMESTEAD', vertex: island });
    expect(victoryPoints(s, 'p0')).toBe(before + 3);
    expect(s.landfall.p0).toEqual([1]);
  });

  test(`the game is won at ${SEA_WIN_POINTS} points`, () => {
    const s = building();
    expect(hexKit.seatError(5, { mode: 'sea' })).not.toBeNull();
    expect(hexKit.seatError(4, { mode: 'sea' })).toBeNull();
    // Ten points is not enough at sea.
    const ten = { ...s, buildings: s.buildings.map((b) => (b?.player === 'p0' ? { ...b, town: true } : b)), landfall: { ...s.landfall, p0: [1, 2] } };
    const after = play(ten, { type: 'BANK_TRADE', give: 'timber', get: 'clay' });
    expect(victoryPoints(after, 'p0')).toBeLessThan(SEA_WIN_POINTS);
    expect(after.over).toBe(false);
  });
});

test('bots play Open Sea to the end, and some sail to the outer islands', () => {
  let landfalls = 0;
  for (let seed = 1; seed <= 6; seed++) {
    let s = createHexstead(seats(3, true), seed, { mode: 'sea' });
    for (let i = 0; i < 40000 && !s.over; i++) s = hexKit.apply(s, hexKit.bot(s), actor(s));
    expect(s.over, `seed ${seed}`).toBe(true);
    landfalls += Object.values(s.landfall).reduce((t, l) => t + l.length, 0);
  }
  expect(landfalls).toBeGreaterThan(0);
}, 120_000);
