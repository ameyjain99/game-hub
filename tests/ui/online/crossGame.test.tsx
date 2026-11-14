// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App, initialRoute } from '../../../src/app/App';
import { clearSessionFor, loadSession, loadSessionFor, saveSession } from '../../../src/online/session-storage';

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.pushState({}, '', '/');
});

const monopolySession = () => saveSession({ code: 'MN23', token: 't', playerId: 'p0', gameId: 'monopoly' });

test('a session is only handed to the game it belongs to', () => {
  monopolySession();
  expect(loadSessionFor('monopoly')?.code).toBe('MN23');
  expect(loadSessionFor('ticket-to-ride')).toBeNull();
  expect(loadSessionFor('cluedo')).toBeNull();
  // Sessions saved before gameId existed belong to Ticket to Ride.
  saveSession({ code: 'OLD1', token: 't', playerId: 'p0' });
  expect(loadSessionFor('ticket-to-ride')?.code).toBe('OLD1');
});

test("clearing one game's session leaves another game's session alone", () => {
  monopolySession();
  clearSessionFor('ticket-to-ride');
  expect(loadSession()?.code).toBe('MN23');
  clearSessionFor('monopoly');
  expect(loadSession()).toBeNull();
});

test('a URL naming a game wins over a stored session from another game', () => {
  monopolySession();
  window.history.pushState({}, '', '/tic-tac-toe');
  expect(initialRoute()).toEqual({ kind: 'game', gameId: 'tic-tac-toe' });
});

test('opening Ticket to Ride while in a Monopoly room shows the TtR landing, not the foreign room', () => {
  monopolySession();
  window.history.pushState({}, '', '/ticket-to-ride');
  render(<App />);
  expect(screen.getByRole('button', { name: /play on this device/i })).toBeTruthy();
  // And leaving Ticket to Ride keeps the Monopoly seat.
  fireEvent.click(screen.getByRole('button', { name: /back to games/i }));
  expect(loadSession()?.code).toBe('MN23');
});
