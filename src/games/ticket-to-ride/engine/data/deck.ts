import type { TrainCard } from '../types';

/** Train-car deck: 12 of each of 8 colors + 14 locomotives = 124 cards. */
export const DECK_COMPOSITION: Record<TrainCard, number> = {
  red: 12,
  orange: 12,
  yellow: 12,
  green: 12,
  blue: 12,
  purple: 12,
  white: 12,
  black: 12,
  locomotive: 14,
};
