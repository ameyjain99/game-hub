/** Scrabble's rule-book pictures: tiles with their values, and the premium squares. */
import type { CSSProperties } from 'react';
import { TileFace } from './ScrabbleGame';

const CELL: CSSProperties = { display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: 6, containerType: 'inline-size' };

export const Tiles = () => (
  <div className="rf-row rf-wg">
    {['W', 'O', 'R', 'D', 'Q', 'Z', '?'].map((l, i) => (
      <span key={i} className="rf-col">
        <span style={{ ...CELL, background: '#2a2f3b' }}>
          <TileFace letter={l} blank={l === '?'} />
        </span>
        <span className="rf-label">{l === '?' ? 'Blank: any letter, 0' : `${l}`}</span>
      </span>
    ))}
  </div>
);

const PREMIUMS: [string, string, string][] = [
  ['dl', '2L', 'Double letter'],
  ['tl', '3L', 'Triple letter'],
  ['dw', '2W', 'Double word'],
  ['tw', '3W', 'Triple word'],
];

export const Premiums = () => (
  <div className="rf-row">
    {PREMIUMS.map(([k, label, name]) => (
      <span key={k} className="rf-col">
        <span className={`scrabble-cell is-${k}`} style={CELL}>
          <span className="scrabble-prem" style={{ fontSize: 12 }}>
            {label}
          </span>
        </span>
        <span className="rf-label">{name}</span>
      </span>
    ))}
  </div>
);
