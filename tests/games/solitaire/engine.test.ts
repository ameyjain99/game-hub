import { describe, expect, test } from 'vitest';
import { applySol, autoFinishStep, autoTarget, canAutoFinish, canMove, fitsTableau, hint, newDeal, type SolState } from '../../../src/games/solitaire/engine';

describe('deal', () => {
  test('seven piles of 1–7 cards, top one up; 24 in the stock', () => {
    const s = newDeal(1, 1);
    expect(s.tableau.map((p) => p.cards.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(s.tableau.every((p) => p.up === 1)).toBe(true);
    expect(s.stock).toHaveLength(24);
    const all = [...s.stock, ...s.tableau.flatMap((p) => p.cards)];
    expect(new Set(all).size).toBe(52);
  });
});

describe('rules', () => {
  test('a red Queen goes on a black King, not on a red one; only Kings fill a space', () => {
    expect(fitsTableau('QH', 'KS')).toBe(true);
    expect(fitsTableau('QH', 'KD')).toBe(false);
    expect(fitsTableau('JH', 'KS')).toBe(false);
    expect(fitsTableau('KH', undefined)).toBe(true);
    expect(fitsTableau('QS', undefined)).toBe(false);
  });

  test('drawing one or three, and recycling the waste', () => {
    let s = newDeal(1, 3);
    s = applySol(s, { type: 'DRAW' });
    expect(s.waste).toHaveLength(3);
    expect(s.stock).toHaveLength(21);
    for (let i = 0; i < 7; i++) s = applySol(s, { type: 'DRAW' });
    expect(s.stock).toHaveLength(0);
    s = applySol(s, { type: 'DRAW' });
    expect(s.stock).toHaveLength(24);
    expect(s.waste).toHaveLength(0);
    // Drawing one at a time, a recycle costs 100 points (not below zero).
    let one: SolState = { ...newDeal(1, 1), stock: [], waste: ['AS'], score: 150 };
    one = applySol(one, { type: 'DRAW' });
    expect(one.score).toBe(50);
  });

  test('moving a run uncovers and turns the card beneath (+5), and scores', () => {
    const s: SolState = {
      ...newDeal(1, 1),
      tableau: [
        { cards: ['2C', 'KS', 'QH'], up: 2 },
        { cards: [], up: 0 },
        ...Array.from({ length: 5 }, () => ({ cards: [], up: 0 })),
      ],
      score: 0,
    };
    const from = { pile: 'tableau' as const, index: 0, from: 1 };
    expect(canMove(s, from, { pile: 'tableau', index: 1 })).toBe(true);
    const after = applySol(s, { type: 'MOVE', from, to: { pile: 'tableau', index: 1 } });
    expect(after.tableau[1].cards).toEqual(['KS', 'QH']);
    expect(after.tableau[0]).toEqual({ cards: ['2C'], up: 1 });
    expect(after.score).toBe(5);
  });

  test('foundations build up by suit from the Ace', () => {
    let s: SolState = { ...newDeal(1, 1), waste: ['2S', 'AS'] };
    s = applySol(s, { type: 'MOVE', from: { pile: 'waste' }, to: { pile: 'foundation', index: 0 } });
    expect(s.foundations[0]).toEqual(['AS']);
    expect(s.score).toBe(10);
    s = applySol(s, { type: 'MOVE', from: { pile: 'waste' }, to: { pile: 'foundation', index: 0 } });
    expect(s.foundations[0]).toEqual(['AS', '2S']);
  });

  test('an illegal move changes nothing', () => {
    const s = newDeal(1, 1);
    expect(applySol(s, { type: 'MOVE', from: { pile: 'tableau', index: 6, from: 0 }, to: { pile: 'tableau', index: 0 } })).toBe(s);
  });

  test('a click sends a card home first, else to a tableau pile', () => {
    const s: SolState = { ...newDeal(1, 1), waste: ['AH'] };
    expect(autoTarget(s, { pile: 'waste' })).toEqual({ pile: 'foundation', index: 0 });
  });

  test('with everything face up, the rest finishes itself and wins', () => {
    const suits = ['S', 'H', 'D', 'C'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
    // Each pile holds one suit, King at the bottom down to the Ace on top.
    let s: SolState = {
      ...newDeal(1, 1),
      stock: [],
      waste: [],
      tableau: [
        ...suits.map((x) => ({ cards: [...ranks].reverse().map((r) => r + x), up: 13 })),
        ...Array.from({ length: 3 }, () => ({ cards: [], up: 0 })),
      ],
    };
    expect(canAutoFinish(s)).toBe(true);
    for (let i = 0; i < 60; i++) {
      const step = autoFinishStep(s);
      if (!step) break;
      s = applySol(s, step);
    }
    expect(s.won).toBe(true);
  });

  test('a hint is offered at the start of any deal', () => {
    for (let seed = 1; seed < 20; seed++) expect(hint(newDeal(seed, 1))).not.toBeNull();
  });
});
