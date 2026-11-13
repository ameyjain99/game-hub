// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CluedoApp } from '../../../src/games/cluedo/ui/CluedoApp';

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.pushState({}, '', '/');
});

test('Cluedo starts a local game with the human to roll', () => {
  render(<CluedoApp onBackToHub={() => {}} />);
  // Cluedo setup screen
  expect(screen.getByRole('heading', { name: /cluedo/i })).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: /start local game/i }));

  // The game is running: the human is prompted to take their turn.
  expect(screen.getByRole('heading', { name: /your turn/i })).toBeTruthy();
  expect(screen.getByRole('button', { name: /roll & move/i })).toBeTruthy();
  // The detective's notebook is present.
  expect(screen.getByRole('heading', { name: /detective's notebook/i })).toBeTruthy();
});

test('rolling then moving puts the human into a room and offers a suggestion', () => {
  render(<CluedoApp onBackToHub={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /start local game/i }));

  fireEvent.click(screen.getByRole('button', { name: /roll & move/i }));
  expect(screen.getByRole('heading', { name: /move to a room/i })).toBeTruthy();

  // Pick the first offered room.
  const roomButtons = screen.getAllByRole('button');
  const kitchen = roomButtons.find((b) => b.textContent === 'Kitchen') ?? roomButtons[0];
  fireEvent.click(kitchen);

  // Now in a room, the Suggest control is available.
  expect(screen.getByRole('button', { name: /^suggest/i })).toBeTruthy();
});
