// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../src/app/App';

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.pushState({}, '', '/');
});

function openMonopoly() {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /play monopoly/i }));
}

test('the hub card opens /monopoly', () => {
  openMonopoly();
  expect(window.location.pathname).toBe('/monopoly');
});

test('starting a game opens the create page with board + settings', () => {
  openMonopoly();
  fireEvent.click(screen.getByRole('button', { name: /start a game/i }));
  expect(window.location.pathname).toBe('/monopoly/create');
  expect(screen.getByRole('combobox', { name: /board/i })).toBeTruthy();
  expect(screen.getByLabelText(/auctions/i)).toBeTruthy();
});

test('opening /monopoly/create directly shows the create page', () => {
  window.history.pushState({}, '', '/monopoly/create');
  render(<App />);
  expect(screen.getByRole('combobox', { name: /board/i })).toBeTruthy();
  expect(window.location.pathname).toBe('/monopoly/create');
});

test('/monopoly/join with no room bounces to the landing', () => {
  window.history.pushState({}, '', '/monopoly/join');
  render(<App />);
  expect(window.location.pathname).toBe('/monopoly');
  expect(screen.getByRole('button', { name: /start a game/i })).toBeTruthy();
});

test('a /monopoly/join?room=ABCD link opens the join flow once confirmed', async () => {
  window.history.pushState({}, '', '/monopoly/join?room=ABCD');
  render(<App />);
  // fetch is unavailable in jsdom → the gate fails open and shows the name step.
  expect(await screen.findByRole('button', { name: /join game/i })).toBeTruthy();
  expect(window.location.pathname).toBe('/monopoly/join');
});

test('a /monopoly/<code> link this browser does not belong to bounces to the landing', () => {
  window.history.pushState({}, '', '/monopoly/ABCD');
  render(<App />);
  expect(window.location.pathname).toBe('/monopoly');
  expect(screen.getByRole('button', { name: /start a game/i })).toBeTruthy();
});
