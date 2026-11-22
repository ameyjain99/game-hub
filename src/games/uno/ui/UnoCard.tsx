import type { CSSProperties } from 'react';
import { Ban, FlipVertical2, Repeat2 } from '../../../shared/icons';
import { Layers } from 'lucide-react';
import type { Face } from '../engine';

export const COLOR_HEX: Record<string, string> = {
  red: '#E5383B',
  yellow: '#F2B705',
  green: '#20A464',
  blue: '#2B6BE0',
  pink: '#FF4F8B',
  teal: '#14C3A2',
  orange: '#FF9F1C',
  purple: '#9B6BFF',
};

export const COLOR_NAME: Record<string, string> = {
  red: 'Red',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  pink: 'Pink',
  teal: 'Teal',
  orange: 'Orange',
  purple: 'Purple',
};

const DARK = new Set(['pink', 'teal', 'orange', 'purple']);

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
    case 'wild-draw-color':
      return 'Wild Hunt';
    case 'discard-all':
      return `${c}Discard All`;
    case 'wild-reverse-draw':
      return `Wild Reverse Draw ${f.value}`;
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
        <span className="uno-stack">
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
    case 'wild-draw-color':
      return <b>+?</b>;
    case 'wild':
      return <b className="uno-w">W</b>;
    case 'discard-all':
      return (
        <span className="uno-stack">
          <Layers size={size} strokeWidth={2.4} />
          <i>all</i>
        </span>
      );
    case 'wild-reverse-draw':
      return (
        <span className="uno-stack">
          <Repeat2 size="0.7em" strokeWidth={2.8} />
          <i>+{f.value}</i>
        </span>
      );
  }
}

/**
 * A Uno face: light faces are solid colour with a white glyph; dark faces
 * are night-blue with a glowing glyph in their colour; wilds carry a four-colour
 * wheel. `back` draws the classic deck's back.
 */
export function UnoCard({
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
      <span className={`uno-card is-back${className ? ` ${className}` : ''}`} style={style} aria-hidden="true">
        <span className="uno-back-mark">LC</span>
      </span>
    );
  }
  const dark = face.color ? DARK.has(face.color) : side === 'dark' || face.kind === 'wild-draw-color';
  const wild = face.color === null;
  const cls = ['uno-card', dark ? 'is-dark' : 'is-light', wild ? 'is-wild' : ''];
  if (className) cls.push(className);
  return (
    <span className={cls.join(' ')} style={{ '--cc': face.color ? COLOR_HEX[face.color] : '#1d1f26', ...style } as CSSProperties} title={title ?? faceName(face)}>
      <span className="uno-corner">
        <Glyph f={face} />
      </span>
      <span className="uno-face">
        {wild && <span className="uno-wheel" />}
        <span className="uno-glyph">
          <Glyph f={face} />
        </span>
      </span>
      <span className="uno-corner is-flip">
        <Glyph f={face} />
      </span>
    </span>
  );
}
