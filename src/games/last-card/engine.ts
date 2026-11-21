/**
 * Last Card - a colour-matching shedding game, in two modes.
 *
 * Play a card that matches the colour or the symbol of the top of the discard
 * pile, or a wild; otherwise draw one (and you may play it at once if it fits).
 * Action cards skip, reverse or make the next player draw; wilds set the colour.
 * Down to one card, you call "Last card" - a player caught without calling draws
 * two. Empty your hand to win the hand and score the cards left in everyone
 * else's.
 *
 * Classic: 108 cards - per colour one 0, two each of 1-9, Skip, Reverse and
 * Draw 2; plus four Wilds and four Wild Draw 4s (a Wild Draw 4 only when you
 * have nothing of the colour in play).
 *
 * Flip: every card has a light face and a dark face. A Flip card turns the whole
 * table over - hands, draw pile and discard - and play continues on the other
 * side, where the actions are harsher: Draw 5, Skip Everyone, and a Wild that
 * makes the next player draw until they find the chosen colour. You can always
 * see the other face of everyone else's cards.
 *
 * No Mercy: a bigger, harsher deck of 152 with no limits. Draw cards always
 * stack (answer with any draw card as big or bigger); with nothing to play you
 * draw until a card fits, and must play it; Draw 4s come in colours, the wild
 * draws are 6 and 10, a Wild Reverse Draw 4 sends four back the way they came,
 * Discard All sheds a whole colour, a 7 swaps hands and a 0 passes every hand
 * on. Reach 25 cards and you are out of the hand.
 */
import { IllegalMove, nextRandom, shuffle, type GameKit, type KitCommonAction, type KitPlayer, type KitSeat } from '../kit/engine';

export type Variant = 'classic' | 'flip' | 'unlimited';
/** No Mercy: this many cards in hand knocks a player out of the hand. */
export const MERCY = 25;
export type Side = 'light' | 'dark';
export const LIGHT_COLORS = ['red', 'yellow', 'green', 'blue'] as const;
export const DARK_COLORS = ['rose', 'jade', 'amber', 'violet'] as const;
export type Color = (typeof LIGHT_COLORS)[number] | (typeof DARK_COLORS)[number];
export type Kind = 'number' | 'skip' | 'reverse' | 'draw' | 'wild' | 'wild-draw' | 'flip' | 'skip-all' | 'wild-hunt' | 'discard-all' | 'wild-reverse-draw';

export interface Face {
  kind: Kind;
  /** Null for wilds. */
  color: Color | null;
  /** The number, or how many a draw card gives. */
  value?: number;
}

export interface Card {
  id: number;
  /** A face is null where the viewer can't see it. */
  light: Face | null;
  dark: Face | null;
}

export interface LcPlayer extends KitPlayer {
  hand: Card[];
  handCount: number;
  /** Left the table for good. */
  out?: boolean;
  /** No Mercy: knocked out of this hand for holding too many cards. */
  bust?: boolean;
}

export interface LcEvent {
  player: string;
  kind: 'play' | 'draw' | 'pass' | 'call' | 'catch' | 'penalty' | 'swap' | 'rotate' | 'bust';
  card?: Card;
  /** How many cards were drawn. */
  count?: number;
  /** The player made to draw or caught. */
  target?: string;
  color?: Color | null;
  seq: number;
}

export interface LcState {
  variant: Variant;
  side: Side;
  players: LcPlayer[];
  turn: number;
  direction: 1 | -1;
  deck: Card[];
  deckCount: number;
  /** The top card's other face, seen on the back of the draw pile (Flip). */
  deckBack: Face | null;
  discard: Card[];
  /** The colour to match; null when anything goes. */
  color: Color | null;
  /** A card just drawn that fits: its owner may play it or keep it. */
  drawn: number | null;
  /** A player down to one card who hasn't called "Last card" - catchable until the next player moves. */
  exposed: string | null;
  last: LcEvent | null;
  history: LcEvent[];
  winner: string | null;
  over: boolean;
  game: number;
  /** Points won across hands. */
  score: Record<string, number>;
  seed: number;
  /** House rule: a draw card can be answered with another of its kind, passing the total on. */
  stack: boolean;
  /** Cards the player to move must draw, unless they stack (0 when nothing is owed). */
  owed: number;
  /** No Mercy: points from the hands of players knocked out, for whoever wins the hand. */
  pot: number;
}

