import { figure, list, note, p, section, steps, table, type GameRules } from '../../shared/rules';
import { Box } from './ui/ruleFigures';
import { CLUES } from './engine';

export const SUDOKU_RULES: GameRules = {
  title: 'Sudoku',
  variants: [
    {
      id: 'standard',
      label: 'Standard',
      book: {
        summary: 'Fill the 9×9 grid with digits so that every row, every column and every 3×3 box holds each digit from 1 to 9 exactly once. One player.',
        sections: [
          section(
            'The goal',
            figure(Box, 'One box holds each digit from 1 to 9 once; so does every row and column.'),
            p('Fill every empty square with a digit from 1 to 9 so that **each row**, **each column** and **each of the nine 3×3 boxes** contains every digit exactly once.'),
          ),
          section(
            'The puzzle',
            steps(
              'Every puzzle is made fresh and has **exactly one solution**. You never need to guess.',
              'Some squares start filled: these **clues** cannot be changed.',
            ),
            table(['Level', 'Clues given'], ['Easy', String(CLUES.easy)], ['Medium', String(CLUES.medium)], ['Hard', String(CLUES.hard)], ['Expert', String(CLUES.expert)]),
            p('A few more clues than the number shown may remain when no more can be removed without making the answer less than certain.'),
          ),
          section(
            'Playing',
            steps(
              'Select an empty square, then choose a digit to place it.',
              'A digit that is **wrong** (not the puzzle\'s solution for that square) counts as a **mistake** and is shown in red. You may erase it and try again.',
              'Placing a digit removes that digit from the pencil notes of every square in its row, column and box.',
              'Switch to **notes** to pencil small candidate digits into a square instead. Notes are never checked.',
              '**Erase** clears a square you filled (or its notes).',
              '**Hint** fills the selected square with its correct digit. Hints are counted.',
              '**Undo** takes back your last change, as many times as you like. A mistake stays counted even if undone.',
            ),
          ),
          section(
            'Winning and losing',
            steps(
              'You win when every square holds its correct digit.',
              'With the mistake limit on (set before you start), your **third mistake** ends the puzzle. With "No limit", mistakes are only counted.',
            ),
            note('Your time, mistakes and hints are shown when you finish.'),
          ),
          section('Shortcuts', list('Type 1 to 9 to place a digit, N to switch notes on or off, and Backspace, Delete or 0 to erase. Arrow keys move the selection. Ctrl or Cmd + Z undoes.')),
        ],
      },
    },
  ],
};
