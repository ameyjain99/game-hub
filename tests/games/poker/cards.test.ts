import { describe, expect, test } from 'vitest';
import { deckFor, describeHand, evalHigh, evalLow, evalOmaha } from '../../../src/games/poker/cards';

const h = (s: string) => s.split(' ');
const high = (s: string, shortDeck = false) => evalHigh(h(s), shortDeck);

describe('decks', () => {
  test('a full deck has 52 different cards; Short Deck drops the 2s to 5s for 36', () => {
    expect(new Set(deckFor('holdem')).size).toBe(52);
    const short = deckFor('shortdeck');
    expect(short).toHaveLength(36);
    expect(short.some((c) => '2345'.includes(c[0]))).toBe(false);
  });
});

describe('high hands', () => {
  test('the categories rank from straight flush down to high card', () => {
    const order = [
      '9H TH JH QH KH 2C 3D', // straight flush
      '7S 7H 7D 7C KS 2C 3D', // four of a kind
      '7S 7H 7D KC KS 2C 3D', // full house
      '2H 6H 9H JH KH 3C 4D', // flush
      '5S 6H 7D 8C 9S 2C 2D', // straight
      '7S 7H 7D KC QS 2C 3D', // three of a kind
      '7S 7H KD KC QS 2C 3D', // two pair
      '7S 7H KD JC QS 2C 3D', // pair
      '7S 9H KD JC QS 2C 3D', // high card
    ].map((s) => high(s).score);
    for (let i = 1; i < order.length; i++) expect(order[i - 1]).toBeGreaterThan(order[i]);
  });

  test('the best five of seven are picked, and named', () => {
    const v = high('AH KH 9H 6H 2H 3H QS');
    expect(v.category).toBe('flush');
    expect(new Set(v.cards)).toEqual(new Set(['AH', 'KH', '9H', '6H', '3H']));
    expect(describeHand(v)).toBe('Flush, ace high');
  });

  test('the wheel (A-2-3-4-5) is the lowest straight', () => {
    const wheel = high('AS 2H 3D 4C 5S KD KH');
    expect(wheel.category).toBe('straight');
    expect(describeHand(wheel)).toBe('Straight, five high');
    expect(high('2S 3H 4D 5C 6S KD KH').score).toBeGreaterThan(wheel.score);
  });

  test('kickers decide equal pairs, and identical hands tie', () => {
    expect(high('AS AH KD 9C 7S 3D 2C').score).toBeGreaterThan(high('AD AC QD 9H 7H 3S 2D').score);
    expect(high('AS AH KD 9C 7S 3D 2C').score).toBe(high('AD AC KS 9H 7H 4S 2D').score);
  });

  test('a royal flush and two pair read naturally', () => {
    expect(describeHand(high('TS JS QS KS AS 2C 3D'))).toBe('Royal flush');
    expect(describeHand(high('KS KH 7D 7C 2S 3D 9C'))).toBe('Two pair, kings and sevens');
    expect(describeHand(high('7S 7H 7D KC KS 2C 3D'))).toBe('Full house, sevens full of kings');
  });
});

describe('Short Deck', () => {
  test('a flush beats a full house, and three of a kind beats a straight', () => {
    expect(high('6H 8H 9H JH KH 7C TD', true).score).toBeGreaterThan(high('7S 7H 7D KC KS 8C 9D', true).score);
    expect(high('7S 7H 7D KC QS 6C 9D', true).score).toBeGreaterThan(high('6S 7H 8D 9C TS QC QD', true).score);
  });

  test('A-6-7-8-9 is the lowest straight', () => {
    const v = high('AS 6H 7D 8C 9S KD KH', true);
    expect(v.category).toBe('straight');
    expect(describeHand(v)).toBe('Straight, nine high');
    expect(high('6S 7H 8D 9C TS KD KH', true).score).toBeGreaterThan(v.score);
  });
});

describe('Omaha', () => {
  test('a hand uses exactly two hole cards and three from the board', () => {
    // Four hearts on the board and one in the hand: no flush.
    const noFlush = evalOmaha(h('AH KS QD JC'), h('2H 5H 8H 9H 3C'));
    expect(noFlush.category).not.toBe('flush');
    // Two hearts in the hand make it.
    expect(evalOmaha(h('AH KH QD JC'), h('2H 5H 8H 9S 3C')).category).toBe('flush');
    // A board straight doesn't play by itself.
    expect(evalOmaha(h('2S 2D KC KD'), h('5H 6C 7D 8S 9H')).category).not.toBe('straight');
  });

  test('the best five keep two hole cards', () => {
    const v = evalOmaha(h('AS AD 2C 3C'), h('AH KS 7D 7C 2H'));
    expect(v.category).toBe('full-house');
    expect(v.cards.filter((c) => ['AS', 'AD', '2C', '3C'].includes(c))).toHaveLength(2);
  });
});

describe('Razz (ace-to-five low)', () => {
  test('A-2-3-4-5 is the best low: straights and flushes do not count', () => {
    const wheel = evalLow(h('AH 2H 3H 4H 5H KS QS'));
    expect(describeHand(wheel)).toBe('5-4-3-2-A');
    expect(wheel.score).toBeGreaterThan(evalLow(h('AH 2C 3D 4S 6H KS QS')).score);
  });

  test('lower top cards win; a pair loses to any five different cards', () => {
    expect(evalLow(h('8S 7H 4D 2C AS KS QS')).score).toBeGreaterThan(evalLow(h('9S 4H 3D 2C AS KS QS')).score);
    expect(evalLow(h('KS QH JD TC 9S 9D 9C')).score).toBeGreaterThan(evalLow(h('AS AH 2D 3C 4S 4D 2C')).score);
    // Only four different ranks: the lowest pair plays.
    expect(describeHand(evalLow(h('AS 2H 2D 3C 4S 4D 4C')))).toBe('Pair of twos');
  });

  test('the best five come from the seven', () => {
    const v = evalLow(h('KS 7H 6D 4C 3S 2D 2C'));
    expect(describeHand(v)).toBe('7-6-4-3-2');
    expect(v.cards).toHaveLength(5);
  });
});