export type LcAction =
  | { type: 'PLAY'; card: number; color?: Color; callLast?: boolean; /** No Mercy, on a 7: whose hand to take. */ swapWith?: string }
  | { type: 'DRAW' }
  | { type: 'PASS' }
  | { type: 'CALL' }
  | { type: 'CATCH'; target: string };

const HAND = 7;
const HISTORY = 30;

export const colorsOf = (side: Side): readonly Color[] => (side === 'light' ? LIGHT_COLORS : DARK_COLORS);
export const faceOf = (c: Card, side: Side) => (side === 'light' ? c.light : c.dark);
const isWild = (f: Face) => f.color === null;
/** Not playing this hand: gone from the table, or knocked out of the hand. */
const away = (p: LcPlayer) => !!p.out || !!p.bust;
/** How many cards a card makes someone draw (0 for a card that makes nobody draw). */
const drawSize = (f: Face) => (f.kind === 'draw' || f.kind === 'wild-draw' || f.kind === 'wild-reverse-draw' ? f.value! : 0);

/** The 152 cards of No Mercy. */
function unlimitedFaces(): Face[] {
  const out: Face[] = [];
  const add = (n: number, f: Face) => {
    for (let i = 0; i < n; i++) out.push({ ...f });
  };
  for (const color of LIGHT_COLORS) {
    for (let v = 0; v <= 9; v++) add(2, { kind: 'number', color, value: v });
    add(3, { kind: 'skip', color });
    add(3, { kind: 'reverse', color });
    add(2, { kind: 'draw', color, value: 2 });
    add(2, { kind: 'draw', color, value: 4 });
    add(2, { kind: 'skip-all', color });
    add(2, { kind: 'discard-all', color });
  }
  add(4, { kind: 'wild-reverse-draw', color: null, value: 4 });
  add(4, { kind: 'wild-draw', color: null, value: 6 });
  add(4, { kind: 'wild-draw', color: null, value: 10 });
  add(4, { kind: 'wild-hunt', color: null });
  return out;
}

function buildDeck(variant: Variant, seed: number): [Card[], number] {
  if (variant === 'unlimited') return shuffle(unlimitedFaces().map((f, i) => ({ id: i, light: f, dark: null })), seed);
  const faces = (side: Side): Face[] => {
    const out: Face[] = [];
    for (const color of colorsOf(side)) {
      if (variant === 'classic') out.push({ kind: 'number', color, value: 0 });
      for (let v = 1; v <= 9; v++) out.push({ kind: 'number', color, value: v }, { kind: 'number', color, value: v });
      const actions: Face[] =
        variant === 'classic'
          ? [{ kind: 'skip', color }, { kind: 'reverse', color }, { kind: 'draw', color, value: 2 }]
          : side === 'light'
            ? [{ kind: 'skip', color }, { kind: 'reverse', color }, { kind: 'draw', color, value: 1 }, { kind: 'flip', color }]
            : [{ kind: 'skip-all', color }, { kind: 'reverse', color }, { kind: 'draw', color, value: 5 }, { kind: 'flip', color }];
      for (const a of actions) out.push(a, { ...a });
    }
    for (let i = 0; i < 4; i++) {
      out.push({ kind: 'wild', color: null });
      if (variant === 'classic') out.push({ kind: 'wild-draw', color: null, value: 4 });
      else if (side === 'light') out.push({ kind: 'wild-draw', color: null, value: 2 });
      else out.push({ kind: 'wild-hunt', color: null });
    }
    return out;
  };
  const light = faces('light');
  let s = seed;
  let dark: Face[] = [];
  if (variant === 'flip') [dark, s] = shuffle(faces('dark'), s);
  const cards = light.map((f, i) => ({ id: i, light: f, dark: variant === 'flip' ? dark[i] : null }));
  return shuffle(cards, s);
}

