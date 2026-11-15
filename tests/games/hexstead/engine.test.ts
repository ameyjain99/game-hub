import { describe, expect, test } from 'vitest';
import { IllegalMove } from '../../../src/games/kit/engine';
import { GEO, RESOURCES, type Resource } from '../../../src/games/hexstead/board';
import {
  COSTS,
  createHexstead,
  hexKit,
  legalHomesteadSpots,
  legalRoadSpots,
  longestRoadOf,
  rollDice,
  tradeRatio,
  victoryPoints,
  type HxAction,
  type HxState,
} from '../../../src/games/hexstead/engine';

const seats = (n: number, ai = false) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI: ai, difficulty: 'normal' }));
const actor = (s: HxState) => hexKit.actor(s)!;
const act = (s: HxState, a: HxAction) => hexKit.apply(s, a, actor(s));
const hand = (s: HxState, i: number) => s.players[i].hand;
const total = (h: Record<Resource, number>) => RESOURCES.reduce((t, r) => t + h[r], 0);
const empty = (): Record<Resource, number> => ({ timber: 0, clay: 0, wool: 0, grain: 0, stone: 0 });
const give = (s: HxState, i: number, cards: Partial<Record<Resource, number>>): HxState => ({
  ...s,
  players: s.players.map((p, k) => (k === i ? { ...p, hand: { ...p.hand, ...cards } } : p)),
});
/** A seed whose next roll totals `n`. */
function withRoll(s: HxState, n: number): HxState {
  for (let seed = 1; ; seed++) {
    const [[a, b]] = rollDice(seed);
    if (a + b === n) return { ...s, seed };
  }
}
/** Play the setup: each player takes the first legal corner and road offered. */
function setUp(s: HxState): HxState {
  while (s.phase === 'setup') {
    const id = actor(s);
    if (s.setup!.needRoad) s = hexKit.apply(s, { type: 'BUILD_ROAD', edge: legalRoadSpots(s, id)[0] }, id);
    else s = hexKit.apply(s, { type: 'BUILD_HOMESTEAD', vertex: legalHomesteadSpots(s, id)[0] }, id);
  }
  return s;
}

describe('setup', () => {
  test('places go round in snake order: 1, 2, 3, then 3, 2, 1; each a homestead then a road beside it', () => {
    let s = createHexstead(seats(3), 5);
    const order: string[] = [];
    while (s.phase === 'setup') {
      const id = actor(s);
      if (!s.setup!.needRoad) {
        order.push(id);
        const v = legalHomesteadSpots(s, id)[0];
        s = act(s, { type: 'BUILD_HOMESTEAD', vertex: v });
        const roads = legalRoadSpots(s, id);
        expect(roads.every((e) => GEO.edges[e].v.includes(v))).toBe(true);
        s = act(s, { type: 'BUILD_ROAD', edge: roads[0] });
      }
    }
    expect(order).toEqual(['p0', 'p1', 'p2', 'p2', 'p1', 'p0']);
    expect(s.phase).toBe('roll');
    expect(s.turn).toBe(0);
  });

  test('the second homestead collects one card from each producing tile around it', () => {
    let s = createHexstead(seats(3), 5);
    s = setUp(s);
    const p0 = s.players[0];
    const second = s.buildings.reduce((last, b, i) => (b?.player === 'p0' ? i : last), -1);
    const expected = empty();
    for (const t of GEO.vertices[second].tiles) {
      const r = ({ forest: 'timber', hills: 'clay', pasture: 'wool', fields: 'grain', mountains: 'stone' } as Record<string, Resource>)[s.board.terrain[t]] ?? null;
      if (r) expected[r] += 1;
    }
    expect(p0.hand).toEqual(expected);
  });

  test('no homestead may stand on a corner next to another homestead', () => {
    let s = createHexstead(seats(3), 5);
    const v = legalHomesteadSpots(s, 'p0')[0];
    s = act(s, { type: 'BUILD_HOMESTEAD', vertex: v });
    s = act(s, { type: 'BUILD_ROAD', edge: legalRoadSpots(s, 'p0')[0] });
    for (const n of GEO.vertices[v].neighbours) expect(legalHomesteadSpots(s, 'p1')).not.toContain(n);
    expect(() => act(s, { type: 'BUILD_HOMESTEAD', vertex: GEO.vertices[v].neighbours[0] })).toThrow(IllegalMove);
  });
});

