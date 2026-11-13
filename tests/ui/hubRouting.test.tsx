// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../src/app/App';

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.pushState({}, '', '/');
});

test('the hub is the home screen and opening Ticket to Ride shows its start/join page', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /your game night/i })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /play ticket to ride/i }));
  expect(screen.getByRole('heading', { name: /ticket to ride/i })).toBeTruthy();
});

test('opening a game navigates to its own path', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /play ticket to ride/i }));
  expect(window.location.pathname).toBe('/ticket-to-ride');
});

test('backing out of a game returns to the hub and the root path', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /play ticket to ride/i }));
  fireEvent.click(screen.getByRole('button', { name: /back to games/i }));
  expect(screen.getByRole('heading', { name: /your game night/i })).toBeTruthy();
  expect(window.location.pathname).toBe('/');
});

test('the browser back button returns from a game to the hub', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /play ticket to ride/i }));
  expect(window.location.pathname).toBe('/ticket-to-ride');
  // Simulate the browser Back button: URL reverts, popstate fires.
  act(() => {
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(screen.getByRole('heading', { name: /your game night/i })).toBeTruthy();
});
