// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../src/app/App';

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.pushState({}, '', '/');
});

test('the hub card opens /cluedo', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /play cluedo/i }));
  expect(window.location.pathname).toBe('/cluedo');
  expect(screen.getByRole('heading', { name: 'Cluedo' })).toBeTruthy();
});

test('starting a game opens /cluedo/create, which also loads directly', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /play cluedo/i }));
  fireEvent.click(screen.getByRole('button', { name: /start a game/i }));
  expect(window.location.pathname).toBe('/cluedo/create');
  expect(screen.getByRole('combobox', { name: /number of players/i })).toBeTruthy();

  cleanup();
  window.history.pushState({}, '', '/cluedo/create');
  render(<App />);
  expect(screen.getByRole('heading', { name: /set up your game/i })).toBeTruthy();
});

test('a local game lives at /cluedo/play', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /play cluedo/i }));
  fireEvent.click(screen.getByRole('button', { name: /start local game/i }));
  expect(window.location.pathname).toBe('/cluedo/play');
  expect(screen.getByRole('button', { name: /roll & move/i })).toBeTruthy();
});

test('/cluedo/join?room=ABCD opens the join flow once the room is confirmed', async () => {
  window.history.pushState({}, '', '/cluedo/join?room=ABCD');
  render(<App />);
  expect(await screen.findByRole('button', { name: /join game/i })).toBeTruthy();
  expect(screen.getByText(/room abcd/i)).toBeTruthy();
});

test('/cluedo/join with no room, or a room we are not in, bounces to the landing', () => {
  window.history.pushState({}, '', '/cluedo/join');
  render(<App />);
  expect(window.location.pathname).toBe('/cluedo');

  cleanup();
  window.history.pushState({}, '', '/cluedo/WXYZ');
  render(<App />);
  expect(window.location.pathname).toBe('/cluedo');
  expect(screen.getByRole('button', { name: /start a game/i })).toBeTruthy();
});
