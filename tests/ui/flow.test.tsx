// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { LocalGame } from '../../src/games/ticket-to-ride/ui/LocalGame';
import { useGame } from '../../src/games/ticket-to-ride/ui/store';

afterEach(cleanup);
beforeEach(() => {
  useGame.getState().reset();
  vi.useRealTimers();
});

describe('game flow', () => {
  it('sets up a 1-human + 1-AI game and the AI takes its turn', async () => {
    vi.useFakeTimers();
    // Start a deterministic game directly through the store.
    act(() => {
      useGame.getState().startGame(
        [
          { name: 'You', isAI: false },
          { name: 'Bot', isAI: true, difficulty: 'normal' },
        ],
        7,
      );
    });

    render(<LocalGame />);

    // Human is choosing setup tickets.
    expect(screen.getByTestId('ticket-select')).toBeTruthy();

    // Keep the pre-selected tickets (all 3 start selected; min 2).
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Keep \d ticket/ }));
    });

    // Now the AI must confirm its setup tickets, then play begins.
    // Advance timers to let the AI runner fire.
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const state = useGame.getState().state!;
    // AI has confirmed setup -> game is in the play phase.
    expect(state.phase).toBe('turn');
    // The board is visible.
    expect(document.querySelector('.board')).toBeTruthy();
    vi.useRealTimers();
  });

  it('shows the setup screen initially with no game', () => {
    render(<LocalGame />);
    expect(screen.getByText('Ticket to Ride')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Start game/ })).toBeTruthy();
  });
});
