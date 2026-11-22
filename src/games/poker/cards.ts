/**
 * Poker cards and hand values. A card is two characters: its rank (2-9, T, J,
 * Q, K, A) then its suit (S, H, D, C), e.g. "TS" is the ten of spades.
 *
 * Every evaluator returns a `score` where higher is better, so any two hands
 * scored the same way compare with `>`; equal scores split the pot.
 */

export type Card = string;
export type Variant = 'holdem' | 'omaha' | 'shortdeck' | 'stud' | 'razz';

const RANKS = '23456789TJQKA';
const SUITS = 'SHDC';

/** 2..14 (ace high). */
export const rankValue = (c: Card) => RANKS.indexOf(c[0]) + 2;

/** The deck a variant deals from: 52 cards, or 36 (6 to ace) for Short Deck. */
export function deckFor(variant: Variant): Card[] {
  const ranks = variant === 'shortdeck' ? '6789TJQKA' : RANKS;
  const out: Card[] = [];
  for (const s of SUITS) for (const r of ranks) out.push(r + s);
  return out;
}

type Category =
  | 'high-card'
  | 'pair'
  | 'two-pair'
  | 'trips'
  | 'straight'
  | 'flush'
  | 'full-house'
  | 'quads'
  | 'straight-flush';

export interface HandValue {
  /** Higher is better, among hands scored the same way. */
  score: number;
  category: Category;
  /** The five cards that make the hand. */
  cards: Card[];
  /** The ranks that decide it, most important first (aces are 1 in a low hand). */
  ranks: number[];
  /** Scored as an ace-to-five low (Razz). */
  low?: boolean;
}

const HIGH_ORDER: Category[] = ['high-card', 'pair', 'two-pair', 'trips', 'straight', 'flush', 'full-house', 'quads', 'straight-flush'];
/** Short Deck: three of a kind beats a straight, and a flush beats a full house. */
const SHORT_ORDER: Category[] = ['high-card', 'pair', 'two-pair', 'straight', 'trips', 'full-house', 'flush', 'quads', 'straight-flush'];

function packed(lead: number, ranks: number[]): number {
  let s = lead;
  for (let i = 0; i < 5; i++) s = s * 16 + (ranks[i] ?? 0);
  return s;
}

const byRankDesc = (a: Card, b: Card) => rankValue(b) - rankValue(a);

/** The highest straight among `cards`: its top rank and its five cards. */
function straightIn(cards: Card[], shortDeck: boolean): { top: number; cards: Card[] } | null {
  const at = new Map<number, Card>();
  for (const c of cards) if (!at.has(rankValue(c))) at.set(rankValue(c), c);
  const runs: number[][] = [];
  for (let top = 14; top >= (shortDeck ? 10 : 6); top--) runs.push([top, top - 1, top - 2, top - 3, top - 4]);
  // The ace also plays low: A-2-3-4-5, or A-6-7-8-9 without the small cards.
  runs.push(shortDeck ? [9, 8, 7, 6, 14] : [5, 4, 3, 2, 14]);
  for (const run of runs) {
    if (run.every((r) => at.has(r))) return { top: run[0], cards: run.map((r) => at.get(r)!) };
  }
  return null;
}

/** The best five-card high hand from 5 to 7 cards (Hold'em, Stud, Short Deck). */
export function evalHigh(cards: Card[], shortDeck = false): HandValue {
  const order = shortDeck ? SHORT_ORDER : HIGH_ORDER;
  const sorted = [...cards].sort(byRankDesc);
  const groups = new Map<number, Card[]>();
  const suits = new Map<string, Card[]>();
  for (const c of sorted) {
    groups.set(rankValue(c), [...(groups.get(rankValue(c)) ?? []), c]);
    suits.set(c[1], [...(suits.get(c[1]) ?? []), c]);
  }
  // Rank groups, largest first, then highest.
  const g = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || b[0] - a[0]);
  const kickers = (used: Card[], n: number) => sorted.filter((c) => !used.includes(c)).slice(0, n);

  const found: { category: Category; ranks: number[]; cards: Card[] }[] = [];
  const flushSuit = [...suits.values()].find((s) => s.length >= 5);
  if (flushSuit) {
    const sf = straightIn(flushSuit, shortDeck);
    if (sf) found.push({ category: 'straight-flush', ranks: [sf.top], cards: sf.cards });
    const five = flushSuit.slice(0, 5);
    found.push({ category: 'flush', ranks: five.map(rankValue), cards: five });
  }
  if (g[0][1].length === 4) {
    const k = kickers(g[0][1], 1);
    found.push({ category: 'quads', ranks: [g[0][0], ...k.map(rankValue)], cards: [...g[0][1], ...k] });
  }
  if (g[0][1].length === 3) {
    const pair = g.slice(1).find(([, cs]) => cs.length >= 2);
    if (pair) found.push({ category: 'full-house', ranks: [g[0][0], pair[0]], cards: [...g[0][1], ...pair[1].slice(0, 2)] });
    const k = kickers(g[0][1], 2);
    found.push({ category: 'trips', ranks: [g[0][0], ...k.map(rankValue)], cards: [...g[0][1], ...k] });
  }
  const st = straightIn(sorted, shortDeck);
  if (st) found.push({ category: 'straight', ranks: [st.top], cards: st.cards });
  if (g[0][1].length === 2 && g[1]?.[1].length === 2) {
    const used = [...g[0][1], ...g[1][1]];
    const k = kickers(used, 1);
    found.push({ category: 'two-pair', ranks: [g[0][0], g[1][0], ...k.map(rankValue)], cards: [...used, ...k] });
  } else if (g[0][1].length === 2) {
    const k = kickers(g[0][1], 3);
    found.push({ category: 'pair', ranks: [g[0][0], ...k.map(rankValue)], cards: [...g[0][1], ...k] });
  }
  const top = sorted.slice(0, 5);
  found.push({ category: 'high-card', ranks: top.map(rankValue), cards: top });

  let best: HandValue | null = null;
  for (const f of found) {
    const score = packed(order.indexOf(f.category), f.ranks);
    if (!best || score > best.score) best = { ...f, score };
  }
  return best!;
}