/** Points a card scores for whoever goes out. */
export function points(f: Face): number {
  switch (f.kind) {
    case 'number':
      return f.value!;
    case 'draw':
      return f.value === 1 ? 10 : 20;
    case 'skip':
    case 'reverse':
    case 'flip':
    case 'discard-all':
      return 20;
    case 'skip-all':
      return 30;
    case 'wild':
      return 40;
    case 'wild-draw':
    case 'wild-reverse-draw':
      return 50;
    case 'wild-hunt':
      return 60;
  }
}

/** Whether `face` may go on the pile now. */
export function fits(s: LcState, face: Face, hand: Card[]): boolean {
  if (s.owed > 0) {
    // Cards are owed: the only play is another draw card of the same kind, to pass them on.
    const top = faceOf(s.discard[s.discard.length - 1], s.side)!;
    // No Mercy: any draw card as big or bigger answers.
    if (s.variant === 'unlimited') return drawSize(face) > 0 && drawSize(face) >= drawSize(top);
    return face.kind === top.kind && (face.kind !== 'draw' || face.value === top.value);
  }
  if (face.kind === 'wild-draw' && s.variant !== 'unlimited') {
    // Only with nothing of the colour in play to hand.
    return s.color === null || !hand.some((c) => faceOf(c, s.side)!.color === s.color);
  }
  if (isWild(face) || s.color === null) return true;
  const top = faceOf(s.discard[s.discard.length - 1], s.side)!;
  if (face.color === s.color) return true;
  if (face.kind === 'number') return top.kind === 'number' && top.value === face.value;
  return face.kind === top.kind && face.value === top.value;
}

export const playable = (s: LcState, p: LcPlayer) => p.hand.filter((c) => fits(s, faceOf(c, s.side)!, p.hand));

function nextSeat(s: LcState, from: number, steps = 1): number {
  let i = from;
  for (let k = 0; k < steps; k++) {
    do i = (i + s.direction + s.players.length) % s.players.length;
    while (away(s.players[i]));
  }
  return i;
}

/** Take `n` cards from the deck (reshuffling the discards under the top card when it runs out). */
function take(s: LcState, n: number): { s: LcState; cards: Card[] } {
  let { deck, discard, seed } = s;
  const cards: Card[] = [];
  for (let k = 0; k < n; k++) {
    if (deck.length === 0) {
      if (discard.length <= 1) break;
      [deck, seed] = shuffle(discard.slice(0, -1), seed);
      discard = discard.slice(-1);
    }
    cards.push(deck[0]);
    deck = deck.slice(1);
  }
  return { s: { ...s, deck, discard, seed }, cards };
}

function giveCards(s: LcState, seat: number, cards: Card[]): LcState {
  return { ...s, players: s.players.map((p, i) => (i === seat ? { ...p, hand: [...p.hand, ...cards], handCount: p.hand.length + cards.length } : p)) };
}

const record = (s: LcState, e: Omit<LcEvent, 'seq'>): LcState => {
  const ev = { ...e, seq: (s.last?.seq ?? 0) + 1 };
  return { ...s, last: ev, history: [ev, ...s.history].slice(0, HISTORY) };
};

const finalize = (s: LcState): LcState => ({ ...s, deckCount: s.deck.length, deckBack: s.variant === 'flip' && s.deck[0] ? faceOf(s.deck[0], s.side === 'light' ? 'dark' : 'light') : null });

