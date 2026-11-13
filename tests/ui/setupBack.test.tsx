// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TicketToRideSetup } from '../../src/games/ticket-to-ride/ui/TicketToRideSetup';

afterEach(cleanup);

// The local setup screen shows its nav links only when the matching callback is
// provided — i.e. when it was reached from the hub/landing, not in a bare game.
test('no nav links when neither callback is provided', () => {
  render(<TicketToRideSetup onStart={vi.fn()} />);
  expect(screen.queryByRole('button', { name: /play with anyone/i })).toBeNull();
  expect(screen.queryByRole('button', { name: /back to games/i })).toBeNull();
});

test('the "play with anyone" link calls onPlayOnline', () => {
  const onPlayOnline = vi.fn();
  render(<TicketToRideSetup onStart={vi.fn()} onPlayOnline={onPlayOnline} />);
  fireEvent.click(screen.getByRole('button', { name: /play with anyone/i }));
  expect(onPlayOnline).toHaveBeenCalled();
});

test('the "Back to games" link calls onBackToHub', () => {
  const onBackToHub = vi.fn();
  render(<TicketToRideSetup onStart={vi.fn()} onBackToHub={onBackToHub} />);
  fireEvent.click(screen.getByRole('button', { name: /back to games/i }));
  expect(onBackToHub).toHaveBeenCalled();
});
