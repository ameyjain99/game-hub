/**
 * Poker as a sit-and-go tournament: Texas Hold'em, Omaha, Short Deck,
 * Seven-Card Stud and Razz. Everyone starts with the same stack, the stakes
 * rise every few hands, and the last player with chips wins.
 *
 * A hand: post the blinds (or antes), deal, then betting rounds. Between them
 * the dealer steps in by itself (`auto`): it deals the next street, and once a
 * hand's result has been on show for a moment, the next hand.
 */
import { DEALER_ID, IllegalMove, nextRandom, shuffle, type GameKit, type KitCommonAction, type KitPlayer, type KitSeat } from '../kit/engine';
import { deckFor, describeHand, evalHigh, evalLow, evalOmaha, rankValue, type Card, type HandValue, type Variant } from './cards';
import { pokerBot } from './bot';

export type { Card, Variant } from './cards';
export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'third' | 'fourth' | 'fifth' | 'sixth' | 'seventh';
export type Speed = 'fast' | 'normal' | 'slow';
export type Structure = 'no-limit' | 'pot-limit' | 'fixed-limit';

export interface VariantSpec {
  name: string;
  structure: Structure;
  /** Stud deals each player their own up and down cards; the rest share a board. */
  stud: boolean;
  /** The lowest hand wins (Razz). */
  low: boolean;
  /** Hole cards each (community games). */
  hole: number;
  maxSeats: number;
}

export const VARIANTS: Record<Variant, VariantSpec> = {
  holdem: { name: "Texas Hold'em", structure: 'no-limit', stud: false, low: false, hole: 2, maxSeats: 9 },
  omaha: { name: 'Omaha', structure: 'pot-limit', stud: false, low: false, hole: 4, maxSeats: 9 },
  shortdeck: { name: 'Short Deck', structure: 'no-limit', stud: false, low: false, hole: 2, maxSeats: 6 },
  stud: { name: 'Seven-Card Stud', structure: 'fixed-limit', stud: true, low: false, hole: 0, maxSeats: 8 },
  razz: { name: 'Razz', structure: 'fixed-limit', stud: true, low: true, hole: 0, maxSeats: 8 },
};

/** Small and big blind by level. Stud and Razz derive their stakes from them. */
export const LEVELS: [number, number][] = [
  [10, 20], [15, 30], [25, 50], [50, 100], [75, 150], [100, 200], [150, 300], [200, 400], [300, 600], [400, 800],
  [600, 1200], [800, 1600], [1000, 2000], [1500, 3000], [2000, 4000], [3000, 6000], [4000, 8000], [6000, 12000], [8000, 16000], [10000, 20000],
];
export const HANDS_PER_LEVEL: Record<Speed, number> = { fast: 6, normal: 10, slow: 15 };
export const STARTING_STACK = 1500;

const COMMUNITY_STREETS: Street[] = ['preflop', 'flop', 'turn', 'river'];
const STUD_STREETS: Street[] = ['third', 'fourth', 'fifth', 'sixth', 'seventh'];
/** Suits from lowest to highest, for Stud's bring-in. */
const SUIT_ORDER = 'CDHS';

export interface PokerPlayer extends KitPlayer {
  stack: number;
  /** Your cards. Stud deals some face up (`up`); others' face-down cards read as null. */
  hole: (Card | null)[];
  up: boolean[];
  /** Chips put in during this betting round. */
  bet: number;
  /** Chips put in during this hand (antes included). */
  total: number;
  folded: boolean;
  allIn: boolean;
  /** Has acted since the last full raise. */
  acted: boolean;
  /** Faces a raise too small to reopen the betting: may only call or fold. */
  capped: boolean;
  /** Knocked out, or left the game. */
  out: boolean;
  /** Finishing place once out (1 = the winner). */
  place: number | null;
  /** Cards turned face up at a showdown. */
  shown: boolean;
}

export interface PotResult {
  amount: number;
  /** In seat order from the button: the first takes any odd chip. */
  winners: string[];
}

export interface HandResult {
  showdown: boolean;
  pots: PotResult[];
  /** Chips each winner took. */
  won: Record<string, number>;
  /** Every shown hand's name and the five cards that make it. */
  hands: Record<string, { name: string; cards: Card[] }>;
}

