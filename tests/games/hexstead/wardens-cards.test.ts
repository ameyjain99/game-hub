/**
 * Wardens: the full edict decks and the choices the original leaves to the
 * players (who discards what, which town falls, where a pushed warden goes).
 */
import { describe, expect, test } from 'vitest';
import { IllegalMove, nextRandom } from '../../../src/games/kit/engine';
import { geometry, YIELD } from '../../../src/games/hexstead/board';
import {
  bankRatio,
  createHexstead,
  hexKit,
  legalHomesteadSpots,
  legalRoadSpots,
  legalWardenSpots,
  openRoads,
  rollDice,
  victoryPoints,
  type HxAction,
  type HxPlayer,
  type HxState,
} from '../../../src/games/hexstead/engine';
import { EDICT_DECKS, GUILDS, OMEN_FACES, type Edict } from '../../../src/games/hexstead/wardens';

const seats = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    name: `P${i}`,
    isAI: false,
    difficulty: 'normal',
  }));
const actor = (s: HxState) => hexKit.actor(s)!;
const play = (s: HxState, a: HxAction, id = actor(s)) => hexKit.apply(s, a, id);
const geo = geometry('standard');
const RICH = { timber: 9, clay: 9, wool: 9, grain: 9, stone: 9 };
const NONE = { timber: 0, clay: 0, wool: 0, grain: 0, stone: 0 };
const NO_GOODS = { parchment: 0, linen: 0, silver: 0 };
const otherEnd = (e: number, v: number) => (geo.edges[e].v[0] === v ? geo.edges[e].v[1] : geo.edges[e].v[0]);

function setUp(s: HxState): HxState {
  while (s.phase === 'setup') {
    const id = actor(s);
    s = s.setup!.needRoad
      ? play(s, { type: 'BUILD_ROAD', edge: legalRoadSpots(s, id)[0] })
      : play(s, {
          type: 'BUILD_HOMESTEAD',
          vertex: legalHomesteadSpots(s, id)[0],
        });
  }
  return s;
}

/** p0's build phase after setup: p0 rich, the others with empty hands. */
function building(seed = 3): HxState {
  const s = setUp(createHexstead(seats(3), seed, { mode: 'wardens' }));
  return {
    ...s,
    phase: 'main',
    dice: [2, 3],
    players: s.players.map((p, i) =>
      i === 0
        ? {
            ...p,
            hand: { ...RICH },
            goods: { parchment: 12, linen: 12, silver: 12 },
          }
        : { ...p, hand: { ...NONE }, goods: { ...NO_GOODS } },
    ),
  };
}

const edit = (s: HxState, i: number, patch: Partial<HxPlayer>): HxState => ({
  ...s,
  players: s.players.map((p, k) => (k === i ? { ...p, ...patch } : p)),
});
const holding = (s: HxState, i: number, edicts: Edict[]) => edit(s, i, { edicts });
/** Make one of a player's homesteads a town (a point ahead). */
const promoteHome = (s: HxState, id: string): HxState => {
  const v = s.buildings.findIndex((b) => b?.player === id && !b.town);
  return {
    ...s,
    buildings: s.buildings.map((b, k) => (k === v ? { player: id, town: true } : b)),
  };
};

/** A seed whose next roll is these dice, and whose omen die then shows `face`. */
function rigged(total: number, face: (typeof OMEN_FACES)[number], red?: number): number {
  for (let seed = 1; seed < 200000; seed++) {
    const [[a, b], next] = rollDice(seed);
    if (a + b !== total || (red !== undefined && a !== red)) continue;
    const [r] = nextRandom(next);
    if (OMEN_FACES[Math.floor(r * OMEN_FACES.length)] === face) return seed;
  }
  throw new Error('no seed');
}

describe('the decks', () => {
  test('each guild deck holds 18 edicts, the original count, with every card', () => {
    for (const g of GUILDS) expect(EDICT_DECKS[g]).toHaveLength(18);
    const count = (e: Edict) => GUILDS.flatMap((g) => EDICT_DECKS[g]).filter((x) => x === e).length;
    expect(count('merchant')).toBe(6);
    expect(count('spy')).toBe(3);
    for (const e of ['alchemist', 'inventor', 'deserter', 'diplomat', 'intrigue', 'commercial-harbor'] as Edict[]) expect(count(e)).toBe(2);
  });

  test('a played edict goes back under its own deck', () => {
    let s = holding(building(), 0, ['crane']);
    const size = s.edictDecks.academy.length;
    s = play(s, { type: 'PLAY_EDICT', edict: 'crane' });
    expect(s.edictDecks.academy).toHaveLength(size + 1);
    expect(s.edictDecks.academy.at(-1)).toBe('crane');
  });
});

