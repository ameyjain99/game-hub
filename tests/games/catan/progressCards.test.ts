/**
 * Cities & Knights: the full progress card decks and the choices the original leaves to the
 * players (who discards what, which city falls, where a pushed knight goes).
 */
import { describe, expect, test } from 'vitest';
import { IllegalMove, nextRandom } from '../../../src/games/kit/engine';
import { geometry, YIELD } from '../../../src/games/catan/board';
import {
  bankRatio,
  createCatan,
  catanKit,
  legalSettlementSpots,
  legalRoadSpots,
  legalKnightSpots,
  openRoads,
  rollDice,
  victoryPoints,
  type CatanAction,
  type CatanPlayer,
  type CatanState,
} from '../../../src/games/catan/engine';
import { PROGRESS_DECKS, AREAS, EVENT_DIE_FACES, type ProgressCard } from '../../../src/games/catan/citiesKnights';

const seats = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    name: `P${i}`,
    isAI: false,
    difficulty: 'normal',
  }));
const actor = (s: CatanState) => catanKit.actor(s)!;
const play = (s: CatanState, a: CatanAction, id = actor(s)) => catanKit.apply(s, a, id);
const geo = geometry('standard');
const RICH = { lumber: 9, brick: 9, wool: 9, grain: 9, ore: 9 };
const NONE = { lumber: 0, brick: 0, wool: 0, grain: 0, ore: 0 };
const NO_GOODS = { paper: 0, cloth: 0, coin: 0 };
const otherEnd = (e: number, v: number) => (geo.edges[e].v[0] === v ? geo.edges[e].v[1] : geo.edges[e].v[0]);

function setUp(s: CatanState): CatanState {
  while (s.phase === 'setup') {
    const id = actor(s);
    s = s.setup!.needRoad
      ? play(s, { type: 'BUILD_ROAD', edge: legalRoadSpots(s, id)[0] })
      : play(s, {
          type: 'BUILD_SETTLEMENT',
          vertex: legalSettlementSpots(s, id)[0],
        });
  }
  return s;
}

/** p0's build phase after setup: p0 rich, the others with empty hands. */
function building(seed = 3): CatanState {
  const s = setUp(createCatan(seats(3), seed, { mode: 'cities-knights' }));
  return {
    ...s,
    phase: 'main',
    dice: [2, 3],
    players: s.players.map((p, i) =>
      i === 0
        ? {
            ...p,
            hand: { ...RICH },
            goods: { paper: 12, cloth: 12, coin: 12 },
          }
        : { ...p, hand: { ...NONE }, goods: { ...NO_GOODS } },
    ),
  };
}

const edit = (s: CatanState, i: number, patch: Partial<CatanPlayer>): CatanState => ({
  ...s,
  players: s.players.map((p, k) => (k === i ? { ...p, ...patch } : p)),
});
const holding = (s: CatanState, i: number, progressCards: ProgressCard[]) => edit(s, i, { progressCards });
/** Make one of a player's settlements a city (a point ahead). */
const promoteHome = (s: CatanState, id: string): CatanState => {
  const v = s.buildings.findIndex((b) => b?.player === id && !b.city);
  return {
    ...s,
    buildings: s.buildings.map((b, k) => (k === v ? { player: id, city: true } : b)),
  };
};

/** A seed whose next roll is these dice, and whose event die then shows `face`. */
function rigged(total: number, face: (typeof EVENT_DIE_FACES)[number], red?: number): number {
  for (let seed = 1; seed < 200000; seed++) {
    const [[a, b], next] = rollDice(seed);
    if (a + b !== total || (red !== undefined && a !== red)) continue;
    const [r] = nextRandom(next);
    if (EVENT_DIE_FACES[Math.floor(r * EVENT_DIE_FACES.length)] === face) return seed;
  }
  throw new Error('no seed');
}

