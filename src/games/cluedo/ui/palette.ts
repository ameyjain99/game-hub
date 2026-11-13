import type { Card, Suspect } from '../engine/cards';
import { SUSPECTS, WEAPONS } from '../engine/cards';

/** Canonical Cluedo character colours. */
export const SUSPECT_COLOR: Record<Suspect, string> = {
  'Miss Scarlett': '#e2483b',
  'Colonel Mustard': '#e8c84a',
  'Mrs White': '#e8edf2',
  'Mr Green': '#3faa6a',
  'Mrs Peacock': '#3f7fd0',
  'Professor Plum': '#9b5fd0',
};

/** Pale suspect colours need dark text on top of them. */
export const inkOn = (s: Suspect): string => (s === 'Mrs White' || s === 'Colonel Mustard' ? '#14151a' : '#ffffff');

/** Short label for a character token: "Miss Scarlett" → "S", "Mr Green" → "G". */
export const suspectInitial = (s: Suspect): string => s.split(' ').slice(-1)[0][0];

export type CardKind = 'suspect' | 'weapon' | 'room';

export function kindOf(card: Card): CardKind {
  if ((SUSPECTS as readonly string[]).includes(card)) return 'suspect';
  if ((WEAPONS as readonly string[]).includes(card)) return 'weapon';
  return 'room';
}