export type EventKind = 'post' | 'ante' | 'bring-in' | 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'complete' | 'return' | 'street' | 'win' | 'out' | 'level';
export interface PokerEvent {
  seq: number;
  hand: number;
  kind: EventKind;
  player?: string;
  amount?: number;
  allIn?: boolean;
  street?: Street;
  /** A shown hand's name, or which blind was posted. */
  text?: string;
}

export interface PokerState {
  variant: Variant;
  speed: Speed;
  players: PokerPlayer[];
  seed: number;
  /** Cards still to deal (empty in a player's view). */
  deck: Card[];
  deckCount: number;
  /** The shared cards: the flop, turn and river; in Stud, a seventh-street card everyone shares. */
  board: Card[];
  button: number;
  hand: number;
  level: number;
  street: Street;
  /** betting: a player is to act; dealing: the dealer deals next; result: the hand's outcome is on show. */
  phase: 'betting' | 'dealing' | 'result' | 'over';
  /** The seat to act, while betting. */
  toAct: number | null;
  /** Chips from finished betting rounds (and antes). */
  pot: number;
  /** The largest bet in this round. */
  currentBet: number;
  /** The smallest raise allowed: the last full bet or raise in this round. */
  minRaise: number;
  /** Full bets and raises this round (fixed limit stops at four). */
  raises: number;
  /** Stud's third street: the bring-in hasn't been posted or completed yet. */
  bringInDue: boolean;
  result: HandResult | null;
  /** Newest first. */
  log: PokerEvent[];
  seq: number;
  over: boolean;
  winner: string | null;
}

export type PokerAction =
  | { type: 'FOLD' }
  | { type: 'CHECK' }
  | { type: 'CALL' }
  /** Bet, raise or complete: `to` is your total bet for the round. */
  | { type: 'RAISE'; to: number }
  /** Stud: post the bring-in. */
  | { type: 'BRING_IN' }
  /** The dealer: deal the next street. */
  | { type: 'DEAL' }
  /** The dealer: start the next hand. */
  | { type: 'NEXT' };

export interface PokerOptions {
  variant?: Variant;
  speed?: Speed;
}

/** The current stakes. Stud and Razz: the ante, the bring-in and the two bet sizes. */
export function stakes(s: { level: number }) {
  const [sb, bb] = LEVELS[Math.min(s.level, LEVELS.length - 1)];
  return { sb, bb, ante: Math.max(5, Math.round(bb / 25) * 5), bringIn: sb, small: bb, big: bb * 2 };
}

/** The size of a bet (and the smallest raise) on this street. */
export function betUnit(s: PokerState): number {
  const st = stakes(s);
  if (!VARIANTS[s.variant].stud) return st.bb;
  return s.street === 'third' || s.street === 'fourth' ? st.small : st.big;
}

const inHand = (p: PokerPlayer) => !p.out && !p.folded;
const canAct = (p: PokerPlayer) => inHand(p) && !p.allIn;
const needsToAct = (s: PokerState) => (p: PokerPlayer) => canAct(p) && (!p.acted || p.bet < s.currentBet);

/** The first seat after `from`, clockwise, whose player satisfies `ok`. */
function seatAfter(s: PokerState, from: number, ok: (p: PokerPlayer) => boolean): number | null {
  for (let i = 1; i <= s.players.length; i++) {
    const k = (from + i) % s.players.length;
    if (ok(s.players[k])) return k;
  }
  return null;
}

/** Seats still in the hand, clockwise from the seat after the button. */
function fromButton(s: PokerState): number[] {
  const out: number[] = [];
  for (let i = 1; i <= s.players.length; i++) {
    const k = (s.button + i) % s.players.length;
    if (inHand(s.players[k])) out.push(k);
  }
  return out;
}

function note(s: PokerState, e: Omit<PokerEvent, 'seq' | 'hand'>) {
  s.seq += 1;
  s.log = [{ ...e, seq: s.seq, hand: s.hand }, ...s.log].slice(0, 80);
}

/** Up to `amount` from a stack into the player's bet (or, for an ante, the pot). */
function pay(s: PokerState, p: PokerPlayer, amount: number, ante = false): number {
  const paid = Math.min(amount, p.stack);
  p.stack -= paid;
  p.total += paid;
  if (ante) s.pot += paid;
  else p.bet += paid;
  if (p.stack === 0) p.allIn = true;
  return paid;
}

