// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { KitLocal } from '../../../src/games/kit/ui/KitLocal';
import { createPoker, pokerKit, type PokerState } from '../../../src/games/poker/engine';
import { PokerGame } from '../../../src/games/poker/ui/PokerGame';

afterEach(cleanup);

/** You under the gun at a three-handed table: you act first before the flop. */
function yourTurn(variant: 'holdem' | 'stud' = 'holdem'): () => PokerState {
  return () => {
    let s = createPoker([{ name: 'You', isAI: false }, { name: 'Bot 1', isAI: true }, { name: 'Bot 2', isAI: true }], 3, { variant });
    // Put the first decision on you.
    s = { ...s, toAct: 0, bringInDue: variant === 'stud' };
    return s;
  };
}

test('facing the big blind you can fold, call it, or raise by a chosen amount', () => {
  render(<KitLocal kit={pokerKit} init={yourTurn()} onExit={() => {}} render={(p) => <PokerGame {...p} />} />);
  expect(screen.getByRole('button', { name: 'Fold' })).toBeTruthy();
  const call = screen.getByRole('button', { name: /^Call/ });
  expect(screen.getByRole('slider', { name: /bet size/i })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Pot' }));
  expect(screen.getByRole('button', { name: /^Raise to/ })).toBeTruthy();
  fireEvent.click(call);
  expect(screen.getByText(/^You call/)).toBeTruthy();
});

test('in Stud the bring-in is yours to post or complete', () => {
  render(<KitLocal kit={pokerKit} init={yourTurn('stud')} onExit={() => {}} render={(p) => <PokerGame {...p} />} />);
  expect(screen.getByRole('button', { name: /^Bring in 10/ })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /^Complete to 20/ }));
  expect(screen.getByText(/^You complete to 20/)).toBeTruthy();
});
