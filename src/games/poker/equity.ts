import { deckFor, type Card } from './cards';
import { handValue, type Variant } from './engine';

/**
 * Each player's chance of winning from here, when the hands are face up and
 * only the board is left to come (an all-in). Worked out by dealing the rest
 * of the board many times; a split pot counts as a share for each winner.
 * Community-card games only (Hold'em, Omaha, Short Deck).
 */
export function winChances(
  variant: Variant,
  hands: { id: string; hole: Card[] }[],
  board: Card[],
  rand: () => number = Math.random,
  deals = 400,
): Record<string, number> {
  const seen = new Set([...board, ...hands.flatMap((h) => h.hole)]);
  const rest = deckFor(variant).filter((c) => !seen.has(c));
  const need = 5 - board.length;
  const share: Record<string, number> = Object.fromEntries(hands.map((h) => [h.id, 0]));
  const runs = need === 0 ? 1 : deals;
  for (let n = 0; n < runs; n++) {
    // The first `need` cards of a partial shuffle.
    const deck = rest.slice();
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(rand() * (deck.length - i));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const full = [...board, ...deck.slice(0, need)];
    const scores = hands.map((h) => handValue(variant, h.hole, full)?.score ?? -1);
    const best = Math.max(...scores);
    const winners = hands.filter((_, i) => scores[i] === best);
    for (const w of winners) share[w.id] += 1 / winners.length;
  }
  return Object.fromEntries(hands.map((h) => [h.id, share[h.id] / runs]));
}