/** A hand's value from hole cards and board (null before Omaha's flop). */
export function handValue(variant: Variant, hole: Card[], board: Card[]): HandValue | null {
  if (variant === 'omaha') return board.length >= 3 && hole.length === 4 ? evalOmaha(hole, board) : null;
  const cards = [...hole, ...board];
  if (cards.length === 0) return null;
  if (variant === 'razz') return evalLow(cards);
  return evalHigh(cards, variant === 'shortdeck');
}

/** Stud's bring-in: the lowest upcard (aces high), clubs lowest on equal ranks.
 *  Razz: the highest upcard (aces low), spades highest on equal ranks. */
export function bringInSeat(s: Pick<PokerState, 'players' | 'variant'>): number {
  const low = VARIANTS[s.variant].low;
  let best = -1;
  let bestKey = -Infinity;
  s.players.forEach((p, k) => {
    if (p.out || p.folded) return;
    const up = p.hole[2] as Card;
    const r = rankValue(up);
    const suit = SUIT_ORDER.indexOf(up[1]);
    const key = low ? (r === 14 ? 1 : r) * 4 + suit : -(r * 4 + suit);
    if (key > bestKey) {
      bestKey = key;
      best = k;
    }
  });
  return best;
}

/** After the first round: the first player clockwise from the button (Hold'em,
 *  Omaha, Short Deck), or the best hand showing (Stud: highest; Razz: lowest),
 *  the first of them from the button on a tie. An all-in leader passes it on. */
function firstToAct(s: PokerState): number {
  const spec = VARIANTS[s.variant];
  if (!spec.stud) return seatAfter(s, s.button, canAct)!;
  let best = -1;
  let bestScore = -Infinity;
  for (const k of fromButton(s)) {
    const p = s.players[k];
    const up = p.hole.filter((_, i) => p.up[i]) as Card[];
    const score = spec.low ? evalLow(up).score : evalHigh(up).score;
    if (score > bestScore) {
      bestScore = score;
      best = k;
    }
  }
  return canAct(s.players[best]) ? best : seatAfter(s, best, canAct)!;
}

const lastStreet = (s: PokerState) => s.street === 'river' || s.street === 'seventh';

function startHand(prev: PokerState, moveOn: boolean): PokerState {
  const s = structuredClone(prev);
  const spec = VARIANTS[s.variant];
  if (moveOn) {
    s.hand += 1;
    s.button = seatAfter(s, s.button, (p) => !p.out)!;
  }
  const level = Math.floor((s.hand - 1) / HANDS_PER_LEVEL[s.speed]);
  if (level !== s.level) {
    s.level = level;
    note(s, { kind: 'level', amount: stakes(s).bb });
  }
  for (const p of s.players) Object.assign(p, { hole: [], up: [], bet: 0, total: 0, folded: p.out, allIn: false, acted: false, capped: false, shown: false });
  const [deck, seed] = shuffle(deckFor(s.variant), s.seed);
  Object.assign(s, { deck, seed, board: [], pot: 0, currentBet: 0, raises: 0, bringInDue: false, result: null, toAct: null, phase: 'betting' });
  const order = fromButton(s);
  const st = stakes(s);
  const dealRound = (up: boolean) => {
    for (const k of order) {
      s.players[k].hole.push(s.deck.shift()!);
      s.players[k].up.push(up);
    }
  };

  if (spec.stud) {
    s.street = 'third';
    s.minRaise = st.small;
    for (const k of order) note(s, { kind: 'ante', player: s.players[k].id, amount: pay(s, s.players[k], st.ante, true) });
    dealRound(false);
    dealRound(false);
    dealRound(true);
    const seat = bringInSeat(s);
    if (canAct(s.players[seat])) {
      s.bringInDue = true;
      s.toAct = seat;
      s.deckCount = s.deck.length;
      return s;
    }
    s.deckCount = s.deck.length;
    return advance(s, seat);
  }

  s.street = 'preflop';
  // Heads-up the button posts the small blind.
  const sbSeat = order.length === 2 ? s.button : seatAfter(s, s.button, (p) => !p.out)!;
  const bbSeat = seatAfter(s, sbSeat, (p) => !p.out)!;
  note(s, { kind: 'post', player: s.players[sbSeat].id, amount: pay(s, s.players[sbSeat], st.sb), text: 'small blind' });
  note(s, { kind: 'post', player: s.players[bbSeat].id, amount: pay(s, s.players[bbSeat], st.bb), text: 'big blind' });
  for (let i = 0; i < spec.hole; i++) dealRound(false);
  s.deckCount = s.deck.length;
  s.currentBet = st.bb;
  s.minRaise = st.bb;
  return advance(s, bbSeat);
}

