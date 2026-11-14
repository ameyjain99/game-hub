// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SudokuGame } from '../../../src/games/sudoku/ui/SudokuGame';

afterEach(cleanup);

test('pick an empty cell and type: a number goes in, and the pad counts it', () => {
  render(<SudokuGame difficulty="easy" mistakeLimit={3} onExit={() => {}} />);
  const empty = screen.getAllByRole('gridcell').find((c) => c.getAttribute('aria-label')!.endsWith('empty'))!;
  fireEvent.click(empty);
  fireEvent.keyDown(window, { key: '4' });
  expect(empty.getAttribute('aria-label')).toMatch(/, 4/);
});

test('notes mode pencils digits instead', () => {
  render(<SudokuGame difficulty="easy" mistakeLimit={3} onExit={() => {}} />);
  const empty = screen.getAllByRole('gridcell').find((c) => c.getAttribute('aria-label')!.endsWith('empty'))!;
  fireEvent.click(empty);
  fireEvent.click(screen.getByRole('button', { name: /notes off/i }));
  fireEvent.keyDown(window, { key: '2' });
  fireEvent.keyDown(window, { key: '8' });
  expect(empty.getAttribute('aria-label')).toMatch(/empty$/);
  expect(empty.textContent).toBe('28');
});
