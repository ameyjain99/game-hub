/** Chess's rule-book pictures: the pieces as the board draws them. */
import { PieceImg } from './ChessGame';

const PIECES: [string, string][] = [
  ['K', 'King'],
  ['Q', 'Queen'],
  ['R', 'Rook'],
  ['B', 'Bishop'],
  ['N', 'Knight'],
  ['P', 'Pawn'],
];

export const Pieces = () => (
  <div className="rf-row">
    {PIECES.map(([k, name]) => (
      <span key={k} className="rf-col">
        <span style={{ display: 'flex', gap: 2 }}>
          {['w', 'b'].map((c) => (
            <span key={c} style={{ display: 'grid', width: 40, height: 40 }}>
              <PieceImg code={`${c}${k}`} />
            </span>
          ))}
        </span>
        <span className="rf-label">{name}</span>
      </span>
    ))}
  </div>
);