/** Whose turn it is after `from`, or the round closes. */
function advance(s: PokerState, from: number): PokerState {
  if (s.players.filter(inHand).length === 1) return finishHand(s);
  const live = s.players.filter(canAct);
  const next = seatAfter(s, from, needsToAct(s));
  // One player left who can bet, and nothing to call: nobody to bet against.
  if (next === null || (live.length === 1 && live[0].bet >= s.currentBet)) return closeRound(s);
  s.toAct = next;
  s.phase = 'betting';
  return s;
}

/** A bet nobody matched goes back to whoever made it. */
function returnUncalled(s: PokerState) {
  const bets = s.players.map((p) => p.bet).sort((a, b) => b - a);
  const [top, second = 0] = bets;
  if (top <= second) return;
  const p = s.players.find((q) => q.bet === top)!;
  const back = top - second;
  p.bet -= back;
  p.total -= back;
  p.stack += back;
  p.allIn = p.stack === 0;
  note(s, { kind: 'return', player: p.id, amount: back });
}

function collectBets(s: PokerState) {
  returnUncalled(s);
  for (const p of s.players) {
    s.pot += p.bet;
    p.bet = 0;
  }
}

function closeRound(s: PokerState): PokerState {
  collectBets(s);
  for (const p of s.players) {
    p.acted = false;
    p.capped = false;
  }
  s.currentBet = 0;
  s.raises = 0;
  s.toAct = null;
  s.bringInDue = false;
  if (lastStreet(s)) return finishHand(s);
  s.phase = 'dealing';
  return s;
}

function startRound(s: PokerState): PokerState {
  s.currentBet = 0;
  s.raises = 0;
  s.minRaise = betUnit(s);
  for (const p of s.players) {
    p.acted = false;
    p.capped = false;
  }
  if (s.players.filter(canAct).length < 2) {
    if (lastStreet(s)) return finishHand(s);
    s.phase = 'dealing';
    s.toAct = null;
    return s;
  }
  s.phase = 'betting';
  s.toAct = firstToAct(s);
  return s;
}

function dealStreet(prev: PokerState): PokerState {
  const s = structuredClone(prev);
  const spec = VARIANTS[s.variant];
  const streets = spec.stud ? STUD_STREETS : COMMUNITY_STREETS;
  s.street = streets[streets.indexOf(s.street) + 1];
  const before = s.board.length;
  if (!spec.stud) {
    s.board.push(...s.deck.splice(0, s.street === 'flop' ? 3 : 1));
  } else {
    const order = fromButton(s);
    // Not a card for everyone: one card face up in the middle, shared by all.
    if (s.deck.length < order.length) s.board.push(s.deck.shift()!);
    else
      for (const k of order) {
        s.players[k].hole.push(s.deck.shift()!);
        s.players[k].up.push(s.street !== 'seventh');
      }
  }
  s.deckCount = s.deck.length;
  // The street's shared cards, for the hand history.
  note(s, { kind: 'street', street: s.street, text: s.board.slice(before).join(' ') || undefined });
  return startRound(s);
}

/** Pots by contribution: each holds what everyone put in up to a level, and is
 *  open to the players still in who put in at least that much. */
function sidePots(s: PokerState): { amount: number; eligible: PokerPlayer[] }[] {
  const contenders = s.players.filter(inHand);
  const levels = [...new Set(contenders.map((p) => p.total))].sort((a, b) => a - b);
  const pots: { amount: number; eligible: PokerPlayer[] }[] = [];
  let prev = 0;
  for (const level of levels) {
    const amount = s.players.reduce((t, p) => t + Math.max(0, Math.min(p.total, level) - prev), 0);
    if (amount > 0) pots.push({ amount, eligible: contenders.filter((p) => p.total >= level) });
    prev = level;
  }
  return pots;
}

