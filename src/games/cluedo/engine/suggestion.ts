import type { Card, Triple } from './cards';

/**
 * The clockwise order in which players attempt to disprove a suggestion: starts
 * with the player after the suggester and wraps around, excluding the suggester.
 */
export function disproveOrder(playerIds: string[], suggesterId: string): string[] {
  const i = playerIds.indexOf(suggesterId);
  return [...playerIds.slice(i + 1), ...playerIds.slice(0, i)];
}

export interface Disproof {
  playerId: string;
  /** The suggested cards this player holds (what they could show). */
  matches: Card[];
}

/**
 * The first player (in disprove order) who holds any of the three suggested
 * cards, together with every suggested card they hold. Null if no one can.
 */
export function firstDisprover(
  playerIds: string[],
  suggesterId: string,
  suggestion: Triple,
  hands: Record<string, Card[]>,
): Disproof | null {
  const named: Card[] = [suggestion.suspect, suggestion.weapon, suggestion.room];
  for (const id of disproveOrder(playerIds, suggesterId)) {
    const matches = (hands[id] ?? []).filter((c) => named.includes(c));
    if (matches.length > 0) return { playerId: id, matches };
  }
  return null;
}
