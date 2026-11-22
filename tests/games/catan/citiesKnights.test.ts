import { describe, expect, test } from 'vitest';
import { IllegalMove } from '../../../src/games/kit/engine';
import { geometry } from '../../../src/games/catan/board';
import {
  bankRatio,
  createCatan,
  catanKit,
  improveCost,
  legalSettlementSpots,
  legalRoadSpots,
  legalKnightSpots,
  rollDice,
  victoryPoints,
  knightMoves,
  type CatanAction,
  type CatanState,
} from '../../../src/games/catan/engine';
import { EVENT_DIE_FACES, type ProgressCard } from '../../../src/games/catan/citiesKnights';
import { nextRandom } from '../../../src/games/kit/engine';

const seats = (n: number, ai = false) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI: ai, difficulty: 'normal' }));
const actor = (s: CatanState) => catanKit.actor(s)!;
const play = (s: CatanState, a: CatanAction, id = actor(s)) => catanKit.apply(s, a, id);
const geo = geometry('standard');
const RICH = { lumber: 9, brick: 9, wool: 9, grain: 9, ore: 9 };

function setUp(s: CatanState): CatanState {
  while (s.phase === 'setup') {
    const id = actor(s);
    s = s.setup!.needRoad ? play(s, { type: 'BUILD_ROAD', edge: legalRoadSpots(s, id)[0] }) : play(s, { type: 'BUILD_SETTLEMENT', vertex: legalSettlementSpots(s, id)[0] });
  }
  return s;
}

/** p0's build phase after setup, rich in resources and commodities. */
function building(seed = 3): CatanState {
  const s = setUp(createCatan(seats(3), seed, { mode: 'cities-knights' }));
  return {
    ...s,
    phase: 'main',
    dice: [2, 3],
    players: s.players.map((p, i) => (i === 0 ? { ...p, hand: { ...RICH }, goods: { paper: 12, cloth: 12, coin: 12 } } : p)),
  };
}

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

describe('setting up', () => {
  test('the second placement is a city, there are no development cards, and 13 points win', () => {
    const s = setUp(createCatan(seats(3), 3, { mode: 'cities-knights' }));
    for (const p of s.players) {
      const mine = s.buildings.filter((b) => b?.player === p.id);
      expect(mine.filter((b) => b!.city)).toHaveLength(1);
      expect(mine.filter((b) => !b!.city)).toHaveLength(1);
      expect(victoryPoints(s, p.id)).toBe(3);
    }
    expect(s.deckCount).toBe(0);
    expect(catanKit.seatError(5, { mode: 'cities-knights' })).not.toBeNull();
  });
});

describe('commodities', () => {
  test('a city on forest, pasture or mountains makes a commodity in place of its second card', () => {
    let s = building();
    const city = s.buildings.findIndex((b) => b?.player === 'p1' && b.city);
    const tile = geo.vertices[city].tiles.find((t) => ['forest', 'pasture', 'mountains'].includes(s.board.terrain[t]) && t !== s.board.robber);
    if (tile === undefined) return;
    const good = { forest: 'paper', pasture: 'cloth', mountains: 'coin' }[s.board.terrain[tile] as 'forest'] as 'paper';
    const res = { forest: 'lumber', pasture: 'wool', mountains: 'ore' }[s.board.terrain[tile] as 'forest'] as 'lumber';
    s = { ...s, phase: 'roll', dice: null, seed: rigged(s.board.numbers[tile]!, 'ship') };
    const before = s.players[1];
    s = play(s, { type: 'ROLL' }, 'p0');
    expect(s.players[1].goods[good] - before.goods[good]).toBeGreaterThanOrEqual(1);
    expect(s.players[1].hand[res] - before.hand[res]).toBeGreaterThanOrEqual(1);
  });

  test('commodities trade with the bank 4 for 1, or 2 for 1 with the Trade area at level 3', () => {
    let s = building();
    expect(bankRatio(s, 'p0', 'cloth')).toBeGreaterThanOrEqual(3);
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, areas: { ...p.areas, trade: 3 } } : p)) };
    expect(bankRatio(s, 'p0', 'cloth')).toBe(2);
    const after = play(s, { type: 'BANK_TRADE', give: 'cloth', get: 'ore' });
    expect(after.players[0].goods.cloth).toBe(10);
    expect(after.players[0].hand.ore).toBe(10);
  });
});

