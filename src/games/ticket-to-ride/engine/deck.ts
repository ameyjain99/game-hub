import type { GameState, Hand, TrainCard } from './types';
import { CARD_COLORS } from './types';
import { DECK_COMPOSITION } from './data/deck';
import { makeRng, type Rng } from '../../../shared/rng';

export function emptyHand(): Hand {
  return {
    red: 0,
    orange: 0,
    yellow: 0,
    green: 0,
    blue: 0,
    purple: 0,
    white: 0,
    black: 0,
    locomotive: 0,
  };
}

/** In-place Fisher-Yates using the injected rng. */
export function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function buildDrawPile(
  rng: Rng,
  deck: Record<TrainCard, number> = DECK_COMPOSITION,
): TrainCard[] {
  const cards: TrainCard[] = [];
  const kinds: TrainCard[] = [...CARD_COLORS, 'locomotive'];
  for (const kind of kinds) {
    for (let i = 0; i < deck[kind]; i++) cards.push(kind);
  }
  return shuffle(cards, rng);
}

/**
 * Draw the top card (end of drawPile). If empty, reshuffle the discard pile
 * into a new draw pile first. Returns null card if no cards remain anywhere.
 */
export function drawOne(state: GameState): { card: TrainCard | null; state: GameState } {
  let drawPile = state.drawPile;
  let discardPile = state.discardPile;
  let rngState = state.rngState;

  if (drawPile.length === 0) {
    if (discardPile.length === 0) return { card: null, state };
    const rng = makeRng(rngState);
    drawPile = shuffle([...discardPile], rng);
    discardPile = [];
    rngState = rng.state;
  }

  const next = [...drawPile];
  const card = next.pop()!;
  return { card, state: { ...state, drawPile: next, discardPile, rngState } };
}

const MARKET_SIZE = 5;

/**
 * Fill the face-up market to 5. If a full market ever shows 3+ locomotives,
 * discard all 5 and redeal. Stops if the deck can no longer fill the market.
 */
export function dealMarket(state: GameState): GameState {
  let s = state;

  const fill = (from: GameState): GameState => {
    let cur = from;
    const market = [...cur.market];
    while (market.length < MARKET_SIZE) {
      const { card, state: after } = drawOne(cur);
      if (card === null) break;
      market.push(card);
      cur = after;
    }
    return { ...cur, market };
  };

  s = fill(s);

  // Redeal loop: only applies to a full 5-card market.
  let guard = 0;
  while (
    s.market.length === MARKET_SIZE &&
    s.market.filter((c) => c === 'locomotive').length >= 3 &&
    guard < 20
  ) {
    guard++;
    s = { ...s, discardPile: [...s.discardPile, ...s.market], market: [] };
    s = fill(s);
  }

  return s;
}
