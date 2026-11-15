/** Tic-Tac-Toe's rule-book picture: a won round. */
import { MarkGlyph } from './TttGame';

const BOARD = ['X', 'O', '', '', 'X', 'O', '', '', 'X'] as const;

export const ThreeInARow = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 44px)', gap: 3, background: '#ffffff26', borderRadius: 8, padding: 3 }}>
    {BOARD.map((m, i) => (
      <span key={i} style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, background: '#15161b', borderRadius: 5 }}>
        {m && <MarkGlyph mark={m} />}
      </span>
    ))}
  </div>
);
