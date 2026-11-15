/** Minesweeper's rule-book pictures: the squares as the field draws them. */
import type { CSSProperties, ReactNode } from 'react';
import { FlagGlyph, MineGlyph } from './MinesweeperGame';

const SIZE = { '--cell': '38px', width: 38, height: 38 } as CSSProperties;

function Square({ cls, label, children }: { cls: string; label: string; children?: ReactNode }) {
  return (
    <span className="rf-col">
      <span className={`ms-cell ${cls}`} style={SIZE}>
        {children}
      </span>
      <span className="rf-label">{label}</span>
    </span>
  );
}

export const Squares = () => (
  <div className="rf-row">
    <Square cls="" label="Unopened" />
    <Square cls="is-open n0" label="Open, no mines near" />
    {[1, 2, 3].map((n) => (
      <Square key={n} cls={`is-open n${n}`} label={`${n} mine${n === 1 ? '' : 's'} next to it`}>
        <b>{n}</b>
      </Square>
    ))}
    <Square cls="" label="Flagged">
      <FlagGlyph />
    </Square>
    <Square cls="is-open is-mine" label="A mine">
      <MineGlyph />
    </Square>
  </div>
);