describe('trading', () => {
  test('commodities can be offered to and asked of other players', () => {
    let s = edit(building(), 1, {
      goods: { parchment: 0, linen: 2, silver: 0 },
    });
    s = play(s, {
      type: 'OFFER',
      give: { timber: 1 },
      get: {},
      getGoods: { linen: 1 },
    });
    expect(s.offer!.asked).toEqual(['p1']);
    s = play(s, { type: 'ANSWER', accept: true }, 'p1');
    s = play(s, { type: 'CLOSE_OFFER', with: 'p1' }, 'p0');
    expect(s.players[0].goods.linen).toBe(13);
    expect(s.players[1].goods.linen).toBe(1);
    expect(s.players[1].hand.timber).toBe(1);
  });
});

describe('choices left to the players', () => {
  test('Saboteur: each player hit chooses which half of their cards to discard', () => {
    let s = holding(
      edit(edit(building(), 1, { hand: { ...NONE, grain: 4, stone: 2 } }), 2, {
        hand: { ...NONE, wool: 1 },
      }),
      0,
      ['saboteur'],
    );
    s = play(s, { type: 'PLAY_EDICT', edict: 'saboteur' });
    // p2's one card halves to nothing: only p1 is asked.
    expect(s.asks).toEqual([{ kind: 'discard', player: 'p1', count: 3 }]);
    expect(actor(s)).toBe('p1');
    expect(() => play(s, { type: 'END_TURN' }, 'p0')).toThrow(IllegalMove);
    expect(() => play(s, { type: 'RESOLVE', cards: { grain: 2 } }, 'p1')).toThrow(IllegalMove);
    s = play(s, { type: 'RESOLVE', cards: { grain: 1, stone: 2 } }, 'p1');
    expect(s.players[1].hand).toMatchObject({ grain: 3, stone: 0 });
    expect(s.asks).toEqual([]);
    expect(actor(s)).toBe('p0');
  });

  test('Wedding: a richer player gives the 2 cards of their choice', () => {
    let s = holding(
      edit(promoteHome(building(), 'p1'), 1, {
        hand: { ...NONE, clay: 2, stone: 3 },
      }),
      0,
      ['wedding'],
    );
    s = play(s, { type: 'PLAY_EDICT', edict: 'wedding' });
    expect(s.asks![0]).toEqual({
      kind: 'give',
      player: 'p1',
      to: 'p0',
      count: 2,
    });
    s = play(s, { type: 'RESOLVE', cards: { clay: 2 } }, 'p1');
    expect(s.players[0].hand.clay).toBe(11);
    expect(s.players[1].hand).toMatchObject({ clay: 0, stone: 3 });
  });

  test('Wedding: a richer player with 2 cards or fewer simply hands them over', () => {
    let s = holding(edit(promoteHome(building(), 'p1'), 1, { hand: { ...NONE, stone: 1 } }), 0, ['wedding']);
    s = play(s, { type: 'PLAY_EDICT', edict: 'wedding' });
    expect(s.asks).toEqual([]);
    expect(s.players[0].hand.stone).toBe(10);
  });

  test("Master Merchant: you see the richer player's hand, and only you, and take the 2 you choose", () => {
    let s = holding(
      edit(promoteHome(building(), 'p1'), 1, {
        hand: { ...NONE, grain: 3, stone: 1 },
        goods: { ...NO_GOODS, silver: 1 },
      }),
      0,
      ['master-merchant'],
    );
    s = play(s, { type: 'PLAY_EDICT', edict: 'master-merchant', target: 'p1' });
    expect(s.asks![0]).toEqual({
      kind: 'take',
      player: 'p0',
      from: 'p1',
      count: 2,
    });
    expect(hexKit.redact(s, 'p0').players[1].hand.grain).toBe(3);
    expect(hexKit.redact(s, 'p2').players[1].hand.grain).toBe(0);
    s = play(s, { type: 'RESOLVE', cards: { stone: 1 }, goods: { silver: 1 } }, 'p0');
    expect(s.players[0].hand.stone).toBe(10);
    expect(s.players[0].goods.silver).toBe(13);
    expect(s.players[1].hand.grain).toBe(3);
  });

  test("Spy: you look at a player's edicts and take the one you choose", () => {
    let s = holding(holding(building(), 1, ['merchant', 'alchemist']), 0, ['spy']);
    s = play(s, { type: 'PLAY_EDICT', edict: 'spy', target: 'p1' });
    expect(hexKit.redact(s, 'p0').players[1].edicts).toEqual(['merchant', 'alchemist']);
    expect(hexKit.redact(s, 'p2').players[1].edicts).toEqual([]);
    s = play(s, { type: 'RESOLVE', edict: 'alchemist' }, 'p0');
    expect(s.players[0].edicts).toEqual(['alchemist']);
    expect(s.players[1].edicts).toEqual(['merchant']);
  });

  test('a pillaged player chooses which town falls, its wall goes with it, and the roll pays only afterwards', () => {
    let s = promoteHome(building(), 'p0');
    const towns = s.buildings.flatMap((b, v) => (b?.player === 'p0' && b.town ? [v] : []));
    expect(towns).toHaveLength(2);
    s = {
      ...s,
      walls: s.walls.map((w, v) => w || v === towns[1]),
      players: s.players.map((p, i) => (i === 0 ? { ...p, walls: 1 } : p)),
    };
    s = {
      ...s,
      phase: 'roll',
      dice: null,
      marauders: 6,
      seed: rigged(8, 'ship'),
    };
    const cards = (x: HxState) => x.players.map((p) => Object.values(p.hand).reduce((a, b) => a + b, 0) + Object.values(p.goods).reduce((a, b) => a + b, 0));
    const before = cards(s);
    s = play(s, { type: 'ROLL' }, 'p0');
    expect(s.asks![0]).toEqual({ kind: 'pillage', player: 'p0' });
    expect(cards(s)).toEqual(before);
    s = play(s, { type: 'RESOLVE', vertex: towns[1] }, 'p0');
    expect(s.buildings[towns[1]]).toEqual({ player: 'p0', town: false });
    expect(s.buildings[towns[0]]).toEqual({ player: 'p0', town: true });
    expect(s.walls[towns[1]]).toBe(false);
    expect(s.players[0].walls).toBe(0);
    // p1 and p2 had one town each: theirs fall without asking.
    expect(s.buildings.filter((b) => b?.town)).toHaveLength(1);
    expect(s.asks).toEqual([]);
    expect(s.phase).toBe('main');
  });

  test('a tie for the best defence: each tied player draws from the deck of their choice, roller first', () => {
    let s = building();
    const a = legalWardenSpots(s, 'p0')[0];
    const b = legalWardenSpots(s, 'p1').find((v) => v !== a)!;
    s = {
      ...s,
      wardens: s.wardens.map((w, v) => (v === a ? { player: 'p0', level: 2, active: true, since: 0 } : v === b ? { player: 'p1', level: 2, active: true, since: 0 } : w)),
    };
    s = {
      ...s,
      edictDecks: {
        ...s.edictDecks,
        trade: ['merchant', ...s.edictDecks.trade],
        council: ['spy', ...s.edictDecks.council],
      },
    };
    s = {
      ...s,
      phase: 'roll',
      dice: null,
      marauders: 6,
      seed: rigged(8, 'ship'),
    };
    s = play(s, { type: 'ROLL' }, 'p0');
    expect(s.asks!.map((x) => [x.kind, x.player])).toEqual([
      ['draw', 'p0'],
      ['draw', 'p1'],
    ]);
    s = play(s, { type: 'RESOLVE', guild: 'trade' }, 'p0');
    s = play(s, { type: 'RESOLVE', guild: 'council' }, 'p1');
    expect(s.players[0].edicts).toEqual(['merchant']);
    expect(s.players[1].edicts).toEqual(['spy']);
    expect(s.players[0].defender + s.players[1].defender).toBe(0);
  });
});

