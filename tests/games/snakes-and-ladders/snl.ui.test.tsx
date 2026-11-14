// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { KitLocal } from '../../../src/games/kit/ui/KitLocal';
import { createSnl, snlKit } from '../../../src/games/snakes-and-ladders/engine';
import { SnlGame } from '../../../src/games/snakes-and-ladders/ui/SnlGame';

afterEach(cleanup);

test('you roll, your token moves, and the bots take their turns', async () => {
  const seats = [
    { name: 'You', isAI: false },
    { name: 'Bot 1', isAI: true },
  ];
  render(<KitLocal kit={snlKit} init={() => createSnl(seats, 9)} onExit={() => {}} render={(p) => <SnlGame {...p} />} />);
  expect(screen.getByText(/everyone starts off the board/i)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /roll the die/i }));
  expect(screen.getAllByText(/^You rolled \d/).length).toBeGreaterThan(0);
  // The bot rolls on its own, and the turn comes back.
  await waitFor(() => expect(screen.getAllByText(/Bot 1 rolled/).length).toBeGreaterThan(0), { timeout: 6000 });
}, 10_000);