describe('the decks', () => {
  test('each area deck holds 18 progress cards, the original count, with every card', () => {
    for (const g of AREAS) expect(PROGRESS_DECKS[g]).toHaveLength(18);
    const count = (e: ProgressCard) => AREAS.flatMap((g) => PROGRESS_DECKS[g]).filter((x) => x === e).length;
    expect(count('merchant')).toBe(6);
    expect(count('spy')).toBe(3);
    for (const e of ['alchemist', 'inventor', 'deserter', 'diplomat', 'intrigue', 'commercial-harbor'] as ProgressCard[]) expect(count(e)).toBe(2);
  });

  test('a played progress card goes back under its own deck', () => {
    let s = holding(building(), 0, ['crane']);
    const size = s.progressCardDecks.science.length;
    s = play(s, { type: 'PLAY_PROGRESS', progressCard: 'crane' });
    expect(s.progressCardDecks.science).toHaveLength(size + 1);
    expect(s.progressCardDecks.science.at(-1)).toBe('crane');
  });
});

describe('trading', () => {
  test('commodities can be offered to and asked of other players', () => {
    let s = edit(building(), 1, {
      goods: { paper: 0, cloth: 2, coin: 0 },
    });
    s = play(s, {
      type: 'OFFER',
      give: { lumber: 1 },
      get: {},
      getGoods: { cloth: 1 },
    });
    expect(s.offer!.asked).toEqual(['p1']);
    s = play(s, { type: 'ANSWER', accept: true }, 'p1');
    s = play(s, { type: 'CLOSE_OFFER', with: 'p1' }, 'p0');
    expect(s.players[0].goods.cloth).toBe(13);
    expect(s.players[1].goods.cloth).toBe(1);
    expect(s.players[1].hand.lumber).toBe(1);
  });
});

