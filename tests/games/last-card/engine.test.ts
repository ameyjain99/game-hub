import { describe, expect, test } from 'vitest';
import { IllegalMove } from '../../../src/games/kit/engine';
import { applyLastCard, createLastCard, faceOf, fits, lastCardKit, playable, points, type Card, type Face, type LcState } from '../../../src/games/last-card/engine';

const seats = (n = 3) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI: false }));
let nextId = 10_000;
const card = (light: Face, dark: Face | null = null): Card => ({ id: nextId++, light, dark });
const num = (color: Face['color'], value: number): Face => ({ kind: 'number', color, value });

/** A table with chosen hands and a chosen top card. */
function table(hands: Card[][], top: Card, opts: Partial<LcState> = {}): LcState {
  const s = createLastCard(seats(hands.length), 1, { variant: opts.variant });
  return {
    ...s,
    players: s.players.map((p, i) => ({ ...p, hand: hands[i], handCount: hands[i].length })),
    discard: [top],
    color: faceOf(top, opts.side ?? 'light')!.color,
    ...opts,
  };
}

describe('the deck and the deal', () => {
  test('classic: 108 cards, seven each', () => {
    const s = createLastCard(seats(4), 3);
    const total = s.deck.length + s.discard.length + s.players.reduce((n, p) => n + p.hand.length, 0);
    expect(total).toBe(108);
    expect(s.players.every((p) => p.hand.length === 7)).toBe(true);
    expect(faceOf(s.discard[0], 'light')!.kind).not.toBe('wild-draw');
  });

  test('flip: 112 two-faced cards, light side up', () => {
    const s = createLastCard(seats(2), 3, { variant: 'flip' });
    const all = [...s.deck, ...s.discard, ...s.players.flatMap((p) => p.hand)];
    expect(all).toHaveLength(112);
    expect(all.every((c) => c.light && c.dark)).toBe(true);
    expect(all.filter((c) => c.dark!.kind === 'wild-hunt')).toHaveLength(4);
    expect(s.side).toBe('light');
    expect(s.deckBack).not.toBeNull();
  });
});

describe('playing', () => {
  test('match the colour or the number; anything else is refused', () => {
    const s = table([[card(num('red', 3)), card(num('blue', 5)), card(num('green', 9))], [card(num('red', 1))], [card(num('red', 1))]], card(num('blue', 3)));
    const me = s.players[0];
    expect(playable(s, me).map((c) => faceOf(c, 'light')!.value)).toEqual([3, 5]);
    expect(() => applyLastCard(s, { type: 'PLAY', card: me.hand[2].id }, 'p0')).toThrow(IllegalMove);
    const after = applyLastCard(s, { type: 'PLAY', card: me.hand[0].id }, 'p0');
    expect(after.color).toBe('red');
    expect(after.turn).toBe(1);
  });

  test('skip, reverse and draw two', () => {
    const skip = card({ kind: 'skip', color: 'red' });
    const rev = card({ kind: 'reverse', color: 'red' });
    const two = card({ kind: 'draw', color: 'red', value: 2 });
    const filler = () => [card(num('green', 1)), card(num('green', 2))];
    let s = table([[skip, ...filler()], filler(), filler()], card(num('red', 5)));
    expect(applyLastCard(s, { type: 'PLAY', card: skip.id }, 'p0').turn).toBe(2);
    s = table([[rev, ...filler()], filler(), filler()], card(num('red', 5)));
    const r = applyLastCard(s, { type: 'PLAY', card: rev.id }, 'p0');
    expect(r.direction).toBe(-1);
    expect(r.turn).toBe(2);
    s = table([[two, ...filler()], filler(), filler()], card(num('red', 5)));
    const d = applyLastCard(s, { type: 'PLAY', card: two.id }, 'p0');
    expect(d.players[1].hand).toHaveLength(4);
    expect(d.turn).toBe(2);
  });

  test('with two players a reverse acts as a skip', () => {
    const rev = card({ kind: 'reverse', color: 'red' });
    const s = table([[rev, card(num('red', 1))], [card(num('blue', 1))]], card(num('red', 5)));
    expect(applyLastCard(s, { type: 'PLAY', card: rev.id }, 'p0').turn).toBe(0);
  });

  test('a wild needs a colour; Wild Draw 4 only without the colour in hand', () => {
    const wild = card({ kind: 'wild', color: null });
    const four = card({ kind: 'wild-draw', color: null, value: 4 });
    const s = table([[wild, four, card(num('red', 1))], [card(num('blue', 2))], [card(num('blue', 2))]], card(num('red', 5)));
    expect(() => applyLastCard(s, { type: 'PLAY', card: wild.id }, 'p0')).toThrow(IllegalMove);
    expect(applyLastCard(s, { type: 'PLAY', card: wild.id, color: 'green' }, 'p0').color).toBe('green');
    expect(fits(s, four.light!, s.players[0].hand)).toBe(false); // holding a red
    const ok = table([[four, card(num('blue', 1))], [card(num('blue', 2))], [card(num('blue', 2))]], card(num('red', 5)));
    const after = applyLastCard(ok, { type: 'PLAY', card: four.id, color: 'blue' }, 'p0');
    expect(after.players[1].hand).toHaveLength(5);
    expect(after.turn).toBe(2);
  });

  test('drawing: a card that fits may be played, else the turn passes', () => {
    const s = table([[card(num('green', 1))], [card(num('green', 1))], [card(num('green', 1))]], card(num('red', 5)), {
      deck: [card(num('red', 8)), card(num('blue', 2))],
    });
    const drew = applyLastCard(s, { type: 'DRAW' }, 'p0');
    expect(drew.drawn).not.toBeNull();
    expect(drew.turn).toBe(0);
    const passed = applyLastCard(drew, { type: 'PASS' }, 'p0');
    expect(passed.turn).toBe(1);
    const miss = table([[card(num('green', 1))], [card(num('green', 1))], [card(num('green', 1))]], card(num('red', 5)), { deck: [card(num('blue', 2))] });
    expect(applyLastCard(miss, { type: 'DRAW' }, 'p0').turn).toBe(1);
  });

  test('forgetting to call "Last card" can be caught for two cards', () => {
    const a = card(num('red', 1));
    const s = table([[a, card(num('red', 2))], [card(num('blue', 1)), card(num('blue', 2))], [card(num('blue', 3))]], card(num('red', 5)));
    const quiet = applyLastCard(s, { type: 'PLAY', card: a.id }, 'p0');
    expect(quiet.exposed).toBe('p0');
    const caught = applyLastCard(quiet, { type: 'CATCH', target: 'p0' }, 'p2');
    expect(caught.players[0].hand).toHaveLength(3);
    expect(caught.exposed).toBeNull();
    const called = applyLastCard(s, { type: 'PLAY', card: a.id, callLast: true }, 'p0');
    expect(called.exposed).toBeNull();
    expect(() => applyLastCard(called, { type: 'CATCH', target: 'p0' }, 'p1')).toThrow(IllegalMove);
  });

  test('going out wins the hand and scores the rest', () => {
    const last = card(num('red', 1));
    const s = table([[last], [card(num('blue', 7)), card({ kind: 'wild', color: null })], [card({ kind: 'skip', color: 'green' })]], card(num('red', 5)));
    const won = applyLastCard(s, { type: 'PLAY', card: last.id }, 'p0');
    expect(won.over).toBe(true);
    expect(won.winner).toBe('p0');
    expect(won.score.p0).toBe(7 + 40 + 20);
    const next = applyLastCard(won, { type: 'REMATCH' }, 'p1');
    expect(next.over).toBe(false);
    expect(next.game).toBe(2);
    expect(next.score.p0).toBe(67);
  });

  test('points: numbers at face value, actions 20, wilds 40–60', () => {
    expect(points(num('red', 8))).toBe(8);
    expect(points({ kind: 'skip', color: 'red' })).toBe(20);
    expect(points({ kind: 'wild-draw', color: null, value: 4 })).toBe(50);
  });
});

