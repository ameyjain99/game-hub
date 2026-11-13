// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { JoinRoomGate } from '../../src/games/ticket-to-ride/ui/JoinRoomGate';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('shows the name step once the room is confirmed to exist', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ exists: true }) })));
  render(<JoinRoomGate code="AB23" onBack={vi.fn()} onSubmit={vi.fn()} />);
  expect(await screen.findByRole('heading', { name: /who are you/i })).toBeTruthy();
});

test('shows a "no such room" message when the room is missing, not the name step', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ exists: false }) })));
  render(<JoinRoomGate code="ZZZZ" onBack={vi.fn()} onSubmit={vi.fn()} />);
  expect(await screen.findByRole('alertdialog', { name: /could not join/i })).toBeTruthy();
  expect(screen.getByText(/no room with the code/i)).toBeTruthy();
  expect(screen.queryByRole('heading', { name: /who are you/i })).toBeNull();
});
