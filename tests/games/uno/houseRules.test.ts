// The house rules a table can switch on: what stacks on what, same numbers
// together, a free Wild Draw, drawing until a card fits, and sevens and zeros.
import { expect, test } from 'vitest';
import { IllegalMove } from '../../../src/games/kit/engine';
import { applyUno, createUno, faceOf, fits, unoBotAction, unoKit, playable, rulesOf, type Card, type Face, type UnoOptions, type UnoState } from '../../../src/games/uno/engine';

const seats = (n = 3) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI: false }));
let nextId = 20_000;
const card = (light: Face, dark: Face | null = null): Card => ({ id: nextId++, light, dark });
const num = (color: Face['color'], value: number): Face => ({ kind: 'number', color, value });
const draw = (color: Face['color'], value: number): Face => ({ kind: 'draw', color, value });
const wildDraw = (value: number): Face => ({ kind: 'wild-draw', color: null, value });

function table(options: UnoOptions, hands: Card[][], top: Card, more: Partial<UnoState> = {}): UnoState {
  const s = createUno(seats(hands.length), 1, options);
  return { ...s, players: s.players.map((p, i) => ({ ...p, hand: hands[i], handCount: hands[i].length })), discard: [top], color: faceOf(top, more.side ?? 'light')!.color, ...more };
}

const owing = (options: UnoOptions, top: Face, side: 'light' | 'dark' = 'light'): UnoState => {
  const c = side === 'light' ? card(top) : card(num('red', 1), top);
  return table(options, [[card(num('red', 1))], [card(num('red', 1))]], c, { owed: 2, side, color: top.color });
};

test('No Mercy has every house rule but "together" built in; the other modes have what was switched on', () => {
  expect(rulesOf(createUno(seats(), 1, { variant: 'no-mercy' }))).toEqual({ stack: true, together: false, freeWild: true, drawToMatch: true, sevenZero: true, jumpIn: false, challenge: false });
  expect(rulesOf(createUno(seats(), 1))).toEqual({ stack: false, together: false, freeWild: false, drawToMatch: false, sevenZero: false, jumpIn: false, challenge: false });
  expect(rulesOf(createUno(seats(), 1, { variant: 'flip', together: true, sevenZero: true }))).toMatchObject({ together: true, sevenZero: true, stack: false });
});

test('stacking: a draw card is answered by any draw card as big or bigger, in every mode', () => {
  const classic = { variant: 'classic', stack: true } as const;
  expect(fits(owing(classic, draw('red', 2)), draw('blue', 2), [])).toBe(true);
  expect(fits(owing(classic, draw('red', 2)), wildDraw(4), [])).toBe(true);
  expect(fits(owing(classic, wildDraw(4)), draw('red', 2), [])).toBe(false);
  expect(fits(owing(classic, wildDraw(4)), wildDraw(4), [])).toBe(true);
  expect(fits(owing(classic, draw('red', 2)), num('red', 5), [])).toBe(false);

  const flip = { variant: 'flip', stack: true } as const;
  expect(fits(owing(flip, draw('red', 1)), wildDraw(2), [])).toBe(true);
  expect(fits(owing(flip, wildDraw(2)), draw('red', 1), [])).toBe(false);
  expect(fits(owing(flip, draw('pink', 5), 'dark'), draw('teal', 5), [])).toBe(true);
  expect(fits(owing(flip, draw('pink', 5), 'dark'), { kind: 'wild-draw-color', color: null }, [])).toBe(false);

  const noMercy = { variant: 'no-mercy' } as const;
  expect(fits(owing(noMercy, draw('red', 4)), draw('blue', 2), [])).toBe(false);
  expect(fits(owing(noMercy, draw('red', 4)), { kind: 'wild-reverse-draw', color: null, value: 4 }, [])).toBe(true);
  expect(fits(owing(noMercy, wildDraw(6)), draw('red', 4), [])).toBe(false);
  expect(fits(owing(noMercy, wildDraw(6)), wildDraw(10), [])).toBe(true);
  expect(fits(owing(noMercy, wildDraw(10)), wildDraw(6), [])).toBe(false);
});

test('a Wild Draw 4 needs an empty colour, unless the table plays it freely', () => {
  const hand = [card(wildDraw(4)), card(num('red', 2))];
  const top = card(num('red', 9));
  expect(playable(table({}, [hand, []], top), table({}, [hand, []], top).players[0])).toHaveLength(1);
  const free = table({ freeWild: true }, [hand, []], top);
  expect(playable(free, free.players[0])).toHaveLength(2);
});

test('same numbers together: they all go on the pile, the last one sets the colour', () => {
  const [a, b, c, keep] = [card(num('red', 5)), card(num('blue', 5)), card(num('green', 5)), card(num('yellow', 1))];
  const s = table({ together: true }, [[a, b, c, keep], [card(num('red', 1))], [card(num('red', 1))]], card(num('red', 9)));
  const after = applyUno(s, { type: 'PLAY', card: a.id, also: [c.id, b.id], callLast: true }, 'p0');
  expect(after.players[0].hand.map((x) => x.id)).toEqual([keep.id]);
  expect(after.discard.slice(-3).map((x) => x.id)).toEqual([a.id, c.id, b.id]);
  expect(after.color).toBe('blue');
  expect(after.last).toMatchObject({ kind: 'call' });
  expect(after.history.find((e) => e.kind === 'play')).toMatchObject({ count: 3 });
  expect(after.turn).toBe(1);
});