function deal(s: LcState, game: number, starter: number): LcState {
  const [deck, seed] = buildDeck(s.variant, s.seed);
  let next: LcState = {
    ...s,
    side: 'light',
    deck,
    seed,
    discard: [],
    players: s.players.map((p) => ({ ...p, hand: [], handCount: 0, bust: false })),
    direction: 1,
    turn: starter,
    drawn: null,
    exposed: null,
    last: null,
    history: [],
    winner: null,
    over: false,
    game,
    owed: 0,
    pot: 0,
  };
  for (let i = 0; i < next.players.length; i++) {
    if (next.players[i].out) continue;
    const t = take(next, HAND);
    next = giveCards(t.s, i, t.cards);
  }
  // Turn up a starting card that makes nobody draw (in No Mercy, a plain number).
  for (;;) {
    const t = take(next, 1);
    next = { ...t.s, discard: [...t.s.discard, t.cards[0]] };
    const f = faceOf(t.cards[0], 'light')!;
    if (s.variant === 'unlimited' ? f.kind === 'number' : f.kind !== 'wild-draw') break;
  }
  const top = faceOf(next.discard[next.discard.length - 1], 'light')!;
  return finalize({ ...next, color: top.color });
}

export function createLastCard(seats: KitSeat[], seed: number, options: { variant?: Variant; stack?: boolean } = {}): LcState {
  const players = seats.map((seat, i) => ({ id: `p${i}`, name: seat.name, isAI: seat.isAI, difficulty: seat.difficulty, hand: [], handCount: 0 }));
  const variant = options.variant ?? 'classic';
  // No Mercy always stacks.
  const base = { variant, stack: variant === 'unlimited' || !!options.stack, owed: 0, pot: 0, players, score: Object.fromEntries(players.map((p) => [p.id, 0])), seed } as unknown as LcState;
  return deal(base, 1, 0);
}

/** End the turn: the next player is up (after any skips). */
const advance = (s: LcState, steps = 1): LcState => ({ ...s, turn: nextSeat(s, s.turn, steps), drawn: null });

function endHand(s: LcState, winnerSeat: number): LcState {
  const winner = s.players[winnerSeat];
  const won = s.players.reduce((n, p, i) => n + (i === winnerSeat ? 0 : p.hand.reduce((m, c) => m + points(faceOf(c, s.side)!), 0)), 0);
  return { ...s, over: true, winner: winner.id, drawn: null, exposed: null, score: { ...s.score, [winner.id]: (s.score[winner.id] ?? 0) + won + s.pot } };
}

/**
 * No Mercy's mercy rule: anyone holding 25 cards or more is out of the hand.
 * Their cards go under the deck and their points into the pot. The last player
 * left wins the hand; a turn that fell to a knocked-out player moves on.
 */
function settle(s: LcState): LcState {
  if (s.variant !== 'unlimited' || s.over) return s;
  let next = s;
  for (let i = 0; i < next.players.length; i++) {
    const p = next.players[i];
    if (away(p) || p.hand.length < MERCY) continue;
    const worth = p.hand.reduce((n, c) => n + points(faceOf(c, next.side)!), 0);
    next = {
      ...next,
      deck: [...next.deck, ...p.hand],
      pot: next.pot + worth,
      exposed: next.exposed === p.id ? null : next.exposed,
      players: next.players.map((q, k) => (k === i ? { ...q, bust: true, hand: [], handCount: 0 } : q)),
    };
    next = record(next, { player: p.id, kind: 'bust', count: p.hand.length });
  }
  if (next === s) return s;
  const left = next.players.map((p, i) => (away(p) ? -1 : i)).filter((i) => i >= 0);
  if (left.length === 1) return endHand({ ...next, owed: 0 }, left[0]);
  return away(next.players[next.turn]) ? { ...next, turn: nextSeat(next, next.turn), drawn: null } : next;
}