describe('choices left to the players', () => {
  test('Saboteur: each player hit chooses which half of their cards to discard', () => {
    let s = holding(
      edit(edit(building(), 1, { hand: { ...NONE, grain: 4, ore: 2 } }), 2, {
        hand: { ...NONE, wool: 1 },
      }),
      0,
      ['saboteur'],
    );
    s = play(s, { type: 'PLAY_PROGRESS', progressCard: 'saboteur' });
    // p2's one card halves to nothing: only p1 is asked.
    expect(s.asks).toEqual([{ kind: 'discard', player: 'p1', count: 3 }]);
    expect(actor(s)).toBe('p1');
    expect(() => play(s, { type: 'END_TURN' }, 'p0')).toThrow(IllegalMove);
    expect(() => play(s, { type: 'RESOLVE', cards: { grain: 2 } }, 'p1')).toThrow(IllegalMove);
    s = play(s, { type: 'RESOLVE', cards: { grain: 1, ore: 2 } }, 'p1');
    expect(s.players[1].hand).toMatchObject({ grain: 3, ore: 0 });
    expect(s.asks).toEqual([]);
    expect(actor(s)).toBe('p0');
  });

  test('Wedding: a richer player gives the 2 cards of their choice', () => {
    let s = holding(
      edit(promoteHome(building(), 'p1'), 1, {
        hand: { ...NONE, brick: 2, ore: 3 },
      }),
      0,
      ['wedding'],
    );
    s = play(s, { type: 'PLAY_PROGRESS', progressCard: 'wedding' });
    expect(s.asks![0]).toEqual({
      kind: 'give',
      player: 'p1',
      to: 'p0',
      count: 2,
    });
    s = play(s, { type: 'RESOLVE', cards: { brick: 2 } }, 'p1');
    expect(s.players[0].hand.brick).toBe(11);
    expect(s.players[1].hand).toMatchObject({ brick: 0, ore: 3 });
  });

  test('Wedding: a richer player with 2 cards or fewer simply hands them over', () => {
    let s = holding(edit(promoteHome(building(), 'p1'), 1, { hand: { ...NONE, ore: 1 } }), 0, ['wedding']);
    s = play(s, { type: 'PLAY_PROGRESS', progressCard: 'wedding' });
    expect(s.asks).toEqual([]);
    expect(s.players[0].hand.ore).toBe(10);
  });

  test("Master Merchant: you see the richer player's hand, and only you, and take the 2 you choose", () => {
    let s = holding(
      edit(promoteHome(building(), 'p1'), 1, {
        hand: { ...NONE, grain: 3, ore: 1 },
        goods: { ...NO_GOODS, coin: 1 },
      }),
      0,
      ['master-merchant'],
    );
    s = play(s, { type: 'PLAY_PROGRESS', progressCard: 'master-merchant', target: 'p1' });
    expect(s.asks![0]).toEqual({
      kind: 'take',
      player: 'p0',
      from: 'p1',
      count: 2,
    });
    expect(catanKit.redact(s, 'p0').players[1].hand.grain).toBe(3);
    expect(catanKit.redact(s, 'p2').players[1].hand.grain).toBe(0);
    s = play(s, { type: 'RESOLVE', cards: { ore: 1 }, goods: { coin: 1 } }, 'p0');
    expect(s.players[0].hand.ore).toBe(10);
    expect(s.players[0].goods.coin).toBe(13);
    expect(s.players[1].hand.grain).toBe(3);
  });

  test("Spy: you look at a player's progress cards and take the one you choose", () => {
    let s = holding(holding(building(), 1, ['merchant', 'alchemist']), 0, ['spy']);
    s = play(s, { type: 'PLAY_PROGRESS', progressCard: 'spy', target: 'p1' });
    expect(catanKit.redact(s, 'p0').players[1].progressCards).toEqual(['merchant', 'alchemist']);
    expect(catanKit.redact(s, 'p2').players[1].progressCards).toEqual([]);
    s = play(s, { type: 'RESOLVE', progressCard: 'alchemist' }, 'p0');
    expect(s.players[0].progressCards).toEqual(['alchemist']);
    expect(s.players[1].progressCards).toEqual(['merchant']);
  });

  test('a pillaged player chooses which city falls, its wall goes with it, and the roll pays only afterwards', () => {
    let s = promoteHome(building(), 'p0');
    const cities = s.buildings.flatMap((b, v) => (b?.player === 'p0' && b.city ? [v] : []));
    expect(cities).toHaveLength(2);
    s = {
      ...s,
      walls: s.walls.map((w, v) => w || v === cities[1]),
      players: s.players.map((p, i) => (i === 0 ? { ...p, walls: 1 } : p)),
    };
    s = {
      ...s,
      phase: 'roll',
      dice: null,
      barbarians: 6,
      seed: rigged(8, 'ship'),
    };
    const cards = (x: CatanState) => x.players.map((p) => Object.values(p.hand).reduce((a, b) => a + b, 0) + Object.values(p.goods).reduce((a, b) => a + b, 0));
    const before = cards(s);
    s = play(s, { type: 'ROLL' }, 'p0');
    expect(s.asks![0]).toEqual({ kind: 'pillage', player: 'p0' });
    expect(cards(s)).toEqual(before);
    s = play(s, { type: 'RESOLVE', vertex: cities[1] }, 'p0');
    expect(s.buildings[cities[1]]).toEqual({ player: 'p0', city: false });
    expect(s.buildings[cities[0]]).toEqual({ player: 'p0', city: true });
    expect(s.walls[cities[1]]).toBe(false);
    expect(s.players[0].walls).toBe(0);
    // p1 and p2 had one city each: theirs fall without asking.
    expect(s.buildings.filter((b) => b?.city)).toHaveLength(1);
    expect(s.asks).toEqual([]);
    expect(s.phase).toBe('main');
  });

  test('a tie for the best defence: each tied player draws from the deck of their choice, roller first', () => {
    let s = building();
    const a = legalKnightSpots(s, 'p0')[0];
    const b = legalKnightSpots(s, 'p1').find((v) => v !== a)!;
    s = {
      ...s,
      knights: s.knights.map((w, v) => (v === a ? { player: 'p0', level: 2, active: true, since: 0 } : v === b ? { player: 'p1', level: 2, active: true, since: 0 } : w)),
    };
    s = {
      ...s,
      progressCardDecks: {
        ...s.progressCardDecks,
        trade: ['merchant', ...s.progressCardDecks.trade],
        politics: ['spy', ...s.progressCardDecks.politics],
      },
    };
    s = {
      ...s,
      phase: 'roll',
      dice: null,
      barbarians: 6,
      seed: rigged(8, 'ship'),
    };
    s = play(s, { type: 'ROLL' }, 'p0');
    expect(s.asks!.map((x) => [x.kind, x.player])).toEqual([
      ['draw', 'p0'],
      ['draw', 'p1'],
    ]);
    s = play(s, { type: 'RESOLVE', area: 'trade' }, 'p0');
    s = play(s, { type: 'RESOLVE', area: 'politics' }, 'p1');
    expect(s.players[0].progressCards).toEqual(['merchant']);
    expect(s.players[1].progressCards).toEqual(['spy']);
    expect(s.players[0].defender + s.players[1].defender).toBe(0);
  });
});

