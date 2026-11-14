// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { KitLocal } from '../../../src/games/kit/ui/KitLocal';
import { createTtt, ticTacToeKit } from '../../../src/games/tic-tac-toe/engine';
import { TttGame } from '../../../src/games/tic-tac-toe/ui/TttGame';

afterEach(cleanup);

function renderLocal() {
  const seats = [
    { name: 'You', isAI: false },
    { name: 'Bot', isAI: true, difficulty: 'hard' },
  ];
  return render(<KitLocal kit={ticTacToeKit} init={() => createTtt(seats, 3)} onExit={() => {}} render={(p) => <TttGame {...p} />} />);
}

test('you open as X, and the bot answers on its own', async () => {
  renderLocal();
  expect(screen.getByText(/your move/i)).toBeTruthy();
  fireEvent.click(screen.getByRole('gridcell', { name: 'Row 1, column 1, empty' }));
  expect(screen.getByRole('gridcell', { name: 'Row 1, column 1, X' })).toBeTruthy();
  expect(screen.getByText(/is thinking/i)).toBeTruthy();
  // The perfect bot answers a corner with the centre.
  await waitFor(() => expect(screen.getByRole('gridcell', { name: 'Row 2, column 2, O' })).toBeTruthy(), { timeout: 3000 });
  expect(screen.getByText(/your move/i)).toBeTruthy();
});

test('the board is locked while the bot is to move', () => {
  renderLocal();
  fireEvent.click(screen.getByRole('gridcell', { name: 'Row 1, column 1, empty' }));
  const cell = screen.getByRole('gridcell', { name: 'Row 3, column 3, empty' }) as HTMLButtonElement;
  expect(cell.disabled).toBe(true);
});