function play(s: LcState, seat: number, cardId: number, color: Color | undefined, callLast: boolean, swapWith?: string): LcState {
  const me = s.players[seat];
  const card = me.hand.find((c) => c.id === cardId);
  if (!card) throw new IllegalMove("that card isn't in your hand");
  const face = faceOf(card, s.side)!;
  if (s.drawn !== null && cardId !== s.drawn) throw new IllegalMove('you can only play the card you drew');
  if (!fits(s, face, me.hand)) throw new IllegalMove("that card doesn't fit");
  if (isWild(face) && (!color || !colorsOf(s.side).includes(color))) throw new IllegalMove('choose a colour');
  const unlimited = s.variant === 'unlimited';
  // Discard All takes every other card of its colour out of the hand with it.
  const shed = unlimited && face.kind === 'discard-all' ? me.hand.filter((c) => c.id !== cardId && faceOf(c, s.side)!.color === face.color) : [];
  const hand = me.hand.filter((c) => c.id !== cardId && !shed.includes(c));
  // A 7 swaps hands with a player you choose (unless it is your last card).
  const swapSeat = unlimited && face.kind === 'number' && face.value === 7 && hand.length > 0 ? s.players.findIndex((p) => p.id === swapWith) : -1;
  if (unlimited && face.kind === 'number' && face.value === 7 && hand.length > 0 && (swapSeat < 0 || swapSeat === seat || away(s.players[swapSeat]))) {
    throw new IllegalMove('choose a player to swap hands with');
  }
  let next: LcState = {
    ...s,
    players: s.players.map((p, i) => (i === seat ? { ...p, hand, handCount: hand.length } : p)),
    discard: [...s.discard, ...shed, card],
    color: isWild(face) ? color! : face.color,
    drawn: null,
    exposed: hand.length === 1 && !callLast ? me.id : null,
  };
  next = record(next, { player: me.id, kind: 'play', card, color: next.color });
  if (hand.length === 1 && callLast) next = record(next, { player: me.id, kind: 'call' });

  const victim = nextSeat(next, seat);
  const two = next.players.filter((p) => !away(p)).length === 2;
  if (swapSeat >= 0) {
    const theirs = next.players[swapSeat].hand;
    next = { ...next, exposed: null, players: next.players.map((p, i) => (i === seat ? { ...p, hand: theirs, handCount: theirs.length } : i === swapSeat ? { ...p, hand, handCount: hand.length } : p)) };
    next = record(next, { player: me.id, kind: 'swap', target: next.players[swapSeat].id });
  } else if (unlimited && face.kind === 'number' && face.value === 0 && hand.length > 0) {
    // A 0: every hand moves on to the next player in the direction of play.
    const live = next.players.map((p, i) => (away(p) ? -1 : i)).filter((i) => i >= 0);
    const from = new Map(live.map((i) => [nextSeat(next, i), next.players[i].hand]));
    next = { ...next, exposed: null, players: next.players.map((p, i) => (from.has(i) ? { ...p, hand: from.get(i)!, handCount: from.get(i)!.length } : p)) };
    next = record(next, { player: me.id, kind: 'rotate' });
  }
  switch (face.kind) {
    case 'skip':
      next = advance(next, 2);
      break;
    case 'skip-all':
      next = { ...next, drawn: null }; // everyone else is skipped: you go again
      break;
    case 'reverse':
      next = { ...next, direction: (next.direction * -1) as 1 | -1 };
      next = two ? { ...next, drawn: null } : advance(next); // with two players it acts as a skip
      break;
    case 'wild-reverse-draw':
      // Play turns round, and the four are owed by the player now next.
      next = { ...next, direction: (next.direction * -1) as 1 | -1 };
      next = advance({ ...next, owed: next.owed + face.value! });
      break;
    case 'draw':
    case 'wild-draw': {
      if (next.stack) {
        // Stacking: the next player answers with a card of the same kind, or draws the lot.
        next = advance({ ...next, owed: next.owed + face.value! });
        break;
      }
      const t = take(next, face.value!);
      next = giveCards(t.s, victim, t.cards);
      next = record(next, { player: next.players[victim].id, kind: 'penalty', count: t.cards.length, target: next.players[victim].id });
      next = advance(next, 2);
      break;
    }
    case 'wild-hunt': {
      // The next player draws until they find the chosen colour, and misses the turn.
      const found: Card[] = [];
      let t = next;
      for (let k = 0; k < 40; k++) {
        const got = take(t, 1);
        t = got.s;
        if (got.cards.length === 0) break;
        found.push(got.cards[0]);
        if (faceOf(got.cards[0], next.side)!.color === color) break;
      }
      next = giveCards(t, victim, found);
      next = record(next, { player: next.players[victim].id, kind: 'penalty', count: found.length, target: next.players[victim].id });
      next = advance(next, 2);
      break;
    }
    case 'flip': {
      const side: Side = next.side === 'light' ? 'dark' : 'light';
      const top = faceOf(next.discard[next.discard.length - 1], side)!;
      // The table turns over: what was the back of every card is now its face.
      next = { ...next, side, deck: [...next.deck].reverse(), color: top.color };
      next = advance(next);
      break;
    }
    default:
      next = advance(next);
  }
  if (hand.length === 0) {
    // Going out on a stacked draw card: whoever owed the cards still takes them.
    if (next.owed > 0) {
      const t = take(next, next.owed);
      next = giveCards({ ...t.s, owed: 0 }, next.turn, t.cards);
    }
    return finalize(endHand(next, seat));
  }
  return finalize(settle(next));
}

