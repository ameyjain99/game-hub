import { describe, expect, test } from 'vitest';
import { IllegalMove } from '../../../src/games/kit/engine';
import {
  BOARD,
  CORNERS,
  applyLineup,
  cellsOf,
  createLineup,
  isDead,
  legalPlays,
  lineupKit,
  targetsFor,
  type SeqState,
} from '../../../src/games/lineup/engine';

const seats = (n = 2) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI: false }));
const withHand = (s: SeqState, i: number, hand: string[]): SeqState => ({ ...s, players: s.players.map((p, k) => (k === i ? { ...p, hand, handCount: hand.length } : p)) });
const chipsAt = (s: SeqState, cells: number[], team: number): SeqState => ({ ...s, chips: s.chips.map((c, i) => (cells.includes(i) ? team : c)) });
const play = (s: SeqState, card: number, cell: number) => applyLineup(s, { type: 'PLAY', card, cell }, s.players[s.turn].id);

describe('board and deal', () => {
  test('every non-Jack card appears exactly twice, with four free corners', () => {
    const counts = new Map<string, number>();
    for (const c of BOARD) counts.set(c, (counts.get(c) ?? 0) + 1);
    expect(counts.get('XX')).toBe(4);
    expect([...counts].filter(([c]) => c !== 'XX').every(([, n]) => n === 2)).toBe(true);
    expect(counts.size).toBe(49);
    expect([...CORNERS].every((i) => BOARD[i] === 'XX')).toBe(true);
  });

  test('hand sizes and teams follow the player count', () => {
    const two = createLineup(seats(2), 1);
    expect(two.players.map((p) => p.hand.length)).toEqual([7, 7]);
    expect(two.teams).toBe(2);
    expect(two.needed).toBe(2);
    const three = createLineup(seats(3), 1);
    expect(three.players[0].hand).toHaveLength(6);
    expect(three.needed).toBe(1);
    const four = createLineup(seats(4), 1);
    expect(four.players.map((p) => p.team)).toEqual([0, 1, 0, 1]); // partners sit alternately
    const six = createLineup(seats(6), 1);
    expect(six.teams).toBe(3);
    expect(six.players[0].hand).toHaveLength(5);
    expect(lineupKit.seatError(5)).not.toBeNull();
  });

  test('two decks: 104 cards between the hands and the deck', () => {
    const s = createLineup(seats(2), 3);
    expect(s.deck.length + s.players.reduce((n, p) => n + p.hand.length, 0)).toBe(104);
  });
});

describe('plays', () => {
  test('a card puts a chip on one of its two spaces, then you draw', () => {
    let s = withHand(createLineup(seats(), 1), 0, ['5D', '2S']);
    const [a] = cellsOf('5D');
    s = play(s, 0, a);
    expect(s.chips[a]).toBe(0);
    expect(s.players[0].hand).toHaveLength(2);
    expect(s.players[0].hand).not.toContain('5D');
    expect(s.turn).toBe(1);
    expect(() => play(withHand(s, 1, ['5D']), 0, a)).toThrow(IllegalMove); // taken
  });

  test('a two-eyed Jack goes anywhere open; a one-eyed Jack removes an opponent chip', () => {
    let s = withHand(createLineup(seats(), 1), 0, ['JD']);
    expect(targetsFor(s, 'JD', 0)).toHaveLength(96);
    s = play(s, 0, 55);
    expect(s.chips[55]).toBe(0);
    s = withHand(s, 1, ['JS']);
    expect(targetsFor(s, 'JS', 1)).toEqual([55]);
    s = play(s, 0, 55);
    expect(s.chips[55]).toBeNull();
    expect(s.last?.kind).toBe('remove');
  });

  test('five in a row makes a sequence; its chips can no longer be removed', () => {
    let s = chipsAt(createLineup(seats(), 1), [11, 12, 13, 14], 0);
    s = withHand(s, 0, [BOARD[15]]);
    s = play(s, 0, 15);
    expect(s.sequences).toEqual([{ team: 0, cells: [11, 12, 13, 14, 15] }]);
    expect(targetsFor(withHand(s, 1, ['JH']), 'JH', 1)).toEqual([]);
  });

  test('a free corner counts toward a sequence', () => {
    let s = chipsAt(createLineup(seats(), 1), [1, 2, 3], 0);
    s = withHand(s, 0, [BOARD[4]]);
    s = play(s, 0, 4);
    expect(s.sequences[0].cells).toEqual([0, 1, 2, 3, 4]);
  });

  test('a second sequence may reuse one chip of the first, and two win', () => {
    // Row 1: 10–14 is the first; 14–18 shares only 14.
    let s = chipsAt(createLineup(seats(), 1), [10, 11, 12, 13, 14, 15, 16, 17], 0);
    s = { ...s, sequences: [{ team: 0, cells: [10, 11, 12, 13, 14] }] };
    s = withHand(s, 0, [BOARD[18]]);
    s = play(s, 0, 18);
    expect(s.sequences).toHaveLength(2);
    expect(s.sequences[1].cells).toEqual([14, 15, 16, 17, 18]);
    expect(s.over).toBe(true);
    expect(s.winner).toBe(0);
  });

  test('a dead card can be swapped once per turn', () => {
    let s = createLineup(seats(), 1);
    const [a, b] = cellsOf('KS');
    s = chipsAt(s, [a, b], 1);
    s = withHand(s, 0, ['KS', 'KS', '2S']);
    expect(isDead(s, 'KS')).toBe(true);
    s = applyLineup(s, { type: 'DEAD', card: 0 }, 'p0');
    expect(s.players[0].hand).toHaveLength(3);
    expect(s.turn).toBe(0); // still your turn
    expect(() => applyLineup(s, { type: 'DEAD', card: 0 }, 'p0')).toThrow(IllegalMove);
  });

  test("opponents' hands and the deck are hidden", () => {
    const s = createLineup(seats(), 1);
    const view = lineupKit.redact(s, 'p0');
    expect(view.players[0].hand).toHaveLength(7);
    expect(view.players[1].hand).toEqual([]);
    expect(view.players[1].handCount).toBe(7);
    expect(view.deck).toEqual([]);
    expect(view.deckCount).toBe(s.deck.length);
  });

  test('bots play a game to the end', () => {
    let s = createLineup(Array.from({ length: 4 }, (_, i) => ({ name: `B${i}`, isAI: true, difficulty: i % 2 ? 'hard' : 'normal' })), 4);
    for (let i = 0; i < 3000 && !s.over; i++) {
      expect(legalPlays(s).length + s.players[s.turn].hand.length).toBeGreaterThan(0);
      s = lineupKit.apply(s, lineupKit.bot(s), lineupKit.actor(s)!);
    }
    expect(s.over).toBe(true);
    expect(s.sequences.filter((q) => q.team === s.winner).length).toBeGreaterThanOrEqual(2);
  });
});
