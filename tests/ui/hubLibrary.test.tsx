// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { HubScreen } from '../../src/app/HubScreen';
import { GameIcon } from '../../src/app/GameIcon';
import { CATEGORIES, GAMES } from '../../src/games/registry';

afterEach(cleanup);

/** Titles of the game cards currently shown, in grid order. */
function shownTitles(): string[] {
  const grid = screen.getByRole('list', { name: /games/i });
  return within(grid)
    .getAllByRole('heading', { level: 3 })
    .map((h) => h.textContent ?? '');
}

const pill = (name: RegExp) => screen.getByRole('button', { name });

test('the library shows every game, in the order the registry lists them', () => {
  render(<HubScreen onSelect={vi.fn()} />);
  expect(shownTitles()).toEqual(GAMES.map((g) => g.title));
});

test('every game has an icon and belongs to a known category', () => {
  const known = new Set(CATEGORIES.map((c) => c.id));
  for (const g of GAMES) {
    expect(known.has(g.category)).toBe(true);
    const { container, unmount } = render(<GameIcon gameId={g.id} accent="#000" />);
    expect(container.querySelector('svg'), g.id).not.toBeNull();
    unmount();
  }
});

test('the current games keep their colours: TTR red, Monopoly green, Cluedo purple; cards are blue', () => {
  const color = (id: string) => CATEGORIES.find((c) => c.id === GAMES.find((g) => g.id === id)!.category)!.color;
  expect(color('ticket-to-ride')).toBe('#D93A3F');
  expect(color('monopoly')).toBe('#2F9E62');
  expect(color('cluedo')).toBe('#7C4DBA');
  // Catan follows its category (strategy) instead of keeping its own colour.
  expect(color('catan')).toBe(color('ticket-to-ride'));
  expect(color('uno')).toBe(color('poker'));
});

test('each category pill shows how many games it holds', () => {
  render(<HubScreen onSelect={vi.fn()} />);
  expect(pill(/^all/i).textContent).toContain(String(GAMES.length));
  const cards = GAMES.filter((g) => g.category === 'cards').length;
  expect(pill(/^cards/i).textContent).toContain(String(cards));
});

test('picking a category shows only its games; All brings everything back', () => {
  render(<HubScreen onSelect={vi.fn()} />);
  expect(pill(/^all/i).getAttribute('aria-pressed')).toBe('true');

  fireEvent.click(pill(/^cards/i));
  expect(pill(/^cards/i).getAttribute('aria-pressed')).toBe('true');
  expect(pill(/^all/i).getAttribute('aria-pressed')).toBe('false');
  expect(shownTitles()).toEqual(GAMES.filter((g) => g.category === 'cards').map((g) => g.title));

  fireEvent.click(pill(/^all/i));
  expect(shownTitles()).toHaveLength(GAMES.length);
});

test('search narrows the grid by name, ignoring case', () => {
  render(<HubScreen onSelect={vi.fn()} />);
  fireEvent.change(screen.getByRole('searchbox', { name: /search games/i }), { target: { value: 'MONO' } });
  expect(shownTitles()).toEqual(['Monopoly']);
});

test('search and category combine, with a clear message when nothing matches', () => {
  render(<HubScreen onSelect={vi.fn()} />);
  fireEvent.change(screen.getByRole('searchbox', { name: /search games/i }), { target: { value: 'mono' } });
  fireEvent.click(pill(/^cards/i));
  expect(screen.queryByRole('list', { name: /games/i })).toBeNull();
  expect(screen.getByText(/no games match/i)).toBeTruthy();
});