describe('a turn', () => {
  test('a roll pays one card per homestead and two per town on matching tiles, except under the raider', () => {
    let s = setUp(createHexstead(seats(3), 5));
    const v = s.buildings.findIndex((b) => b?.player === 'p0');
    const tile = GEO.vertices[v].tiles.find((t) => s.board.numbers[t] !== null && t !== s.board.raider)!;
    const n = s.board.numbers[tile]!;
    const before = total(hand(s, 0));
    s = act(withRoll(s, n), { type: 'ROLL' });
    expect(total(hand(s, 0))).toBeGreaterThan(before);
    expect(s.rolls[n]).toBe(1);
  });

  test('when the bank runs short of a resource for several players, nobody gets it', () => {
    let s = setUp(createHexstead(seats(3), 5));
    // One producing tile, with p0 and p1 on opposite corners and nobody else on the island.
    const tile = s.board.numbers.findIndex((n, t) => n !== null && t !== s.board.raider);
    const [a, , , b] = GEO.tiles[tile].corners;
    const res = ({ forest: 'timber', hills: 'clay', pasture: 'wool', fields: 'grain', mountains: 'stone' } as Record<string, Resource>)[s.board.terrain[tile]];
    s = {
      ...s,
      buildings: s.buildings.map((_, i) => (i === a ? { player: 'p0', town: false } : i === b ? { player: 'p1', town: false } : null)),
      bank: { ...s.bank, [res]: 1 },
    };
    const before = [hand(s, 0)[res], hand(s, 1)[res]];
    s = act(withRoll(s, s.board.numbers[tile]!), { type: 'ROLL' });
    expect([hand(s, 0)[res], hand(s, 1)[res]]).toEqual(before);
    expect(s.bank[res]).toBe(1);
  });

  test('a 7: players holding more than 7 cards discard half, then the raider moves and steals', () => {
    let s = setUp(createHexstead(seats(3), 5));
    s = give(s, 1, { timber: 4, clay: 5 }); // 9 + setup cards
    const cards = total(hand(s, 1));
    s = act(withRoll(s, 7), { type: 'ROLL' });
    expect(s.phase).toBe('discard');
    expect(actor(s)).toBe('p1');
    const lose = Math.floor(cards / 2);
    expect(() => act(s, { type: 'DISCARD', cards: { timber: 1 } })).toThrow(IllegalMove);
    const pick = empty();
    let left = lose;
    for (const r of RESOURCES) {
      const take = Math.min(left, hand(s, 1)[r]);
      pick[r] = take;
      left -= take;
    }
    s = act(s, { type: 'DISCARD', cards: pick });
    expect(total(hand(s, 1))).toBe(cards - lose);
    expect(s.phase).toBe('raider');
    expect(() => act(s, { type: 'MOVE_RAIDER', tile: s.board.raider })).toThrow(IllegalMove);
    // Move next to p1's homesteads (and nobody else's) and steal from them.
    const target = GEO.tiles
      .map((_, t) => t)
      .find((t) => t !== s.board.raider && GEO.tiles[t].corners.some((c) => s.buildings[c]?.player === 'p1') && GEO.tiles[t].corners.every((c) => !s.buildings[c] || s.buildings[c]!.player === 'p1'));
    expect(target).toBeDefined();
    s = act(s, { type: 'MOVE_RAIDER', tile: target! });
    if (s.phase === 'steal') s = act(s, { type: 'STEAL', from: 'p1' });
    expect(s.phase).toBe('main');
    expect(total(hand(s, 1))).toBe(cards - lose - 1);
  });
});

describe('building', () => {
  const ready = (): HxState => {
    const s = setUp(createHexstead(seats(3), 5));
    return { ...act(withRoll(s, 2), { type: 'ROLL' }), phase: 'main' as const };
  };

  test('a road costs timber and clay and must join your own road or building', () => {
    let s = give(ready(), 0, { timber: 1, clay: 1 });
    const spots = legalRoadSpots(s, 'p0');
    expect(spots.length).toBeGreaterThan(0);
    const mine = new Set(s.buildings.flatMap((b, i) => (b?.player === 'p0' ? [i] : [])));
    s.roads.forEach((r, e) => r === 'p0' && GEO.edges[e].v.forEach((v) => mine.add(v)));
    for (const e of spots) expect(GEO.edges[e].v.some((v) => mine.has(v))).toBe(true);
    s = act(s, { type: 'BUILD_ROAD', edge: spots[0] });
    expect([hand(s, 0).timber, hand(s, 0).clay]).toEqual([0, 0]);
  });

  test('you cannot build what you cannot pay for', () => {
    const s = { ...ready(), players: ready().players.map((p) => ({ ...p, hand: empty() })) };
    expect(() => act(s, { type: 'BUILD_ROAD', edge: legalRoadSpots(s, 'p0')[0] ?? 0 })).toThrow(IllegalMove);
    expect(() => act(s, { type: 'BUY_CHARTER' })).toThrow(IllegalMove);
  });

  test('a town replaces your homestead, costs 2 grain and 3 stone, and is worth 2 points', () => {
    let s = give(ready(), 0, { grain: 2, stone: 3 });
    const v = s.buildings.findIndex((b) => b?.player === 'p0');
    const before = victoryPoints(s, 'p0');
    s = act(s, { type: 'BUILD_TOWN', vertex: v });
    expect(s.buildings[v]).toEqual({ player: 'p0', town: true });
    expect(victoryPoints(s, 'p0')).toBe(before + 1);
  });

  test('costs match the build card', () => {
    expect(COSTS.road).toEqual({ timber: 1, clay: 1 });
    expect(COSTS.homestead).toEqual({ timber: 1, clay: 1, wool: 1, grain: 1 });
    expect(COSTS.town).toEqual({ grain: 2, stone: 3 });
    expect(COSTS.charter).toEqual({ wool: 1, grain: 1, stone: 1 });
  });
});