describe('the hand limit of 4 edicts', () => {
  test('out of turn, a fifth edict is drawn, then its holder discards one of their choice under its deck', () => {
    let s = edit(holding(building(), 1, ['spy', 'wedding', 'bishop', 'warlord']), 1, { guilds: { trade: 0, council: 0, academy: 1 } });
    s = {
      ...s,
      edictDecks: {
        ...s.edictDecks,
        academy: ['crane', ...s.edictDecks.academy.filter((e) => e !== 'crane')],
      },
    };
    s = { ...s, phase: 'roll', dice: null, seed: rigged(8, 'academy', 2) };
    s = play(s, { type: 'ROLL' }, 'p0');
    expect(s.players[1].edicts).toHaveLength(5);
    expect(s.asks![0]).toEqual({ kind: 'edict-limit', player: 'p1' });
    s = play(s, { type: 'RESOLVE', edict: 'bishop' }, 'p1');
    expect(s.players[1].edicts).toEqual(['spy', 'wedding', 'warlord', 'crane']);
    expect(s.edictDecks.council.at(-1)).toBe('bishop');
    expect(s.phase).toBe('main');
  });

  test('on your own turn you may hold a fifth until you end the turn', () => {
    let s = edit(holding(building(), 0, ['spy', 'wedding', 'bishop', 'warlord']), 0, { guilds: { trade: 0, council: 0, academy: 1 } });
    s = {
      ...s,
      edictDecks: {
        ...s.edictDecks,
        academy: ['crane', ...s.edictDecks.academy.filter((e) => e !== 'crane')],
      },
    };
    s = { ...s, phase: 'roll', dice: null, seed: rigged(8, 'academy', 2) };
    s = play(s, { type: 'ROLL' }, 'p0');
    expect(s.players[0].edicts).toHaveLength(5);
    expect(s.asks).toEqual([]);
    s = play(s, { type: 'END_TURN' }, 'p0');
    expect(s.asks![0]).toEqual({ kind: 'edict-limit', player: 'p0' });
    expect(s.turn).toBe(0);
    s = play(s, { type: 'RESOLVE', edict: 'spy' }, 'p0');
    expect(s.players[0].edicts).toHaveLength(4);
    expect(s.turn).toBe(1);
  });
});

