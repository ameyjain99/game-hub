// Monopoly's cues, on the shared sound engine (src/shared/sound.ts). Every cue
// is soft and short; `soundCues` decides, from one state change, which play on
// a given player's screen.

import type { MonopolyState } from '../engine/state';
import { completedSets } from '../engine/selectors';
import { noise, playTimeWarning, playTurn, tone, withAudio } from '../../../shared/sound';

export type Cue =
  | 'dice'
  | 'card'
  | 'jail'
  | 'buy'
  | 'bid'
  | 'sold'
  | 'auctionClosed'
  | 'tradeOffer'
  | 'tradeDone'
  | 'tradeDeclined'
  | 'set'
  | 'pay'
  | 'receive'
  | 'turn';

const currentId = (s: MonopolyState) => s.players[s.turnOrder[s.current]]?.id;
const cashOf = (s: MonopolyState, id: string) => s.players.find((p) => p.id === id)?.cash ?? 0;

/** Whether a trade that just left the table went through (its lots or money moved). */
function tradeWentThrough(prev: MonopolyState, next: MonopolyState): boolean {
  const t = prev.pendingTrade!;
  const lots = [
    ...t.give.properties.map((id) => next.ownership[id].owner === t.to),
    ...t.receive.properties.map((id) => next.ownership[id].owner === t.from),
  ];
  if (lots.length > 0) return lots.every(Boolean);
  const before = prev.players.find((p) => p.id === t.from)!;
  const after = next.players.find((p) => p.id === t.from)!;
  return after.cash !== before.cash || after.getOutCards !== before.getOutCards;
}

/**
 * The cues one state change makes on `meId`'s screen, in the order they play.
 * Money moving in or out of the viewer's own balance sounds as a payment or
 * income, unless a more specific cue (a purchase, a sale, a trade) already
 * accounts for it.
 */
export function soundCues(prev: MonopolyState, next: MonopolyState, meId: string): Cue[] {
  if (prev === next) return [];
  const cues: Cue[] = [];
  let moneyExplained = false;

  if (next.rollSeq > prev.rollSeq) cues.push('dice');

  const card = next.lastCard;
  const lastCard = prev.lastCard;
  if (card && (!lastCard || card.atRoll !== lastCard.atRoll || card.text !== lastCard.text)) cues.push('card');

  if (next.players.some((p) => p.inJail && !prev.players.find((q) => q.id === p.id)?.inJail)) cues.push('jail');

  // A lot taken from the bank by a purchase (an auction win is a sale, below).
  const auctioned = prev.pendingAuction?.spaceId;
  const bought = Object.keys(next.ownership)
    .map(Number)
    .filter((id) => id !== auctioned && !prev.ownership[id].owner && next.ownership[id].owner);
  if (bought.length > 0) {
    cues.push('buy');
    if (bought.some((id) => next.ownership[id].owner === meId)) moneyExplained = true;
  }

  if (prev.pendingAuction && next.pendingAuction && next.pendingAuction.highBid > prev.pendingAuction.highBid) {
    cues.push('bid');
  }
  if (prev.pendingAuction && !next.pendingAuction) {
    const winner = next.ownership[prev.pendingAuction.spaceId].owner;
    cues.push(winner ? 'sold' : 'auctionClosed');
    if (winner === meId) moneyExplained = true;
  }

  if (!prev.pendingTrade && next.pendingTrade?.to === meId) cues.push('tradeOffer');
  if (prev.pendingTrade && !next.pendingTrade) {
    const done = tradeWentThrough(prev, next);
    cues.push(done ? 'tradeDone' : 'tradeDeclined');
    if (done && (prev.pendingTrade.from === meId || prev.pendingTrade.to === meId)) moneyExplained = true;
  }

  const setsBefore = new Map(completedSets(prev).map((s) => [s.group, s.owner]));
  if (completedSets(next).some((s) => setsBefore.get(s.group) !== s.owner)) cues.push('set');

  const delta = cashOf(next, meId) - cashOf(prev, meId);
  if (delta !== 0 && !moneyExplained) cues.push(delta > 0 ? 'receive' : 'pay');

  const myTurnNow = currentId(next) === meId && (next.phase === 'roll' || next.phase === 'jail');
  if (myTurnNow && currentId(prev) !== meId) cues.push('turn');

  return cues;
}

