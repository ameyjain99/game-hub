// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HubScreen } from '../../src/app/HubScreen';

afterEach(cleanup);

test('selecting the live Ticket to Ride game calls onSelect with its id', () => {
  const onSelect = vi.fn();
  render(<HubScreen onSelect={onSelect} onJoin={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /play ticket to ride/i }));
  expect(onSelect).toHaveBeenCalledWith('ticket-to-ride');
});

test('upcoming games are hidden until "Show all"; then they show a disabled Coming soon button', () => {
  const onSelect = vi.fn();
  render(<HubScreen onSelect={onSelect} onJoin={vi.fn()} />);
  expect(screen.queryAllByRole('button', { name: /coming soon/i })).toHaveLength(0);
  fireEvent.click(screen.getByRole('checkbox', { name: /show all/i }));
  // Catan is marked "soon" in the registry, so it has no Play button.
  expect(screen.queryByRole('button', { name: /play catan/i })).toBeNull();
  const soon = screen.getAllByRole('button', { name: /coming soon/i });
  expect(soon.length).toBeGreaterThan(0);
  soon.forEach((btn) => expect((btn as HTMLButtonElement).disabled).toBe(true));
  fireEvent.click(soon[0]);
  expect(onSelect).not.toHaveBeenCalled();
});

test('Monopoly and Tic-Tac-Toe are live and playable from the hub', () => {
  const onSelect = vi.fn();
  render(<HubScreen onSelect={onSelect} onJoin={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /play monopoly/i }));
  fireEvent.click(screen.getByRole('button', { name: /play tic-tac-toe/i }));
  expect(onSelect.mock.calls).toEqual([['monopoly'], ['tic-tac-toe']]);
});

test('Cluedo is switched off on the hub for now', () => {
  render(<HubScreen onSelect={vi.fn()} onJoin={vi.fn()} />);
  expect(screen.queryByRole('button', { name: /play cluedo/i })).toBeNull();
});
