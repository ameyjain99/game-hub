// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { KitLocal } from '../../../src/games/kit/ui/KitLocal';
import { checkersKit, createCheckers } from '../../../src/games/checkers/engine';
import { CheckersGame } from '../../../src/games/checkers/ui/CheckersGame';

afterEach(cleanup);

test('pick a man, move it, and the bot replies', async () => {
  const seats = [
    { name: 'You', isAI: false },
    { name: 'Bot', isAI: true, difficulty: 'easy' },
  ];
  render(<KitLocal kit={checkersKit} init={() => createCheckers(seats, 2)} onExit={() => {}} render={(p) => <CheckersGame {...p} />} />);
  expect(screen.getByText(/your move/i)).toBeTruthy();
  fireEvent.click(screen.getByRole('gridcell', { name: 'Square 11, Black man' }));
  fireEvent.click(screen.getByRole('gridcell', { name: 'Square 15, empty' }));
  expect(screen.getByRole('gridcell', { name: 'Square 15, Black man' })).toBeTruthy();
  expect(screen.getByText('11-15')).toBeTruthy();
  await waitFor(() => expect(screen.getByText(/your move|you must capture/i)).toBeTruthy(), { timeout: 3000 });
});