test('same numbers together: the first card must fit, the rest must be that number, and the rule must be on', () => {
  const [a, b, odd] = [card(num('red', 5)), card(num('blue', 5)), card(num('blue', 6))];
  const hands = [[a, b, odd, card(num('green', 1))], [card(num('red', 1))]];
  const on = table({ together: true }, hands, card(num('red', 9)));
  expect(() => applyUno(on, { type: 'PLAY', card: b.id, also: [a.id] }, 'p0')).toThrow(IllegalMove);
  expect(() => applyUno(on, { type: 'PLAY', card: a.id, also: [odd.id] }, 'p0')).toThrow(IllegalMove);
  expect(() => applyUno(on, { type: 'PLAY', card: a.id, also: [a.id] }, 'p0')).toThrow(IllegalMove);
  const off = table({}, hands, card(num('red', 9)));
  expect(() => applyUno(off, { type: 'PLAY', card: a.id, also: [b.id] }, 'p0')).toThrow(IllegalMove);
});

test('same numbers together can win the hand outright', () => {
  const [a, b] = [card(num('red', 5)), card(num('blue', 5))];
  const s = table({ together: true }, [[a, b], [card(num('red', 4))]], card(num('red', 9)));
  const after = applyUno(s, { type: 'PLAY', card: a.id, also: [b.id] }, 'p0');
  expect([after.over, after.winner, after.score.p0]).toEqual([true, 'p0', 4]);
});

test('draw to match in Classic: you draw until a card fits, and must play it', () => {
  const s0 = table({ drawToMatch: true }, [[card(num('blue', 1))], [card(num('blue', 2))]], card(num('red', 9)));
  const fit = card(num('red', 3));
  const s = { ...s0, deck: [card(num('green', 4)), card(num('yellow', 6)), fit, card(num('red', 7))] };
  const after = applyUno(s, { type: 'DRAW' }, 'p0');
  expect(after.players[0].hand).toHaveLength(4);
  expect(after.drawn).toBe(fit.id);
  expect(after.turn).toBe(0);
  expect(() => applyUno(after, { type: 'PASS' }, 'p0')).toThrow(IllegalMove);
  // No 25-card limit outside No Mercy: a long draw never knocks anyone out.
  const long = { ...s0, deck: [...Array.from({ length: 30 }, () => card(num('green', 4))), fit] };
  const drawn = applyUno(long, { type: 'DRAW' }, 'p0');
  expect([drawn.players[0].hand.length, drawn.players[0].bust ?? false, drawn.drawn]).toEqual([32, false, fit.id]);
});

test('sevens and zeros in Classic: a 7 swaps hands, a 0 passes every hand on', () => {
  const seven = card(num('red', 7));
  const mine = card(num('blue', 1));
  const theirs = [card(num('green', 2)), card(num('green', 3))];
  const s = table({ sevenZero: true }, [[seven, mine], [card(num('red', 4))], theirs], card(num('red', 9)));
  expect(() => applyUno(s, { type: 'PLAY', card: seven.id }, 'p0')).toThrow(IllegalMove);
  const swapped = applyUno(s, { type: 'PLAY', card: seven.id, swapWith: 'p2' }, 'p0');
  expect(swapped.players[0].hand).toEqual(theirs);
  expect(swapped.players[2].hand).toEqual([mine]);

  const zero = card(num('red', 0));
  const z = table({ sevenZero: true }, [[zero, mine], [card(num('red', 4))], theirs], card(num('red', 9)));
  const turned = applyUno(z, { type: 'PLAY', card: zero.id }, 'p0');
  expect(turned.players[1].hand).toEqual([mine]);
  expect(turned.players[0].hand).toEqual(theirs);
  // Off by default: a 7 is just a 7.
  const plain = applyUno(table({}, [[seven, mine], [card(num('red', 4))], theirs], card(num('red', 9))), { type: 'PLAY', card: seven.id }, 'p0');
  expect(plain.players[0].hand).toEqual([mine]);
});

test('bots finish hands under every house rule, in every mode', () => {
  for (const variant of ['classic', 'flip', 'no-mercy'] as const) {
    for (let seed = 1; seed <= 12; seed++) {
      let s = createUno(Array.from({ length: 4 }, (_, i) => ({ name: `B${i}`, isAI: true, difficulty: (['easy', 'normal', 'hard'] as const)[(seed + i) % 3] })), seed, { variant, stack: true, together: true, freeWild: true, drawToMatch: true, sevenZero: true });
      let r = seed * 7919;
      const rand = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      for (let i = 0; i < 6000 && !s.over; i++) s = applyUno(s, unoBotAction(s, rand), s.players[s.turn].id);
      expect(s.over, `${variant} seed ${seed}`).toBe(true);
    }
  }
});

