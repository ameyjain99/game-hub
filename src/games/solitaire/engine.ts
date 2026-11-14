/**
 * Klondike solitaire – the classic "Solitaire".
 *
 * Seven tableau piles are dealt with 1–7 cards, the top one face up; the rest
 * of the deck is the stock. Build the tableau down in alternating colours (a
 * red Queen on a black King); any face-up run moves as a unit, and only a King
 * (or a run headed by one) fills an empty pile. Build the four foundations up by
 * suit from Ace to King. Turn the stock one card or three at a time onto the
 * waste, with unlimited passes. A face-down card left on top of a pile turns
 * over. All 52 cards on the foundations wins.
 *
 * Scoring follows Windows Solitaire: waste → tableau +5, waste or tableau →
 * foundation +10, turning a tableau card +5, foundation → tableau -15, and
 * recycling the waste when drawing one at a time -100 (never below 0).
 */
import { shuffle } from '../kit/engine';

export type DrawMode = 1 | 3;

export interface TableauPile {
  cards: string[];
  /** How many cards from the top are face up. */
  up: number;
}

export interface SolState {
  stock: string[];
  waste: string[];
  foundations: string[][];
  tableau: TableauPile[];
  draw: DrawMode;
  moves: number;
  score: number;
  won: boolean;
}

export type Place = { pile: 'waste' } | { pile: 'foundation'; index: number } | { pile: 'tableau'; index: number; from?: number };
export type SolAction = { type: 'DRAW' } | { type: 'MOVE'; from: Place; to: { pile: 'foundation' | 'tableau'; index: number } };

