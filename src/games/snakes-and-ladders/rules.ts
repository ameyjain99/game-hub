import { figure, list, note, p, section, steps, table, type GameRules } from '../../shared/rules';
import { UpAndDown } from './ui/ruleFigures';
import { LADDERS, SNAKES } from './engine';

const ladderRows = Object.entries(LADDERS).map(([from, to]) => [`Ladder`, from, String(to)]);
const snakeRows = Object.entries(SNAKES).map(([from, to]) => [`Snake`, from, String(to)]);

export const SNAKES_AND_LADDERS_RULES: GameRules = {
  title: 'Snakes & Ladders',
  variants: [
    {
      id: 'standard',
      label: 'Standard',
      book: {
        summary: 'A race of pure luck across a 100-square board. Roll the die, climb the ladders, avoid the snakes, and land exactly on 100 to win. 2 to 6 players.',
        sections: [
          section('The goal', p('Be the first player to reach square **100**, landing on it exactly.')),
          section(
            'Setup',
            steps(
              'Every player\'s token starts **off the board**, just before square 1.',
              'The first player in the seat order (the host online, you on this device) rolls first. Turns then go round the seats in order.',
            ),
          ),
          section(
            'A turn',
            figure(UpAndDown, "Stop at a ladder's foot and climb it; stop on a snake's head and slide down."),
            steps(
              'Roll the die (1 to 6).',
              'Move your token forward that many squares, counting each square once. Several tokens may share a square.',
              'If your move **ends** on the foot of a **ladder**, climb straight to its top.',
              'If your move **ends** on the head of a **snake**, slide straight down to its tail.',
              'Passing over a ladder or a snake on the way does nothing. Only the square you end on counts.',
              'If you rolled a **6**, roll again: take another full turn at once. There is no limit to how many 6s in a row you may roll. A 6 that wins the game ends it.',
            ),
          ),
          section(
            'Landing exactly on 100',
            steps(
              'You must land on 100 with the exact number.',
              'If your roll would take you past 100, move up to 100 and then **bounce back** for the remaining steps. Example: on 98 you roll 5: 99, 100, then back to 99, 98, 97.',
              'After a bounce, the square you end on still counts: a snake head or ladder foot there takes effect.',
            ),
          ),
          section(
            'The board',
            p('Ladders go up from their foot to their top; snakes go down from their head to their tail.'),
            table(['', 'From square', 'To square'], ...ladderRows, ...snakeRows),
          ),
          section(
            'Winning',
            steps(
              'The first player to end a move on square 100 (directly or by a ladder) wins at once.',
              'Each win scores a point. Press Play again for a new game with the score carried over.',
            ),
            note('A player who leaves is taken out of the turn order. If only one player is left, they win.'),
          ),
          section('Timing', list('Online, each turn has a 20-second clock. If it runs out, the die is rolled for you.')),
        ],
      },
    },
  ],
};
