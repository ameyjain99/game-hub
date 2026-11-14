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
const LIVE = GAMES.filter((g) => g.status === 'live');
const showAll = () => fireEvent.click(screen.getByRole('checkbox', { name: /show all/i }));

test('by default only playable games show, in registry order; "Show all" adds the upcoming ones', () => {
  render(<HubScreen onSelect={vi.fn()} onJoin={vi.fn()} />);
  const box = screen.getByRole('checkbox', { name: /show all/i }) as HTMLInputElement;
  expect(box.checked).toBe(false);
  expect(shownTitles()).toEqual(LIVE.map((g) => g.title));
  showAll();
  expect(shownTitles()).toEqual(GAMES.map((g) => g.title));
  showAll();
  expect(shownTitles()).toEqual(LIVE.map((g) => g.title));
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
  expect(color('last-card')).toBe(color('poker'));
});

test('each category pill counts the games on show; empty categories drop out', () => {
  render(<HubScreen onSelect={vi.fn()} onJoin={vi.fn()} />);
  expect(pill(/^all/i).textContent).toContain(String(LIVE.length));
  const liveCards = LIVE.filter((g) => g.category === 'cards').length;
  expect(pill(/^cards/i).textContent).toContain(String(liveCards));
  const emptyNow = CATEGORIES.filter((c) => !LIVE.some((g) => g.category === c.id));
  for (const c of emptyNow) expect(screen.queryByRole('button', { name: new RegExp(`^${c.label}`, 'i') })).toBeNull();
  showAll();
  expect(pill(/^all/i).textContent).toContain(String(GAMES.length));
  expect(pill(/^cards/i).textContent).toContain(String(GAMES.filter((g) => g.category === 'cards').length));
});

test('picking a category shows only its games; All brings everything back', () => {
  render(<HubScreen onSelect={vi.fn()} onJoin={vi.fn()} />);
  expect(pill(/^all/i).getAttribute('aria-pressed')).toBe('true');

  fireEvent.click(pill(/^cards/i));
  expect(pill(/^cards/i).getAttribute('aria-pressed')).toBe('true');
  expect(pill(/^all/i).getAttribute('aria-pressed')).toBe('false');
  expect(shownTitles()).toEqual(LIVE.filter((g) => g.category === 'cards').map((g) => g.title));
  showAll();
  expect(shownTitles()).toEqual(GAMES.filter((g) => g.category === 'cards').map((g) => g.title));

  fireEvent.click(pill(/^all/i));
  expect(shownTitles()).toHaveLength(GAMES.length);
});

test('search narrows the grid by name, ignoring case', () => {
  render(<HubScreen onSelect={vi.fn()} onJoin={vi.fn()} />);
  fireEvent.change(screen.getByRole('searchbox', { name: /search games/i }), { target: { value: 'MONO' } });
  expect(shownTitles()).toEqual(['Monopoly']);
});

test('search and category combine, with a clear message when nothing matches', () => {
  render(<HubScreen onSelect={vi.fn()} onJoin={vi.fn()} />);
  fireEvent.change(screen.getByRole('searchbox', { name: /search games/i }), { target: { value: 'mono' } });
  fireEvent.click(pill(/^cards/i));
  expect(screen.queryByRole('list', { name: /games/i })).toBeNull();
  expect(screen.getByText(/no games match/i)).toBeTruthy();
});

test('each tile names its type; an upcoming game says Coming soon instead', () => {
  const { container } = render(<HubScreen onSelect={vi.fn()} onJoin={vi.fn()} />);
  showAll();
  const label = (id: string) => CATEGORIES.find((c) => c.id === id)!.label;
  const cards = [...container.querySelectorAll('.game-card')];
  expect(cards).toHaveLength(GAMES.length);
  GAMES.forEach((g, i) => {
    const tags = [...cards[i].querySelectorAll('.game-card-tag')].map((t) => t.textContent);
    expect(tags, g.id).toEqual([g.status === 'live' ? label(g.category) : 'Coming soon']);
  });
});