export function applyLastCard(s: LcState, action: LcAction | KitCommonAction, actorId: string): LcState {
  const seat = s.players.findIndex((p) => p.id === actorId);
  if (seat < 0) throw new IllegalMove('not in this game');
  if (action.type === 'REMATCH') {
    if (!s.over || s.players.filter((p) => !p.out).length < 2) throw new IllegalMove('the hand is still on');
    const [, seed] = nextRandom(s.seed);
    // The deal moves round the table.
    let starter = (s.game) % s.players.length;
    while (s.players[starter].out) starter = (starter + 1) % s.players.length;
    return deal({ ...s, seed }, s.game + 1, starter);
  }
  if (s.over) throw new IllegalMove('the hand is over');
  if (action.type === 'RESIGN') return lastCardKit.forfeit(s, actorId);

  // Calling and catching can come from anyone, any time.
  if (action.type === 'CALL') {
    if (s.exposed !== actorId) throw new IllegalMove('nothing to call');
    return finalize(record({ ...s, exposed: null }, { player: actorId, kind: 'call' }));
  }
  if (action.type === 'CATCH') {
    if (!s.exposed || s.exposed !== action.target || action.target === actorId) throw new IllegalMove('nobody to catch');
    const victim = s.players.findIndex((p) => p.id === action.target);
    const t = take(s, 2);
    const next = giveCards({ ...t.s, exposed: null }, victim, t.cards);
    return finalize(settle(record(next, { player: actorId, kind: 'catch', target: action.target, count: t.cards.length })));
  }

  if (s.turn !== seat) throw new IllegalMove('not your turn');
  // Moving on closes the chance to catch the previous player.
  const open = s.exposed && s.exposed !== actorId ? { ...s, exposed: null } : s;
  switch (action.type) {
    case 'PLAY':
      return play(open, seat, action.card, action.color, !!action.callLast, action.swapWith);
    case 'DRAW': {
      if (s.drawn !== null) throw new IllegalMove("you've already drawn");
      if (s.owed > 0) {
        // No card to stack: take everything owed, and the turn passes.
        const t = take(open, s.owed);
        const took = record(giveCards({ ...t.s, owed: 0 }, seat, t.cards), { player: actorId, kind: 'penalty', count: t.cards.length, target: actorId });
        return finalize(settle(advance(took)));
      }
      if (s.variant === 'unlimited') {
        // Draw until a card fits; that card must then be played.
        let cur = open;
        let found: Card | null = null;
        let count = 0;
        while (!found && count < 200) {
          const t = take(cur, 1);
          if (t.cards.length === 0) {
            cur = t.s;
            break;
          }
          cur = giveCards(t.s, seat, t.cards);
          count++;
          if (cur.players[seat].hand.length >= MERCY) break; // knocked out before finding one
          if (fits(cur, faceOf(t.cards[0], cur.side)!, cur.players[seat].hand)) found = t.cards[0];
        }
        cur = record(cur, count > 0 ? { player: actorId, kind: 'draw', count } : { player: actorId, kind: 'pass' });
        if (found && cur.players[seat].hand.length < MERCY) return finalize({ ...cur, drawn: found.id });
        const after = settle(cur);
        return finalize(after.over || after.turn !== seat ? after : advance(after));
      }
      const t = take(open, 1);
      if (t.cards.length === 0) return finalize(advance(record(t.s, { player: actorId, kind: 'pass' })));
      let next = giveCards(t.s, seat, t.cards);
      next = record(next, { player: actorId, kind: 'draw', count: 1 });
      const card = t.cards[0];
      // A card that fits may be played at once; otherwise the turn passes.
      if (fits(next, faceOf(card, next.side)!, next.players[seat].hand)) return finalize({ ...next, drawn: card.id });
      return finalize(advance(next));
    }
    case 'PASS':
      if (s.drawn === null) throw new IllegalMove('draw first');
      if (s.variant === 'unlimited') throw new IllegalMove('you must play the card you drew');
      return finalize(advance(record(open, { player: actorId, kind: 'pass' })));
    default:
      throw new IllegalMove('unknown action');
  }
}

