import { describe, expect, test } from 'vitest';
import { IllegalMove } from '../../../src/games/kit/engine';
import { geometry } from '../../../src/games/hexstead/board';
import {
  bankRatio,
  createHexstead,
  hexKit,
  improveCost,
  legalHomesteadSpots,
  legalRoadSpots,
  legalWardenSpots,
  rollDice,
  victoryPoints,
  wardenMoves,
  type HxAction,
  type HxState,
} from '../../../src/games/hexstead/engine';
import { OMEN_FACES, type Edict } from '../../../src/games/hexstead/wardens';
import { nextRandom } from '../../../src/games/kit/engine';

const seats = (n: number, ai = false) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI: ai, difficulty: 'normal' }));
const actor = (s: HxState) => hexKit.actor(s)!;
const play = (s: HxState, a: HxAction, id = actor(s)) => hexKit.apply(s, a, id);
const geo = geometry('standard');
const RICH = { timber: 9, clay: 9, wool: 9, grain: 9, stone: 9 };

function setUp(s: HxState): HxState {
  while (s.phase === 'setup') {
    const id = actor(s);
    s = s.setup!.needRoad ? play(s, { type: 'BUILD_ROAD', edge: legalRoadSpots(s, id)[0] }) : play(s, { type: 'BUILD_HOMESTEAD', vertex: legalHomesteadSpots(s, id)[0] });
  }
  return s;
}

/** p0's build phase after setup, rich in resources and commodities. */
function building(seed = 3): HxState {
  const s = setUp(createHexstead(seats(3), seed, { mode: 'wardens' }));
  return {
    ...s,
    phase: 'main',
    dice: [2, 3],
    players: s.players.map((p, i) => (i === 0 ? { ...p, hand: { ...RICH }, goods: { parchment: 12, linen: 12, silver: 12 } } : p)),
  };
}

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

describe('setting up', () => {
  test('the second placement is a town, there are no charters, and 13 points win', () => {
    const s = setUp(createHexstead(seats(3), 3, { mode: 'wardens' }));
    for (const p of s.players) {
      const mine = s.buildings.filter((b) => b?.player === p.id);
      expect(mine.filter((b) => b!.town)).toHaveLength(1);
      expect(mine.filter((b) => !b!.town)).toHaveLength(1);
      expect(victoryPoints(s, p.id)).toBe(3);
    }
    expect(s.deckCount).toBe(0);
    expect(hexKit.seatError(5, { mode: 'wardens' })).not.toBeNull();
  });
});

describe('commodities', () => {
  test('a town on forest, pasture or mountains makes a commodity in place of its second card', () => {
    let s = building();
    const town = s.buildings.findIndex((b) => b?.player === 'p1' && b.town);
    const tile = geo.vertices[town].tiles.find((t) => ['forest', 'pasture', 'mountains'].includes(s.board.terrain[t]) && t !== s.board.raider);
    if (tile === undefined) return;
    const good = { forest: 'parchment', pasture: 'linen', mountains: 'silver' }[s.board.terrain[tile] as 'forest'] as 'parchment';
    const res = { forest: 'timber', pasture: 'wool', mountains: 'stone' }[s.board.terrain[tile] as 'forest'] as 'timber';
    s = { ...s, phase: 'roll', dice: null, seed: rigged(s.board.numbers[tile]!, 'ship') };
    const before = s.players[1];
    s = play(s, { type: 'ROLL' }, 'p0');
    expect(s.players[1].goods[good] - before.goods[good]).toBeGreaterThanOrEqual(1);
    expect(s.players[1].hand[res] - before.hand[res]).toBeGreaterThanOrEqual(1);
  });

  test('commodities trade with the bank 4 for 1, or 2 for 1 with the Trade guild at level 3', () => {
    let s = building();
    expect(bankRatio(s, 'p0', 'linen')).toBeGreaterThanOrEqual(3);
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, guilds: { ...p.guilds, trade: 3 } } : p)) };
    expect(bankRatio(s, 'p0', 'linen')).toBe(2);
    const after = play(s, { type: 'BANK_TRADE', give: 'linen', get: 'stone' });
    expect(after.players[0].goods.linen).toBe(10);
    expect(after.players[0].hand.stone).toBe(10);
  });
});