function finishHand(s: PokerState): PokerState {
  collectBets(s);
  const contenders = s.players.filter(inHand);
  const showdown = contenders.length > 1;
  const hands: HandResult['hands'] = {};
  let pots: { amount: number; winners: PokerPlayer[] }[];
  if (!showdown) {
    pots = [{ amount: s.pot, winners: contenders }];
  } else {
    const value = new Map(contenders.map((p) => [p.id, handValue(s.variant, p.hole as Card[], s.board)!]));
    for (const p of contenders) {
      p.shown = true;
      const v = value.get(p.id)!;
      hands[p.id] = { name: describeHand(v), cards: v.cards };
    }
    pots = sidePots(s).map(({ amount, eligible }) => {
      const best = Math.max(...eligible.map((p) => value.get(p.id)!.score));
      return { amount, winners: eligible.filter((p) => value.get(p.id)!.score === best) };
    });
  }
  // Share each pot; odd chips go one each to the winners nearest the button's left.
  const order = fromButton(s);
  const won: Record<string, number> = {};
  const results: PotResult[] = pots.map(({ amount, winners }) => {
    const seated = order.map((k) => s.players[k]).filter((p) => winners.includes(p));
    const share = Math.floor(amount / seated.length);
    let odd = amount - share * seated.length;
    for (const w of seated) {
      const take = share + (odd > 0 ? 1 : 0);
      if (odd > 0) odd -= 1;
      w.stack += take;
      won[w.id] = (won[w.id] ?? 0) + take;
    }
    return { amount, winners: seated.map((w) => w.id) };
  });
  s.pot = 0;
  for (const p of s.players) if (p.stack > 0) p.allIn = false;
  for (const [id, amount] of Object.entries(won)) note(s, { kind: 'win', player: id, amount, text: hands[id]?.name });
  s.result = { showdown, pots: results, won, hands };
  s.phase = 'result';
  s.toAct = null;
  return s;
}

function finishTournament(s: PokerState): PokerState {
  const standing = s.players.filter((p) => !p.out).sort((a, b) => b.stack - a.stack);
  standing.forEach((p, i) => (p.place = i + 1));
  s.over = true;
  s.phase = 'over';
  s.toAct = null;
  s.winner = standing[0]?.id ?? null;
  return s;
}

function nextHand(prev: PokerState): PokerState {
  const s = structuredClone(prev);
  const busted = s.players.filter((p) => !p.out && p.stack === 0);
  const remaining = s.players.filter((p) => !p.out && p.stack > 0).length;
  // A busted player put in everything they had: `total` is the stack they started the hand with.
  for (const p of busted) {
    p.place = remaining + 1 + busted.filter((q) => q.total > p.total).length;
    note(s, { kind: 'out', player: p.id, amount: p.place });
  }
  for (const p of busted) p.out = true;
  if (remaining <= 1) return finishTournament(s);
  return startHand(s, true);
}

export interface BetOptions {
  /** Chips to call (0: you may check). */
  toCall: number;
  canCheck: boolean;
  canRaise: boolean;
  /** The smallest and largest total you may bet or raise to (an all-in for less is the smallest). */
  minTo: number;
  maxTo: number;
  allInTo: number;
  /** Stud: the bring-in to post, while it's due. */
  bringIn: number | null;
  /** Nobody has bet this round: a raise is a bet. */
  isBet: boolean;
  /** Stud's third street: raising completes the bring-in to a full bet. */
  completes: boolean;
}

/** What the player to act may do. */
export function optionsFor(s: PokerState): BetOptions | null {
  if (s.phase !== 'betting' || s.toAct === null) return null;
  const p = s.players[s.toAct];
  const spec = VARIANTS[s.variant];
  const st = stakes(s);
  const unit = betUnit(s);
  const allInTo = p.bet + p.stack;
  const owe = Math.max(0, s.currentBet - p.bet);
  const others = s.players.filter((q) => q !== p && canAct(q)).length;
  const completes = spec.stud && s.street === 'third' && s.currentBet < unit;
  if (s.bringInDue) {
    const complete = Math.min(unit, allInTo);
    return { toCall: 0, canCheck: false, canRaise: p.stack > st.bringIn && others > 0, minTo: complete, maxTo: complete, allInTo, bringIn: Math.min(st.bringIn, p.stack), isBet: true, completes };
  }
  let canRaise = !p.capped && p.stack > owe && others > 0;
  let minTo: number;
  let maxTo: number;
  if (spec.structure === 'fixed-limit') {
    if (s.raises >= 4 && s.players.filter(inHand).length > 2) canRaise = false;
    minTo = maxTo = Math.min(completes ? unit : s.currentBet + unit, allInTo);
  } else {
    minTo = Math.min(s.currentBet === 0 ? unit : s.currentBet + s.minRaise, allInTo);
    maxTo = allInTo;
    if (spec.structure === 'pot-limit') {
      const bets = s.players.reduce((t, q) => t + q.bet, 0);
      maxTo = Math.min(allInTo, s.currentBet + s.pot + bets + owe);
    }
    maxTo = Math.max(maxTo, minTo);
  }
  return { toCall: Math.min(owe, p.stack), canCheck: owe === 0, canRaise, minTo, maxTo, allInTo, bringIn: null, isBet: s.currentBet === 0, completes };
}

