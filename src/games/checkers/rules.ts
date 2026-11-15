import { figure, list, note, p, section, steps, sub, terms, type GameRules } from '../../shared/rules';
import { Pieces } from './ui/ruleFigures';

export const CHECKERS_RULES: GameRules = {
  title: 'Checkers',
  variants: [
    {
      id: 'american',
      label: 'American checkers',
      book: {
        summary: 'American checkers (English draughts) on an 8×8 board. Move diagonally, jump over your opponent\'s pieces to capture them, and leave them with no pieces or no legal move. 2 players.',
        sections: [
          section(
            'The goal',
            p('Win by leaving your opponent **unable to move** on their turn: either they have no pieces left, or every piece they have is blocked.'),
          ),
          section(
            'Setup',
            figure(Pieces, 'Men move forward only; a king (with a crown) moves both ways.'),
            steps(
              'The board has 64 squares. Only the 32 **dark squares** are used. They are numbered 1 to 32, starting from Black\'s side.',
              'Each player has 12 pieces, called **men**. Black\'s men stand on squares 1 to 12; White\'s on squares 21 to 32.',
              'In game 1 the first player (the host online) plays **Black**. Colours swap every game.',
              '**Black moves first.** Players then alternate turns.',
            ),
          ),
          section(
            'Moving',
            terms(
              ['Man', 'Moves one square **diagonally forward** (toward the opponent\'s side) onto an empty dark square.'],
              ['King', 'Moves one square diagonally in **any** direction, forward or back.'],
            ),
            p('On your turn you make exactly one move: a simple move, or a capture. You may not pass.'),
          ),
          section(
            'Capturing',
            steps(
              'A piece captures by **jumping** diagonally over an opponent\'s piece directly next to it, onto the empty square just beyond. The jumped piece is removed.',
              'Men capture forward only. Kings capture forward or backward.',
              '**Capturing is compulsory.** If any of your pieces can capture, you must capture instead of making a simple move.',
              'If several captures are possible, you may choose any of them. You do not have to choose the one that takes the most pieces.',
              sub(
                '**Multi-jumps.** After a jump, if the same piece can jump again, it must keep jumping in the same turn until it cannot.',
                'Each jump is played as its own step, so everyone can follow it.',
                'You may change direction between jumps.',
              ),
            ),
          ),
          section(
            'Kings',
            steps(
              'A man that ends a move on the far row (squares 29 to 32 for Black, 1 to 4 for White) is **crowned** and becomes a king.',
              'A man crowned during a capture **stops there**: its turn ends at once, even if as a king it could jump again.',
            ),
          ),
          section(
            'End of the game',
            steps(
              'You **lose** if it is your turn and you have no legal move, whether because you have no pieces or all of yours are blocked.',
              'The game is a **draw** if 40 moves each (80 moves in all) pass with no capture and no man moved. Only king moves in that stretch.',
              'Giving up (or leaving) loses the game.',
              'Each win scores a point; a draw scores nothing. Press Play again for the next game, with colours swapped.',
            ),
          ),
          section(
            'Timing and bots',
            list(
              'Online, each turn has a 60-second clock. If it runs out, a legal move is played for you.',
              'Bots come in Easy, Normal and Hard. Hard searches up to nine moves ahead.',
            ),
            note('Notation in the move list: "11-15" is a move from square 11 to 15; "22x15x8" is a double jump.'),
          ),
        ],
      },
    },
  ],
};
