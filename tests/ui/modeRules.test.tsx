// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { GameScreen } from '../../src/games/ticket-to-ride/ui/GameScreen';
import { createGame } from '../../src/games/ticket-to-ride/engine/setup';
import { rulebookUrl } from '../../src/games/ticket-to-ride/engine/maps/rulebook';
import type { GameState } from '../../src/games/ticket-to-ride/engine/types';
import { ticket } from '../ai/helpers';

afterEach(cleanup);

const twoHumans = [
  { name: 'Alice', isAI: false },
  { name: 'Bob', isAI: false },
];

test('the Mega Game asks to keep at least 3 of the 5 starting tickets', () => {
  render(<GameScreen state={createGame(twoHumans, 1, 'usa', 'mega')} lastError={null} dispatch={vi.fn()} />);
  expect(screen.getByText(/Keep at least 3\./)).toBeTruthy();
});

test('the Rules link opens the rulebook of the mode being played', () => {
  render(<GameScreen state={createGame(twoHumans, 1, 'usa', '1910')} lastError={null} dispatch={vi.fn()} />);
  expect(screen.getByTitle('Rules').getAttribute('href')).toBe(rulebookUrl('usa_expansion.pdf'));
});

/** Game over: Bob has the longest path and completed the only ticket. */
function bobSweeps(modeId: string): GameState {
  const base = createGame(twoHumans, 7, 'usa', modeId);
  const [p0, p1] = base.players;
  return {
    ...base,
    phase: 'game-over',
    claimedBy: { 'montreal-boston': 'p0', 'boston-new-york': 'p1', 'new-york-washington': 'p1' },
    players: [
      { ...p0, pendingTickets: [], claimedRouteIds: ['montreal-boston'], tickets: [] },
      {
        ...p1,
        pendingTickets: [],
        claimedRouteIds: ['boston-new-york', 'new-york-washington'],
        tickets: [ticket('boston', 'washington', 10)],
      },
    ],
  };
}

test('in 1910 the winner detail shows the Globetrotter bonus and no Longest Path bonus', () => {
  render(<GameScreen state={bobSweeps('1910')} lastError={null} dispatch={vi.fn()} onPlayAgain={vi.fn()} />);
  const detail = screen.getByTestId('final-detail').textContent ?? '';
  expect(detail).toContain('+15 bonus');
  expect(detail).not.toContain('+10 bonus');
});

test('in the Mega Game the winner detail shows both bonuses', () => {
  render(<GameScreen state={bobSweeps('mega')} lastError={null} dispatch={vi.fn()} onPlayAgain={vi.fn()} />);
  const detail = screen.getByTestId('final-detail').textContent ?? '';
  expect(detail).toContain('+15 bonus');
  expect(detail).toContain('+10 bonus');
});
