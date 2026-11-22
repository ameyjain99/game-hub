// @vitest-environment jsdom
// The Mega Edition on screen: the 52-square board, the speed die, and the
// choices that only Mega asks for.
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MonopolyGame } from '../../src/games/monopoly/ui/MonopolyGame';
import { createMonopolyGame, type MonopolyState } from '../../src/games/monopoly/engine/state';
import { spacesOf } from '../../src/games/monopoly/engine/board';
import { cellPos, movePath, sideOf, tokenAnchor } from '../../src/games/monopoly/ui/board-layout';
import { cashForBoard } from '../../src/games/monopoly/ui/MonopolyRules';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const nameFor = (id: string) => (id === 'p0' ? 'Amy' : `Bot ${id.slice(1)}`);
const id = (name: string) => spacesOf('megaUs').find((s) => s.name === name)!.id;

function game(change: (g: MonopolyState) => void = () => {}): MonopolyState {
  const g = createMonopolyGame(
    [
      { avatar: '', isAI: false },
      { avatar: '', isAI: true },
    ],
    5,
    { board: 'megaUs', randomizeOrder: false },
  );
  change(g);
  return g;
}

function show(view: MonopolyState) {
  const onAction = vi.fn();
  render(<MonopolyGame view={view} meId="p0" nameFor={nameFor} onAction={onAction} onExit={() => {}} exitLabel="Back" />);
  return onAction;
}

test('the layout puts 13 squares on a side, corners at 0, 13, 26 and 39', () => {
  expect([0, 13, 26, 39].map((i) => sideOf(i, 13))).toEqual(['corner', 'corner', 'corner', 'corner']);
  expect([cellPos(0, 13), cellPos(13, 13), cellPos(26, 13), cellPos(39, 13)]).toEqual([
    { row: 14, col: 14 },
    { row: 14, col: 1 },
    { row: 1, col: 1 },
    { row: 1, col: 14 },
  ]);
  const cells = Array.from({ length: 52 }, (_, i) => cellPos(i, 13));
  expect(new Set(cells.map((c) => `${c.row}:${c.col}`)).size).toBe(52);
  for (let i = 0; i < 52; i++) {
    const a = tokenAnchor(i, 13);
    expect(a.x).toBeGreaterThan(0);
    expect(a.x).toBeLessThan(1);
    expect(a.y).toBeGreaterThan(0);
    expect(a.y).toBeLessThan(1);
  }
  // A roll of three dice walks up to 15 squares, round the corner at 52.
  expect(movePath(45, 8, false, 13)).toHaveLength(15);
  expect(movePath(45, 8, false, 13).at(-1)).toBe(8);
  expect(movePath(0, 30, false, 13)).toEqual([30]);
});

test('a Mega game draws 52 squares, the three new ones included, and starts on 2,500', () => {
  show(game());
  const board = screen.getByRole('group', { name: 'Monopoly board' });
  expect(board.querySelectorAll('[data-space]')).toHaveLength(52);
  expect(board.className).toContain('is-mega');
  for (const name of ['Auction', 'Bus Ticket', 'Birthday Gift']) expect(board.querySelector(`[data-space="${id(name)}"]`)!.textContent).toContain(name);
  expect(within(board).getByRole('button', { name: /^Gas Company, \$150/ })).toBeTruthy();
  expect(screen.getAllByText('$2,500').length).toBeGreaterThan(0);
});

test('the speed die is shown beside the white dice', () => {
  show(game((g) => Object.assign(g, { dice: [3, 4], speedDie: 'bus', rollSeq: 1, phase: 'action' })));
  expect(screen.getByRole('img', { name: 'Rolled 3 and 4 and the Bus on the speed die' })).toBeTruthy();
});

test('triples: a square is picked on the board, then confirmed', () => {
  const onAction = show(game((g) => Object.assign(g, { phase: 'action', choice: { kind: 'triples' }, dice: [2, 2], speedDie: 2, rollSeq: 1 })));
  expect(screen.getByText('Move to any square')).toBeTruthy();
  const go = screen.getByRole('button', { name: 'Move there' }) as HTMLButtonElement;
  expect(go.disabled).toBe(true);
  // Every square but the one you stand on can be picked, corners and card squares too.
  expect(document.querySelectorAll('.mono-cell.is-target')).toHaveLength(51);
  fireEvent.click(screen.getByRole('button', { name: /^Pick Boardwalk/ }));
  expect((screen.getByRole('combobox', { name: 'Move to any square' }) as HTMLSelectElement).value).toBe(String(id('Boardwalk')));
  fireEvent.click(go);
  expect(onAction).toHaveBeenCalledWith({ type: 'CHOOSE', space: id('Boardwalk') });
});

