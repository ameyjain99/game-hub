// The No Mercy mode: draws stack without limit, you draw until you can play,
// harsher cards, hands that change owner, and 25 cards knocks you out.
import { expect, test } from 'vitest';
import { applyUno, createUno, fits, unoKit, unoBotAction, points, MERCY, type Card, type Face, type UnoState } from '../../../src/games/uno/engine';

const seats = (n: number, isAI = false) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI, difficulty: 'normal' }));
const card = (id: number, face: Face): Card => ({ id, light: face, dark: null });
const num = (id: number, value: number, color: Face['color'] = 'red') => card(id, { kind: 'number', color, value });
const draw = (id: number, value: number, color: Face['color'] = 'red') => card(id, { kind: 'draw', color, value });
const wildDraw = (id: number, value: number) => card(id, { kind: 'wild-draw', color: null, value });
const filler = (from: number, n: number, color: Face['color'] = 'blue') => Array.from({ length: n }, (_, i) => num(from + i, (i % 5) + 1, color));

/** A hand of No Mercy with chosen hands, red 5 on the pile, seat 0 to move. */
function rigged(hands: Card[][], extra: Partial<UnoState> = {}): UnoState {
  const s = createUno(seats(hands.length), 4, { variant: 'no-mercy' });
  return { ...s, turn: 0, direction: 1, color: 'red', drawn: null, exposed: null, owed: 0, discard: [num(900, 5)], players: s.players.map((p, i) => ({ ...p, hand: hands[i], handCount: hands[i].length })), ...extra };
}

test('the deck has 152 cards with the harsher ones in it, and seven are dealt', () => {
  const s = createUno(seats(4), 9, { variant: 'no-mercy' });
  const all = [...s.deck, ...s.discard, ...s.players.flatMap((p) => p.hand)].map((c) => c.light!);
  expect(all).toHaveLength(152);
  const count = (f: (x: Face) => boolean) => all.filter(f).length;
  expect(count((f) => f.kind === 'number')).toBe(80);
  expect(count((f) => f.kind === 'draw' && f.value === 4)).toBe(8);
  expect(count((f) => f.kind === 'discard-all')).toBe(8);
  expect(count((f) => f.kind === 'skip-all')).toBe(8);
  expect(count((f) => f.kind === 'wild-draw' && f.value === 6)).toBe(4);
  expect(count((f) => f.kind === 'wild-draw' && f.value === 10)).toBe(4);
  expect(count((f) => f.kind === 'wild-reverse-draw')).toBe(4);
  expect(count((f) => f.kind === 'wild-draw-color')).toBe(4);
  expect(s.players.every((p) => p.hand.length === 7)).toBe(true);
  expect(s.stack).toBe(true);
  expect(MERCY).toBe(25);
});

test('a draw card is answered with any draw card as big or bigger, and the total passes on', () => {
  let s = rigged([[draw(1, 2), num(2, 1), num(3, 2)], [draw(4, 4, 'blue'), draw(5, 2, 'green'), wildDraw(6, 10), num(7, 3)], [num(8, 4), num(9, 6), num(10, 1)]]);
  s = applyUno(s, { type: 'PLAY', card: 1 }, 'p0');
  expect([s.owed, s.turn]).toEqual([2, 1]);
  const p1 = s.players[1].hand;
  expect(p1.map((c) => fits(s, c.light!, p1))).toEqual([true, true, true, false]);
  s = applyUno(s, { type: 'PLAY', card: 4 }, 'p1'); // a Draw 4 on a Draw 2
  expect([s.owed, s.turn]).toEqual([6, 2]);
  // Now only a 4 or bigger answers: p2 has none and takes all six.
  s = applyUno(s, { type: 'DRAW' }, 'p2');
  expect(s.players[2].hand).toHaveLength(9);
  expect([s.owed, s.turn]).toEqual([0, 0]);
});

test('a smaller draw card cannot answer a bigger one', () => {
  let s = rigged([[draw(1, 4), num(2, 1), num(3, 2)], [draw(5, 2), num(7, 3)], [num(8, 4), num(9, 6)]]);
  s = applyUno(s, { type: 'PLAY', card: 1 }, 'p0');
  expect(fits(s, s.players[1].hand[0].light!, s.players[1].hand)).toBe(false);
});

