// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HubScreen } from '../../src/app/HubScreen';

afterEach(cleanup);

test('selecting the live Ticket to Ride game calls onSelect with its id', () => {
  const onSelect = vi.fn();
  render(<HubScreen onSelect={onSelect} />);
  fireEvent.click(screen.getByRole('button', { name: /play ticket to ride/i }));
  expect(onSelect).toHaveBeenCalledWith('ticket-to-ride');
});

test('a "soon" game shows a disabled Coming soon button and never fires onSelect', () => {
  const onSelect = vi.fn();
  render(<HubScreen onSelect={onSelect} />);
  // Catan is marked "soon" in the registry, so it has no Play button.
  expect(screen.queryByRole('button', { name: /play catan/i })).toBeNull();
  const soon = screen.getAllByRole('button', { name: /coming soon/i });
  expect(soon.length).toBeGreaterThan(0);
  soon.forEach((btn) => expect((btn as HTMLButtonElement).disabled).toBe(true));
  fireEvent.click(soon[0]);
  expect(onSelect).not.toHaveBeenCalled();
});

test('Monopoly and Cluedo are live and playable from the hub', () => {
  const onSelect = vi.fn();
  render(<HubScreen onSelect={onSelect} />);
  fireEvent.click(screen.getByRole('button', { name: /play monopoly/i }));
  fireEvent.click(screen.getByRole('button', { name: /play cluedo/i }));
  expect(onSelect.mock.calls).toEqual([['monopoly'], ['cluedo']]);
});
