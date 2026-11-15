/** Checkers' rule-book pictures: men and kings as the board draws them. */
import { Disc } from './CheckersGame';

const Box = ({ piece, label }: { piece: number; label: string }) => (
  <span className="rf-col">
    <span style={{ display: 'grid', placeItems: 'center', width: 52, height: 52, background: '#6b4f3a', borderRadius: 6 }}>
      <Disc piece={piece} />
    </span>
    <span className="rf-label">{label}</span>
  </span>
);

export const Pieces = () => (
  <div className="rf-row">
    <Box piece={1} label="Black man" />
    <Box piece={2} label="Black king" />
    <Box piece={-1} label="White man" />
    <Box piece={-2} label="White king" />
  </div>
);
