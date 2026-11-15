import { figure, list, note, p, section, steps, sub, table, type GameRules } from '../../shared/rules';
import { Pieces } from './ui/ruleFigures';

export const CHESS_RULES: GameRules = {
  title: 'Chess',
  variants: [
    {
      id: 'standard',
      label: 'Standard chess',
      book: {
        summary: 'Standard chess on an 8×8 board. Each side has sixteen pieces. Win by checkmating the other king: attacking it so that it has no way to escape. 2 players.',
        sections: [
          section(
            'The goal',
            p('Win by **checkmate**: the opponent\'s king is attacked (in **check**) and they have no move that gets it out of check.'),
          ),
          section(
            'Setup',
            steps(
              'The board is placed with a light square in each player\'s right-hand corner.',
              'Each side starts with 8 pawns on its second row and, on its back row from left to right (as White sees it): rook, knight, bishop, queen, king, bishop, knight, rook. The queen starts on her own colour.',
              'In game 1 the first player (the host online) plays **White**. Colours swap every game. On this device you choose White, Black or Random.',
              '**White moves first.** Players then alternate, one move each.',
            ),
          ),
          section(
            'How the pieces move',
            figure(Pieces),
            table(
              ['Piece', 'Moves'],
              ['King', 'One square in any direction.'],
              ['Queen', 'Any number of squares in a straight line: along a row, a column or a diagonal.'],
              ['Rook', 'Any number of squares along a row or a column.'],
              ['Bishop', 'Any number of squares along a diagonal.'],
              ['Knight', 'In an L: two squares one way, then one square at a right angle. It is the only piece that jumps over others.'],
              ['Pawn', 'One square straight forward to an empty square, or two from its starting square if both squares are empty. It captures one square diagonally forward.'],
            ),
            steps(
              'Apart from the knight, no piece may move through another piece.',
              'A piece captures by moving onto a square held by an opponent\'s piece, which is removed. You never capture your own pieces.',
              'You may **never** make a move that leaves your own king in check. If you are in check, your move must end the check.',
            ),
          ),
          section(
            'Special moves',
            steps(
              sub(
                '**Castling.** The king moves two squares toward a rook, and that rook jumps to the square the king crossed. Allowed only when all of these hold:',
                'neither the king nor that rook has moved yet this game;',
                'every square between them is empty;',
                'the king is not in check, does not pass through a square under attack, and does not land in check.',
              ),
              '**En passant.** When a pawn moves two squares and lands beside an opponent\'s pawn, that pawn may capture it as if it had moved only one square. This is allowed only on the very next move.',
              '**Promotion.** A pawn reaching the far row must become a queen, rook, bishop or knight of the same colour, chosen by its player.',
            ),
          ),
          section(
            'End of the game',
            steps(
              '**Checkmate** wins.',
              'Resigning (or leaving) loses.',
              sub(
                'The game is a **draw** as soon as any of these happens:',
                '**Stalemate:** the player to move is not in check but has no legal move.',
                '**Insufficient material:** neither side has enough pieces left to checkmate (for example, king against king, or king and bishop against king).',
                '**Threefold repetition:** the same position occurs for the third time, with the same player to move and the same castling and en passant rights.',
                '**Fifty-move rule:** fifty moves by each player in a row with no capture and no pawn move.',
                '**Agreement:** one player offers a draw and the other accepts.',
              ),
              'Each win scores a point. Press Play again for the next game, with colours swapped.',
            ),
            note('Repetition and the fifty-move rule end the game automatically; nobody needs to claim them.'),
          ),
          section(
            'Draw offers',
            steps(
              'On your turn or theirs, you may offer your opponent a draw.',
              'They may accept (the game ends drawn) or decline.',
              'Making a move counts as declining an offer you have received. Only one offer can be open at a time.',
            ),
          ),
          section(
            'Timing and the computer',
            list(
              'Chess is played **without a clock**. Online, if your opponent walks away you may remove them from the game, which counts as their loss.',
              'On this device you play Stockfish at one of five strengths: Beginner (about 1350), Intermediate (about 1700), Advanced (about 2000), Master (about 2400) or full strength.',
            ),
          ),
        ],
      },
    },
  ],
};