describe('the new edicts', () => {
  test('Alchemist: played before the roll, you set both number dice', () => {
    let s = holding(building(), 0, ['alchemist', 'crane']);
    s = { ...s, phase: 'roll', dice: null };
    expect(() => play(s, { type: 'PLAY_EDICT', edict: 'crane' })).toThrow(IllegalMove);
    s = play(s, { type: 'PLAY_EDICT', edict: 'alchemist', dice: [2, 4] });
    expect(s.dice).toEqual([2, 4]);
    expect(s.phase).not.toBe('roll');
    expect(s.players[0].edicts).toEqual(['crane']);
    const later = holding({ ...s, phase: 'main', asks: [] }, 0, ['alchemist']);
    expect(() => play(later, { type: 'PLAY_EDICT', edict: 'alchemist', dice: [3, 3] })).toThrow(IllegalMove);
  });

  test('Inventor: swaps two number tokens, but never a 2, 12, 6 or 8', () => {
    let s = holding(building(), 0, ['inventor', 'inventor']);
    const free = s.board.numbers.flatMap((n, t) => (n !== null && ![2, 6, 8, 12].includes(n) ? [t] : []));
    const fixed = s.board.numbers.findIndex((n) => n === 6);
    expect(() =>
      play(s, {
        type: 'PLAY_EDICT',
        edict: 'inventor',
        tiles: [free[0], fixed],
      }),
    ).toThrow(IllegalMove);
    const [a, b] = [free[0], free.find((t) => s.board.numbers[t] !== s.board.numbers[free[0]])!];
    const [na, nb] = [s.board.numbers[a], s.board.numbers[b]];
    s = play(s, { type: 'PLAY_EDICT', edict: 'inventor', tiles: [a, b] });
    expect([s.board.numbers[a], s.board.numbers[b]]).toEqual([nb, na]);
  });

  test("Merchant: a point and a 2:1 rate for its tile's resource, until another Merchant takes it over", () => {
    let s = holding(building(), 0, ['merchant']);
    const home = s.buildings.findIndex((b) => b?.player === 'p0');
    const tile = geo.vertices[home].tiles.find((t) => YIELD[s.board.terrain[t]])!;
    const res = YIELD[s.board.terrain[tile]]!;
    const pts = victoryPoints(s, 'p0');
    s = play(s, { type: 'PLAY_EDICT', edict: 'merchant', tile });
    expect(s.merchant).toEqual({ player: 'p0', tile });
    expect(victoryPoints(s, 'p0')).toBe(pts + 1);
    expect(bankRatio(s, 'p0', res)).toBe(2);
    // A tile nowhere near your buildings is refused.
    const far = geo.tiles.findIndex((t, i) => YIELD[s.board.terrain[i]] && !t.corners.some((c) => s.buildings[c]?.player === 'p1'));
    let t1 = holding({ ...s, turn: 1 }, 1, ['merchant', 'merchant']);
    expect(() => play(t1, { type: 'PLAY_EDICT', edict: 'merchant', tile: far })).toThrow(IllegalMove);
    const theirs = geo.vertices[t1.buildings.findIndex((b) => b?.player === 'p1')].tiles.find((t) => YIELD[t1.board.terrain[t]])!;
    t1 = play(t1, { type: 'PLAY_EDICT', edict: 'merchant', tile: theirs });
    expect(t1.merchant!.player).toBe('p1');
    expect(victoryPoints(t1, 'p0')).toBe(pts);
  });

  test("Diplomat: removes another player's open road; your own you may build again elsewhere", () => {
    let s = holding(building(), 0, ['diplomat', 'diplomat']);
    const theirs = s.roads.findIndex((r) => r === 'p1');
    expect(openRoads(s)).toContain(theirs);
    s = play(s, { type: 'PLAY_EDICT', edict: 'diplomat', edge: theirs });
    expect(s.roads[theirs]).toBeNull();
    const mine = s.roads.findIndex((r) => r === 'p0');
    s = play(s, { type: 'PLAY_EDICT', edict: 'diplomat', edge: mine });
    expect(s.roads[mine]).toBeNull();
    expect(s.asks![0]).toEqual({ kind: 'road', player: 'p0', skip: mine });
    const spot = legalRoadSpots(s, 'p0').find((e) => e !== mine)!;
    s = play(s, { type: 'RESOLVE', edge: spot }, 'p0');
    expect(s.roads[spot]).toBe('p0');
  });

  test("Diplomat: a road with its owner's pieces at both ends is not open", () => {
    let s = holding(building(), 0, ['diplomat']);
    const mine = s.roads.findIndex((r) => r === 'p0');
    const home = geo.edges[mine].v.find((v) => s.buildings[v]?.player === 'p0')!;
    const far = otherEnd(mine, home);
    const next = geo.vertices[far].edges.find((e) => e !== mine && s.roads[e] === null)!;
    s = { ...s, roads: s.roads.map((r, e) => (e === next ? 'p0' : r)) };
    expect(openRoads(s)).not.toContain(mine);
    expect(() => play(s, { type: 'PLAY_EDICT', edict: 'diplomat', edge: mine })).toThrow(IllegalMove);
  });

  test("Intrigue and displacing: the pushed warden's owner picks an empty corner along their roads", () => {
    // In an empty stretch of the island: p1's warden on c1, p1's roads c1-c2-c4, and a road of p0's onto c1.
    let s = holding(building(), 0, ['intrigue']);
    const clear = (v: number) => !s.buildings[v] && s.roads.every((r, e) => !r || !geo.edges[e].v.includes(v));
    const c1 = geo.vertices.findIndex((c, v) => clear(v) && c.edges.length === 3 && c.neighbours.every(clear) && c.neighbours.every((n) => geo.vertices[n].neighbours.every(clear)));
    const [e2, e3] = geo.vertices[c1].edges;
    const c2 = otherEnd(e2, c1);
    const e4 = geo.vertices[c2].edges.find((e) => e !== e2)!;
    const c4 = otherEnd(e4, c2);
    s = {
      ...s,
      roads: s.roads.map((r, e) => (e === e2 || e === e4 ? 'p1' : e === e3 ? 'p0' : r)),
    };
    s = {
      ...s,
      wardens: s.wardens.map((w, v) => (v === c1 ? { player: 'p1', level: 2, active: true, since: 0 } : w)),
    };
    s = play(s, { type: 'PLAY_EDICT', edict: 'intrigue', vertex: c1 });
    expect(s.wardens[c1]).toBeNull();
    expect(s.asks![0]).toMatchObject({
      kind: 'retreat',
      player: 'p1',
      from: c1,
    });
    expect(() => play(s, { type: 'RESOLVE', vertex: c1 }, 'p1')).toThrow(IllegalMove);
    s = play(s, { type: 'RESOLVE', vertex: c4 }, 'p1');
    expect(s.wardens[c4]).toEqual({
      player: 'p1',
      level: 2,
      active: true,
      since: 0,
    });
  });

  test('Deserter: the player picks which warden to give up; you place one of the same strength', () => {
    let s = holding(building(), 0, ['deserter']);
    const spots = geo.vertices.map((_, v) => v).filter((v) => !s.buildings[v] && geo.vertices[v].neighbours.every((n) => !s.buildings[n]));
    s = {
      ...s,
      wardens: s.wardens.map((w, v) => (v === spots[0] ? { player: 'p1', level: 1, active: false, since: 0 } : v === spots[5] ? { player: 'p1', level: 2, active: true, since: 0 } : w)),
    };
    s = play(s, { type: 'PLAY_EDICT', edict: 'deserter', target: 'p1' });
    expect(s.asks![0]).toEqual({ kind: 'desert', player: 'p1', to: 'p0' });
    s = play(s, { type: 'RESOLVE', vertex: spots[5] }, 'p1');
    expect(s.wardens[spots[5]]).toBeNull();
    expect(s.asks![0]).toEqual({
      kind: 'enlist',
      player: 'p0',
      level: 2,
      active: true,
    });
    const mine = legalWardenSpots(s, 'p0')[0];
    s = play(s, { type: 'RESOLVE', vertex: mine }, 'p0');
    expect(s.wardens[mine]).toMatchObject({
      player: 'p0',
      level: 2,
      active: true,
    });
  });

  test('Commercial Harbour: each player gives a commodity of their choice for your resource, once; none means no trade', () => {
    let s = holding(edit(building(), 1, { goods: { parchment: 0, linen: 2, silver: 1 } }), 0, ['commercial-harbor']);
    s = play(s, { type: 'PLAY_EDICT', edict: 'commercial-harbor' });
    s = play(s, { type: 'HARBOR', target: 'p1', give: 'timber' });
    expect(s.asks![0]).toEqual({ kind: 'harbor', player: 'p1', to: 'p0' });
    s = play(s, { type: 'RESOLVE', goods: { silver: 1 } }, 'p1');
    expect(s.players[0].goods.silver).toBe(13);
    expect(s.players[1].hand.timber).toBe(1);
    expect(() => play(s, { type: 'HARBOR', target: 'p1', give: 'clay' })).toThrow(IllegalMove);
    s = play(s, { type: 'HARBOR', target: 'p2', give: 'clay' });
    expect(s.players[0].hand.clay).toBe(9);
    expect(s.asks).toEqual([]);
  });

  test('Bishop: not before the marauders first land', () => {
    const s = holding(building(), 0, ['bishop']);
    expect(() => play(s, { type: 'PLAY_EDICT', edict: 'bishop' })).toThrow(IllegalMove);
    expect(play({ ...s, attacked: true }, { type: 'PLAY_EDICT', edict: 'bishop' }).phase).toBe('raider');
  });
});