describe('flip', () => {
  test('a Flip turns the table to the dark side', () => {
    const flip = card({ kind: 'flip', color: 'red' }, num('jade', 4));
    const other = card(num('red', 1), num('rose', 6));
    const s = table([[flip, other], [card(num('blue', 1), num('amber', 2))], [card(num('blue', 1), num('violet', 2))]], card(num('red', 5), num('rose', 5)), { variant: 'flip' });
    const after = applyLastCard(s, { type: 'PLAY', card: flip.id }, 'p0');
    expect(after.side).toBe('dark');
    expect(after.color).toBe('jade');
    expect(after.turn).toBe(1);
  });

  test('Draw 5 and Skip Everyone on the dark side', () => {
    const five = card(num('red', 1), { kind: 'draw', color: 'rose', value: 5 });
    const all = card(num('red', 2), { kind: 'skip-all', color: 'rose' });
    const fill = () => [card(num('blue', 1), num('amber', 1)), card(num('blue', 2), num('amber', 2))];
    const base = { variant: 'flip' as const, side: 'dark' as const };
    let s = table([[five, ...fill()], fill(), fill()], card(num('red', 5), num('rose', 5)), base);
    s = { ...s, color: 'rose' };
    const d = applyLastCard(s, { type: 'PLAY', card: five.id }, 'p0');
    expect(d.players[1].hand).toHaveLength(7);
    expect(d.turn).toBe(2);
    let t = table([[all, ...fill()], fill(), fill()], card(num('red', 5), num('rose', 5)), base);
    t = { ...t, color: 'rose' };
    expect(applyLastCard(t, { type: 'PLAY', card: all.id }, 'p0').turn).toBe(0);
  });

  test('in Flip you see the face in play of your cards and the other face of theirs', () => {
    const s = createLastCard(seats(2), 5, { variant: 'flip' });
    const view = lastCardKit.redact(s, 'p0');
    expect(view.players[0].hand.every((c) => c.light && !c.dark)).toBe(true);
    expect(view.players[1].hand.every((c) => !c.light && c.dark)).toBe(true);
    expect(view.deck).toEqual([]);
  });
});

describe('bots', () => {
  test.each(['classic', 'flip'] as const)('%s: bots finish a hand', (variant) => {
    let s = createLastCard(
      Array.from({ length: 4 }, (_, i) => ({ name: `B${i}`, isAI: true, difficulty: ['easy', 'normal', 'hard', 'normal'][i] })),
      9,
      { variant },
    );
    for (let i = 0; i < 4000 && !s.over; i++) s = lastCardKit.apply(s, lastCardKit.bot(s), lastCardKit.actor(s)!);
    expect(s.over).toBe(true);
    expect(s.players.find((p) => p.id === s.winner)!.hand).toHaveLength(0);
  });
});
