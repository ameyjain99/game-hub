import type { CSSProperties, ReactNode } from 'react';
import { CARD_NAME, type Kind } from '../engine';

/** What each card does, in the words printed under its picture. */
const CARD_TEXT: Record<Kind, string> = {
  exploding: 'Show it at once. Without a Defuse, you explode.',
  defuse: 'Stops a Kitten. Put it back in the pile, anywhere.',
  nope: 'Stops any action. Play it at any time.',
  attack: 'End your turn without drawing. The next player takes 2 turns.',
  skip: 'End your turn without drawing.',
  favor: 'A player you choose gives you a card of theirs.',
  shuffle: 'Shuffle the draw pile.',
  future: 'Look at the top 3 cards of the draw pile.',
  tacocat: 'No power alone. Play a pair to steal a card.',
  cattermelon: 'No power alone. Play a pair to steal a card.',
  potato: 'No power alone. Play a pair to steal a card.',
  beard: 'No power alone. Play a pair to steal a card.',
  rainbow: 'No power alone. Play a pair to steal a card.',
};

/** Each card's colour: its band, and the ground its picture stands on. */
const CARD_COLOR: Record<Kind, string> = {
  exploding: '#17171b',
  defuse: '#3fa34d',
  nope: '#d6343c',
  attack: '#ef8a17',
  skip: '#2f7de1',
  favor: '#4b4f5c',
  shuffle: '#a8703a',
  future: '#d44a9c',
  tacocat: '#8d95a3',
  cattermelon: '#8d95a3',
  potato: '#8d95a3',
  beard: '#8d95a3',
  rainbow: '#8d95a3',
};

/** A cat's head, ears up: the shape every picture in the deck is built round. */
const HEAD = 'M13 27L17 9l12 9q3-.6 6 0L47 9l4 18q4 9 0 18-6 11-19 11T13 45q-4-9 0-18Z';

function Face({ ink = '#17171b', eyes = 'open' }: { ink?: string; eyes?: 'open' | 'flat' | 'wide' }) {
  return (
    <g fill={ink} stroke={ink} strokeLinecap="round">
      {eyes === 'flat' ? (
        <path d="M21 33h8M35 33h8" strokeWidth="3" fill="none" />
      ) : (
        <>
          <circle cx="25" cy="33" r={eyes === 'wide' ? 4 : 2.6} stroke="none" />
          <circle cx="39" cy="33" r={eyes === 'wide' ? 4 : 2.6} stroke="none" />
        </>
      )}
      <path d="M30 39h4l-2 2.4Z" stroke="none" />
      <path d="M27 44q5 3 10 0" strokeWidth="1.8" fill="none" />
    </g>
  );
}

