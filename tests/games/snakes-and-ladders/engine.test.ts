import { describe, expect, test } from 'vitest';
import { IllegalMove } from '../../../src/games/kit/engine';
import { LADDERS, SNAKES, applySnl, createSnl, snlKit, walk, type SnlState } from '../../../src/games/snakes-and-ladders/engine';

const seats = (n = 2) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI: false }));

/** A state where the next die roll is `roll` (searching seeds). */
function withRoll(s: SnlState, roll: number): SnlState {
  for (let seed = 1; seed < 10_000; seed++) {
    const t = applySnl({ ...s, seed }, { type: 'ROLL' }, s.players[s.turn].id);
    if (t.last!.roll === roll) return { ...s, seed };
  }
  throw new Error('no seed');
}

const at = (s: SnlState, pos: number, i = 0): SnlState => ({ ...s, players: s.players.map((p, j) => (j === i ? { ...p, pos } : p)) });
const roll = (s: SnlState, n: number) => applySnl(withRoll(s, n), { type: 'ROLL' }, s.players[s.turn].id);

describe('board', () => {
  test('nine ladders up and ten snakes down, none on 100', () => {
    expect(Object.keys(LADDERS)).toHaveLength(9);
    expect(Object.keys(SNAKES)).toHaveLength(10);
    for (const [from, to] of Object.entries(LADDERS)) expect(to).toBeGreaterThan(Number(from));
    for (const [from, to] of Object.entries(SNAKES)) expect(to).toBeLessThan(Number(from));
    expect(SNAKES[100]).toBeUndefined();
  });

  test('a walk past 100 bounces back', () => {
    expect(walk(97, 5)).toEqual([98, 99, 100, 99, 98]);
    expect(walk(10, 3)).toEqual([11, 12, 13]);
  });
});

describe('turns', () => {
  test('everyone starts off the board and the first seat rolls', () => {
    const s = createSnl(seats(3), 1);
    expect(s.players.every((p) => p.pos === 0)).toBe(true);
    expect(snlKit.actor(s)).toBe('p0');
  });

  test('a roll moves you; play passes on unless it was a 6', () => {
    const s = createSnl(seats(), 1);
    const three = roll(at(s, 10), 3);
    expect(three.players[0].pos).toBe(13);
    expect(three.turn).toBe(1);
    const six = roll(at(s, 10), 6);
    expect(six.players[0].pos).toBe(SNAKES[16]); // 16 is a snake head
    expect(six.last!.again).toBe(true);
    expect(six.turn).toBe(0);
  });

  test('ending on a ladder foot climbs it; on a snake head slides', () => {
    const s = createSnl(seats(), 1);
    const up = roll(at(s, 24), 4); // 28 → 84
    expect(up.players[0].pos).toBe(84);
    expect(up.last!.via).toEqual({ kind: 'ladder', from: 28, to: 84 });
    const down = roll(at(s, 85), 2); // 87 → 24
    expect(down.players[0].pos).toBe(24);
    expect(down.last!.via?.kind).toBe('snake');
  });

  test('a bounce can land on a snake', () => {
    const s = roll(at(createSnl(seats(), 1), 97), 5); // 97 → 100 → back to 98, the snake to 78
    expect(s.players[0].pos).toBe(78);
  });

  test('landing on 100 exactly wins', () => {
    const s = roll(at(createSnl(seats(), 1), 96), 4);
    expect(s.over).toBe(true);
    expect(s.winner).toBe('p0');
    expect(s.score.p0).toBe(1);
    expect(snlKit.actor(s)).toBeNull();
  });

  test('rolling out of turn is rejected', () => {
    expect(() => applySnl(createSnl(seats(), 1), { type: 'ROLL' }, 'p1')).toThrow(IllegalMove);
  });

  test('a player who leaves is skipped; the last one left wins', () => {
    let s = createSnl(seats(3), 1);
    s = snlKit.forfeit(s, 'p1');
    s = roll(s, 2); // p0 → p2 (p1 skipped)
    expect(s.turn).toBe(2);
    s = snlKit.forfeit(s, 'p2');
    expect(s.over).toBe(true);
    expect(s.winner).toBe('p0');
  });

  test('bots finish a whole game', () => {
    let s = createSnl([{ name: 'A', isAI: true }, { name: 'B', isAI: true }, { name: 'C', isAI: true }], 11);
    for (let i = 0; i < 5000 && !s.over; i++) s = snlKit.apply(s, snlKit.bot(s), snlKit.actor(s)!);
    expect(s.over).toBe(true);
    expect(s.players.find((p) => p.id === s.winner)!.pos).toBe(100);
  });
});
