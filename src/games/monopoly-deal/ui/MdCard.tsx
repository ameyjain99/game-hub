import type { CSSProperties } from 'react';
import { COLORS, COLOR_NAME, RENT, SET_SIZE, type ActionKind, type Color, type MdCard as Card } from '../engine';
import { MONOPOLY_MONEY } from '../../monopoly/engine/board';

export const COLOR_HEX: Record<Color, string> = {
  brown: '#8b5a2b',
  lightblue: '#9fd8f0',
  pink: '#d84a9a',
  orange: '#f08a1c',
  red: '#e03131',
  yellow: '#f4d21f',
  green: '#2f9e44',
  darkblue: '#1c4fb5',
  railroad: '#2b2d33',
  utility: '#c2cf73',
};
/** Colours pale enough to need dark lettering. */
const PALE: Color[] = ['lightblue', 'yellow', 'utility'];
export const inkOn = (color: Color) => (PALE.includes(color) ? '#17171b' : '#ffffff');

/** An amount in millions, as the cards print it. */
export const money = (n: number) => `${MONOPOLY_MONEY}${n}M`;

const MONEY_HEX: Record<number, string> = { 1: '#f1e3a0', 2: '#f4b6a0', 3: '#bfe3b4', 4: '#b3d4f0', 5: '#d3bdf0', 10: '#f2c14e' };

/** What an action card says under its name. */
const ACTION_TEXT: Record<ActionKind, string> = {
  'deal-breaker': 'Take a full set from any player, buildings and all.',
  'just-say-no': 'Cancel an action played against you.',
  'sly-deal': 'Take a property from any player. Not from a full set.',
  'forced-deal': 'Swap a property with any player. Not from a full set.',
  'debt-collector': `One player pays you ${money(5)}.`,
  birthday: `Every player pays you ${money(2)}.`,
  'pass-go': 'Draw 2 more cards.',
  house: `Adds ${money(3)} to the rent of a full set.`,
  hotel: `Adds ${money(4)} to the rent of a full set with a House.`,
  'double-rent': 'Play with a Rent card to double it.',
};

const ACTION_HEX: Record<ActionKind, string> = {
  'deal-breaker': '#7c4dba',
  'just-say-no': '#2f7de1',
  'sly-deal': '#14868c',
  'forced-deal': '#c2570c',
  'debt-collector': '#55606e',
  birthday: '#d84a9a',
  'pass-go': '#c79a1b',
  house: '#2f9e44',
  hotel: '#e03131',
  'double-rent': '#b3261e',
};

/** The band across a wild or rent card: its colours side by side. */
const bands = (colors: Color[]) => {
  const list = colors.length === COLORS.length ? (['red', 'orange', 'yellow', 'green', 'lightblue', 'darkblue', 'pink'] as Color[]) : colors;
  const step = 100 / list.length;
  return `linear-gradient(90deg, ${list.map((c, i) => `${COLOR_HEX[c]} ${i * step}% ${(i + 1) * step}%`).join(', ')})`;
};

interface Props {
  card: Card | null;
  /** The colour a wild is lying in, shown first. */
  as?: Color;
  className?: string;
  style?: CSSProperties;
}

/** One card, face up (or face down when `card` is null). Its width is the `--lw` custom property. */
export function MdCard({ card, as, className = '', style }: Props) {
  if (!card) return <span className={`md-card is-back ${className}`} style={style} aria-hidden="true" />;
  const value = card.value > 0 ? <span className="md-card-value">{money(card.value)}</span> : null;
  if (card.kind === 'money') {
    return (
      <span className={`md-card is-money ${className}`} style={{ '--cc': MONEY_HEX[card.value], ...style } as CSSProperties}>
        {value}
        <span className="md-card-big">{money(card.value)}</span>
      </span>
    );
  }
  if (card.kind === 'property' || card.kind === 'wild') {
    const color = card.kind === 'property' ? card.colors[0] : as;
    const any = card.colors.length === COLORS.length;
    const ladder = color ?? (any ? undefined : card.colors[0]);
    return (
      <span className={`md-card is-property ${className}`} style={style}>
        <span className="md-card-band" style={{ background: color && card.kind === 'property' ? COLOR_HEX[color] : bands(card.colors), color: color && card.kind === 'property' ? inkOn(color) : '#17171b' }}>
          {card.kind === 'property' ? card.name : any ? 'Property Wild Card' : card.colors.map((c) => COLOR_NAME[c]).join(' / ')}
        </span>
        {value}
        {card.kind === 'wild' && <span className="md-card-kicker">{any ? 'Any colour' : as ? `Wild, lying as ${COLOR_NAME[as]}` : 'Wild'}</span>}
        {ladder && (
          <span className="md-card-rents">
            {RENT[ladder].map((r, i) => (
              <span key={i} className={i + 1 === SET_SIZE[ladder] ? 'is-full' : ''}>
                <i>{i + 1 === SET_SIZE[ladder] ? 'Set' : i + 1}</i>
                <b>{money(r)}</b>
              </span>
            ))}
          </span>
        )}
      </span>
    );
  }
  if (card.kind === 'rent') {
    return (
      <span className={`md-card is-rent ${className}`} style={style}>
        {value}
        <span className="md-card-disc" style={{ background: bands(card.colors) }}>
          <b>Rent</b>
        </span>
        <span className="md-card-text">{card.colors.length === COLORS.length ? 'One player pays rent on any colour of yours.' : `Every player pays rent on your ${card.colors.map((c) => COLOR_NAME[c]).join(' or ')}.`}</span>
      </span>
    );
  }
  const kind = card.action!;
  return (
    <span className={`md-card is-action ${className}`} style={{ '--cc': ACTION_HEX[kind], ...style } as CSSProperties}>
      {value}
      <span className="md-card-disc">
        <b>{card.name}</b>
      </span>
      <span className="md-card-text">{ACTION_TEXT[kind]}</span>
    </span>
  );
}