test('the Auction square asks for an unowned property', () => {
  const onAction = show(
    game((g) => {
      Object.assign(g, { phase: 'action', choice: { kind: 'auction' } });
      g.players[0].position = id('Auction');
      g.ownership[id('Boardwalk')].owner = 'p1';
    }),
  );
  const list = screen.getByRole('combobox', { name: 'Put a property up for auction' }) as HTMLSelectElement;
  expect(within(list).queryByRole('option', { name: /Boardwalk/ })).toBeNull();
  fireEvent.change(list, { target: { value: String(id('Park Place')) } });
  fireEvent.click(screen.getByRole('button', { name: 'Auction it' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'CHOOSE', space: id('Park Place') });
});

test('the Birthday Gift offers the money or a Bus Ticket', () => {
  const onAction = show(game((g) => Object.assign(g, { phase: 'action', choice: { kind: 'birthday' } })));
  fireEvent.click(screen.getByRole('button', { name: 'Collect $100' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'CHOOSE', take: 'cash' });
  fireEvent.click(screen.getByRole('button', { name: 'Take a Bus Ticket' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'CHOOSE', take: 'ticket' });
});

test('the speed die bonus is taken before the turn can end', () => {
  const onAction = show(game((g) => Object.assign(g, { phase: 'action', bonus: 'bus', dice: [1, 2], speedDie: 'bus', rollSeq: 1 })));
  expect(screen.queryByRole('button', { name: 'End turn' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Ride to the next Chance or Community Chest' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'BONUS', take: 'move' });
  cleanup();
  const again = show(game((g) => Object.assign(g, { phase: 'action', bonus: 'mr', dice: [1, 2], speedDie: 'mr', rollSeq: 1 })));
  fireEvent.click(screen.getByRole('button', { name: 'Take the bonus move' }));
  expect(again).toHaveBeenCalledWith({ type: 'BONUS' });
});

test('a Bus Ticket can be ridden in place of the roll, along this side only', () => {
  const onAction = show(game((g) => (g.players[0].busTickets = 2)));
  expect(screen.getByTitle(/^Bus Tickets/).textContent).toBe('Bus ×2');
  fireEvent.click(screen.getByRole('button', { name: /Ride a Bus Ticket instead \(2\)/ }));
  // From Go: the twelve squares of the first side and the Jail corner.
  expect(document.querySelectorAll('.mono-cell.is-target')).toHaveLength(13);
  fireEvent.click(screen.getByRole('button', { name: /^Pick Connecticut Avenue/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Ride there' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'USE_TICKET', space: id('Connecticut Avenue') });
});

test('skyscrapers and train depots show on the board, and a depot can be built from your properties', () => {
  const onAction = show(
    game((g) => {
      g.phase = 'action';
      g.dice = [1, 2];
      Object.assign(g.ownership[id('Boardwalk')], { owner: 'p0', houses: 6 });
      Object.assign(g.ownership[id('Short Line')], { owner: 'p0', depot: true });
      g.ownership[id('Reading Railroad')].owner = 'p0';
    }),
  );
  const board = screen.getByRole('group', { name: 'Monopoly board' });
  expect(within(board).getByRole('button', { name: /^Boardwalk, owned by Amy, skyscraper/ }).querySelector('.mono-skyscraper')).toBeTruthy();
  expect(within(board).getByRole('button', { name: /^Short Line, owned by Amy, train depot/ }).querySelector('.mono-depot')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Build a train depot on Reading Railroad' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'BUILD_DEPOT', spaceId: id('Reading Railroad') });
  expect((screen.getByRole('button', { name: 'Build a train depot on Short Line' }) as HTMLButtonElement).disabled).toBe(true);
});

test('picking a Mega board moves the standard starting cash to 2,500, and leaves a chosen amount alone', () => {
  expect(cashForBoard(1500, 'us', 'megaUs')).toBe(2500);
  expect(cashForBoard(2500, 'megaUs', 'uk')).toBe(1500);
  expect(cashForBoard(2500, 'megaUs', 'megaUk')).toBe(2500);
  expect(cashForBoard(1000, 'us', 'megaUs')).toBe(1000);
});