export function createPoker(seats: KitSeat[], seed: number, options?: unknown): PokerState {
  const o = (options ?? {}) as PokerOptions;
  const variant: Variant = o.variant && VARIANTS[o.variant] ? o.variant : 'holdem';
  const speed: Speed = o.speed && HANDS_PER_LEVEL[o.speed] ? o.speed : 'normal';
  const [r, next] = nextRandom(seed);
  const s: PokerState = {
    variant,
    speed,
    seed: next,
    players: seats.map((p, i) => ({
      id: `p${i}`,
      name: p.name,
      isAI: p.isAI,
      difficulty: p.difficulty,
      stack: STARTING_STACK,
      hole: [],
      up: [],
      bet: 0,
      total: 0,
      folded: false,
      allIn: false,
      acted: false,
      capped: false,
      out: false,
      place: null,
      shown: false,
    })),
    deck: [],
    deckCount: 0,
    board: [],
    button: Math.floor(r * seats.length),
    hand: 1,
    level: 0,
    street: 'preflop',
    phase: 'betting',
    toAct: null,
    pot: 0,
    currentBet: 0,
    minRaise: 0,
    raises: 0,
    bringInDue: false,
    result: null,
    log: [],
    seq: 0,
    over: false,
    winner: null,
  };
  return startHand(s, false);
}

function applyPoker(prev: PokerState, action: PokerAction | KitCommonAction, actorId: string): PokerState {
  switch (action.type) {
    case 'REMATCH':
      if (!prev.over) throw new IllegalMove('the tournament is still going');
      return createPoker(
        prev.players.map((p) => ({ name: p.name, isAI: p.isAI, difficulty: p.difficulty })),
        nextRandom(prev.seed)[1],
        { variant: prev.variant, speed: prev.speed },
      );
    case 'RESIGN':
      return forfeit(prev, actorId);
    case 'DEAL':
      if (actorId !== DEALER_ID || prev.phase !== 'dealing') throw new IllegalMove('nothing to deal');
      return dealStreet(prev);
    case 'NEXT':
      if (actorId !== DEALER_ID || prev.phase !== 'result') throw new IllegalMove('the hand is still going');
      return nextHand(prev);
  }
  if (prev.phase !== 'betting' || prev.toAct === null || prev.players[prev.toAct].id !== actorId) throw new IllegalMove('not your turn');
  const o = optionsFor(prev)!;
  const s = structuredClone(prev);
  const k = s.toAct!;
  const p = s.players[k];
  const due = o.bringIn !== null;
  switch (action.type) {
    case 'FOLD':
      if (due) throw new IllegalMove('post the bring-in or complete');
      p.folded = true;
      p.acted = true;
      note(s, { kind: 'fold', player: p.id });
      break;
    case 'CHECK':
      if (!o.canCheck || due) throw new IllegalMove('there is a bet to call');
      p.acted = true;
      note(s, { kind: 'check', player: p.id });
      break;
    case 'CALL':
      if (o.toCall === 0 || due) throw new IllegalMove('nothing to call');
      pay(s, p, o.toCall);
      p.acted = true;
      note(s, { kind: 'call', player: p.id, amount: o.toCall, allIn: p.allIn });
      break;
    case 'BRING_IN':
      if (!due) throw new IllegalMove('no bring-in is due');
      pay(s, p, o.bringIn!);
      s.currentBet = stakes(s).bringIn;
      s.bringInDue = false;
      p.acted = true;
      note(s, { kind: 'bring-in', player: p.id, amount: p.bet, allIn: p.allIn });
      break;
    case 'RAISE': {
      const to = action.to;
      if (!o.canRaise || !Number.isInteger(to) || to < o.minTo || to > o.maxTo || to <= s.currentBet) throw new IllegalMove('not a legal bet');
      const fixed = VARIANTS[s.variant].structure === 'fixed-limit';
      const unit = betUnit(s);
      const before = s.currentBet;
      const full = fixed ? to >= (o.completes || before === 0 ? unit : before + unit) : to - before >= s.minRaise;
      pay(s, p, to - p.bet);
      if (full) {
        if (!fixed) s.minRaise = Math.max(s.minRaise, to - before);
        s.raises += 1;
        for (const q of s.players) {
          if (q === p) continue;
          q.acted = false;
          q.capped = false;
        }
      } else {
        // Short of a full raise (an all-in): those who acted may now only call or fold.
        for (const q of s.players) if (q !== p && q.acted) q.capped = true;
      }
      s.currentBet = to;
      s.bringInDue = false;
      p.acted = true;
      note(s, { kind: o.completes && before < unit ? 'complete' : before === 0 ? 'bet' : 'raise', player: p.id, amount: to, allIn: p.allIn });
      break;
    }
  }
  return advance(s, k);
}

