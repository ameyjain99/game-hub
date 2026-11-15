/** Solitaire's rule-book pictures, drawn with the game's playing cards. */
import type { CSSProperties } from 'react';
import { PlayingCard } from '../../kit/ui/PlayingCard';

const SIZE = { '--pc-w': '44px' } as CSSProperties;

export const Builds = () => (
  <div className="rf-row" style={{ gap: 28, alignItems: 'flex-start' }}>
    <span className="rf-col">
      <span style={{ display: 'grid' }}>
        {['KS', 'QH', 'JC', 'TD'].map((c, i) => (
          <span key={c} style={{ gridArea: '1 / 1', marginTop: i * 18 }}>
            <PlayingCard card={c} style={SIZE} />
          </span>
        ))}
      </span>
      <span className="rf-label">Tableau: down by one, red and black in turn</span>
    </span>
    <span className="rf-col">
      <span className="rf-row" style={{ gap: 4 }}>
        {['AH', '2H', '3H'].map((c) => (
          <PlayingCard key={c} card={c} style={SIZE} />
        ))}
      </span>
      <span className="rf-label">Foundation: up by one, one suit</span>
    </span>
  </div>
);