test('jump-in: the very same card goes down out of turn, and play carries on from the jumper', () => {
  const twin = card(num('red', 9));
  const s = table({ jumpIn: true }, [[card(num('blue', 1)), card(num('blue', 2))], [card(num('red', 4)), card(num('red', 5))], [twin, card(num('green', 3)), card(num('green', 4))]], card(num('red', 9)));
  expect(s.turn).toBe(0);
  const after = applyUno(s, { type: 'JUMP', card: twin.id }, 'p2');
  expect(after.players[2].hand).toHaveLength(2);
  expect(after.turn).toBe(0); // on from p2: p0 is next
  expect(after.history.map((e) => e.kind)).toEqual(['play', 'jump']);
  // Not a different card, not a wild, not on your own turn, and not when the rule is off.
  expect(() => applyUno(s, { type: 'JUMP', card: s.players[2].hand[1].id }, 'p2')).toThrow(IllegalMove);
  expect(() => applyUno(s, { type: 'JUMP', card: s.players[0].hand[0].id }, 'p0')).toThrow(IllegalMove);
  expect(() => applyUno(table({}, s.players.map((p) => p.hand), s.discard[0]), { type: 'JUMP', card: twin.id }, 'p2')).toThrow(IllegalMove);
});

test('challenge: a bluffed Wild Draw 4 costs the bluffer the cards, and the challenger plays on', () => {
  const wd = card(wildDraw(4));
  const s = table({ challenge: true }, [[wd, card(num('red', 2)), card(num('blue', 3))], [card(num('green', 5)), card(num('green', 6))], [card(num('red', 1))]], card(num('red', 9)));
  // Holding red, the Wild Draw 4 is a bluff, but it may be played.
  const played = applyUno(s, { type: 'PLAY', card: wd.id, color: 'green' }, 'p0');
  expect([played.turn, played.owed, played.bluff?.player]).toEqual([1, 4, 'p0']);
  expect(unoKit.redact(played, 'p1').bluff).toEqual({ player: 'p0' });
  const after = applyUno(played, { type: 'CHALLENGE' }, 'p1');
  expect([after.players[0].hand.length, after.players[1].hand.length, after.owed, after.turn]).toEqual([6, 2, 0, 1]);
  expect(after.last).toMatchObject({ kind: 'challenge', caught: true, count: 4 });
});

test('challenge: a fair Wild Draw 4 costs the challenger six, and taking the cards is always allowed', () => {
  const wd = card(wildDraw(4));
  const s = table({ challenge: true }, [[wd, card(num('blue', 3)), card(num('blue', 4))], [card(num('green', 5))], [card(num('red', 1))]], card(num('red', 9)));
  const played = applyUno(s, { type: 'PLAY', card: wd.id, color: 'blue' }, 'p0');
  const wrong = applyUno(played, { type: 'CHALLENGE' }, 'p1');
  expect([wrong.players[1].hand.length, wrong.players[0].hand.length, wrong.turn]).toEqual([7, 2, 2]);
  expect(wrong.last).toMatchObject({ kind: 'challenge', caught: false, count: 6 });
  const took = applyUno(played, { type: 'DRAW' }, 'p1');
  expect([took.players[1].hand.length, took.turn, took.bluff ?? null]).toEqual([5, 2, null]);
  // No stacking at this table: nothing else may be played on it.
  expect(playable(played, played.players[1])).toHaveLength(0);
  // Without the rule the bluff cannot be played at all.
  const strict = table({}, [[wd, card(num('red', 2))], [card(num('green', 5))]], card(num('red', 9)));
  expect(() => applyUno(strict, { type: 'PLAY', card: wd.id, color: 'green' }, 'p0')).toThrow(IllegalMove);
});

test('cards dealt and the target score follow the host, with the standard 7 and 500 otherwise', () => {
  const s = createUno(seats(3), 2, { handSize: 10, target: 200 });
  expect([s.players.map((p) => p.hand.length), s.target]).toEqual([[10, 10, 10], 200]);
  const d = createUno(seats(3), 2, { handSize: 3 as never, target: 7 as never });
  expect([d.players[0].hand.length, d.target]).toEqual([7, 500]);
});

test('bots finish hands with jump-in and challenges on', () => {
  for (let seed = 1; seed <= 15; seed++) {
    let s = createUno(Array.from({ length: 4 }, (_, i) => ({ name: `B${i}`, isAI: true, difficulty: (['easy', 'normal', 'hard'] as const)[(seed + i) % 3] })), seed, { variant: seed % 2 ? 'classic' : 'flip', stack: seed % 3 === 0, jumpIn: true, challenge: true, handSize: 5 });
    let r = seed * 104729;
    const rand = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < 6000 && !s.over; i++) s = applyUno(s, unoBotAction(s, rand), s.players[s.turn].id);
    expect(s.over, `seed ${seed}`).toBe(true);
  }
});
