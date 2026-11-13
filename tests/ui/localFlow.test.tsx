// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../src/app/App';

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.pushState({}, '', '/');
});

function openLocalSetup() {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /play ticket to ride/i }));
  fireEvent.click(screen.getByRole('button', { name: /play on this device/i }));
}

test('local setup shows a Back to games link that returns to the hub', () => {
  openLocalSetup();
  fireEvent.click(screen.getByRole('button', { name: /back to games/i }));
  expect(screen.getByRole('heading', { name: /your game night/i })).toBeTruthy();
});

test('local setup "play with anyone" opens the online start/join page, not the hub', () => {
  openLocalSetup();
  fireEvent.click(screen.getByRole('button', { name: /play with anyone/i }));
  expect(screen.getByRole('heading', { name: /join a game/i })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: /your game night/i })).toBeNull();
});

test('the Back to games link uses the left-aligned back-link style', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /play ticket to ride/i }));
  const back = screen.getByRole('button', { name: /back to games/i });
  expect(back.className).toContain('back-link');
});
