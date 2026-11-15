import { figure, list, note, p, section, steps, sub, table, type GameRules } from '../../shared/rules';
import { Squares } from './ui/ruleFigures';
import { LEVELS } from './engine';

export const MINESWEEPER_RULES: GameRules = {
  title: 'Minesweeper',
  variants: [
    {
      id: 'standard',
      label: 'Standard',
      book: {
        summary: 'Open every square that has no mine under it. Each number tells you how many mines touch that square. Open a mine and the game is over. One player.',
        sections: [
          section('The goal', p('Open **every safe square** on the field without opening a mine.')),
          section(
            'The field',
            table(
              ['Level', 'Size', 'Mines'],
              ...Object.values(LEVELS).map((l) => [l.label, `${l.cols} × ${l.rows}`, String(l.mines)]),
            ),
            list('All squares start closed. The mines are placed at random when you open your first square.'),
          ),
          section(
            'Opening squares',
            figure(Squares),
            steps(
              '**Your first square is always safe**, and so are the eight squares around it. The mines go elsewhere, so the first click always opens an area.',
              'An opened square shows a **number**: how many of the (up to eight) squares touching it hold mines, including diagonals.',
              'A square with no mines around it shows as blank, and every square around it opens too. This spreads until it reaches numbered squares.',
              'Open a mine and you lose: every mine is shown.',
            ),
          ),
          section(
            'Flags',
            steps(
              'Put a **flag** on a square you are sure hides a mine. A flagged square cannot be opened until you remove the flag.',
              'The counter shows the mines left: the total minus your flags. A wrong flag still lowers the counter.',
              sub(
                'To flag:',
                'right-click the square; or',
                'press and hold it (touch screens); or',
                'switch on **flag mode**, then click; or',
                'press **F** on a selected square.',
              ),
            ),
          ),
          section(
            'Chording',
            steps(
              'Click an opened number whose flags around it already equal that number: every other closed square around it opens at once.',
              'If one of those flags was wrong, a mine opens and you lose.',
            ),
          ),
          section(
            'Winning',
            steps('You win the moment every safe square is open. Any mines you had not flagged are flagged for you.', 'Your time is recorded; your best time for each level is kept in this browser.'),
            note('Keyboard: the arrow keys move the selection, Enter or Space opens the selected square, F flags it, and N starts a new game.'),
          ),
        ],
      },
    },
  ],
};