test('Wild Reverse Draw 4 turns play round and the player before you owes four', () => {
  let s = rigged([[card(1, { kind: 'wild-reverse-draw', color: null, value: 4 }), num(2, 1), num(3, 2)], [num(4, 3), num(5, 3)], [num(8, 4), num(9, 6)]]);
  s = applyUno(s, { type: 'PLAY', card: 1, color: 'green' }, 'p0');
  expect([s.direction, s.turn, s.owed, s.color]).toEqual([-1, 2, 4, 'green']);
});

test('the big wild draw cards need no excuse: they can be played with the colour in hand', () => {
  const s = rigged([[wildDraw(1, 6), num(2, 1, 'red')], [num(4, 3)], [num(8, 4)]]);
  expect(fits(s, s.players[0].hand[0].light!, s.players[0].hand)).toBe(true);
});

test('with nothing to play you draw until a card fits, and that card must be played', () => {
  let s = rigged([[num(1, 9, 'blue'), num(2, 8, 'blue')], [num(4, 3)], [num(8, 4)]]);
  s = { ...s, deck: [num(50, 7, 'green'), num(51, 8, 'yellow'), num(52, 2, 'red'), num(53, 3, 'red'), ...s.deck] };
  s = applyUno(s, { type: 'DRAW' }, 'p0');
  expect(s.players[0].hand.map((c) => c.id)).toEqual([1, 2, 50, 51, 52]);
  expect([s.drawn, s.turn]).toEqual([52, 0]);
  expect(s.last).toMatchObject({ kind: 'draw', count: 3 });
  expect(() => applyUno(s, { type: 'PASS' }, 'p0')).toThrow(/must play/);
  s = applyUno(s, { type: 'PLAY', card: 52 }, 'p0');
  expect(s.turn).toBe(1);
});

test('Discard All sheds every card of its colour with it', () => {
  let s = rigged([[card(1, { kind: 'discard-all', color: 'red' }), num(2, 1), num(3, 2), num(4, 9, 'blue'), num(5, 9, 'green')], [num(6, 3)], [num(8, 4)]]);
  s = applyUno(s, { type: 'PLAY', card: 1 }, 'p0');
  expect(s.players[0].hand.map((c) => c.id)).toEqual([4, 5]);
  expect(s.discard[s.discard.length - 1].id).toBe(1); // the Discard All stays on top
  expect(s.discard.map((c) => c.id)).toEqual(expect.arrayContaining([2, 3]));
  expect([s.turn, s.color]).toEqual([1, 'red']);
});

test('going out with a Discard All wins the hand', () => {
  let s = rigged([[card(1, { kind: 'discard-all', color: 'red' }), num(2, 1), num(3, 2)], [num(6, 3), num(7, 3)], [num(8, 4)]]);
  s = applyUno(s, { type: 'PLAY', card: 1 }, 'p0');
  expect([s.over, s.winner]).toEqual([true, 'p0']);
});

test('a 7 swaps your hand with a player you choose', () => {
  let s = rigged([[num(1, 7), num(2, 1), num(3, 2)], [num(6, 3)], [num(8, 4), num(9, 4)]]);
  expect(() => applyUno(s, { type: 'PLAY', card: 1 }, 'p0')).toThrow(/choose a player/);
  expect(() => applyUno(s, { type: 'PLAY', card: 1, swapWith: 'p0' }, 'p0')).toThrow(/choose a player/);
  s = applyUno(s, { type: 'PLAY', card: 1, swapWith: 'p1' }, 'p0');
  expect(s.players[0].hand.map((c) => c.id)).toEqual([6]);
  expect(s.players[1].hand.map((c) => c.id)).toEqual([2, 3]);
  expect(s.last).toMatchObject({ kind: 'swap', player: 'p0', target: 'p1' });
  expect(s.turn).toBe(1);
});

test('a 0 passes every hand to the next player in the direction of play', () => {
  let s = rigged([[num(1, 0), num(2, 1)], [num(6, 3), num(7, 3)], [num(8, 4), num(9, 4), num(10, 4)]]);
  s = applyUno(s, { type: 'PLAY', card: 1 }, 'p0');
  expect(s.players.map((p) => p.hand.map((c) => c.id))).toEqual([[8, 9, 10], [2], [6, 7]]);
  expect(s.players.map((p) => p.handCount)).toEqual([3, 1, 2]);
  expect(s.last).toMatchObject({ kind: 'rotate' });
});

test('going out on a 7 or a 0 wins without any hand changing owner', () => {
  let s = rigged([[num(1, 7)], [num(6, 3), num(7, 3)], [num(8, 4)]]);
  s = applyUno(s, { type: 'PLAY', card: 1 }, 'p0');
  expect([s.over, s.winner]).toEqual([true, 'p0']);
  expect(s.players[1].hand).toHaveLength(2);
});