// ---------------------------------------------------------------------------
// The bot.

/** The colour the bot names for a wild: the one it holds most of. */
function bestColor(s: LcState, hand: Card[], skip?: number): Color {
  const counts = new Map<Color, number>();
  for (const c of hand) {
    if (c.id === skip) continue;
    const f = faceOf(c, s.side)!;
    if (f.color) counts.set(f.color, (counts.get(f.color) ?? 0) + 1);
  }
  let best: Color = colorsOf(s.side)[0];
  let n = -1;
  for (const col of colorsOf(s.side)) if ((counts.get(col) ?? 0) > n) [best, n] = [col, counts.get(col) ?? 0];
  return best;
}

export function lcBotAction(s: LcState, rand: () => number = Math.random): LcAction {
  const me = s.players[s.turn];
  const level = me.difficulty ?? 'normal';
  // Catch a player who forgot to call.
  if (s.exposed && s.exposed !== me.id && rand() < (level === 'hard' ? 0.95 : level === 'normal' ? 0.6 : 0.25)) return { type: 'CATCH', target: s.exposed };
  const options = playable(s, me).filter((c) => s.drawn === null || c.id === s.drawn);
  if (options.length === 0) return s.drawn !== null ? { type: 'PASS' } : { type: 'DRAW' };
  // No Mercy, for a 7: the hand worth taking is the smallest one at the table.
  const others = s.players.filter((p) => p.id !== me.id && !away(p));
  const smallest = [...others].sort((a, b) => a.handCount - b.handCount)[0];
  const swapWith = smallest?.id;
  const call = me.hand.length === 2 && rand() < (level === 'easy' ? 0.7 : level === 'normal' ? 0.92 : 1);
  if (level === 'easy') {
    const c = options[Math.floor(rand() * options.length)];
    return { type: 'PLAY', card: c.id, color: bestColor(s, me.hand, c.id), callLast: call, swapWith };
  }
  const nextP = s.players[nextSeat(s, s.turn)];
  const threat = nextP.handCount <= 2;
  const value = (c: Card) => {
    const f = faceOf(c, s.side)!;
    let v = points(f) * 0.2; // shed heavy cards first
    if (isWild(f)) v -= 30; // keep wilds back
    if ((drawSize(f) > 0 || f.kind === 'skip' || f.kind === 'skip-all' || f.kind === 'wild-hunt') && threat) v += 60;
    if (s.variant === 'unlimited') {
      // A 7 is a gift when someone holds fewer cards than I would keep, and a blunder otherwise; a 0 likewise with my neighbour.
      const keep = me.hand.length - 1;
      if (f.kind === 'number' && f.value === 7 && keep > 0) v += smallest && smallest.handCount < keep ? 25 + (keep - smallest.handCount) * 6 : -45;
      if (f.kind === 'number' && f.value === 0 && keep > 0) {
        const giver = s.players[nextSeat({ ...s, direction: (s.direction * -1) as 1 | -1 }, s.turn)];
        v += (keep - giver.handCount) * 6;
      }
      if (f.kind === 'discard-all') v += me.hand.filter((h) => faceOf(h, s.side)!.color === f.color).length * 8;
    }
    if (f.color && f.color === bestColor(s, me.hand)) v += 6;
    if (f.kind === 'flip' && level === 'hard') {
      // Flip when my hand looks better on the other side.
      const other = s.side === 'light' ? 'dark' : 'light';
      const now = me.hand.reduce((n, h) => n + points(faceOf(h, s.side)!), 0);
      const then = me.hand.reduce((n, h) => n + points(faceOf(h, other)!), 0);
      v += (now - then) * 0.3;
    }
    return v + rand();
  };
  const best = [...options].sort((a, b) => value(b) - value(a))[0];
  return { type: 'PLAY', card: best.id, color: bestColor(s, me.hand, best.id), callLast: call, swapWith };
}

