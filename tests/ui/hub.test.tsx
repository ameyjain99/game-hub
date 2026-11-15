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

test('with every game playable there is no "Show all" switch and no Coming soon card', () => {
  render(<HubScreen onSelect={vi.fn()} onJoin={vi.fn()} />);
  expect(screen.queryByRole('checkbox', { name: /show all/i })).toBeNull();
  expect(screen.queryAllByRole('button', { name: /coming soon/i })).toHaveLength(0);
});

test('Monopoly and Tic-Tac-Toe are live and playable from the hub', () => {
  const onSelect = vi.fn();
  render(<HubScreen onSelect={onSelect} onJoin={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /play monopoly/i }));
  fireEvent.click(screen.getByRole('button', { name: /play tic-tac-toe/i }));
  expect(onSelect.mock.calls).toEqual([['monopoly'], ['tic-tac-toe']]);
});

test('Cluedo and Imposter are live and playable from the hub', () => {
  const onSelect = vi.fn();
  render(<HubScreen onSelect={onSelect} onJoin={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /play cluedo/i }));
  fireEvent.click(screen.getByRole('button', { name: /play imposter/i }));
  expect(onSelect.mock.calls.map((c) => c[0])).toEqual(['cluedo', 'imposter']);
});
