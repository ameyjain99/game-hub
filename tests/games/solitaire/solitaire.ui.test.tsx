// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SolitaireApp } from '../../../src/games/solitaire/ui/SolitaireApp';

afterEach(() => {
  cleanup();
  window.history.pushState({}, '', '/');
});

test('the landing offers draw one or three, and starts a deal at /solitaire/play', () => {
  window.history.pushState({}, '', '/solitaire');
  render(<SolitaireApp onBackToHub={() => {}} />);
  expect(screen.getByRole('combobox', { name: /turn the stock/i })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /start game/i }));
  expect(window.location.pathname).toBe('/solitaire/play');
});

test('a fresh deal shows the stock, the stats and the controls', () => {
  window.history.pushState({}, '', '/solitaire/play');
  render(<SolitaireApp onBackToHub={() => {}} />);
  expect(screen.getByText('Moves')).toBeTruthy();
  expect(screen.getByRole('button', { name: /new deal/i })).toBeTruthy();
  expect((screen.getByRole('button', { name: /undo/i }) as HTMLButtonElement).disabled).toBe(true);
});