function forfeit(prev: PokerState, id: string): PokerState {
  const k = prev.players.findIndex((p) => p.id === id);
  if (k < 0 || prev.players[k].out || prev.over) return prev;
  const s = structuredClone(prev);
  const p = s.players[k];
  const wasTurn = s.phase === 'betting' && s.toAct === k;
  p.place = s.players.filter((q) => !q.out).length;
  // Their stack leaves the table; chips already bet stay in the pot.
  Object.assign(p, { folded: true, acted: true, out: true, stack: 0 });
  note(s, { kind: 'out', player: p.id, amount: p.place });
  const live = s.players.filter((q) => !q.out);
  if (live.length === 1) {
    live[0].stack += s.pot + s.players.reduce((t, q) => t + q.bet, 0);
    s.pot = 0;
    for (const q of s.players) q.bet = 0;
    return finishTournament(s);
  }
  if (s.phase === 'betting') {
    if (s.players.filter(inHand).length === 1) return finishHand(s);
    if (wasTurn) return advance(s, k);
  }
  return s;
}

/** A player's view: others' face-down cards hidden until shown, and no deck or seed. */
export function redactPoker(s: PokerState, viewer: string): PokerState {
  return {
    ...s,
    seed: 0,
    deck: [],
    deckCount: s.deck.length,
    players: s.players.map((p) => (p.id === viewer || p.shown ? p : { ...p, hole: p.hole.map((c, i) => (p.up[i] ? c : null)) })),
  };
}

export const pokerKit: GameKit<PokerState, PokerAction> = {
  seatError(count, options) {
    const v = VARIANTS[((options ?? {}) as PokerOptions).variant ?? 'holdem'] ?? VARIANTS.holdem;
    if (count < 2) return 'Poker needs at least 2 players';
    return count > v.maxSeats ? `${v.name} seats at most ${v.maxSeats} players` : null;
  },
  create: createPoker,
  apply: applyPoker,
  actor: (s) => (s.phase === 'betting' && s.toAct !== null ? s.players[s.toAct].id : null),
  players: (s) => s.players,
  isOver: (s) => s.over,
  bot: (s, rand = Math.random) => pokerBot(s, rand),
  timeout(s) {
    const o = optionsFor(s);
    if (o?.bringIn != null) return { type: 'BRING_IN' };
    return o?.canCheck ? { type: 'CHECK' } : { type: 'FOLD' };
  },
  botDelay: () => 1000,
  auto(s) {
    if (s.phase === 'dealing') return { action: { type: 'DEAL' }, delay: s.players.filter(canAct).length < 2 ? 1400 : 700 };
    if (s.phase === 'result') return { action: { type: 'NEXT' }, delay: s.result?.showdown ? 4800 : 2200 };
    return null;
  },
  setBot: (s, id, difficulty) => ({ ...s, players: s.players.map((p) => (p.id === id ? { ...p, isAI: true, difficulty } : p)) }),
  forfeit,
  end: (s) => (s.over ? s : finishTournament(structuredClone(s))),
  redact: redactPoker,
  turnMs: 30_000,
};
