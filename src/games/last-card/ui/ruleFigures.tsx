/** Last Card's rule-book pictures, drawn with the game's own cards. */
import type { CSSProperties, ReactNode } from 'react';
import type { Face } from '../engine';
import { LcCard } from './LcCard';

const SIZE = { '--lw': '52px' } as CSSProperties;

function Named({ face, side = 'light', name }: { face: Face; side?: 'light' | 'dark'; name: string }) {
  return (
    <span className="rf-col">
      <LcCard face={face} side={side} style={SIZE} />
      <span className="rf-label">{name}</span>
    </span>
  );
}

const Row = ({ children }: { children: ReactNode }) => <div className="rf-row">{children}</div>;

export const ClassicCards = () => (
  <Row>
    <Named face={{ kind: 'number', color: 'red', value: 7 }} name="Number" />
    <Named face={{ kind: 'skip', color: 'yellow' }} name="Skip" />
    <Named face={{ kind: 'reverse', color: 'green' }} name="Reverse" />
    <Named face={{ kind: 'draw', color: 'blue', value: 2 }} name="Draw 2" />
    <Named face={{ kind: 'wild', color: null }} name="Wild" />
    <Named face={{ kind: 'wild-draw', color: null, value: 4 }} name="Wild Draw 4" />
  </Row>
);

export const FlipCards = () => (
  <>
    <Row>
      <Named face={{ kind: 'draw', color: 'red', value: 1 }} name="Draw 1" />
      <Named face={{ kind: 'flip', color: 'blue' }} name="Flip" />
      <Named face={{ kind: 'wild-draw', color: null, value: 2 }} name="Wild Draw 2" />
    </Row>
    <Row>
      <Named side="dark" face={{ kind: 'skip-all', color: 'rose' }} name="Skip Everyone" />
      <Named side="dark" face={{ kind: 'draw', color: 'jade', value: 5 }} name="Draw 5" />
      <Named side="dark" face={{ kind: 'wild-hunt', color: null }} name="Wild Draw Colour" />
    </Row>
  </>
);

export const Matching = () => (
  <Row>
    <Named face={{ kind: 'number', color: 'green', value: 7 }} name="On the pile" />
    <Named face={{ kind: 'number', color: 'green', value: 3 }} name="Same colour: yes" />
    <Named face={{ kind: 'number', color: 'blue', value: 7 }} name="Same number: yes" />
    <Named face={{ kind: 'number', color: 'red', value: 4 }} name="Neither: no" />
  </Row>
);