describe('the hand limit of 4 progress cards', () => {
  test('out of turn, a fifth progress card is drawn, then its holder discards one of their choice under its deck', () => {
    let s = edit(holding(building(), 1, ['spy', 'wedding', 'bishop', 'warlord']), 1, { areas: { trade: 0, politics: 0, science: 1 } });
    s = {
      ...s,
      progressCardDecks: {
        ...s.progressCardDecks,
        science: ['crane', ...s.progressCardDecks.science.filter((e) => e !== 'crane')],
      },
    };
    s = { ...s, phase: 'roll', dice: null, seed: rigged(8, 'science', 2) };
    s = play(s, { type: 'ROLL' }, 'p0');
    expect(s.players[1].progressCards).toHaveLength(5);
    expect(s.asks![0]).toEqual({ kind: 'progressCard-limit', player: 'p1' });
    s = play(s, { type: 'RESOLVE', progressCard: 'bishop' }, 'p1');
    expect(s.players[1].progressCards).toEqual(['spy', 'wedding', 'warlord', 'crane']);
    expect(s.progressCardDecks.politics.at(-1)).toBe('bishop');
    expect(s.phase).toBe('main');
  });

  test('on your own turn you may hold a fifth until you end the turn', () => {
    let s = edit(holding(building(), 0, ['spy', 'wedding', 'bishop', 'warlord']), 0, { areas: { trade: 0, politics: 0, science: 1 } });
    s = {
      ...s,
      progressCardDecks: {
        ...s.progressCardDecks,
        science: ['crane', ...s.progressCardDecks.science.filter((e) => e !== 'crane')],
      },
    };
    s = { ...s, phase: 'roll', dice: null, seed: rigged(8, 'science', 2) };
    s = play(s, { type: 'ROLL' }, 'p0');
    expect(s.players[0].progressCards).toHaveLength(5);
    expect(s.asks).toEqual([]);
    s = play(s, { type: 'END_TURN' }, 'p0');
    expect(s.asks![0]).toEqual({ kind: 'progressCard-limit', player: 'p0' });
    expect(s.turn).toBe(0);
    s = play(s, { type: 'RESOLVE', progressCard: 'spy' }, 'p0');
    expect(s.players[0].progressCards).toHaveLength(4);
    expect(s.turn).toBe(1);
  });
});

