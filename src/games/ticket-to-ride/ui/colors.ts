import type { RouteColor, TrainCard } from '../engine/types';

/**
 * Card/route color -> display hex. Chosen for strong separation in BOTH hue and
 * lightness so neighbours don't blur together:
 *   red / orange / yellow  – warm ramp, clearly different lightness
 *   purple ("pink")        – magenta pink, NOT violet
 *   white / grey / black   – light / mid / dark, wide lightness spread
 */
export const COLOR_HEX: Record<RouteColor | 'locomotive', string> = {
  red: '#d42c25',
  orange: '#e77e1c',
  yellow: '#f5cc17',
  green: '#5aa62c',
  blue: '#2f8fd0',
  purple: '#e85fae', // "pink"
  white: '#fbfaf3',
  grey: '#a9adb2',
  black: '#26262c',
  locomotive: '#8e44ad',
};

/**
 * A darker companion for each color, used everywhere a color needs an edge:
 * empty-slot outlines, affordable-glow strokes, card borders. Kept in lockstep
 * with COLOR_HEX so changing a color updates its variants too.
 */
export const COLOR_BORDER: Record<RouteColor | 'locomotive', string> = {
  red: '#9c1f1a',
  orange: '#a95810',
  yellow: '#c7a40a',
  green: '#3b7519',
  blue: '#1c6aa0',
  purple: '#b23f80',
  white: '#c2b9a0', // tan edge so white reads on the parchment map
  grey: '#787c82',
  black: '#000000',
  locomotive: '#5a3a70',
};

/** Cards light enough that a number printed on them needs dark ink. */
const LIGHT_CARDS = new Set<TrainCard>(['yellow', 'white']);

/** Ink colour for a count/label drawn directly on a card face, for contrast. */
export function cardText(card: TrainCard): string {
  return LIGHT_CARDS.has(card) ? '#15151a' : '#ffffff';
}

/** CSS background for a card face – the loco is a rainbow sweep, others solid. */
/** The locomotive card's rainbow, shared by the CSS card face and SVG ferry slots. */
export const LOCO_STOPS = ['#e74c3c', '#f39c12', '#2ecc71', '#3498db', '#e85fae'];
export const LOCO_GRADIENT = `linear-gradient(135deg,${LOCO_STOPS.join(',')})`;

export function cardHex(card: TrainCard): string {
  return COLOR_HEX[card];
}

export function cardBorder(card: TrainCard): string {
  return COLOR_BORDER[card];
}

/** Per-seat player token colors (up to 5) – distinct from each other. */
export const PLAYER_COLORS = ['#d1352b', '#2f6fdb', '#2fa84f', '#e8a41c', '#333338'];

export function playerColor(index: number): string {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

/** Mix a #rrggbb hex toward white by `amount` (0..1) – used to brighten highlights. */
export function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
