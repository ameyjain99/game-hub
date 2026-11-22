import { describe, expect, test } from 'vitest';
import { IllegalMove } from '../../../src/games/kit/engine';
import { RESOURCES, geometry } from '../../../src/games/catan/board';
import { createCatan, catanKit, legalSettlementSpots, legalRoadSpots, type CatanAction, type CatanState } from '../../../src/games/catan/engine';

const seats = (n: number, ai = false) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI: ai, difficulty: 'normal' }));
const actor = (s: CatanState) => catanKit.actor(s)!;
const play = (s: CatanState, a: CatanAction, id = actor(s)) => catanKit.apply(s, a, id);

function setUp(s: CatanState): CatanState {
  while (s.phase === 'setup') {
    const id = actor(s);
    s = s.setup!.needRoad ? play(s, { type: 'BUILD_ROAD', edge: legalRoadSpots(s, id)[0] }) : play(s, { type: 'BUILD_SETTLEMENT', vertex: legalSettlementSpots(s, id)[0] });
  }
  return s;
}

/** Past the roll of the first turn, into its build phase. */
function building(n: number): CatanState {
  let s = setUp(createCatan(seats(n), 3));
  s = { ...s, phase: 'main', dice: [2, 3] };
  return s;
}

describe('the large island (5 or 6 players)', () => {
  test('30 tiles in rows of 3-4-5-6-5-4-3, each next to the tiles it touches, and 11 harbours on the coast', () => {
    const g = geometry('large');
    expect(g.tiles).toHaveLength(30);
    const rows = new Map<number, number>();
    for (const t of g.tiles) rows.set(t.r, (rows.get(t.r) ?? 0) + 1);
    expect([...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, k]) => k)).toEqual([3, 4, 5, 6, 5, 4, 3]);
    expect(g.harborEdges).toHaveLength(11);
    expect(new Set(g.harborEdges).size).toBe(11);
    for (const e of g.harborEdges) expect(g.edges[e].tiles).toHaveLength(1);
  });

  test('a table of 5 or 6 plays it, with a 24-card bank and 34 development cards; 3 or 4 keep the standard island', () => {
    for (const n of [5, 6]) {
      const s = createCatan(seats(n), 7);
      expect(s.board.layout).toBe('large');
      expect(s.board.terrain).toHaveLength(30);
      expect(s.board.terrain.filter((t) => t === 'desert')).toHaveLength(2);
      expect(s.board.harbors).toHaveLength(11);
      expect(RESOURCES.every((r) => s.bank[r] === 24)).toBe(true);
      expect(s.deckCount).toBe(34);
      expect(s.buildings).toHaveLength(geometry('large').vertices.length);
    }
    const four = createCatan(seats(4), 7);
    expect(four.board.layout).toBe('standard');
    expect(four.deckCount).toBe(25);
    expect(catanKit.seatError(6)).toBeNull();
    expect(catanKit.seatError(7)).not.toBeNull();
  });

  test('no 6 or 8 sits next to another 6 or 8', () => {
    const g = geometry('large');
    for (let seed = 1; seed <= 20; seed++) {
      const b = createCatan(seats(5), seed).board;
      const hot = (i: number) => b.numbers[i] === 6 || b.numbers[i] === 8;
      g.tiles.forEach((t, i) => {
        if (hot(i)) expect(t.neighbours.some(hot)).toBe(false);
      });
    }
  });
});

describe('the special build phase', () => {
  test('after a turn, each other player in seat order may build (not trade), then the next turn begins', () => {
    let s = building(5);
    s = play(s, { type: 'END_TURN' }, 'p0');
    expect(s.phase).toBe('special');
    expect(s.special).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(actor(s)).toBe('p1');
    s = play(s, { type: 'END_TURN' }, 'p1');
    expect(actor(s)).toBe('p2');
    s = { ...s, players: s.players.map((p) => (p.id === 'p2' ? { ...p, hand: { ...p.hand, lumber: 2, brick: 2, wool: 4 } } : p)) };
    expect(() => play(s, { type: 'BANK_TRADE', give: 'wool', get: 'grain' }, 'p2')).toThrow(IllegalMove);
    expect(() => play(s, { type: 'BUILD_ROAD', edge: legalRoadSpots(s, 'p3')[0] }, 'p3')).toThrow(IllegalMove);
    const before = s.roads.filter((r) => r === 'p2').length;
    s = play(s, { type: 'BUILD_ROAD', edge: legalRoadSpots(s, 'p2')[0] }, 'p2');
    expect(s.roads.filter((r) => r === 'p2').length).toBe(before + 1);
    expect(actor(s)).toBe('p2');
    for (const id of ['p2', 'p3', 'p4']) s = play(s, { type: 'END_TURN' }, id);
    expect(s.phase).toBe('roll');
    expect(actor(s)).toBe('p1');
  });

  test('a table of 4 has no special build phase', () => {
    const s = play(building(4), { type: 'END_TURN' }, 'p0');
    expect(s.phase).toBe('roll');
    expect(actor(s)).toBe('p1');
  });

  test('an idle player in the special build phase passes', () => {
    let s = play(building(6), { type: 'END_TURN' }, 'p0');
    expect(catanKit.timeout(s)).toEqual({ type: 'END_TURN' });
    s = catanKit.forfeit(s, 'p1');
    expect(actor(s)).toBe('p2');
  });
});

test('bots play six-player games to the end', () => {
  for (let seed = 1; seed <= 3; seed++) {
    let s = createCatan(seats(6, true), seed);
    for (let i = 0; i < 30000 && !s.over; i++) s = catanKit.apply(s, catanKit.bot(s), actor(s));
    expect(s.over, `seed ${seed}`).toBe(true);
    expect(s.winner).not.toBeNull();
  }
}, 60_000);