describe('the new progress cards', () => {
  test('Alchemist: played before the roll, you set both number dice', () => {
    let s = holding(building(), 0, ['alchemist', 'crane']);
    s = { ...s, phase: 'roll', dice: null };
    expect(() => play(s, { type: 'PLAY_PROGRESS', progressCard: 'crane' })).toThrow(IllegalMove);
    s = play(s, { type: 'PLAY_PROGRESS', progressCard: 'alchemist', dice: [2, 4] });
    expect(s.dice).toEqual([2, 4]);
    expect(s.phase).not.toBe('roll');
    expect(s.players[0].progressCards).toEqual(['crane']);
    const later = holding({ ...s, phase: 'main', asks: [] }, 0, ['alchemist']);
    expect(() => play(later, { type: 'PLAY_PROGRESS', progressCard: 'alchemist', dice: [3, 3] })).toThrow(IllegalMove);
  });

  test('Inventor: swaps two number tokens, but never a 2, 12, 6 or 8', () => {
    let s = holding(building(), 0, ['inventor', 'inventor']);
    const free = s.board.numbers.flatMap((n, t) => (n !== null && ![2, 6, 8, 12].includes(n) ? [t] : []));
    const fixed = s.board.numbers.findIndex((n) => n === 6);
    expect(() =>
      play(s, {
        type: 'PLAY_PROGRESS',
        progressCard: 'inventor',
        tiles: [free[0], fixed],
      }),
    ).toThrow(IllegalMove);
    const [a, b] = [free[0], free.find((t) => s.board.numbers[t] !== s.board.numbers[free[0]])!];
    const [na, nb] = [s.board.numbers[a], s.board.numbers[b]];
    s = play(s, { type: 'PLAY_PROGRESS', progressCard: 'inventor', tiles: [a, b] });
    expect([s.board.numbers[a], s.board.numbers[b]]).toEqual([nb, na]);
  });

  test("Merchant: a point and a 2:1 rate for its tile's resource, until another Merchant takes it over", () => {
    let s = holding(building(), 0, ['merchant']);
    const home = s.buildings.findIndex((b) => b?.player === 'p0');
    const tile = geo.vertices[home].tiles.find((t) => YIELD[s.board.terrain[t]])!;
    const res = YIELD[s.board.terrain[tile]]!;
    const pts = victoryPoints(s, 'p0');
    s = play(s, { type: 'PLAY_PROGRESS', progressCard: 'merchant', tile });
    expect(s.merchant).toEqual({ player: 'p0', tile });
    expect(victoryPoints(s, 'p0')).toBe(pts + 1);
    expect(bankRatio(s, 'p0', res)).toBe(2);
    // A tile nowhere near your buildings is refused.
    const far = geo.tiles.findIndex((t, i) => YIELD[s.board.terrain[i]] && !t.corners.some((c) => s.buildings[c]?.player === 'p1'));
    let t1 = holding({ ...s, turn: 1 }, 1, ['merchant', 'merchant']);
    expect(() => play(t1, { type: 'PLAY_PROGRESS', progressCard: 'merchant', tile: far })).toThrow(IllegalMove);
    const theirs = geo.vertices[t1.buildings.findIndex((b) => b?.player === 'p1')].tiles.find((t) => YIELD[t1.board.terrain[t]])!;
    t1 = play(t1, { type: 'PLAY_PROGRESS', progressCard: 'merchant', tile: theirs });
    expect(t1.merchant!.player).toBe('p1');
    expect(victoryPoints(t1, 'p0')).toBe(pts);
  });

  test("Diplomat: removes another player's open road; your own you may build again elsewhere", () => {
    let s = holding(building(), 0, ['diplomat', 'diplomat']);
    const theirs = s.roads.findIndex((r) => r === 'p1');
    expect(openRoads(s)).toContain(theirs);
    s = play(s, { type: 'PLAY_PROGRESS', progressCard: 'diplomat', edge: theirs });
    expect(s.roads[theirs]).toBeNull();
    const mine = s.roads.findIndex((r) => r === 'p0');
    s = play(s, { type: 'PLAY_PROGRESS', progressCard: 'diplomat', edge: mine });
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
    expect(() => play(s, { type: 'PLAY_PROGRESS', progressCard: 'diplomat', edge: mine })).toThrow(IllegalMove);
  });

  test("Intrigue and displacing: the pushed knight's owner picks an empty corner along their roads", () => {
    // In an empty stretch of the island: p1's knight on c1, p1's roads c1-c2-c4, and a road of p0's onto c1.
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
      knights: s.knights.map((w, v) => (v === c1 ? { player: 'p1', level: 2, active: true, since: 0 } : w)),
    };
    s = play(s, { type: 'PLAY_PROGRESS', progressCard: 'intrigue', vertex: c1 });
    expect(s.knights[c1]).toBeNull();
    expect(s.asks![0]).toMatchObject({
      kind: 'retreat',
      player: 'p1',
      from: c1,
    });
    expect(() => play(s, { type: 'RESOLVE', vertex: c1 }, 'p1')).toThrow(IllegalMove);
    s = play(s, { type: 'RESOLVE', vertex: c4 }, 'p1');
    expect(s.knights[c4]).toEqual({
      player: 'p1',
      level: 2,
      active: true,
      since: 0,
    });
  });

  test('Deserter: the player picks which knight to give up; you place one of the same strength', () => {
    let s = holding(building(), 0, ['deserter']);
    const spots = geo.vertices.map((_, v) => v).filter((v) => !s.buildings[v] && geo.vertices[v].neighbours.every((n) => !s.buildings[n]));
    s = {
      ...s,
      knights: s.knights.map((w, v) => (v === spots[0] ? { player: 'p1', level: 1, active: false, since: 0 } : v === spots[5] ? { player: 'p1', level: 2, active: true, since: 0 } : w)),
    };
    s = play(s, { type: 'PLAY_PROGRESS', progressCard: 'deserter', target: 'p1' });
    expect(s.asks![0]).toEqual({ kind: 'desert', player: 'p1', to: 'p0' });
    s = play(s, { type: 'RESOLVE', vertex: spots[5] }, 'p1');
    expect(s.knights[spots[5]]).toBeNull();
    expect(s.asks![0]).toEqual({
      kind: 'hire',
      player: 'p0',
      level: 2,
      active: true,
    });
    const mine = legalKnightSpots(s, 'p0')[0];
    s = play(s, { type: 'RESOLVE', vertex: mine }, 'p0');
    expect(s.knights[mine]).toMatchObject({
      player: 'p0',
      level: 2,
      active: true,
    });
  });

  test('Commercial Harbor: each player gives a commodity of their choice for your resource, once; none means no trade', () => {
    let s = holding(edit(building(), 1, { goods: { paper: 0, cloth: 2, coin: 1 } }), 0, ['commercial-harbor']);
    s = play(s, { type: 'PLAY_PROGRESS', progressCard: 'commercial-harbor' });
    s = play(s, { type: 'HARBOR', target: 'p1', give: 'lumber' });
    expect(s.asks![0]).toEqual({ kind: 'harbor', player: 'p1', to: 'p0' });
    s = play(s, { type: 'RESOLVE', goods: { coin: 1 } }, 'p1');
    expect(s.players[0].goods.coin).toBe(13);
    expect(s.players[1].hand.lumber).toBe(1);
    expect(() => play(s, { type: 'HARBOR', target: 'p1', give: 'brick' })).toThrow(IllegalMove);
    s = play(s, { type: 'HARBOR', target: 'p2', give: 'brick' });
    expect(s.players[0].hand.brick).toBe(9);
    expect(s.asks).toEqual([]);
  });

  test('Bishop: not before the barbarians first land', () => {
    const s = holding(building(), 0, ['bishop']);
    expect(() => play(s, { type: 'PLAY_PROGRESS', progressCard: 'bishop' })).toThrow(IllegalMove);
    expect(play({ ...s, attacked: true }, { type: 'PLAY_PROGRESS', progressCard: 'bishop' }).phase).toBe('robber');
  });
});