const SUITS = ['S', 'H', 'D', 'C'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
export const rankOf = (card: string) => RANKS.indexOf(card[0]) + 1;
const red = (card: string) => card[1] === 'H' || card[1] === 'D';

export function newDeal(seed: number, draw: DrawMode): SolState {
  const [deck] = shuffle(
    SUITS.flatMap((s) => RANKS.map((r) => r + s)),
    seed,
  );
  let at = 0;
  const tableau = Array.from({ length: 7 }, (_, i) => {
    const cards = deck.slice(at, at + i + 1);
    at += i + 1;
    return { cards, up: 1 };
  });
  return { stock: deck.slice(at).reverse(), waste: [], foundations: [[], [], [], []], tableau, draw, moves: 0, score: 0, won: false };
}

/** Whether `card` may go on a tableau pile topped by `top` (undefined = empty). */
export const fitsTableau = (card: string, top: string | undefined) =>
  top === undefined ? rankOf(card) === 13 : red(card) !== red(top) && rankOf(card) === rankOf(top) - 1;

/** Whether `card` may go on foundation `pile`. */
export const fitsFoundation = (card: string, pile: string[]) =>
  pile.length === 0 ? rankOf(card) === 1 : card[1] === pile[pile.length - 1][1] && rankOf(card) === pile.length + 1;

/** The cards a place would move (a tableau run, or a single top card). */
export function cardsAt(s: SolState, from: Place): string[] {
  if (from.pile === 'waste') return s.waste.slice(-1);
  if (from.pile === 'foundation') return s.foundations[from.index].slice(-1);
  const pile = s.tableau[from.index];
  const start = from.from ?? pile.cards.length - 1;
  if (start < pile.cards.length - pile.up || start < 0) return []; // face down
  return pile.cards.slice(start);
}

export function canMove(s: SolState, from: Place, to: { pile: 'foundation' | 'tableau'; index: number }): boolean {
  const cards = cardsAt(s, from);
  if (cards.length === 0) return false;
  if (to.pile === 'foundation') return cards.length === 1 && from.pile !== 'foundation' && fitsFoundation(cards[0], s.foundations[to.index]);
  if (from.pile === 'tableau' && from.index === to.index) return false;
  return fitsTableau(cards[0], s.tableau[to.index].cards.at(-1));
}

const isWon = (f: string[][]) => f.every((p) => p.length === 13);

export function applySol(s: SolState, action: SolAction): SolState {
  if (s.won) return s;
  if (action.type === 'DRAW') {
    if (s.stock.length === 0) {
      if (s.waste.length === 0) return s;
      return { ...s, stock: [...s.waste].reverse(), waste: [], moves: s.moves + 1, score: s.draw === 1 ? Math.max(0, s.score - 100) : s.score };
    }
    const n = Math.min(s.draw, s.stock.length);
    const drawn = s.stock.slice(-n).reverse();
    return { ...s, stock: s.stock.slice(0, -n), waste: [...s.waste, ...drawn], moves: s.moves + 1 };
  }
  const { from, to } = action;
  if (!canMove(s, from, to)) return s;
  const cards = cardsAt(s, from);
  let { waste, foundations, tableau, score } = s;
  tableau = tableau.map((p) => ({ ...p, cards: [...p.cards] }));
  foundations = foundations.map((p) => [...p]);

  // Take the cards off.
  if (from.pile === 'waste') {
    waste = waste.slice(0, -1);
    score += to.pile === 'tableau' ? 5 : 10;
  } else if (from.pile === 'foundation') {
    foundations[from.index].pop();
    score -= 15;
  } else {
    const pile = tableau[from.index];
    pile.cards.splice(pile.cards.length - cards.length, cards.length);
    pile.up -= cards.length;
    if (to.pile === 'foundation') score += 10;
    if (pile.up === 0 && pile.cards.length > 0) {
      pile.up = 1; // the card beneath turns over
      score += 5;
    }
  }
  // Put them down.
  if (to.pile === 'foundation') foundations[to.index].push(cards[0]);
  else {
    const pile = tableau[to.index];
    pile.cards.push(...cards);
    pile.up += cards.length;
  }
  return { ...s, waste, foundations, tableau, score: Math.max(0, score), moves: s.moves + 1, won: isWon(foundations) };
}

/** The foundation `card` would go to, if any. */
export function foundationFor(s: SolState, card: string): number | null {
  const i = s.foundations.findIndex((p) => fitsFoundation(card, p));
  return i >= 0 ? i : null;
}

/**
 * Where a click on `from` should send it: to a foundation if it can (a single
 * card), else to the best tableau pile (one with cards before an empty one).
 */
export function autoTarget(s: SolState, from: Place): { pile: 'foundation' | 'tableau'; index: number } | null {
  const cards = cardsAt(s, from);
  if (cards.length === 0) return null;
  if (cards.length === 1 && from.pile !== 'foundation') {
    const f = foundationFor(s, cards[0]);
    if (f !== null) return { pile: 'foundation', index: f };
  }
  const order = s.tableau.map((p, i) => ({ i, empty: p.cards.length === 0 })).sort((a, b) => Number(a.empty) - Number(b.empty));
  for (const { i, empty } of order) {
    // Don't shuffle a King from one empty-bottomed pile to another empty pile.
    if (empty && from.pile === 'tableau' && (from.from ?? 0) === 0 && s.tableau[from.index].cards.length === cards.length) continue;
    if (canMove(s, from, { pile: 'tableau', index: i })) return { pile: 'tableau', index: i };
  }
  return null;
}

/** A helpful move to suggest, or 'draw' to turn the stock, or null when stuck. */
export function hint(s: SolState): { from: Place; to: { pile: 'foundation' | 'tableau'; index: number } } | 'draw' | null {
  // 1. Anything to a foundation.
  const singles: Place[] = [{ pile: 'waste' }, ...s.tableau.map((_, index) => ({ pile: 'tableau' as const, index }))];
  for (const from of singles) {
    const card = cardsAt(s, from)[0];
    if (!card) continue;
    const f = foundationFor(s, card);
    if (f !== null) return { from, to: { pile: 'foundation', index: f } };
  }
  // 2. A tableau run that uncovers a face-down card (or empties a pile for a King).
  for (let i = 0; i < 7; i++) {
    const p = s.tableau[i];
    if (p.cards.length === 0) continue;
    const start = p.cards.length - p.up;
    if (start === 0 && rankOf(p.cards[0]) === 13) continue; // a King already at the bottom
    const from: Place = { pile: 'tableau', index: i, from: start };
    for (let j = 0; j < 7; j++) if (canMove(s, from, { pile: 'tableau', index: j })) return { from, to: { pile: 'tableau', index: j } };
  }
  // 3. The waste card onto the tableau.
  for (let j = 0; j < 7; j++) if (canMove(s, { pile: 'waste' }, { pile: 'tableau', index: j })) return { from: { pile: 'waste' }, to: { pile: 'tableau', index: j } };
  if (s.stock.length > 0 || s.waste.length > 0) return 'draw';
  return null;
}

/** Whether everything is face up with the stock and waste spent, so the rest plays itself. */
export const canAutoFinish = (s: SolState) => !s.won && s.stock.length === 0 && s.waste.length === 0 && s.tableau.every((p) => p.up === p.cards.length);

/** The next card the auto-finish sends home. */
export function autoFinishStep(s: SolState): SolAction | null {
  for (let i = 0; i < 7; i++) {
    const card = s.tableau[i].cards.at(-1);
    if (!card) continue;
    const f = foundationFor(s, card);
    if (f !== null) return { type: 'MOVE', from: { pile: 'tableau', index: i }, to: { pile: 'foundation', index: f } };
  }
  return null;
}
