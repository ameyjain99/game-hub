import type { CSSProperties } from 'react';
import { Ban, FlipVertical2, Repeat2 } from '../../../shared/icons';
import type { Face } from '../engine';

export const COLOR_HEX: Record<string, string> = {
  red: '#E5383B',
  yellow: '#F2B705',
  green: '#20A464',
  blue: '#2B6BE0',
  rose: '#FF4F8B',
  jade: '#14C3A2',
  amber: '#FF9F1C',
  violet: '#9B6BFF',
};

export const COLOR_NAME: Record<string, string> = {
  red: 'Red',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  rose: 'Rose',
  jade: 'Jade',
  amber: 'Amber',
  violet: 'Violet',
};

const DARK = new Set(['rose', 'jade', 'amber', 'violet']);

/** "Red 7", "Blue Skip", "Wild Draw 4"... */
export function faceName(f: Face): string {
  const c = f.color ? `${COLOR_NAME[f.color]} ` : '';
  switch (f.kind) {
    case 'number':
      return `${c}${f.value}`;
    case 'skip':
      return `${c}Skip`;
    case 'skip-all':
      return `${c}Skip Everyone`;
    case 'reverse':
      return `${c}Reverse`;
    case 'draw':
      return `${c}Draw ${f.value}`;
    case 'flip':
      return `${c}Flip`;
    case 'wild':
      return 'Wild';
    case 'wild-draw':
      return `Wild Draw ${f.value}`;
    case 'wild-hunt':
      return 'Wild Hunt';
  }
}

function Glyph({ f }: { f: Face }) {
  const size = '1em';
  switch (f.kind) {
    case 'number':
      return <b>{f.value}</b>;
    case 'skip':
      return <Ban size={size} strokeWidth={2.6} />;
    case 'skip-all':
      return (
        <span className="lc-stack">
          <Ban size={size} strokeWidth={2.6} />
          <i>all</i>
        </span>
      );
    case 'reverse':
      return <Repeat2 size={size} strokeWidth={2.6} />;
    case 'flip':
      return <FlipVertical2 size={size} strokeWidth={2.4} />;
    case 'draw':
    case 'wild-draw':
      return <b>+{f.value}</b>;
    case 'wild-hunt':
      return <b>+?</b>;
    case 'wild':
      return <b className="lc-w">W</b>;
  }
}

/**
 * A Last Card face: light faces are solid colour with a white glyph; dark faces
 * are night-blue with a glowing glyph in their colour; wilds carry a four-colour
 * wheel. `back` draws the classic deck's back.
 */
export function LcCard({
  face,
  side,
  back,
  className,
  style,
  title,
}: {
  face?: Face | null;
  /** Which side the face belongs to (wilds look different on each). */
  side?: 'light' | 'dark';
  back?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
}) {
  if (back || !face) {
    return (
      <span className={`lc-card is-back${className ? ` ${className}` : ''}`} style={style} aria-hidden="true">
        <span className="lc-back-mark">LC</span>
      </span>
    );
  }
  const dark = face.color ? DARK.has(face.color) : side === 'dark' || face.kind === 'wild-hunt';
  const wild = face.color === null;
  const cls = ['lc-card', dark ? 'is-dark' : 'is-light', wild ? 'is-wild' : ''];
  if (className) cls.push(className);
  return (
    <span className={cls.join(' ')} style={{ '--cc': face.color ? COLOR_HEX[face.color] : '#1d1f26', ...style } as CSSProperties} title={title ?? faceName(face)}>
      <span className="lc-corner">
        <Glyph f={face} />
      </span>
      <span className="lc-face">
        {wild && <span className="lc-wheel" />}
        <span className="lc-glyph">
          <Glyph f={face} />
        </span>
      </span>
      <span className="lc-corner is-flip">
        <Glyph f={face} />
      </span>
    </span>
  );
}