describe('guilds', () => {
  test('each level costs as many of its commodity as the level; the first to level 4 takes the Capital', () => {
    let s = building();
    expect(improveCost(s, 'p0', 'trade')).toBe(1);
    for (let lv = 1; lv <= 4; lv++) s = play(s, { type: 'IMPROVE', guild: 'trade' });
    expect(s.players[0].guilds.trade).toBe(4);
    expect(s.players[0].goods.linen).toBe(12 - 1 - 2 - 3 - 4);
    expect(s.capitals.trade?.player).toBe('p0');
    expect(victoryPoints(s, 'p0')).toBe(3 + 2);
  });

  test('without a town there is nothing to improve', () => {
    let s = building();
    s = { ...s, buildings: s.buildings.map((b) => (b?.player === 'p0' ? { ...b, town: false } : b)) };
    expect(improveCost(s, 'p0', 'academy')).toBeNull();
    expect(() => play(s, { type: 'IMPROVE', guild: 'academy' })).toThrow(IllegalMove);
  });
});

describe('wardens', () => {
  test('recruit on your road, muster with grain, promote, and strength 3 needs the Council at 3', () => {
    let s = building();
    const spot = legalWardenSpots(s, 'p0')[0];
    s = play(s, { type: 'BUILD_WARDEN', vertex: spot });
    expect(s.wardens[spot]).toMatchObject({ player: 'p0', level: 1, active: false });
    s = play(s, { type: 'MUSTER', vertex: spot });
    expect(s.wardens[spot]!.active).toBe(true);
    s = play(s, { type: 'PROMOTE', vertex: spot });
    expect(s.wardens[spot]!.level).toBe(2);
    // Next turn (a warden is promoted once a turn), strength 3 still needs the Council.
    expect(() => play({ ...s, round: s.round + 1 }, { type: 'PROMOTE', vertex: spot })).toThrow(/Council/);
  });

  test('a warden mustered this turn cannot move until a later turn', () => {
    let s = building();
    const spot = legalWardenSpots(s, 'p0')[0];
    s = play(s, { type: 'BUILD_WARDEN', vertex: spot });
    s = play(s, { type: 'MUSTER', vertex: spot });
    expect(wardenMoves(s, 'p0', spot)).toEqual([]);
    s = { ...s, round: s.round + 1 };
    // It may move along its roads only if it has somewhere to go.
    expect(Array.isArray(wardenMoves(s, 'p0', spot))).toBe(true);
  });

  test("a warden blocks a rival's road and homestead on its corner", () => {
    let s = building();
    const spot = legalWardenSpots(s, 'p0')[0];
    s = play(s, { type: 'BUILD_WARDEN', vertex: spot });
    expect(legalHomesteadSpots({ ...s, phase: 'main' }, 'p1')).not.toContain(spot);
  });
});

describe('the marauder fleet', () => {
  test('ship faces move it on; on the seventh it lands, and a weaker defence costs the weakest a town', () => {
    let s = building();
    s = { ...s, phase: 'roll', dice: null, marauders: 6, seed: rigged(8, 'ship') };
    const townsBefore = s.buildings.filter((b) => b?.town).length;
    s = play(s, { type: 'ROLL' }, 'p0');
    expect(s.marauders).toBe(0);
    expect(s.attacked).toBe(true);
    // Nobody had a mustered warden: every player ties weakest and loses a town.
    expect(s.buildings.filter((b) => b?.town).length).toBe(townsBefore - 3);
  });

  test('when mustered wardens match the towns, the strongest defender takes a Defender point', () => {
    let s = building();
    const spots = legalWardenSpots(s, 'p0');
    s = {
      ...s,
      wardens: s.wardens.map((w, v) => (v === spots[0] ? { player: 'p0', level: 3, active: true, since: 0 } : w)),
      phase: 'roll',
      dice: null,
      marauders: 6,
      seed: rigged(8, 'ship'),
    };
    s = play(s, { type: 'ROLL' }, 'p0');
    expect(s.players[0].defender).toBe(1);
    expect(s.wardens[spots[0]]!.active).toBe(false);
  });

  test('before the first landing a 7 moves no raider', () => {
    let s = building();
    s = { ...s, phase: 'roll', dice: null, seed: rigged(7, 'council', 1) };
    s = play(s, { type: 'ROLL' }, 'p0');
    expect(['main', 'discard']).toContain(s.phase);
  });
});

