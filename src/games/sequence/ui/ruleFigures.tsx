/** Sequence's rule-book pictures: the team chips and the four kinds of Jack. */
import type { CSSProperties } from 'react';
import { PlayingCard } from '../../kit/ui/PlayingCard';
import { TEAM_COLOR, TEAM_NAME } from './SequenceGame';

const SIZE = { '--pc-w': '44px' } as CSSProperties;

export const Chips = () => (
  <div className="rf-row">
    {TEAM_COLOR.map((c, i) => (
      <span key={c} className="rf-col">
        <span style={{ position: 'relative', width: 36, height: 36 }}>
          <span className="seq-chip" style={{ '--tc': c, animation: 'none' } as CSSProperties} />
        </span>
        <span className="rf-label">{TEAM_NAME[i]}</span>
      </span>
    ))}
  </div>
);

export const Jacks = () => (
  <div className="rf-row">
    <span className="rf-col">
      <span className="rf-row" style={{ gap: 4 }}>
        <PlayingCard card="JD" style={SIZE} />
        <PlayingCard card="JC" style={SIZE} />
      </span>
      <span className="rf-label">Two-eyed: place anywhere</span>
    </span>
    <span className="rf-col">
      <span className="rf-row" style={{ gap: 4 }}>
        <PlayingCard card="JH" style={SIZE} />
        <PlayingCard card="JS" style={SIZE} />
      </span>
      <span className="rf-label">One-eyed: remove a chip</span>
    </span>
  </div>
);
