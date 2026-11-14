import { describe, expect, test } from 'vitest';
import { IllegalMove } from '../../../src/games/kit/engine';
import { HOME, HOME_COLUMN, SAFE, START, TRACK, YARD, applyLudo, colorsFor, createLudo, ludoKit, trackIndex, type LudoState } from '../../../src/games/ludo/engine';

const seats = (n = 2) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI: false }));

/** The state with its next die roll forced to `roll` (by searching seeds). */
function nextRoll(s: LudoState, roll: number): LudoState {
  for (let seed = 1; seed < 10_000; seed++) {
    const t = applyLudo({ ...s, seed, sixes: 0 }, { type: 'ROLL' }, s.players[s.turn].id);
    if (t.rollSeq > s.rollSeq && (t.dice === roll || t.last?.roll === roll)) return { ...s, seed };
  }
  throw new Error('no seed');
}
const tokens = (s: LudoState, i: number, t: number[]): LudoState => ({ ...s, players: s.players.map((p, k) => (k === i ? { ...p, tokens: t } : p)) });
const roll = (s: LudoState, n: number) => applyLudo(nextRoll(s, n), { type: 'ROLL' }, s.players[s.turn].id);

describe('board', () => {
  test('a 52-square loop of distinct cells around the cross', () => {
    expect(TRACK).toHaveLength(52);
    expect(new Set(TRACK.map(([r, c]) => `${r},${c}`)).size).toBe(52);
    for (const [r, c] of TRACK) expect(r >= 6 && r <= 8 ? true : c >= 6 && c <= 8).toBe(true);
    // Neighbouring squares touch (diagonally where the track turns at the centre's corners).
    let diagonal = 0;
    TRACK.forEach(([r, c], i) => {
      const [r2, c2] = TRACK[(i + 1) % 52];
      expect(Math.max(Math.abs(r - r2), Math.abs(c - c2))).toBe(1);
      if (r !== r2 && c !== c2) diagonal++;
    });
    expect(diagonal).toBe(4);
  });

  test('each home column starts beside the square a token turns from', () => {
    for (const color of ['red', 'green', 'yellow', 'blue'] as const) {
      const [r, c] = TRACK[trackIndex(color, 50)!];
      const [hr, hc] = HOME_COLUMN[color][0];
      expect(Math.abs(r - hr) + Math.abs(c - hc)).toBe(1);
    }
  });

  test('two players sit opposite; starts and stars are safe', () => {
    expect(colorsFor(2)).toEqual(['red', 'yellow']);
    for (const s of Object.values(START)) expect(SAFE.has(s)).toBe(true);
    expect(SAFE.size).toBe(8);
  });
});

describe('rules', () => {
  test('only a 6 brings a token out – and it rolls again', () => {
    const s = createLudo(seats(), 1);
    const five = roll(s, 5);
    expect(five.last?.kind).toBe('no-move');
    expect(five.turn).toBe(1);
    const six = roll(s, 6);
    // All four tokens are in the yard, so the single choice plays itself.
    expect(six.players[0].tokens).toEqual([0, YARD, YARD, YARD]);
    expect(six.turn).toBe(0);
    expect(six.last?.bonus).toBe(true);
  });

  test('with two choices the player picks the token', () => {
    let s = tokens(createLudo(seats(), 1), 0, [5, 10, YARD, YARD]);
    s = roll(s, 3);
    expect(s.phase).toBe('move');
    expect(() => applyLudo(s, { type: 'MOVE', token: 2 }, 'p0')).toThrow(IllegalMove);
    s = applyLudo(s, { type: 'MOVE', token: 1 }, 'p0');
    expect(s.players[0].tokens).toEqual([5, 13, YARD, YARD]);
    expect(s.turn).toBe(1);
  });

  test('landing on an opponent sends it home and earns a bonus roll', () => {
    // Red token at progress 10 (track 10); yellow token sits on track 13 = yellow progress 39.
    let s = tokens(createLudo(seats(), 1), 0, [10, YARD, YARD, YARD]);
    s = tokens(s, 1, [39, YARD, YARD, YARD]);
    expect(trackIndex('yellow', 39)).toBe(13);
    s = roll(s, 3); // 13 is green's start – a safe square, so no capture
    expect(s.players[1].tokens[0]).toBe(39);
    let t = tokens(createLudo(seats(), 1), 0, [10, YARD, YARD, YARD]);
    t = tokens(t, 1, [38, YARD, YARD, YARD]); // yellow on track 12
    t = roll(t, 2);
    expect(t.players[1].tokens[0]).toBe(YARD);
    expect(t.last?.captured).toHaveLength(1);
    expect(t.turn).toBe(0); // bonus roll
  });

  test('home needs the exact roll, and earns a bonus', () => {
    let s = tokens(createLudo(seats(), 1), 0, [53, YARD, YARD, YARD]);
    s = roll(s, 5); // 58 > 56: no move
    expect(s.last?.kind).toBe('no-move');
    let t = tokens(createLudo(seats(), 1), 0, [53, YARD, YARD, YARD]);
    t = roll(t, 3);
    expect(t.players[0].tokens[0]).toBe(HOME);
    expect(t.turn).toBe(0);
  });

  test('a third 6 in a row ends the turn', () => {
    let s = tokens(createLudo(seats(), 1), 0, [5, YARD, YARD, YARD]);
    s = { ...nextRoll(s, 6), sixes: 2 };
    const after = applyLudo(s, { type: 'ROLL' }, 'p0');
    expect(after.last?.kind).toBe('three-sixes');
    expect(after.turn).toBe(1);
  });

  test('all four home wins', () => {
    let s = tokens(createLudo(seats(), 1), 0, [HOME, HOME, HOME, 54]);
    s = roll(s, 2);
    expect(s.over).toBe(true);
    expect(s.winner).toBe('p0');
  });

  test('bots finish a four-player game', () => {
    let s = createLudo(Array.from({ length: 4 }, (_, i) => ({ name: `B${i}`, isAI: true, difficulty: i % 2 ? 'hard' : 'easy' })), 5);
    for (let i = 0; i < 20_000 && !s.over; i++) s = ludoKit.apply(s, ludoKit.bot(s), ludoKit.actor(s)!);
    expect(s.over).toBe(true);
    expect(s.players.find((p) => p.id === s.winner)!.tokens.every((t) => t === HOME)).toBe(true);
  });

  test('a player who leaves is skipped', () => {
    let s = createLudo(seats(3), 1);
    s = ludoKit.forfeit(s, 'p1');
    s = roll(s, 2);
    expect(s.turn).toBe(2);
  });
});