describe('knights', () => {
  test('a knight is promoted at most once a turn', () => {
    let s = edit(building(), 0, {
      areas: { trade: 0, politics: 3, science: 0 },
    });
    const spot = legalKnightSpots(s, 'p0')[0];
    s = play(s, { type: 'BUILD_KNIGHT', vertex: spot });
    s = play(s, { type: 'PROMOTE', vertex: spot });
    expect(() => play(s, { type: 'PROMOTE', vertex: spot })).toThrow(/once a turn/);
    expect(play({ ...s, round: s.round + 1 }, { type: 'PROMOTE', vertex: spot }).knights[spot]!.level).toBe(3);
  });

  test('a chased robber goes to a numbered tile', () => {
    let s = building();
    const next = s.board.numbers.findIndex((n) => n !== null);
    const corner = geo.tiles[next].corners.find((c) => !s.buildings[c])!;
    s = {
      ...s,
      attacked: true,
      board: { ...s.board, robber: next },
      knights: s.knights.map((w, v) => (v === corner ? { player: 'p0', level: 1, active: true, since: 0 } : w)),
    };
    s = play(s, { type: 'CHASE', vertex: corner });
    const desert = s.board.numbers.findIndex((n, i) => n === null && s.board.terrain[i] !== 'sea');
    expect(() => play(s, { type: 'MOVE_ROBBER', tile: desert })).toThrow(IllegalMove);
  });
});

test('a player who leaves mid-choice is skipped, and play goes on', () => {
  let s = holding(edit(building(), 1, { hand: { ...NONE, grain: 4, ore: 2 } }), 0, ['saboteur']);
  s = play(s, { type: 'PLAY_PROGRESS', progressCard: 'saboteur' });
  expect(actor(s)).toBe('p1');
  s = catanKit.forfeit!(s, 'p1');
  expect(s.asks).toEqual([]);
  expect(actor(s)).toBe('p0');
});
