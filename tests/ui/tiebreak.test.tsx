// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { GameScreen } from '../../src/games/ticket-to-ride/ui/GameScreen';
import { createGame } from '../../src/games/ticket-to-ride/engine/setup';
import type { GameState, Ticket } from '../../src/games/ticket-to-ride/engine/types';
import { ticket } from '../ai/helpers';

afterEach(cleanup);

/** A finished USA game between Alice (p0) and Bob (p1) with the given routes and tickets. */
function finished(alice: { routes: string[]; tickets: Ticket[] }, bob: { routes: string[]; tickets: Ticket[] }): GameState {
  const base = createGame(
    [
      { name: 'Alice', isAI: false },
      { name: 'Bob', isAI: false },
    ],
    7,
  );
  const [p0, p1] = base.players;
  const claimedBy = Object.fromEntries([
    ...alice.routes.map((r) => [r, 'p0']),
    ...bob.routes.map((r) => [r, 'p1']),
  ]);
  return {
    ...base,
    phase: 'game-over',
    claimedBy,
    players: [
      { ...p0, pendingTickets: [], claimedRouteIds: alice.routes, tickets: alice.tickets },
      { ...p1, pendingTickets: [], claimedRouteIds: bob.routes, tickets: bob.tickets },
    ],
  };
}

const show = (s: GameState) =>
  render(<GameScreen state={s} lastError={null} dispatch={vi.fn()} onPlayAgain={vi.fn()} />);
const crowns = () => screen.getByTestId('final-scores').querySelectorAll('.winner-crown').length;

test('tied on points, the player with more completed tickets wins', () => {
  // Both: one 2-space route (12 with the shared Longest Path). Bob completes 1 of 2 tickets (+4 -4).
  show(
    finished(
      { routes: ['montreal-boston'], tickets: [] },
      { routes: ['boston-new-york'], tickets: [ticket('boston', 'new-york', 4), ticket('seattle', 'miami', 4)] },
    ),
  );
  expect(screen.getByText('Game over – Bob wins!')).toBeTruthy();
  expect(crowns()).toBe(1);
});

test('still tied, the holder of the Longest Path card wins', () => {
  // Alice: 2 + 13 = 15. Bob: 4 + 10 (longest path) + 1 = 15. One completed ticket each.
  show(
    finished(
      { routes: ['montreal-boston'], tickets: [ticket('montreal', 'boston', 13)] },
      { routes: ['boston-new-york', 'new-york-washington'], tickets: [ticket('boston', 'washington', 1)] },
    ),
  );
  expect(screen.getByText('Game over – Bob wins!')).toBeTruthy();
  expect(crowns()).toBe(1);
});

test('tied on points, tickets and the Longest Path card, the victory is shared', () => {
  show(finished({ routes: ['montreal-boston'], tickets: [] }, { routes: ['boston-new-york'], tickets: [] }));
  expect(screen.getByText('Game over – Alice & Bob tie!')).toBeTruthy();
  expect(crowns()).toBe(2);
});