/** All k-card combinations of `items`. */
function combos<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  const [first, ...rest] = items;
  return [...combos(rest, k - 1).map((c) => [first, ...c]), ...combos(rest, k)];
}

/** Omaha: exactly two of the hole cards with exactly three from the board. */
export function evalOmaha(hole: Card[], board: Card[]): HandValue {
  let best: HandValue | null = null;
  for (const two of combos(hole, 2)) {
    for (const three of combos(board, 3)) {
      const v = evalHigh([...two, ...three]);
      if (!best || v.score > best.score) best = v;
    }
  }
  return best!;
}

/** Low-hand shapes, best first: no pair, then pairs and worse. */
const LOW_CATEGORY: Category[] = ['high-card', 'pair', 'two-pair', 'trips', 'full-house', 'quads'];

function lowShape(counts: number[]): number {
  if (counts[0] === 4) return 5;
  if (counts[0] === 3) return counts[1] === 2 ? 4 : 3;
  if (counts[0] === 2) return counts[1] === 2 ? 2 : 1;
  return 0;
}

/** Razz: the best ace-to-five low from up to seven cards (fewer for a Stud
 *  board still being dealt). Aces are low; straights and flushes don't count;
 *  the lowest highest card wins, then the next, and so on. */
export function evalLow(cards: Card[]): HandValue {
  const low = (c: Card) => (rankValue(c) === 14 ? 1 : rankValue(c));
  let best: HandValue | null = null;
  for (const five of combos(cards, Math.min(5, cards.length))) {
    const groups = new Map<number, Card[]>();
    for (const c of five) groups.set(low(c), [...(groups.get(low(c)) ?? []), c]);
    const g = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || b[0] - a[0]);
    const shape = lowShape(g.map(([, cs]) => cs.length));
    const ranks = g.map(([r]) => r);
    const score = -packed(shape, ranks);
    if (!best || score > best.score) best = { score, category: LOW_CATEGORY[shape], cards: g.flatMap(([, cs]) => cs), ranks, low: true };
  }
  return best!;
}

const NAMES = ['', 'ace', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king', 'ace'];
const name = (r: number) => NAMES[r];
const plural = (r: number) => (r === 6 ? 'sixes' : `${NAMES[r]}s`);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const short = (r: number) => (r === 1 || r === 14 ? 'A' : r === 10 ? '10' : r > 10 ? 'JQK'[r - 11] : String(r));

/** A hand's name: "Two pair, kings and sevens", "Royal flush", or a low "8-7-4-2-A". */
export function describeHand(v: HandValue): string {
  const [a, b] = v.ranks;
  if (v.low && v.category === 'high-card') return v.ranks.map(short).join('-');
  switch (v.category) {
    case 'straight-flush':
      return a === 14 ? 'Royal flush' : `Straight flush, ${name(a)} high`;
    case 'quads':
      return `Four ${plural(a)}`;
    case 'full-house':
      return `Full house, ${plural(a)} full of ${plural(b)}`;
    case 'flush':
      return `Flush, ${name(a)} high`;
    case 'straight':
      return `Straight, ${name(a)} high`;
    case 'trips':
      return `Three ${plural(a)}`;
    case 'two-pair':
      return `Two pair, ${plural(a)} and ${plural(b)}`;
    case 'pair':
      return `Pair of ${plural(a)}`;
    case 'high-card':
      return `${cap(name(a))} high`;
  }
}