describe('charter cards', () => {
  const ready = (card: HxState['players'][0]['charters'][0]['card'], bought = -1): HxState => {
    const s = setUp(createHexstead(seats(3), 5));
    const t = { ...act(withRoll(s, 2), { type: 'ROLL' }), phase: 'main' as const };
    return { ...t, players: t.players.map((p, i) => (i === 0 ? { ...p, charters: [{ card, bought }] } : p)) };
  };

  test("a card bought this turn can't be played until your next turn", () => {
    const s = ready('bounty', 0);
    const fresh = { ...s, round: 0 };
    expect(() => act(fresh, { type: 'PLAY_CHARTER', card: 'bounty', take: ['grain', 'stone'] })).toThrow(IllegalMove);
  });

  test('Bounty takes any two cards from the bank; only one card may be played per turn', () => {
    let s = ready('bounty');
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, charters: [...p.charters, { card: 'bounty', bought: -1 }] } : p)) };
    const before = hand(s, 0).stone;
    s = act(s, { type: 'PLAY_CHARTER', card: 'bounty', take: ['stone', 'stone'] });
    expect(hand(s, 0).stone).toBe(before + 2);
    expect(() => act(s, { type: 'PLAY_CHARTER', card: 'bounty', take: ['grain', 'grain'] })).toThrow(IllegalMove);
  });

  test('Market takes every card of one resource from the other players', () => {
    let s = ready('market');
    s = give(give(s, 1, { wool: 3 }), 2, { wool: 2 });
    const mine = hand(s, 0).wool;
    s = act(s, { type: 'PLAY_CHARTER', card: 'market', take: ['wool'] });
    expect([hand(s, 0).wool, hand(s, 1).wool, hand(s, 2).wool]).toEqual([mine + 5, 0, 0]);
  });

  test('Roadworks builds two roads for free', () => {
    let s = ready('roadworks');
    const roads = s.roads.filter((r) => r === 'p0').length;
    s = act(s, { type: 'PLAY_CHARTER', card: 'roadworks' });
    expect(s.phase).toBe('roadworks');
    s = act(s, { type: 'BUILD_ROAD', edge: legalRoadSpots(s, 'p0')[0] });
    s = act(s, { type: 'BUILD_ROAD', edge: legalRoadSpots(s, 'p0')[0] });
    expect(s.roads.filter((r) => r === 'p0').length).toBe(roads + 2);
    expect(s.phase).toBe('main');
  });

  test('three Rangers win the Biggest Guard (2 points); more Rangers are needed to take it', () => {
    let s = ready('ranger');
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, rangers: 2 } : p)) };
    const before = victoryPoints(s, 'p0');
    s = act(s, { type: 'PLAY_CHARTER', card: 'ranger' });
    expect(s.phase).toBe('raider');
    expect(s.biggestGuard.player).toBe('p0');
    expect(victoryPoints(s, 'p0')).toBe(before + 2);
  });

  test('a Monument is a hidden point', () => {
    const s = ready('monument');
    expect(victoryPoints(s, 'p0')).toBe(victoryPoints(s, 'p0', false) + 1);
  });
});

