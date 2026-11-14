// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MinesweeperGame } from '../../../src/games/minesweeper/ui/MinesweeperGame';

afterEach(cleanup);

const cells = () => screen.getAllByRole('gridcell');

test('the first click opens an area; right-click flags and counts down', () => {
  render(<MinesweeperGame level="easy" onExit={() => {}} />);
  expect(cells()).toHaveLength(81);
  fireEvent.click(cells()[40]);
  const opened = cells().filter((c) => !/hidden|flagged/.test(c.getAttribute('aria-label')!));
  expect(opened.length).toBeGreaterThan(1);
  const hidden = cells().find((c) => c.getAttribute('aria-label')!.endsWith('hidden'))!;
  fireEvent.contextMenu(hidden);
  expect(hidden.getAttribute('aria-label')).toMatch(/flagged$/);
  expect(screen.getByText('9')).toBeTruthy(); // mines left
});

test('switching level deals a new board of that size', () => {
  render(<MinesweeperGame level="easy" onExit={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /^Medium/ }));
  expect(cells()).toHaveLength(256);
  fireEvent.click(screen.getByRole('button', { name: /^Expert/ }));
  expect(cells()).toHaveLength(720);
});