test('25 cards knocks you out of the hand: your cards go back and their points wait for the winner', () => {
  const big = filler(100, 23); // 23 cards, about to take a stack of 4
  let s = rigged([[draw(1, 4), num(2, 1), num(3, 2)], big, [num(8, 4), num(9, 6)]]);
  const deckBefore = s.deck.length;
  s = applyUno(s, { type: 'PLAY', card: 1 }, 'p0');
  s = applyUno(s, { type: 'DRAW' }, 'p1'); // takes 4: 27 cards
  expect(s.players[1].bust).toBe(true);
  expect(s.players[1].hand).toHaveLength(0);
  expect(s.deck.length).toBe(deckBefore - 4 + 27);
  expect(s.pot).toBeGreaterThan(0);
  expect(s.history.some((e) => e.kind === 'bust' && e.player === 'p1')).toBe(true);
  expect([s.over, s.turn]).toEqual([false, 2]); // play goes on without them
  // p2 plays, then it is p0 again: p1 is passed over.
  s = applyUno(s, { type: 'PLAY', card: 8 }, 'p2');
  expect(s.turn).toBe(0);
});

test('the last player standing wins the hand and takes the pot', () => {
  let s = rigged([[draw(1, 4), num(2, 1)], filler(100, 23)]);
  s = applyUno(s, { type: 'PLAY', card: 1 }, 'p0');
  s = applyUno(s, { type: 'DRAW' }, 'p1');
  expect([s.over, s.winner]).toEqual([true, 'p0']);
  expect(s.score.p0).toBe(s.pot);
  expect(s.score.p0).toBeGreaterThan(0);
  // The next hand starts clean for everyone.
  const again = applyUno(s, { type: 'REMATCH' }, 'p0');
  expect(again.players.every((p) => !p.bust && p.hand.length === 7)).toBe(true);
  expect(again.pot).toBe(0);
});

test('the new cards have a price when left in a hand', () => {
  expect(points({ kind: 'discard-all', color: 'red' })).toBe(20);
  expect(points({ kind: 'draw', color: 'red', value: 4 })).toBe(20);
  expect(points({ kind: 'wild-reverse-draw', color: null, value: 4 })).toBe(50);
  expect(points({ kind: 'wild-draw', color: null, value: 10 })).toBe(50);
});

test('a player who runs out of time plays the card they drew', () => {
  let s = rigged([[num(1, 9, 'blue')], [num(4, 3)], [num(8, 4)]]);
  s = { ...s, deck: [num(52, 7, 'red'), ...s.deck] };
  s = applyUno(s, { type: 'DRAW' }, 'p0');
  const forced = unoKit.timeout(s);
  expect(forced).toMatchObject({ type: 'PLAY', card: 52 });
  expect(() => applyUno(s, forced, 'p0')).not.toThrow();
});

test('bots play whole hands of No Mercy, legally, for every table size', () => {
  for (const n of [2, 3, 5, 8]) {
    for (const seed of [1, 7, 23]) {
      let s = createUno(seats(n, true), seed, { variant: 'no-mercy' });
      let r = seed * 7919;
      const rand = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
      let moves = 0;
      for (; moves < 3000 && !s.over; moves++) s = applyUno(s, unoBotAction(s, rand), s.players[s.turn].id);
      expect(s.over).toBe(true);
      expect(s.winner).not.toBeNull();
      // No card is ever lost or made: 152 in the deck, the pile and the hands.
      expect(s.deck.length + s.discard.length + s.players.reduce((k, p) => k + p.hand.length, 0)).toBe(152);
      expect(s.players.every((p) => p.hand.length < MERCY)).toBe(true);
    }
  }
});

test('the other modes are untouched: no stacking by default, one card drawn, passing allowed', () => {
  let s = createUno(seats(3), 4, { variant: 'classic' });
  expect([s.stack, s.pot]).toEqual([false, 0]);
  s = { ...s, turn: 0, color: 'red', discard: [num(900, 5)], drawn: null, players: s.players.map((p, i) => (i === 0 ? { ...p, hand: [num(1, 9, 'blue')], handCount: 1 } : p)), deck: [num(50, 7, 'green'), num(52, 2, 'red'), ...s.deck] };
  s = applyUno(s, { type: 'DRAW' }, 'p0');
  expect(s.players[0].hand).toHaveLength(2);
  expect(s.turn).toBe(1);
});