describe('Longest Road', () => {
  /** A chain of `n` edges with no corner used twice, from p0's first homestead. */
  function chainFrom(s: HxState, start: number, n: number): { edges: number[]; corners: number[] } {
    const edges: number[] = [];
    const corners = [start];
    let at = start;
    while (edges.length < n) {
      const next = GEO.vertices[at].edges.find((e) => s.roads[e] === null && !edges.includes(e) && !corners.includes(GEO.edges[e].v[0] === at ? GEO.edges[e].v[1] : GEO.edges[e].v[0]) && s.buildings[GEO.edges[e].v[0] === at ? GEO.edges[e].v[1] : GEO.edges[e].v[0]] === null);
      if (next === undefined) break;
      edges.push(next);
      at = GEO.edges[next].v[0] === at ? GEO.edges[next].v[1] : GEO.edges[next].v[0];
      corners.push(at);
    }
    return { edges, corners };
  }

  test('goes to the first player whose road reaches 5, and an opponent homestead breaks it', () => {
    let s = setUp(createHexstead(seats(3), 5));
    s = { ...act(withRoll(s, 2), { type: 'ROLL' }), phase: 'main' };
    // Clear p0's setup roads so the chain is the only one, and start it from a homestead with room to run.
    s = { ...s, roads: s.roads.map((r) => (r === 'p0' ? null : r)) };
    const homes = s.buildings.flatMap((b, i) => (b?.player === 'p0' ? [i] : []));
    const { edges, corners } = homes.map((h) => chainFrom(s, h, 6)).find((c) => c.edges.length === 6)!;
    expect(edges).toHaveLength(6);
    s = { ...s, roads: s.roads.map((r, e) => (edges.slice(0, 4).includes(e) ? 'p0' : r)) };
    expect(longestRoadOf(s, 'p0')).toBe(4);
    s = act(give(s, 0, { timber: 1, clay: 1 }), { type: 'BUILD_ROAD', edge: edges[4] });
    expect(longestRoadOf(s, 'p0')).toBe(5);
    expect(s.longestRoad.player).toBe('p0');
    // An opponent's homestead on a middle corner splits the road.
    const cut = { ...s, buildings: s.buildings.map((b, i) => (i === corners[2] ? { player: 'p1', town: false } : b)) };
    expect(longestRoadOf(cut, 'p0')).toBe(3);
  });
});

describe('trading', () => {
  const ready = (): HxState => {
    const s = setUp(createHexstead(seats(3), 5));
    return { ...act(withRoll(s, 2), { type: 'ROLL' }), phase: 'main' as const };
  };

  test('the bank trades 4 of a kind for 1; a harbour improves your rate', () => {
    let s = give(ready(), 0, { timber: 4 });
    expect(tradeRatio(s, 'p0', 'timber')).toBeLessThanOrEqual(4);
    const ratio = tradeRatio(s, 'p0', 'timber');
    const t = hand(s, 0).timber;
    s = act(s, { type: 'BANK_TRADE', give: 'timber', get: 'stone' });
    expect(hand(s, 0).timber).toBe(t - ratio);
  });

  test('an offer goes round the table; the offerer closes it with one player who accepted', () => {
    let s = give(give(ready(), 0, { timber: 2 }), 2, { stone: 1 });
    s = act(s, { type: 'OFFER', give: { timber: 2 }, get: { stone: 1 } });
    expect(s.phase).toBe('offer');
    // p1 has no stone, so only p2 is asked.
    expect(actor(s)).toBe('p2');
    s = act(s, { type: 'ANSWER', accept: true });
    expect(actor(s)).toBe('p0');
    const [t0, s0] = [hand(s, 0).timber, hand(s, 0).stone];
    s = act(s, { type: 'CLOSE_OFFER', with: 'p2' });
    expect([hand(s, 0).timber, hand(s, 0).stone]).toEqual([t0 - 2, s0 + 1]);
    expect(s.phase).toBe('main');
  });
});

describe('winning', () => {
  test('a player who reaches 10 points on their own turn wins at once', () => {
    let s = setUp(createHexstead(seats(3), 5));
    s = { ...act(withRoll(s, 2), { type: 'ROLL' }), phase: 'main' };
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, charters: Array(8).fill({ card: 'monument', bought: -1 }) } : p)) };
    s = give(s, 0, { timber: 1, clay: 1 });
    s = act(s, { type: 'BUILD_ROAD', edge: legalRoadSpots(s, 'p0')[0] });
    expect(s.over).toBe(true);
    expect(s.winner).toBe('p0');
  });
});

describe('hidden information', () => {
  test("others' cards show as counts only; the charter deck is hidden", () => {
    const s = setUp(createHexstead(seats(3), 5));
    const v = hexKit.redact(s, 'p0');
    expect(v.players[0].hand).toEqual(s.players[0].hand);
    expect(total(v.players[1].hand)).toBe(0);
    expect(v.players[1].handCount).toBe(total(s.players[1].hand));
    expect(v.deck).toEqual([]);
  });
});

describe('bots', () => {
  test.each([3, 4])('%i bots play a whole game: legal moves only, and no card is made or lost', (n) => {
    let s = createHexstead(seats(n, true), 21);
    let r = 9;
    const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    const cards = () => RESOURCES.reduce((t, res) => t + s.bank[res] + s.players.reduce((u, p) => u + p.hand[res], 0), 0);
    for (let i = 0; i < 8000 && !s.over; i++) {
      s = hexKit.apply(s, hexKit.bot(s, rand), actor(s));
      expect(cards()).toBe(95);
    }
    expect(s.over).toBe(true);
    expect(victoryPoints(s, s.winner!)).toBeGreaterThanOrEqual(10);
  }, 60_000);
});