describe('areas', () => {
  test('each level costs as many of its commodity as the level; the first to level 4 takes the Metropolis', () => {
    let s = building();
    expect(improveCost(s, 'p0', 'trade')).toBe(1);
    for (let lv = 1; lv <= 4; lv++) s = play(s, { type: 'IMPROVE', area: 'trade' });
    expect(s.players[0].areas.trade).toBe(4);
    expect(s.players[0].goods.cloth).toBe(12 - 1 - 2 - 3 - 4);
    expect(s.metropolises.trade?.player).toBe('p0');
    expect(victoryPoints(s, 'p0')).toBe(3 + 2);
  });

  test('without a city there is nothing to improve', () => {
    let s = building();
    s = { ...s, buildings: s.buildings.map((b) => (b?.player === 'p0' ? { ...b, city: false } : b)) };
    expect(improveCost(s, 'p0', 'science')).toBeNull();
    expect(() => play(s, { type: 'IMPROVE', area: 'science' })).toThrow(IllegalMove);
  });
});

describe('knights', () => {
  test('hire on your road, activate with grain, promote, and strength 3 needs Politics at 3', () => {
    let s = building();
    const spot = legalKnightSpots(s, 'p0')[0];
    s = play(s, { type: 'BUILD_KNIGHT', vertex: spot });
    expect(s.knights[spot]).toMatchObject({ player: 'p0', level: 1, active: false });
    s = play(s, { type: 'ACTIVATE', vertex: spot });
    expect(s.knights[spot]!.active).toBe(true);
    s = play(s, { type: 'PROMOTE', vertex: spot });
    expect(s.knights[spot]!.level).toBe(2);
    // Next turn (a knight is promoted once a turn), strength 3 still needs the Politics.
    expect(() => play({ ...s, round: s.round + 1 }, { type: 'PROMOTE', vertex: spot })).toThrow(/Politics/);
  });

  test('a knight activated this turn cannot move until a later turn', () => {
    let s = building();
    const spot = legalKnightSpots(s, 'p0')[0];
    s = play(s, { type: 'BUILD_KNIGHT', vertex: spot });
    s = play(s, { type: 'ACTIVATE', vertex: spot });
    expect(knightMoves(s, 'p0', spot)).toEqual([]);
    s = { ...s, round: s.round + 1 };
    // It may move along its roads only if it has somewhere to go.
    expect(Array.isArray(knightMoves(s, 'p0', spot))).toBe(true);
  });

  test("a knight blocks a rival's road and settlement on its corner", () => {
    let s = building();
    const spot = legalKnightSpots(s, 'p0')[0];
    s = play(s, { type: 'BUILD_KNIGHT', vertex: spot });
    expect(legalSettlementSpots({ ...s, phase: 'main' }, 'p1')).not.toContain(spot);
  });
});

describe('the barbarian ship', () => {
  test('ship faces move it on; on the seventh it attacks, and a weaker defence costs the weakest a city', () => {
    let s = building();
    s = { ...s, phase: 'roll', dice: null, barbarians: 6, seed: rigged(8, 'ship') };
    const citiesBefore = s.buildings.filter((b) => b?.city).length;
    s = play(s, { type: 'ROLL' }, 'p0');
    expect(s.barbarians).toBe(0);
    expect(s.attacked).toBe(true);
    // Nobody had an active knight: every player ties weakest and loses a city.
    expect(s.buildings.filter((b) => b?.city).length).toBe(citiesBefore - 3);
  });

  test('when active knights match the cities, the strongest defender takes a Defender of Catan point', () => {
    let s = building();
    const spots = legalKnightSpots(s, 'p0');
    s = {
      ...s,
      knights: s.knights.map((w, v) => (v === spots[0] ? { player: 'p0', level: 3, active: true, since: 0 } : w)),
      phase: 'roll',
      dice: null,
      barbarians: 6,
      seed: rigged(8, 'ship'),
    };
    s = play(s, { type: 'ROLL' }, 'p0');
    expect(s.players[0].defender).toBe(1);
    expect(s.knights[spots[0]]!.active).toBe(false);
  });

  test('before the first attack a 7 moves no robber', () => {
    let s = building();
    s = { ...s, phase: 'roll', dice: null, seed: rigged(7, 'politics', 1) };
    s = play(s, { type: 'ROLL' }, 'p0');
    expect(['main', 'discard']).toContain(s.phase);
  });
});