export const lastCardKit: GameKit<LcState, LcAction> = {
  seatError: (count) => (count >= 2 && count <= 10 ? null : 'Last Card is for 2-10 players'),
  create: (seats, seed, options) => createLastCard(seats, seed, (options ?? {}) as { variant?: Variant; stack?: boolean }),
  apply: applyLastCard,
  actor: (s) => (s.over ? null : s.players[s.turn].id),
  players: (s) => s.players,
  isOver: (s) => s.over,
  bot: (s, rand) => lcBotAction(s, rand),
  // Out of time: keep the card you drew, or (No Mercy, where it must be played) play it.
  timeout: (s) => {
    if (s.drawn === null) return { type: 'DRAW' };
    if (s.variant !== 'unlimited') return { type: 'PASS' };
    const me = s.players[s.turn];
    const other = s.players.find((p) => p.id !== me.id && !p.out && !p.bust);
    return { type: 'PLAY', card: s.drawn, color: bestColor(s, me.hand, s.drawn), swapWith: other?.id };
  },
  botDelay: (s) => (s.drawn !== null ? 700 : 950),
  setBot: (s, id, difficulty) => ({ ...s, players: s.players.map((p) => (p.id === id ? { ...p, isAI: true, difficulty } : p)) }),
  forfeit: (s, id) => {
    const seat = s.players.findIndex((p) => p.id === id);
    const players = s.players.map((p) => (p.id === id ? { ...p, out: true, hand: [], handCount: 0 } : p));
    if (s.over) return { ...s, players };
    // Their cards slide under the discard pile.
    const next: LcState = { ...s, players, discard: [...s.players[seat].hand, ...s.discard], exposed: s.exposed === id ? null : s.exposed };
    const left = players.filter((p) => !p.out && !p.bust);
    if (left.length === 1) return finalize({ ...next, over: true, winner: left[0].id });
    return finalize(s.turn === seat ? advance(next) : next);
  },
  end: (s) => ({ ...s, over: true }),
  // Classic: only your own hand. Flip: you see the face in play of your own cards
  // and the other face of everyone else's (the side turned towards you).
  redact: (s, viewer) => {
    // The hand is over: every hand is turned face up to count the points.
    if (s.over) return { ...s, deck: [], discard: s.discard.slice(-3) };
    if (s.variant !== 'flip') {
      return { ...s, deck: [], players: s.players.map((p) => (p.id === viewer ? p : { ...p, hand: [] })), discard: s.discard.slice(-3) };
    }
    const other: Side = s.side === 'light' ? 'dark' : 'light';
    return {
      ...s,
      deck: [],
      players: s.players.map((p) => ({ ...p, hand: p.hand.map((c) => (p.id === viewer ? { ...c, [other]: null } : { ...c, [s.side]: null })) })),
      discard: s.discard.slice(-3).map((c) => ({ ...c, [other]: null })),
    };
  },
  turnMs: 30_000,
};
