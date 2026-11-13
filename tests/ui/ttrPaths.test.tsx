// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../src/app/App';

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.pushState({}, '', '/');
});

function openTtR() {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /play ticket to ride/i }));
}

test('"play on this device" routes to /ticket-to-ride/setup', () => {
  openTtR();
  expect(window.location.pathname).toBe('/ticket-to-ride');
  fireEvent.click(screen.getByRole('button', { name: /play on this device/i }));
  expect(window.location.pathname).toBe('/ticket-to-ride/setup');
});

test('starting a local game routes to /ticket-to-ride/play', () => {
  openTtR();
  fireEvent.click(screen.getByRole('button', { name: /play on this device/i }));
  fireEvent.click(screen.getByRole('button', { name: /^start game$/i }));
  expect(window.location.pathname).toBe('/ticket-to-ride/play');
});

test('hosting an online game routes to /ticket-to-ride/create', () => {
  openTtR();
  fireEvent.click(screen.getByRole('button', { name: /^start game$/i }));
  expect(window.location.pathname).toBe('/ticket-to-ride/create');
  expect(screen.getByRole('heading', { name: /who are you/i })).toBeTruthy();
  // The board is chosen here on the create page, not on the landing.
  expect(screen.getByRole('combobox', { name: /board/i })).toBeTruthy();
});

test('opening /ticket-to-ride/create directly shows the create page', () => {
  window.history.pushState({}, '', '/ticket-to-ride/create');
  render(<App />);
  expect(screen.getByRole('heading', { name: /who are you/i })).toBeTruthy();
  expect(window.location.pathname).toBe('/ticket-to-ride/create');
});

test('opening /ticket-to-ride/join with no room bounces to the landing', () => {
  window.history.pushState({}, '', '/ticket-to-ride/join');
  render(<App />);
  expect(window.location.pathname).toBe('/ticket-to-ride');
  expect(screen.queryByRole('heading', { name: /who are you/i })).toBeNull();
  expect(screen.getByRole('button', { name: /start game/i })).toBeTruthy();
});

test('a /join?room=ABCD link opens the join flow once the room is confirmed', async () => {
  window.history.pushState({}, '', '/ticket-to-ride/join?room=ABCD');
  render(<App />);
  // The gate checks the room exists first (fetch unavailable here → fails open).
  expect(await screen.findByRole('heading', { name: /who are you/i })).toBeTruthy();
  expect(screen.getByRole('button', { name: /join game/i })).toBeTruthy();
  expect(window.location.pathname).toBe('/ticket-to-ride/join');
});

test('a /<code> link this browser does not belong to bounces to the landing', () => {
  window.history.pushState({}, '', '/ticket-to-ride/ABCD');
  render(<App />);
  // No stored session for ABCD → not a member → redirected to the parent page.
  expect(window.location.pathname).toBe('/ticket-to-ride');
  expect(screen.queryByRole('heading', { name: /who are you/i })).toBeNull();
  expect(screen.getByRole('button', { name: /start game/i })).toBeTruthy();
});
