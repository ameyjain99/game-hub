// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GameScreen } from '../../src/games/ticket-to-ride/ui/GameScreen';
import { createGame } from '../../src/games/ticket-to-ride/engine/setup';
import type { GameState } from '../../src/games/ticket-to-ride/engine/types';

afterEach(cleanup);

/** A finished Europe game: You hold stations in Paris (useful) and Madrid (not). */
function finished(): GameState {
  const base = createGame(
    [
      { name: 'You', isAI: false },
      { name: 'Bot', isAI: true },
    ],
    3,
    'europe',
  );
  const [p0, p1] = base.players;
  return {
    ...base,
    phase: 'game-over',
    claimedBy: { 'paris-zurich': 'p1' },
    players: [
      {
        ...p0,
        pendingTickets: [],
        stations: ['paris', 'madrid'],
        stationsLeft: 1,
        tickets: [{ id: 'paris__zurich', a: 'paris', b: 'zurich', points: 5 }],
      },
      { ...p1, pendingTickets: [], tickets: [], claimedRouteIds: ['paris-zurich'] },
    ],
  };
}

test('the results show which route each station borrowed, and which were not needed', () => {
  render(<GameScreen state={finished()} lastError={null} dispatch={vi.fn()} onPlayAgain={vi.fn()} />);
  fireEvent.click(screen.getByTestId('final-scores').querySelector('[data-player-id="p0"]')!);
  const stations = screen.getByRole('list', { name: /stations/i });
  const items = [...stations.querySelectorAll('li')].map((li) => li.textContent);
  expect(items).toHaveLength(2);
  expect(items[0]).toContain('Paris');
  expect(items[0]).toContain('Paris → Zurich');
  expect(items[0]).toContain('Bot');
  expect(items[1]).toContain('Madrid');
  expect(items[1]).toMatch(/not needed/i);
});
