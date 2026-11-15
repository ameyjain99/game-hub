import { figure, list, note, p, section, steps, type GameRules } from '../../shared/rules';
import { ThreeInARow } from './ui/ruleFigures';

export const TIC_TAC_TOE_RULES: GameRules = {
  title: 'Tic-Tac-Toe',
  variants: [
    {
      id: 'standard',
      label: 'Standard',
      book: {
        summary: 'Two players take turns marking a 3×3 grid, one with X and one with O. The first to get three of their marks in a row wins the round. You play a running series of rounds.',
        sections: [
          section('The goal', p('Be the first to fill **three squares in a row** with your mark: across, down or corner to corner.')),
          section(
            'Setup',
            steps(
              'The grid starts empty.',
              'In round 1, the first player (the host online, you on this device) plays **X** and the other plays **O**.',
              'X always moves first. Who plays X alternates every round, so each player starts every other round.',
            ),
          ),
          section(
            'A turn',
            steps(
              'On your turn, mark one empty square with your mark.',
              'You may not pass, and you may not mark a square that already has a mark.',
              'Then it is the other player\'s turn.',
            ),
          ),
          section(
            'End of a round',
            figure(ThreeInARow, 'X wins with three on a diagonal.'),
            steps(
              'The moment a player completes three in a row, they **win the round** and score 1 point.',
              'If all nine squares are filled with no three in a row, the round is a **draw** and nobody scores.',
              'Press Play again to start the next round with the score carried over.',
            ),
            note('Giving up a round (or leaving) counts as a win for the other player.'),
          ),
          section(
            'Timing and bots',
            list(
              'Online, each turn has a 45-second clock. If it runs out, a safe move is played for you.',
              '**Easy** bot: usually takes a win when it sees one, otherwise picks any square.',
              '**Normal** bot: plays well but sometimes slips; it always takes a win and always blocks yours.',
              '**Hard** bot: plays perfectly and never loses. The best you can do against it is a draw.',
            ),
          ),
        ],
      },
    },
  ],
};
