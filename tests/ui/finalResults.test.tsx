// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { GameScreen } from '../../src/games/ticket-to-ride/ui/GameScreen';
import { LocalGame } from '../../src/games/ticket-to-ride/ui/LocalGame';
import { useGame } from '../../src/games/ticket-to-ride/ui/store';
import { createGame } from '../../src/games/ticket-to-ride/engine/setup';
import { playerColor } from '../../src/games/ticket-to-ride/ui/colors';
import type { GameState, Ticket } from '../../src/games/ticket-to-ride/engine/types';

afterEach(cleanup);
beforeEach(() => useGame.getState().reset());

const ticket = (a: string, b: string, points: number): Ticket => ({ id: `${a}__${b}`, a, b, points });

/**
 * A finished 2-player game. Bot (p1) wins: Boston-NY + NY-Washington (4 route pts),
 * Boston->Washington completed (+10), Seattle->Miami failed (-22), longest path +10.
 * You (p0): Montreal-Boston (2 pts), Montreal->New York failed (-6).
 */
function finishedGame(): GameState {
  const base = createGame(
    [
      { name: 'You', isAI: false },
      { name: 'Bot', isAI: true },
    ],
    7,
  );
  const [p0, p1] = base.players;
  return {
    ...base,
    phase: 'game-over',
    claimedBy: { 'montreal-boston': 'p0', 'boston-new-york': 'p1', 'new-york-washington': 'p1' },
    players: [
      {
        ...p0,
        pendingTickets: [],
        claimedRouteIds: ['montreal-boston'],
        tickets: [ticket('montreal', 'new-york', 6)],
      },
      {
        ...p1,
        pendingTickets: [],
        claimedRouteIds: ['boston-new-york', 'new-york-washington'],
        tickets: [ticket('boston', 'washington', 10), ticket('seattle', 'miami', 22)],
      },
    ],
  };
}

// Scoped to the scores strip: the players column also tags panels with data-player-id.
const row = (id: string) =>
  screen.getByTestId('final-scores').querySelector(`[data-player-id="${id}"]`) as HTMLElement;

describe('final results (game over)', () => {
  it('shows ranked results in the side pane with the winner selected', () => {
    render(<GameScreen state={finishedGame()} lastError={null} dispatch={vi.fn()} onPlayAgain={vi.fn()} />);
    expect(screen.getByTestId('final-scores')).toBeTruthy();
    expect(row('p1').getAttribute('aria-pressed')).toBe('true');
    expect(row('p0').getAttribute('aria-pressed')).toBe('false');
    // The result line now sits in the top bar beside the score chips.
    expect(screen.getByTestId('final-scores').textContent).toMatch(/Game over.*Bot wins/);
  });

  it("lists the selected player's tickets as completed / failed", () => {
    render(<GameScreen state={finishedGame()} lastError={null} dispatch={vi.fn()} onPlayAgain={vi.fn()} />);
    const pane = screen.getByTestId('final-detail');
    expect(pane.querySelector('[data-ticket-id="boston__washington"]')!.classList.contains('done')).toBe(true);
    expect(pane.querySelector('[data-ticket-id="seattle__miami"]')!.classList.contains('missing')).toBe(true);
  });

  it('selecting another player switches the tickets and board highlights', () => {
    const { container } = render(
      <GameScreen state={finishedGame()} lastError={null} dispatch={vi.fn()} onPlayAgain={vi.fn()} />,
    );
    // Winner selected: their longest path (2 routes) is outlined, the other player's trains are dimmed.
    expect(container.querySelectorAll('.longest-path').length).toBe(2);
    const youTrain = () => container.querySelector('[data-route-id="montreal-boston"] rect')!.getAttribute('fill');
    expect(youTrain()).not.toBe(playerColor(0));
    expect(container.querySelector('.ticket-ring.done[data-city-id="washington"]')).toBeTruthy();
    expect(container.querySelector('.ticket-ring.missing[data-city-id="miami"]')).toBeTruthy();

    fireEvent.click(row('p0'));
    expect(row('p0').getAttribute('aria-pressed')).toBe('true');
    const pane = screen.getByTestId('final-detail');
    expect(pane.querySelector('[data-ticket-id="montreal__new-york"]')!.classList.contains('missing')).toBe(true);
    expect(pane.querySelector('[data-ticket-id="seattle__miami"]')).toBeNull();
    expect(youTrain()).toBe(playerColor(0));
    expect(container.querySelectorAll('.longest-path').length).toBe(1);
  });

  it('routes are not claimable once the game is over', () => {
    const { container } = render(
      <GameScreen state={finishedGame()} lastError={null} dispatch={vi.fn()} onPlayAgain={vi.fn()} />,
    );
    expect(container.querySelectorAll('.route.claimable').length).toBe(0);
  });

  it('App keeps the board on screen at game over and Play again returns to setup', () => {
    act(() => useGame.setState({ state: finishedGame() }));
    render(<LocalGame />);
    expect(document.querySelector('.board')).toBeTruthy();
    expect(screen.getByTestId('final-scores')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Play again/ }));
    expect(useGame.getState().state).toBeNull();
    expect(screen.getByRole('button', { name: /Start game/ })).toBeTruthy();
  });
});
