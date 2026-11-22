// Ludo for 5-8 players: the star board's track, its rules, and where its squares are drawn.
import { describe, expect, test } from 'vitest';
import { STAR_COLORS, YARD, applyLudo, createLudo, homeOf, isSafe, lastTrack, ludoKit, trackAt, type LudoState } from '../../../src/games/ludo/engine';
import { cellCentre, starOf, starSpot, trackCell } from '../../../src/games/ludo/ui/star';

const seats = (n: number, bots = false) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI: bots, difficulty: ['easy', 'normal', 'hard'][i % 3] }));

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

describe('the table', () => {
  test('2 to 8 can play; up to four sit at the cross, more get a star with an arm each', () => {
    expect([1, 2, 8, 9].map((n) => ludoKit.seatError(n))).toEqual(['Ludo is for 2-8 players', null, null, 'Ludo is for 2-8 players']);
    expect(createLudo(seats(4), 1).arms).toBe(4);
    expect(createLudo(seats(2), 1).players.map((p) => [p.color, p.arm])).toEqual([['red', 0], ['yellow', 2]]);
    for (const n of [5, 6, 7, 8]) {
      const s = createLudo(seats(n), 1);
      expect(s.arms).toBe(n);
      expect(s.players.map((p) => p.arm)).toEqual(Array.from({ length: n }, (_, i) => i));
      expect(s.players.map((p) => p.color)).toEqual(STAR_COLORS.slice(0, n));
      expect(s.players.every((p) => p.tokens.every((t) => t === YARD))).toBe(true);
    }
  });

  test('a colour picked in the lobby is kept on a star board', () => {
    const picked = seats(5).map((seat, i) => (i === 3 ? { ...seat, piece: 'red' } : seat));
    expect(createLudo(picked, 1).players.map((p) => p.color)).toEqual(['green', 'yellow', 'blue', 'red', 'purple']);
  });
});

describe('the track', () => {
  test.each([5, 6, 7, 8])('%i arms: 13 squares each, a lap of the whole track, then 5 squares of home column', (n) => {
    expect([lastTrack(n), homeOf(n)]).toEqual([13 * n - 2, 13 * n + 4]);
    // Every player starts 13 squares on from the one before, and every token covers the whole lap.
    for (let arm = 0; arm < n; arm++) {
      expect(trackAt(n, arm, 0)).toBe(13 * arm);
      const lap = Array.from({ length: lastTrack(n) + 1 }, (_, p) => trackAt(n, arm, p));
      expect(new Set(lap).size).toBe(13 * n - 1);
      expect(trackAt(n, arm, lastTrack(n) + 1)).toBeNull();
    }
    // A start square and a star on each arm are safe.
    expect(Array.from({ length: 13 * n }, (_, i) => i).filter(isSafe)).toHaveLength(2 * n);
  });

  test('the cross board is the four-arm case', () => {
    expect([lastTrack(4), homeOf(4)]).toEqual([50, 56]);
    expect([0, 8, 13, 21, 26, 34, 39, 47].every(isSafe)).toBe(true);
    expect(Array.from({ length: 52 }, (_, i) => i).filter(isSafe)).toHaveLength(8);
  });
});

describe('play on a star board', () => {
  test('a token needs the exact roll to reach home, further round than on the cross', () => {
    const home = homeOf(6);
    let s = tokens(createLudo(seats(6), 1), 0, [home - 2, home, home, home]);
    const missed = roll(s, 3);
    expect([missed.last?.kind, missed.players[0].tokens[0]]).toEqual(['no-move', home - 2]);
    s = roll(s, 2);
    expect([s.over, s.winner]).toEqual([true, 'p0']);
  });

  test('a token is captured by a rival from any arm, but not on a start or star square', () => {
    // p0 moves 2 from its square 10 to 12: track square 12, where p5 (arm 5 of 6) stands after 25 squares.
    let s = createLudo(seats(6), 1);
    s = tokens(tokens(s, 0, [10, YARD, YARD, YARD]), 5, [25, YARD, YARD, YARD]);
    expect(trackAt(6, 5, 25)).toBe(12);
    const hit = roll(s, 2);
    expect([hit.players[5].tokens[0], hit.last?.captured?.length, hit.turn]).toEqual([YARD, 1, 0]);
    // On p1's start square (13) the same token is safe.
    const safe = roll(tokens(tokens(createLudo(seats(6), 1), 0, [11, YARD, YARD, YARD]), 5, [26, YARD, YARD, YARD]), 2);
    expect([safe.players[5].tokens[0], safe.last?.captured]).toEqual([26, []]);
  });

  test.each([5, 6, 7, 8])('bots finish a %i-player game with all four tokens home', (n) => {
    let s = createLudo(seats(n, true), 11 + n);
    for (let i = 0; i < 60_000 && !s.over; i++) s = ludoKit.apply(s, ludoKit.bot(s, () => 0.5), ludoKit.actor(s)!);
    expect(s.over).toBe(true);
    expect(s.players.find((p) => p.id === s.winner)!.tokens.every((t) => t === homeOf(n))).toBe(true);
  });
});

describe('drawing the star', () => {
  test.each([5, 6, 7, 8])('%i arms: every track square is its own square, and the track is one unbroken ring', (n) => {
    const star = starOf(n);
    const centres = Array.from({ length: 13 * n }, (_, i) => cellCentre(star, trackCell(star, i)));
    expect(new Set(centres.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`)).size).toBe(13 * n);
    centres.forEach(([x, y], i) => {
      const [x2, y2] = centres[(i + 1) % centres.length];
      // Neighbours are one square apart along an arm, and a little more where the track crosses from one arm to the next.
      const gap = Math.hypot(x2 - x, y2 - y);
      expect(gap).toBeGreaterThan(0.99);
      expect(gap).toBeLessThan(i % 13 === 4 ? 2.2 : 1.01);
      expect(Math.hypot(x, y)).toBeLessThan(star.half);
    });
  });

  test('yards sit clear of the arms and inside the board; tokens in a yard, on the track and at home are apart', () => {
    for (const n of [5, 6, 7, 8]) {
      const star = starOf(n);
      expect(star.yardAt + star.yardRadius).toBeLessThanOrEqual(star.apothem + 6 + 1e-9);
      expect(star.yardRadius).toBeGreaterThan(1.4);
      const home = homeOf(n);
      const spots = [YARD, 0, lastTrack(n), lastTrack(n) + 1, home - 1, home].flatMap((p) => [0, 1, 2, 3].map((t) => starSpot(star, 2, p, t)));
      // A player's own four tokens only share a spot when they stand on the same square.
      const yard = spots.slice(0, 4);
      const atHome = spots.slice(-4);
      for (const group of [yard, atHome]) expect(new Set(group.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)).size).toBe(4);
      // The home column runs from the tip towards the centre.
      const [tip, first, last] = [starSpot(star, 2, lastTrack(n), 0), starSpot(star, 2, lastTrack(n) + 1, 0), starSpot(star, 2, home - 1, 0)];
      expect(Math.hypot(...tip)).toBeGreaterThan(Math.hypot(...first));
      expect(Math.hypot(...first)).toBeGreaterThan(Math.hypot(...last));
      expect(Math.hypot(tip[0] - first[0], tip[1] - first[1])).toBeCloseTo(1, 5);
    }
  });
});
