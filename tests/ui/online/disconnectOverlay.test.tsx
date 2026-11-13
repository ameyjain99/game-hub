// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DisconnectOverlay } from '../../../src/games/ticket-to-ride/ui/online/DisconnectOverlay';
import type { LobbyView, SeatView } from '../../../src/net/protocol';

afterEach(cleanup);

const lobby = (seats: Partial<SeatView>[]): LobbyView => ({
  code: 'AB23',
  seatCount: seats.length,
  hostIndex: 0,
  started: true,
  turnDeadline: null,
  seats: seats.map((s, i) => ({ index: i, name: null, avatar: '', isAI: false, connected: true, ...s })),
});

test('shows a replace button when the current player is disconnected', () => {
  const l = lobby([{ name: 'Host' }, { name: 'Bob', connected: false }]);
  const onReplace = vi.fn();
  render(<DisconnectOverlay lobby={l} currentPlayerId="p1" onReplace={onReplace} onRemove={vi.fn()} />);
  expect(screen.getByText(/bob disconnected/i)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /replace with ai/i }));
  expect(onReplace).toHaveBeenCalledWith(1);
});

test('offers removing the dropped player from the game entirely', () => {
  const l = lobby([{ name: 'Host' }, { name: 'Bob', connected: false }]);
  const onRemove = vi.fn();
  render(<DisconnectOverlay lobby={l} currentPlayerId="p1" onReplace={vi.fn()} onRemove={onRemove} />);
  fireEvent.click(screen.getByRole('button', { name: /remove from game/i }));
  expect(onRemove).toHaveBeenCalledWith(1);
});

test('renders nothing when all human players are connected', () => {
  const l = lobby([{ name: 'Host' }, { name: 'Bob' }]);
  const { container } = render(
    <DisconnectOverlay lobby={l} currentPlayerId="p1" onReplace={vi.fn()} onRemove={vi.fn()} />,
  );
  expect(container.firstChild).toBeNull();
});

test('any remaining player can replace a dropped host, even when it is not the host turn', () => {
  // The host (seat 0) has dropped; it's Bob's turn (p1). The banner still surfaces
  // so Bob can swap the host for an AI instead of the game stalling.
  const l = lobby([{ name: 'Host', connected: false }, { name: 'Bob' }]);
  const onReplace = vi.fn();
  render(<DisconnectOverlay lobby={l} currentPlayerId="p1" onReplace={onReplace} onRemove={vi.fn()} />);
  expect(screen.getByText(/host disconnected/i)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /replace with ai/i }));
  expect(onReplace).toHaveBeenCalledWith(0);
});
