import { figure, list, note, p, section, steps, sub, type GameRules } from '../../shared/rules';
import { Tokens } from './ui/ruleFigures';

export const LUDO_RULES: GameRules = {
  title: 'Ludo',
  variants: [
    {
      id: 'standard',
      label: 'Standard',
      book: {
        summary: 'Race your four tokens out of your yard, once round the board and up your home column. Land on rivals to send them back. The first to bring all four tokens home wins. 2 to 4 players.',
        sections: [
          section('The goal', p('Be the first player to move **all four** of your tokens into **home**, the centre of the board.')),
          section(
            'The board and setup',
            figure(Tokens),
            steps(
              'The board is a cross. Its outer **track** has 52 squares running clockwise. Each colour has a **yard** (a corner), a **start square** where its tokens join the track, and a **home column** of five squares leading from the track to home.',
              'Colours: with 2 players, red and yellow (opposite corners); with 3, red, green and yellow; with 4, red, green, yellow and blue.',
              'All four of every player\'s tokens start in their yard.',
              'The first player in the seat order (the host online, you on this device) rolls first. Turns go clockwise: red, green, yellow, blue.',
            ),
          ),
          section(
            'A turn',
            steps(
              'Roll the die (1 to 6).',
              sub(
                'Move **one** token by the number rolled:',
                'A token in the yard may only come out on a **6**, which places it on your start square. That uses the whole roll.',
                'A token on the track moves forward that many squares, clockwise.',
                'A token in the home column moves toward home.',
              ),
              'If no token can move with that roll, your turn ends.',
              'If only one move is possible, it is made for you.',
              'Moving two tokens that stand on the same square is the same move, so it counts as one choice.',
            ),
          ),
          section(
            'Rolling again',
            steps(
              sub(
                'You roll again straight after your move if:',
                'you rolled a **6**;',
                'your move **captured** a rival token; or',
                'your move brought a token **home**.',
              ),
              'Three 6s in a row end your turn at once: the third 6 is not played, and the turn passes on. Moves made with the first two 6s stand.',
              'A 6 with no legal move ends your turn without a bonus roll.',
            ),
          ),
          section(
            'Capturing and safe squares',
            steps(
              'If your token ends its move on a track square holding rival tokens, every rival token there is **captured** and goes back to its owner\'s yard.',
              'There are **8 safe squares**: the four start squares and the four star squares (eight squares on from each start). Tokens on a safe square cannot be captured; any number of colours may share it.',
              'Tokens of the same colour may share any square. There are no blockades: a token never blocks another from passing or landing.',
              'Tokens in a home column or at home can never be captured.',
            ),
          ),
          section(
            'Going home',
            steps(
              'After a full lap, a token turns off the track into its own home column instead of continuing round.',
              'To reach home you need the **exact** number. A roll that would carry a token past home cannot be used for that token.',
              'A token that reaches home stays there and earns a bonus roll.',
            ),
          ),
          section(
            'Winning',
            steps(
              'The first player with all four tokens home wins the game, and the game ends.',
              'Each win scores a point. Press Play again for a new game.',
            ),
            note('A player who leaves is taken out of the turn order. If only one player is left, they win.'),
          ),
          section('Timing', list('Online, each turn has a 20-second clock. If it runs out, your die is rolled or your best token moved for you.')),
        ],
      },
    },
  ],
};