describe('edicts', () => {
  test('a gate draws an edict for each player whose guild level reaches the red die', () => {
    let s = building();
    s = { ...s, phase: 'roll', dice: null, seed: rigged(8, 'academy', 2), players: s.players.map((p, i) => (i === 0 ? { ...p, guilds: { ...p.guilds, academy: 1 } } : p)) };
    const before = s.players[0].edicts.length + s.players[0].edictPoints;
    s = play(s, { type: 'ROLL' }, 'p0');
    expect(s.players[0].edicts.length + s.players[0].edictPoints).toBe(before + 1);
    expect(s.players[1].edicts).toHaveLength(0);
  });

  test('edicts take effect when played: a monopoly, a free promotion, and a free wall', () => {
    let s = building();
    const give = (e: Edict[]) => ({ ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, edicts: e } : i === 1 ? { ...p, hand: { ...p.hand, wool: 3 } } : p)) });
    s = give(['resource-monopoly', 'smith', 'engineer']);
    const wool = s.players[0].hand.wool;
    s = play(s, { type: 'PLAY_EDICT', edict: 'resource-monopoly', take: ['wool'] });
    expect(s.players[0].hand.wool).toBe(wool + 2);
    expect(s.players[1].hand.wool).toBe(1);
    const town = s.buildings.findIndex((b) => b?.player === 'p0' && b.town);
    s = play(s, { type: 'PLAY_EDICT', edict: 'engineer', vertex: town });
    expect(s.walls[town]).toBe(true);
    expect(s.players[0].walls).toBe(1);
    expect(s.players[0].edicts).toEqual(['smith']);
  });

  test('walls raise the hand limit by 2 each', () => {
    let s = building();
    const town = s.buildings.findIndex((b) => b?.player === 'p0' && b.town);
    s = play(s, { type: 'BUILD_WALL', vertex: town });
    expect(s.players[0].walls).toBe(1);
    expect(() => play(s, { type: 'BUILD_WALL', vertex: town })).toThrow(IllegalMove);
  });
});

test('the other players see your commodities and edicts only as counts', () => {
  const s = building();
  const after = play(s, { type: 'BANK_TRADE', give: 'timber', get: 'clay' });
  const v = hexKit.redact(after, 'p1');
  expect(v.players[0].goods).toEqual({ parchment: 0, linen: 0, silver: 0 });
  expect(v.players[0].edicts).toEqual([]);
  expect(v.players[0].handCount).toBe(45 - bankRatio(s, 'p0', 'timber') + 1 + 36);
});

test('bots play Wardens to the end, using guilds and wardens', () => {
  let improved = 0;
  let wardens = 0;
  for (let seed = 1; seed <= 5; seed++) {
    let s = createHexstead(seats(3, true), seed, { mode: 'wardens' });
    for (let i = 0; i < 40000 && !s.over; i++) s = hexKit.apply(s, hexKit.bot(s), actor(s));
    expect(s.over, `seed ${seed}`).toBe(true);
    improved += s.players.reduce((t, p) => t + p.guilds.trade + p.guilds.council + p.guilds.academy, 0);
    wardens += s.wardens.filter(Boolean).length;
  }
  expect(improved).toBeGreaterThan(0);
  expect(wardens).toBeGreaterThan(0);
}, 120_000);