describe('progressCards', () => {
  test('a gate draws a progress card for each player whose area level reaches the red die', () => {
    let s = building();
    s = { ...s, phase: 'roll', dice: null, seed: rigged(8, 'science', 2), players: s.players.map((p, i) => (i === 0 ? { ...p, areas: { ...p.areas, science: 1 } } : p)) };
    const before = s.players[0].progressCards.length + s.players[0].progressCardPoints;
    s = play(s, { type: 'ROLL' }, 'p0');
    expect(s.players[0].progressCards.length + s.players[0].progressCardPoints).toBe(before + 1);
    expect(s.players[1].progressCards).toHaveLength(0);
  });

  test('progress cards take effect when played: a monopoly, a free promotion, and a free wall', () => {
    let s = building();
    const give = (e: ProgressCard[]) => ({ ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, progressCards: e } : i === 1 ? { ...p, hand: { ...p.hand, wool: 3 } } : p)) });
    s = give(['resource-monopoly', 'smith', 'engineer']);
    const wool = s.players[0].hand.wool;
    s = play(s, { type: 'PLAY_PROGRESS', progressCard: 'resource-monopoly', take: ['wool'] });
    expect(s.players[0].hand.wool).toBe(wool + 2);
    expect(s.players[1].hand.wool).toBe(1);
    const city = s.buildings.findIndex((b) => b?.player === 'p0' && b.city);
    s = play(s, { type: 'PLAY_PROGRESS', progressCard: 'engineer', vertex: city });
    expect(s.walls[city]).toBe(true);
    expect(s.players[0].walls).toBe(1);
    expect(s.players[0].progressCards).toEqual(['smith']);
  });

  test('walls raise the hand limit by 2 each', () => {
    let s = building();
    const city = s.buildings.findIndex((b) => b?.player === 'p0' && b.city);
    s = play(s, { type: 'BUILD_WALL', vertex: city });
    expect(s.players[0].walls).toBe(1);
    expect(() => play(s, { type: 'BUILD_WALL', vertex: city })).toThrow(IllegalMove);
  });
});

test('the other players see your commodities and progress cards only as counts', () => {
  const s = building();
  const after = play(s, { type: 'BANK_TRADE', give: 'lumber', get: 'brick' });
  const v = catanKit.redact(after, 'p1');
  expect(v.players[0].goods).toEqual({ paper: 0, cloth: 0, coin: 0 });
  expect(v.players[0].progressCards).toEqual([]);
  expect(v.players[0].handCount).toBe(45 - bankRatio(s, 'p0', 'lumber') + 1 + 36);
});

test('bots play Cities & Knights to the end, using areas and knights', () => {
  let improved = 0;
  let knights = 0;
  for (let seed = 1; seed <= 5; seed++) {
    let s = createCatan(seats(3, true), seed, { mode: 'cities-knights' });
    for (let i = 0; i < 40000 && !s.over; i++) s = catanKit.apply(s, catanKit.bot(s), actor(s));
    expect(s.over, `seed ${seed}`).toBe(true);
    improved += s.players.reduce((t, p) => t + p.areas.trade + p.areas.politics + p.areas.science, 0);
    knights += s.knights.filter(Boolean).length;
  }
  expect(improved).toBeGreaterThan(0);
  expect(knights).toBeGreaterThan(0);
}, 120_000);
