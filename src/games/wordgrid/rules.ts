import { figure, list, note, p, section, steps, sub, table, terms, type GameRules } from '../../shared/rules';
import { Premiums, Tiles } from './ui/ruleFigures';
import { LETTERS } from './engine';

const letterRows = (() => {
  const byValue = new Map<number, string[]>();
  for (const [letter, [count, value]] of Object.entries(LETTERS)) {
    byValue.set(value, [...(byValue.get(value) ?? []), `${letter === '?' ? 'Blank' : letter} ×${count}`]);
  }
  return [...byValue.entries()].sort((a, b) => a[0] - b[0]).map(([value, letters]) => [String(value), letters.join(', ')]);
})();

export const WORDGRID_RULES: GameRules = {
  title: 'Wordgrid',
  variants: [
    {
      id: 'standard',
      label: 'Standard',
      book: {
        summary: 'A crossword game for 2 to 4 players. Lay letter tiles to make words that join the words already on the board, use the premium squares, and finish with the highest score.',
        sections: [
          section('The goal', p('Finish with the **highest score**. You score by laying tiles to make words.')),
          section(
            'Setup',
            steps(
              'The board has 15 × 15 squares. Some are **premium squares** (see Scoring). The centre square has a star.',
              'The bag holds **100 tiles**: 98 letters and 2 blanks (see Tiles).',
              'Each player draws **7 tiles** onto their rack, kept hidden from the others.',
              'Game 1 starts with the first player in the seat order; each new game starts with the next player. Turns go round the seats.',
            ),
          ),
          section(
            'A turn',
            p('On your turn, do exactly one of these:'),
            terms(
              ['Play', 'Lay one or more tiles on the board to make words, then draw back up to 7 tiles.'],
              ['Swap', 'Return any number of your tiles to the bag and draw the same number. Only while the bag holds at least 7 tiles. Scores nothing.'],
              ['Pass', 'Do nothing. Scores nothing.'],
            ),
          ),
          section(
            'Laying tiles',
            steps(
              'All the tiles you lay in a turn go in **one row or one column**.',
              'Together with tiles already on the board, they must form **one unbroken line**, with no empty squares between them.',
              'The **first word** of the game must cover the **centre star** and use at least two tiles.',
              'Every later play must **join** the tiles already down: at least one word you make must use a tile that was there before.',
              sub(
                'Every word you form must be a real word:',
                'the main word along your line of tiles; and',
                'every word your new tiles make across it (two or more letters in a row).',
              ),
              'Words are checked against the ENABLE word list. A play containing any word not in the list is not allowed; take it back and try again.',
              'A **blank** can stand for any letter you choose. It keeps that letter for the rest of the game and is worth 0 points.',
            ),
          ),
          section(
            'Scoring a play',
            figure(Premiums, 'Premium squares count only for the tiles placed on them this turn.'),
            steps(
              'Each word you made scores the sum of its letters\' values.',
              sub(
                'Premium squares count **only** under tiles laid this turn:',
                '**DL** (double letter): that tile counts twice.',
                '**TL** (triple letter): that tile counts three times.',
                '**DW** (double word): the whole word counts twice. The centre star is a double word square.',
                '**TW** (triple word): the whole word counts three times.',
              ),
              'Letter premiums apply before word premiums. Two word premiums under one word multiply (double and double makes four times).',
              'If one new tile sits on a premium square and is part of two words, the premium counts for both words.',
              'Using **all 7 tiles** in one turn earns **50 bonus points**.',
              'Your score for the turn is the total for every word you made, plus any bonus.',
            ),
          ),
          section(
            'Tiles',
            figure(Tiles, 'Each tile shows its letter value in the corner.'),
            table(['Points', 'Letters (how many)'], ...letterRows),
          ),
          section(
            'End of the game',
            steps(
              sub(
                'The game ends when either:',
                'a player plays their **last tile while the bag is empty**; or',
                '**six turns in a row** are passes or swaps (any play of tiles starts the count again).',
              ),
              'If a player went out, every other player **loses** the value of the tiles left on their rack, and the player who went out **gains** the total.',
              'If the game ended on six scoreless turns, every player loses the value of the tiles left on their rack.',
              'The highest final score wins. Equal top scores make it a draw.',
              'Each win counts toward the tally shown at the table. Press Play again for a new game.',
            ),
            note('Blanks left on a rack are worth 0.'),
          ),
          section('Timing', list('Online, each turn has a 2-minute clock. If it runs out, you pass.')),
        ],
      },
    },
  ],
};
