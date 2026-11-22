// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RulesButton } from '../../src/shared/ui/Rules';
import type { GameRules } from '../../src/shared/rules';
import { GAMES } from '../../src/games/registry';
import { TTR_RULES } from '../../src/games/ticket-to-ride/rules';
import { MONOPOLY_RULES } from '../../src/games/monopoly/rules';
import { CLUEDO_RULES } from '../../src/games/cluedo/rules';
import { CHESS_RULES } from '../../src/games/chess/rules';
import { CHECKERS_RULES } from '../../src/games/checkers/rules';
import { TIC_TAC_TOE_RULES } from '../../src/games/tic-tac-toe/rules';
import { SNAKES_AND_LADDERS_RULES } from '../../src/games/snakes-and-ladders/rules';
import { LUDO_RULES } from '../../src/games/ludo/rules';
import { SEQUENCE_RULES } from '../../src/games/sequence/rules';
import { UNO_RULES } from '../../src/games/uno/rules';
import { SCRABBLE_RULES } from '../../src/games/scrabble/rules';
import { MINECRAFT_RULES } from '../../src/games/minecraft/rules';
import { SOLITAIRE_RULES } from '../../src/games/solitaire/rules';
import { SUDOKU_RULES } from '../../src/games/sudoku/rules';
import { MINESWEEPER_RULES } from '../../src/games/minesweeper/rules';
import { POKER_RULES } from '../../src/games/poker/rules';
import { CATAN_RULES } from '../../src/games/catan/rules';
import { IMPOSTER_RULES } from '../../src/games/imposter/rules';
import { EK_RULES } from '../../src/games/exploding-kittens/rules';
import { MD_RULES } from '../../src/games/monopoly-deal/rules';

afterEach(cleanup);

const BOOKS: Record<string, GameRules> = {
  'ticket-to-ride': TTR_RULES,
  monopoly: MONOPOLY_RULES,
  cluedo: CLUEDO_RULES,
  chess: CHESS_RULES,
  checkers: CHECKERS_RULES,
  'tic-tac-toe': TIC_TAC_TOE_RULES,
  'snakes-and-ladders': SNAKES_AND_LADDERS_RULES,
  ludo: LUDO_RULES,
  sequence: SEQUENCE_RULES,
  'uno': UNO_RULES,
  'exploding-kittens': EK_RULES,
  'monopoly-deal': MD_RULES,
  scrabble: SCRABBLE_RULES,
  minecraft: MINECRAFT_RULES,
  solitaire: SOLITAIRE_RULES,
  sudoku: SUDOKU_RULES,
  minesweeper: MINESWEEPER_RULES,
  poker: POKER_RULES,
  catan: CATAN_RULES,
  imposter: IMPOSTER_RULES,
};

test('every playable game has a rule book, with a summary and sections for every version', () => {
  for (const g of GAMES.filter((x) => x.status === 'live' || x.id === 'cluedo')) {
    const book = BOOKS[g.id];
    expect(book, g.id).toBeDefined();
    for (const v of book.variants) {
      expect(v.book.summary.length, `${g.id}/${v.id}`).toBeGreaterThan(20);
      expect(v.book.sections.length, `${g.id}/${v.id}`).toBeGreaterThan(2);
    }
  }
});

test('the sheet opens on the version asked for, numbers the steps, and switches versions', () => {
  render(<RulesButton rules={POKER_RULES} variant="omaha" />);
  fireEvent.click(screen.getByRole('button', { name: 'Rules' }));
  const sheet = screen.getByRole('dialog', { name: 'Poker' });
  expect(within(sheet).getByRole('tab', { selected: true }).textContent).toBe('Omaha');
  expect(within(sheet).getAllByText(/exactly two/i).length).toBeGreaterThan(0);
  expect(within(sheet).getAllByText('4.1').length).toBeGreaterThan(0);
  fireEvent.click(within(sheet).getByRole('tab', { name: 'Razz' }));
  expect(within(sheet).getByRole('tab', { selected: true }).textContent).toBe('Razz');
  expect(within(sheet).getAllByText(/ace-to-five low/i).length).toBeGreaterThan(0);
});

test('Escape closes the sheet', () => {
  render(<RulesButton rules={CHESS_RULES} />);
  fireEvent.click(screen.getByRole('button', { name: 'Rules' }));
  expect(screen.getByRole('dialog', { name: 'Chess' })).toBeTruthy();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'Chess' })).toBeNull();
});
