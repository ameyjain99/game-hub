import { describe, expect, test } from 'vitest';
import { GEO, makeBoard, PIPS } from '../../../src/games/hexstead/board';

describe('the island', () => {
  test('19 land tiles, 54 corners and 72 edges', () => {
    expect(GEO.tiles).toHaveLength(19);
    expect(GEO.vertices).toHaveLength(54);
    expect(GEO.edges).toHaveLength(72);
  });

  test('every corner touches one to three tiles and two or three edges', () => {
    for (const v of GEO.vertices) {
      expect(v.tiles.length).toBeGreaterThanOrEqual(1);
      expect(v.tiles.length).toBeLessThanOrEqual(3);
      expect([2, 3]).toContain(v.edges.length);
    }
  });

  test('30 coastal edges hold 9 harbours, never on neighbouring edges', () => {
    expect(GEO.coast).toHaveLength(30);
    expect(GEO.harborEdges).toHaveLength(9);
    const corners = GEO.harborEdges.flatMap((e) => GEO.edges[e].v);
    expect(new Set(corners).size).toBe(18);
  });
});

describe('a new board', () => {
  test('has the right tiles and numbers, with the raider on the badlands', () => {
    const b = makeBoard(7);
    const count = (t: string) => b.terrain.filter((x) => x === t).length;
    expect([count('forest'), count('hills'), count('pasture'), count('fields'), count('mountains'), count('badlands')]).toEqual([4, 3, 4, 4, 3, 1]);
    expect(b.numbers.filter((n) => n !== null).sort((a, c) => a! - c!)).toEqual([2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]);
    const badlands = b.terrain.indexOf('badlands');
    expect(b.numbers[badlands]).toBeNull();
    expect(b.raider).toBe(badlands);
  });

  test('never puts a 6 or an 8 next to another 6 or 8', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const b = makeBoard(seed);
      GEO.tiles.forEach((t, i) => {
        if (b.numbers[i] !== 6 && b.numbers[i] !== 8) return;
        for (const j of t.neighbours) expect([6, 8]).not.toContain(b.numbers[j]);
      });
    }
  });

  test('has four 3:1 harbours and one 2:1 harbour of each resource', () => {
    const kinds = makeBoard(3).harbors.slice().sort();
    expect(kinds).toEqual(['any', 'any', 'any', 'any', 'clay', 'grain', 'stone', 'timber', 'wool'].sort());
  });

  test('pips: a 6 or 8 is worth 5, a 2 or 12 is worth 1', () => {
    expect([PIPS[2], PIPS[6], PIPS[7], PIPS[8], PIPS[12]]).toEqual([1, 5, 0, 5, 1]);
  });
});