/** A dice rattle: a few quick clicks, like two dice tumbling on a board. */
function playDice(): void {
  withAudio((ac, t) => {
    [0, 0.05, 0.11, 0.18].forEach((dt, i) => noise(ac, t + dt, { dur: 0.03, peak: 0.07 - i * 0.012, band: 2600, q: 2 }));
  });
}

/** The faintest tick for each square a token walks. */
export function playStep(): void {
  withAudio((ac, t) => tone(ac, t, { freq: 1000, to: 700, glide: 0.03, type: 'triangle', peak: 0.025, decay: 0.04 }), {
    queue: false,
  });
}

/** A purchase: two bright, rising notes. */
function playBuy(): void {
  withAudio((ac, t) => {
    tone(ac, t, { freq: 880, peak: 0.09, decay: 0.16 });
    tone(ac, t + 0.08, { freq: 1318.5, peak: 0.08, decay: 0.28 });
  });
}

/** Money out: a soft falling pair. */
function playPay(): void {
  withAudio((ac, t) => {
    tone(ac, t, { freq: 392, peak: 0.08, decay: 0.18 });
    tone(ac, t + 0.1, { freq: 293.7, peak: 0.07, decay: 0.26 });
  });
}

/** Money in: a soft rising pair. */
function playReceive(): void {
  withAudio((ac, t) => {
    tone(ac, t, { freq: 587.3, peak: 0.08, decay: 0.16 });
    tone(ac, t + 0.09, { freq: 784, peak: 0.08, decay: 0.26 });
  });
}

/** A card turned over: a short papery whoosh. */
function playCard(): void {
  withAudio((ac, t) => noise(ac, t, { dur: 0.13, peak: 0.05, band: 3800, q: 0.7 }));
}

/** Off to jail: a low, muted clunk. */
function playJail(): void {
  withAudio((ac, t) => tone(ac, t, { freq: 170, to: 90, glide: 0.2, type: 'triangle', peak: 0.13, decay: 0.3 }));
}

/** A raise in an auction: one light knock. */
function playBid(): void {
  withAudio((ac, t) => tone(ac, t, { freq: 660, to: 520, glide: 0.05, type: 'triangle', peak: 0.07, decay: 0.07 }));
}

/** Sold: two wooden gavel knocks. */
function playSold(): void {
  withAudio((ac, t) => {
    [0, 0.13].forEach((dt) => tone(ac, t + dt, { freq: 300, to: 120, glide: 0.07, type: 'triangle', peak: 0.15, decay: 0.1 }));
  });
}

/** An auction that ends without a sale: a single soft knock. */
function playAuctionClosed(): void {
  withAudio((ac, t) => tone(ac, t, { freq: 260, to: 130, glide: 0.08, type: 'triangle', peak: 0.08, decay: 0.12 }));
}

/** A trade offer for you: a gentle two-note doorbell. */
function playTradeOffer(): void {
  withAudio((ac, t) => {
    tone(ac, t, { freq: 659.3, peak: 0.1, attack: 0.02, decay: 0.3 });
    tone(ac, t + 0.18, { freq: 523.3, peak: 0.09, attack: 0.02, decay: 0.4 });
  });
}

/** A trade that went through: a short major arpeggio. */
function playTradeDone(): void {
  withAudio((ac, t) => {
    [523.3, 659.3, 784].forEach((freq, i) => tone(ac, t + i * 0.07, { freq, peak: 0.08, decay: 0.24 }));
  });
}

/** A trade turned down (or that fell through): a soft minor step down. */
function playTradeDeclined(): void {
  withAudio((ac, t) => {
    tone(ac, t, { freq: 329.6, type: 'triangle', peak: 0.07, decay: 0.2 });
    tone(ac, t + 0.12, { freq: 261.6, type: 'triangle', peak: 0.06, decay: 0.3 });
  });
}

/** A colour set completed: a bright, rising bell arpeggio. */
function playSet(): void {
  withAudio((ac, t) => {
    [523.3, 659.3, 784, 1046.5].forEach((freq, i) => tone(ac, t + i * 0.09, { freq, peak: 0.1, attack: 0.02, decay: 0.6 }));
  });
}

export const PLAY: Record<Cue, () => void> = {
  dice: playDice,
  card: playCard,
  jail: playJail,
  buy: playBuy,
  bid: playBid,
  sold: playSold,
  auctionClosed: playAuctionClosed,
  tradeOffer: playTradeOffer,
  tradeDone: playTradeDone,
  tradeDeclined: playTradeDeclined,
  set: playSet,
  pay: playPay,
  receive: playReceive,
  turn: playTurn,
};

export { playTimeWarning };
