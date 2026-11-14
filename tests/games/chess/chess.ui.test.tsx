// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { KitLocal } from '../../../src/games/kit/ui/KitLocal';
import { chessKit, createChess, type ChessAction } from '../../../src/games/chess/engine';
import { ChessGame } from '../../../src/games/chess/ui/ChessGame';

afterEach(cleanup);

const seats = [
  { name: 'You', isAI: false },
  { name: 'Stockfish', isAI: true, difficulty: 'max' },
];

test('a move by click, then the engine replies', async () => {
  const reply = async (): Promise<ChessAction> => ({ type: 'MOVE', from: 'e7', to: 'e5' });
  render(<KitLocal kit={chessKit} init={() => createChess(seats, 1)} asyncBot={reply} onExit={() => {}} render={(p) => <ChessGame {...p} />} />);
  fireEvent.click(screen.getByRole('gridcell', { name: 'e2, white pawn' }));
  fireEvent.click(screen.getByRole('gridcell', { name: 'e4, empty' }));
  expect(screen.getByRole('gridcell', { name: 'e4, white pawn' })).toBeTruthy();
  expect(document.querySelector('.kit-status')?.textContent).toMatch(/stockfish is thinking/i);
  await waitFor(() => expect(screen.getByRole('gridcell', { name: 'e5, black pawn' })).toBeTruthy());
  expect(screen.getByText(/your move/i)).toBeTruthy();
});

test('playing Black flips the board and lets the engine open', async () => {
  const reply = async (): Promise<ChessAction> => ({ type: 'MOVE', from: 'd2', to: 'd4' });
  render(<KitLocal kit={chessKit} init={() => createChess(seats, 1, { whiteSeat: 1 })} asyncBot={reply} onExit={() => {}} render={(p) => <ChessGame {...p} />} />);
  // Flipped: the first square on screen is h1.
  expect(screen.getAllByRole('gridcell')[0].getAttribute('aria-label')).toMatch(/^h1/);
  await waitFor(() => expect(screen.getByRole('gridcell', { name: 'd4, white pawn' })).toBeTruthy());
});

test('a pawn reaching the last rank asks what to promote to', () => {
  // White pawn on b7 can take a8 or advance... set up with a short game.
  let s = createChess([{ name: 'You', isAI: false }, { name: 'Friend', isAI: false }], 1);
  for (const [from, to] of [['a2', 'a4'], ['b7', 'b5'], ['a4', 'b5'], ['a7', 'a6'], ['b5', 'a6'], ['c8', 'b7']]) {
    s = chessKit.apply(s, { type: 'MOVE', from, to }, chessKit.actor(s)!);
  }
  s = chessKit.apply(s, { type: 'MOVE', from: 'a6', to: 'b7' }, 'p0');
  s = chessKit.apply(s, { type: 'MOVE', from: 'b8', to: 'c6' }, 'p1');
  render(<KitLocal kit={chessKit} init={() => s} onExit={() => {}} render={(p) => <ChessGame {...p} />} />);
  fireEvent.click(screen.getByRole('gridcell', { name: 'b7, white pawn' }));
  fireEvent.click(screen.getByRole('gridcell', { name: 'a8, black rook' }));
  fireEvent.click(screen.getByRole('button', { name: 'knight' }));
  expect(screen.getByRole('gridcell', { name: 'a8, white knight' })).toBeTruthy();
  expect(screen.getByText('bxa8=N')).toBeTruthy();
});