const ART: Record<Kind, ReactNode> = {
  exploding: (
    <>
      <path d="M32 2l6 11 12-5-3 13 13 3-10 9 8 11-13 0 0 13-10-8-9 9-2-13-13 0 8-10L6 26l13-3-2-13 11 5Z" fill="#f2b705" />
      <path d="M32 9l4 9 9-3-3 9 9 3-7 6 5 8-9 0-1 9-7-6-7 6-1-9-9 0 5-8-7-6 9-3-3-9 9 3Z" fill="#e5484d" />
      <path d={HEAD} fill="#17171b" transform="translate(9.6 12) scale(.7)" />
      <g fill="#fff">
        <circle cx="27" cy="35" r="3.4" />
        <circle cx="37" cy="35" r="3.4" />
      </g>
      <g fill="#17171b">
        <circle cx="27" cy="35.6" r="1.4" />
        <circle cx="37" cy="35.6" r="1.4" />
      </g>
    </>
  ),
  defuse: (
    <>
      <path d="M32 6l19 7v15c0 14-8 23-19 28C21 51 13 42 13 28V13Z" fill="#fff" />
      <path d="M22 31l7 8 14-16" fill="none" stroke="#3fa34d" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  nope: (
    <>
      <path d={HEAD} fill="#fff" />
      <Face eyes="flat" />
      <circle cx="32" cy="32" r="27" fill="none" stroke="#fff" strokeWidth="5" />
      <path d="M13 51L51 13" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
    </>
  ),
  attack: (
    <g fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round">
      <path d="M14 12q10 20 4 40" />
      <path d="M30 9q10 22 4 46" />
      <path d="M46 12q10 20 4 40" />
    </g>
  ),
  skip: (
    <g fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 14l18 18-18 18" />
      <path d="M34 14l18 18-18 18" />
    </g>
  ),
  favor: (
    <>
      <path d="M32 54C6 36 13 12 32 25c19-13 26 11 0 29Z" fill="#fff" />
      <path d="M14 14l3-10 9 8ZM50 14l-3-10-9 8Z" fill="#fff" />
    </>
  ),
  shuffle: (
    <g fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 20h8c14 0 14 24 28 24h10" />
      <path d="M8 44h8c14 0 14-24 28-24h10" />
      <path d="M48 13l7 7-7 7M48 37l7 7-7 7" />
    </g>
  ),
  future: (
    <>
      <path d="M4 32q28-30 56 0-28 30-56 0Z" fill="#fff" />
      <circle cx="32" cy="32" r="12" fill="#f2b705" />
      <ellipse cx="32" cy="32" rx="3.4" ry="11" fill="#17171b" />
    </>
  ),
  tacocat: (
    <>
      <path d={HEAD} fill="#c98a4b" transform="translate(6.4 0) scale(.8)" />
      <g transform="translate(6.4 0) scale(.8)">
        <Face />
      </g>
      <path d="M6 44a26 22 0 0 1 52 0v4H6Z" fill="#f2b84b" />
      <path d="M10 40q4-6 8 0t8 0 8 0 8 0 8 0 4-2" fill="none" stroke="#3fa34d" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  cattermelon: (
    <>
      <path d={HEAD} fill="#3aa35a" />
      <path d="M20 14q-3 14 0 36M32 17v38M44 14q3 14 0 36" fill="none" stroke="#237a40" strokeWidth="3" strokeLinecap="round" />
      <g fill="#17171b">
        <circle cx="25" cy="32" r="2.6" />
        <circle cx="39" cy="32" r="2.6" />
      </g>
      <path d="M21 39h22q-2 12-11 12T21 39Z" fill="#e5484d" />
      <g fill="#17171b">
        <circle cx="28" cy="44" r="1.2" />
        <circle cx="32" cy="46" r="1.2" />
        <circle cx="36" cy="44" r="1.2" />
      </g>
    </>
  ),
  potato: (
    <>
      <path d="M12 22l3-12 10 9M52 22l-3-12-10 9" fill="#b88a5a" />
      <path d="M12 34c0-14 9-20 20-20s22 4 21 20-10 22-22 22-19-8-19-22Z" fill="#b88a5a" />
      <g fill="none" stroke="#6b4a2a" strokeWidth="1.8" strokeLinecap="round">
        <path d="M14 26l-6-4M12 34H5M14 43l-6 4M50 26l6-4M52 34h7M50 43l6 4M24 15l-2-6M32 14V7M40 15l2-6M24 54l-2 6M32 56v6M40 54l2 6" />
      </g>
      <Face />
    </>
  ),
  beard: (
    <>
      <path d={HEAD} fill="#e7dfd0" />
      <Face />
      <path d="M14 36q2 26 18 26t18-26q-8 8-18 8T14 36Z" fill="#5b3a22" />
      <path d="M24 42q4 4 8 0 4 4 8 0" fill="none" stroke="#e7dfd0" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  rainbow: (
    <>
      <g fill="none" strokeWidth="5" strokeLinecap="round">
        <path d="M30 44q2 14 26 16" stroke="#e5484d" />
        <path d="M34 42q4 10 24 12" stroke="#f2b705" />
        <path d="M38 40q5 6 20 8" stroke="#2f7de1" />
      </g>
      <path d={HEAD} fill="#fff" transform="translate(-2 -2) scale(.86)" />
      <g transform="translate(-2 -2) scale(.86)">
        <Face eyes="wide" />
      </g>
    </>
  ),
};

interface Props {
  /** The card's face; null draws its back. */
  kind: Kind | null;
  className?: string;
  style?: CSSProperties;
}

/** One card, face up or face down. Its size follows the `--lw` custom property (the card's width). */
export function EkCard({ kind, className = '', style }: Props) {
  if (!kind) {
    return (
      <span className={`ek-card is-back ${className}`} style={style} aria-hidden="true">
        <svg viewBox="0 0 64 64" className="ek-art">
          <path d={HEAD} fill="#e5484d" />
          <g fill="#17171b">
            <circle cx="25" cy="33" r="3.4" />
            <circle cx="39" cy="33" r="3.4" />
          </g>
          <path d="M32 18q-1-8 6-11" fill="none" stroke="#f2b705" strokeWidth="3" strokeLinecap="round" />
          <circle cx="39" cy="6" r="3" fill="#f2b705" />
        </svg>
      </span>
    );
  }
  return (
    <span className={`ek-card is-${kind} ${className}`} style={{ '--cc': CARD_COLOR[kind], ...style } as CSSProperties}>
      <span className="ek-card-name">{CARD_NAME[kind]}</span>
      <svg viewBox="0 0 64 64" className="ek-art" aria-hidden="true">
        {ART[kind]}
      </svg>
      <span className="ek-card-text">{CARD_TEXT[kind]}</span>
    </span>
  );
}