describe('wardens', () => {
  test('a warden is promoted at most once a turn', () => {
    let s = edit(building(), 0, {
      guilds: { trade: 0, council: 3, academy: 0 },
    });
    const spot = legalWardenSpots(s, 'p0')[0];
    s = play(s, { type: 'BUILD_WARDEN', vertex: spot });
    s = play(s, { type: 'PROMOTE', vertex: spot });
    expect(() => play(s, { type: 'PROMOTE', vertex: spot })).toThrow(/once a turn/);
    expect(play({ ...s, round: s.round + 1 }, { type: 'PROMOTE', vertex: spot }).wardens[spot]!.level).toBe(3);
  });

  test('a chased raider goes to a numbered tile', () => {
    let s = building();
    const next = s.board.numbers.findIndex((n) => n !== null);
    const corner = geo.tiles[next].corners.find((c) => !s.buildings[c])!;
    s = {
      ...s,
      attacked: true,
      board: { ...s.board, raider: next },
      wardens: s.wardens.map((w, v) => (v === corner ? { player: 'p0', level: 1, active: true, since: 0 } : w)),
    };
    s = play(s, { type: 'CHASE', vertex: corner });
    const desert = s.board.numbers.findIndex((n, i) => n === null && s.board.terrain[i] !== 'sea');
    expect(() => play(s, { type: 'MOVE_RAIDER', tile: desert })).toThrow(IllegalMove);
  });
});

test('a player who leaves mid-choice is skipped, and play goes on', () => {
  let s = holding(edit(building(), 1, { hand: { ...NONE, grain: 4, stone: 2 } }), 0, ['saboteur']);
  s = play(s, { type: 'PLAY_EDICT', edict: 'saboteur' });
  expect(actor(s)).toBe('p1');
  s = hexKit.forfeit!(s, 'p1');
  expect(s.asks).toEqual([]);
  expect(actor(s)).toBe('p0');
});
