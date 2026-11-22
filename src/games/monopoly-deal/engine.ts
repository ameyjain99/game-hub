/**
 * Monopoly Deal: the card game (106 playing cards, 2-5 players).
 *
 * On your turn you draw 2 cards (5 if your hand is empty) and play up to 3:
 * money and action cards into your bank, properties into your collection, or
 * an action card for what it does. The first player to hold 3 complete
 * property sets of different colours wins.
 *
 * An action played against a player becomes a claim on them. They answer it
 * by paying, by handing the property over, or with a Just Say No, which the
 * player who made the claim may answer with a Just Say No of their own.
 */
import { IllegalMove, nextRandom, shuffle, type GameKit, type KitCommonAction, type KitPlayer, type KitSeat } from '../kit/engine';

export const COLORS = ['brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkblue', 'railroad', 'utility'] as const;
export type Color = (typeof COLORS)[number];

/** Properties that make a full set of each colour. */
export const SET_SIZE: Record<Color, number> = { brown: 2, lightblue: 3, pink: 3, orange: 3, red: 3, yellow: 3, green: 3, darkblue: 2, railroad: 4, utility: 2 };
/** Rent for 1, 2, 3 (and 4) properties of a colour. */
export const RENT: Record<Color, number[]> = {
  brown: [1, 2],
  lightblue: [1, 2, 3],
  pink: [1, 2, 4],
  orange: [1, 3, 5],
  red: [2, 3, 6],
  yellow: [2, 4, 6],
  green: [2, 4, 7],
  darkblue: [3, 8],
  railroad: [1, 2, 3, 4],
  utility: [1, 2],
};
export const COLOR_NAME: Record<Color, string> = { brown: 'Brown', lightblue: 'Light Blue', pink: 'Pink', orange: 'Orange', red: 'Red', yellow: 'Yellow', green: 'Green', darkblue: 'Dark Blue', railroad: 'Railroad', utility: 'Utility' };

export type ActionKind = 'deal-breaker' | 'just-say-no' | 'sly-deal' | 'forced-deal' | 'debt-collector' | 'birthday' | 'pass-go' | 'house' | 'hotel' | 'double-rent';
export const ACTION_NAME: Record<ActionKind, string> = {
  'deal-breaker': 'Deal Breaker',
  'just-say-no': 'Just Say No',
  'sly-deal': 'Sly Deal',
  'forced-deal': 'Forced Deal',
  'debt-collector': 'Debt Collector',
  birthday: "It's My Birthday",
  'pass-go': 'Pass Go',
  house: 'House',
  hotel: 'Hotel',
  'double-rent': 'Double the Rent',
};

export interface MdCard {
  id: number;
  kind: 'money' | 'property' | 'wild' | 'rent' | 'action';
  name: string;
  /** What the card is worth as payment, in millions. */
  value: number;
  /** A property's colour. A wild's or a rent card's colours (all ten for a multicoloured one). */
  colors: Color[];
  action?: ActionKind;
}

/** A property or building on the table, and the colour set it lies in. */
interface Placed {
  card: MdCard;
  color: Color;
}

export interface MdPlayer extends KitPlayer {
  hand: MdCard[];
  handCount: number;
  bank: MdCard[];
  props: Placed[];
  /** Houses and hotels, on the colour set they were built on. */
  buildings: Placed[];
  out?: boolean;
}

/** What one player owes another because of an action card. */
export interface Claim {
  to: string;
  from: string;
  kind: 'pay' | 'steal' | 'swap' | 'set';
  /** The card that made the claim, for the table to read. */
  why: string;
  amount?: number;
  /** The property wanted from `from` (a steal or a swap). */
  card?: number;
  /** The property `to` gives in return (a swap). */
  give?: number;
  /** The colour set wanted (a Deal Breaker). */
  color?: Color;
}

export interface MdEvent {
  seq: number;
  player: string;
  kind: 'draw' | 'bank' | 'property' | 'action' | 'rent' | 'no' | 'pay' | 'broke' | 'steal' | 'swap' | 'set' | 'build' | 'move' | 'discard' | 'end' | 'leave';
  card?: string;
  target?: string;
  color?: Color;
  amount?: number;
  count?: number;
  /** Names of the cards that changed hands. */
  cards?: string[];
}

export interface MdOptions {
  /** Complete sets of different colours needed to win (3 by the official rules). */
  setsToWin?: number;
  /** Houses and hotels may also go on Railroads and Utilities. */
  buildAnywhere?: boolean;
  /** At most one Double the Rent on a Rent card. */
  oneDouble?: boolean;
}

export const SETS_TO_WIN = [3, 2, 4];
const HAND_LIMIT = 7;
const PLAYS = 3;
const HISTORY = 40;

export interface MdState {
  players: MdPlayer[];
  turn: number;
  phase: 'draw' | 'play';
  /** Cards played this turn (3 at most). */
  plays: number;
  deck: MdCard[];
  deckCount: number;
  discard: MdCard[];
  /** Claims still to settle, the one being answered first. */
  claims: Claim[];
  /** Just Say Nos played on the claim being answered. */
  nos: number;
  last: MdEvent | null;
  history: MdEvent[];
  winner: string | null;
  over: boolean;
  game: number;
  seed: number;
  setsToWin: number;
  buildAnywhere: boolean;
  oneDouble: boolean;
}

export type MdAction =
  | { type: 'DRAW' }
  | { type: 'BANK'; card: number }
  | { type: 'PROPERTY'; card: number; color?: Color }
  | { type: 'PLAY'; card: number; target?: string; color?: Color; take?: number; give?: number; doubles?: number[] }
  /** Turn a wild property to another of its colours (free, on your turn). */
  | { type: 'MOVE'; card: number; color: Color }
  | { type: 'PAY'; cards: number[] }
  /** Play a Just Say No on the claim being answered. */
  | { type: 'NO' }
  /** Give in: hand the property over, or let a Just Say No stand. */
  | { type: 'ACCEPT' }
  | { type: 'END'; discard?: number[] };

// ---------------------------------------------------------------------------
// The deck.

const PROPERTIES: [Color, number, string[]][] = [
  ['brown', 1, ['Mediterranean Avenue', 'Baltic Avenue']],
  ['lightblue', 1, ['Oriental Avenue', 'Vermont Avenue', 'Connecticut Avenue']],
  ['pink', 2, ['St. Charles Place', 'States Avenue', 'Virginia Avenue']],
  ['orange', 2, ['St. James Place', 'Tennessee Avenue', 'New York Avenue']],
  ['red', 3, ['Kentucky Avenue', 'Indiana Avenue', 'Illinois Avenue']],
  ['yellow', 3, ['Atlantic Avenue', 'Ventnor Avenue', 'Marvin Gardens']],
  ['green', 4, ['Pacific Avenue', 'North Carolina Avenue', 'Pennsylvania Avenue']],
  ['darkblue', 4, ['Park Place', 'Boardwalk']],
  ['railroad', 2, ['Reading Railroad', 'Pennsylvania Railroad', 'B. & O. Railroad', 'Short Line']],
  ['utility', 2, ['Electric Company', 'Water Works']],
];
/** Two-colour wilds: colours, value, copies. */
const WILDS: [Color, Color, number, number][] = [
  ['lightblue', 'brown', 1, 1],
  ['lightblue', 'railroad', 4, 1],
  ['pink', 'orange', 2, 2],
  ['red', 'yellow', 3, 2],
  ['darkblue', 'green', 4, 1],
  ['green', 'railroad', 4, 1],
  ['railroad', 'utility', 2, 1],
];
const RENTS: [Color, Color][] = [
  ['lightblue', 'brown'],
  ['pink', 'orange'],
  ['red', 'yellow'],
  ['darkblue', 'green'],
  ['railroad', 'utility'],
];
/** Action cards: copies and bank value. */
export const ACTIONS: Record<ActionKind, [number, number]> = {
  'deal-breaker': [2, 5],
  'just-say-no': [3, 4],
  'sly-deal': [3, 3],
  'forced-deal': [3, 3],
  'debt-collector': [3, 3],
  birthday: [3, 2],
  'pass-go': [10, 1],
  house: [3, 3],
  hotel: [2, 4],
  'double-rent': [2, 1],
};
const MONEY: [number, number][] = [
  [1, 6],
  [2, 5],
  [3, 3],
  [4, 3],
  [5, 2],
  [10, 1],
];
export const BUILDING_RENT = { house: 3, hotel: 4 };
export const DEBT = 5;
export const BIRTHDAY = 2;

export function buildDeck(): MdCard[] {
  const out: Omit<MdCard, 'id'>[] = [];
  for (const [color, value, names] of PROPERTIES) for (const name of names) out.push({ kind: 'property', name, value, colors: [color] });
  for (const [a, b, value, n] of WILDS) for (let i = 0; i < n; i++) out.push({ kind: 'wild', name: `${COLOR_NAME[a]} / ${COLOR_NAME[b]} Wild`, value, colors: [a, b] });
  for (let i = 0; i < 2; i++) out.push({ kind: 'wild', name: 'Multicolored Wild', value: 0, colors: [...COLORS] });
  for (const [a, b] of RENTS) for (let i = 0; i < 2; i++) out.push({ kind: 'rent', name: `Rent: ${COLOR_NAME[a]} / ${COLOR_NAME[b]}`, value: 1, colors: [a, b] });
  for (let i = 0; i < 3; i++) out.push({ kind: 'rent', name: 'Rent: any colour', value: 3, colors: [...COLORS] });
  for (const kind of Object.keys(ACTIONS) as ActionKind[]) for (let i = 0; i < ACTIONS[kind][0]; i++) out.push({ kind: 'action', name: ACTION_NAME[kind], value: ACTIONS[kind][1], colors: [], action: kind });
  for (const [value, n] of MONEY) for (let i = 0; i < n; i++) out.push({ kind: 'money', name: `${value}M`, value, colors: [] });
  return out.map((c, id) => ({ ...c, id }));
}

// ---------------------------------------------------------------------------
// Reading the table.

const playerOf = (s: MdState, id: string) => s.players.find((p) => p.id === id);
const active = (s: MdState) => s.players.filter((p) => !p.out);
const isAnyWild = (c: MdCard) => c.kind === 'wild' && c.colors.length === COLORS.length;
export const pileOf = (p: MdPlayer, color: Color) => p.props.filter((x) => x.color === color);

/** A full set: enough properties of the colour, at least one of them not a multicoloured wild. */
export function isComplete(p: MdPlayer, color: Color): boolean {
  const pile = pileOf(p, color);
  return pile.length >= SET_SIZE[color] && pile.some((x) => !isAnyWild(x.card));
}
export const completeColors = (p: MdPlayer) => COLORS.filter((c) => isComplete(p, c));

/** The rent a colour collects: by the number of properties, plus a House and Hotel on a full set. */
export function rentOf(p: MdPlayer, color: Color): number {
  const n = Math.min(pileOf(p, color).length, SET_SIZE[color]);
  if (n === 0) return 0;
  const built = isComplete(p, color) ? p.buildings.filter((b) => b.color === color).reduce((sum, b) => sum + BUILDING_RENT[b.card.action as 'house' | 'hotel'], 0) : 0;
  return RENT[color][n - 1] + built;
}

/** Everything a player could pay with: the bank, properties that have a value, and buildings. */
export function payable(p: MdPlayer): MdCard[] {
  return [...p.bank, ...p.props.filter((x) => x.card.value > 0).map((x) => x.card), ...p.buildings.map((x) => x.card)];
}
const worthOf = (p: MdPlayer) => payable(p).reduce((n, c) => n + c.value, 0);

const holdsNo = (p: MdPlayer) => p.hand.some((c) => c.action === 'just-say-no');

/** Whether `card` on `owner`'s table can be taken by a Sly Deal or a Forced Deal. */
export const stealable = (owner: MdPlayer, card: number) => {
  const placed = owner.props.find((x) => x.card.id === card);
  return !!placed && !isComplete(owner, placed.color);
};

// ---------------------------------------------------------------------------
// Changing the table.

function finalize(s: MdState): MdState {
  return { ...s, deckCount: s.deck.length, players: s.players.map((p) => ({ ...p, handCount: p.hand.length })) };
}

function record(s: MdState, e: Omit<MdEvent, 'seq'>): MdState {
  const event = { ...e, seq: (s.last?.seq ?? 0) + 1 };
  return { ...s, last: event, history: [...s.history, event].slice(-HISTORY) };
}

const setPlayer = (s: MdState, id: string, change: (p: MdPlayer) => MdPlayer): MdState => ({ ...s, players: s.players.map((p) => (p.id === id ? change(p) : p)) });
const without = (cards: MdCard[], ...ids: number[]) => cards.filter((c) => !ids.includes(c.id));

/** Take `n` cards from the draw pile, reshuffling the discards into it when it runs out. */
function drawCards(s: MdState, id: string, n: number): MdState {
  let { deck, discard, seed } = s;
  const drawn: MdCard[] = [];
  for (let i = 0; i < n; i++) {
    if (deck.length === 0) {
      if (discard.length === 0) break;
      [deck, seed] = shuffle(discard, seed);
      discard = [];
    }
    drawn.push(deck[0]);
    deck = deck.slice(1);
  }
  return setPlayer({ ...s, deck, discard, seed }, id, (p) => ({ ...p, hand: [...p.hand, ...drawn] }));
}

export function createMd(seats: KitSeat[], seed: number, options: MdOptions = {}, game = 1): MdState {
  const [deck, s1] = shuffle(buildDeck(), seed);
  const players: MdPlayer[] = seats.map((seat, i) => ({ id: `p${i}`, name: seat.name, isAI: seat.isAI, difficulty: seat.difficulty, hand: deck.slice(i * 5, i * 5 + 5), handCount: 5, bank: [], props: [], buildings: [] }));
  const [first, s2] = nextRandom(s1);
  return finalize({
    players,
    turn: Math.floor(first * seats.length),
    phase: 'draw',
    plays: 0,
    deck: deck.slice(seats.length * 5),
    deckCount: 0,
    discard: [],
    claims: [],
    nos: 0,
    last: null,
    history: [],
    winner: null,
    over: false,
    game,
    seed: s2,
    setsToWin: SETS_TO_WIN.includes(options.setsToWin ?? 3) ? (options.setsToWin ?? 3) : 3,
    buildAnywhere: !!options.buildAnywhere,
    oneDouble: !!options.oneDouble,
  });
}

function checkWin(s: MdState): MdState {
  if (s.over) return s;
  const winner = active(s).find((p) => completeColors(p).length >= s.setsToWin);
  if (winner) return { ...s, over: true, winner: winner.id, claims: [], nos: 0 };
  const left = active(s);
  return left.length === 1 ? { ...s, over: true, winner: left[0].id, claims: [], nos: 0 } : s;
}

/** A card paid or taken arrives on `to`'s table: money in the bank, a property in the colour it lay in. */
function give(s: MdState, from: string, to: string, ids: number[]): MdState {
  const giver = playerOf(s, from)!;
  const cash = [...giver.bank.filter((c) => ids.includes(c.id)), ...giver.buildings.filter((b) => ids.includes(b.card.id)).map((b) => b.card)];
  const props = giver.props.filter((x) => ids.includes(x.card.id));
  let out = setPlayer(s, from, (p) => ({ ...p, bank: without(p.bank, ...ids), props: p.props.filter((x) => !ids.includes(x.card.id)), buildings: p.buildings.filter((b) => !ids.includes(b.card.id)) }));
  out = setPlayer(out, to, (p) => ({ ...p, bank: [...p.bank, ...cash], props: [...p.props, ...props] }));
  return out;
}

/** The claim being answered takes effect. */
function fulfil(s: MdState, c: Claim): MdState {
  const from = playerOf(s, c.from)!;
  if (c.kind === 'steal') {
    const placed = from.props.find((x) => x.card.id === c.card);
    if (!placed || !stealable(from, placed.card.id)) return s;
    return record(give(s, c.from, c.to, [placed.card.id]), { player: c.to, kind: 'steal', target: c.from, cards: [placed.card.name] });
  }
  if (c.kind === 'swap') {
    const theirs = from.props.find((x) => x.card.id === c.card);
    const mine = playerOf(s, c.to)!.props.find((x) => x.card.id === c.give);
    if (!theirs || !mine || !stealable(from, theirs.card.id)) return s;
    return record(give(give(s, c.from, c.to, [theirs.card.id]), c.to, c.from, [mine.card.id]), { player: c.to, kind: 'swap', target: c.from, cards: [theirs.card.name, mine.card.name] });
  }
  // A Deal Breaker: the whole colour set, with its House and Hotel.
  if (!isComplete(from, c.color!)) return s;
  const cards = pileOf(from, c.color!);
  const built = from.buildings.filter((b) => b.color === c.color);
  let out = setPlayer(s, c.from, (p) => ({ ...p, props: p.props.filter((x) => x.color !== c.color), buildings: p.buildings.filter((b) => b.color !== c.color) }));
  out = setPlayer(out, c.to, (p) => ({ ...p, props: [...p.props, ...cards], buildings: [...p.buildings, ...built] }));
  return record(out, { player: c.to, kind: 'set', target: c.from, color: c.color, cards: cards.map((x) => x.card.name) });
}

/**
 * Settle every claim that has only one possible answer: a player with nothing
 * to pay with, a player who holds no Just Say No against a steal, a Just Say
 * No that nobody can answer.
 */
function settle(s0: MdState): MdState {
  let s = s0;
  while (!s.over && s.claims.length > 0) {
    const c = s.claims[0];
    const from = playerOf(s, c.from)!;
    const to = playerOf(s, c.to)!;
    const next = { ...s, claims: s.claims.slice(1), nos: 0 };
    if (from.out || to.out) s = next;
    else if (s.nos % 2 === 1) {
      // A Just Say No stands unless the claimant answers it.
      if (holdsNo(to)) break;
      s = next;
    } else if (holdsNo(from)) break;
    else if (c.kind !== 'pay') s = checkWin(fulfil(next, c));
    else {
      const all = payable(from);
      const total = all.reduce((n, x) => n + x.value, 0);
      if (total > c.amount!) break;
      // Everything they have is not more than the debt: it is all paid, and that is the end of it.
      s = all.length === 0 ? record(next, { player: c.from, kind: 'broke', target: c.to, amount: c.amount }) : checkWin(record(give(next, c.from, c.to, all.map((x) => x.id)), { player: c.from, kind: 'pay', target: c.to, amount: total, cards: all.map((x) => x.name) }));
    }
  }
  return s;
}

const others = (s: MdState, me: string) => active(s).filter((p) => p.id !== me);

function playAction(s0: MdState, me: MdPlayer, a: Extract<MdAction, { type: 'PLAY' }>): MdState {
  const card = me.hand.find((c) => c.id === a.card);
  if (!card || (card.kind !== 'action' && card.kind !== 'rent')) throw new IllegalMove('that is not an action card in your hand');
  const kind = card.action;
  const target = a.target ? playerOf(s0, a.target) : undefined;
  const needTarget = () => {
    if (!target || target.out || target.id === me.id) throw new IllegalMove('choose another player');
    return target;
  };
  const spend = (s: MdState, ...ids: number[]) => setPlayer({ ...s, plays: s.plays + ids.length, discard: [...s.discard, ...me.hand.filter((c) => ids.includes(c.id))] }, me.id, (p) => ({ ...p, hand: without(p.hand, ...ids) }));

  if (card.kind === 'rent') {
    const color = a.color;
    if (!color || !card.colors.includes(color)) throw new IllegalMove('choose one of the colours on the Rent card');
    const base = rentOf(me, color);
    if (base === 0) throw new IllegalMove('you have no property of that colour');
    const doubles = [...new Set(a.doubles ?? [])].map((id) => me.hand.find((c) => c.id === id && c.action === 'double-rent'));
    if (doubles.some((d) => !d)) throw new IllegalMove('you do not hold that Double the Rent');
    if (s0.oneDouble && doubles.length > 1) throw new IllegalMove('only one Double the Rent on a Rent card');
    if (s0.plays + 1 + doubles.length > PLAYS) throw new IllegalMove('that is more than 3 cards this turn');
    const amount = base * 2 ** doubles.length;
    const one = card.colors.length === COLORS.length;
    const payers = one ? [needTarget()] : others(s0, me.id);
    const s = spend(s0, card.id, ...doubles.map((d) => d!.id));
    const why = `${COLOR_NAME[color]} rent`;
    return record({ ...s, claims: payers.map((p) => ({ to: me.id, from: p.id, kind: 'pay' as const, why, amount })) }, { player: me.id, kind: 'rent', color, amount, count: doubles.length, target: one ? payers[0].id : undefined });
  }

  if (kind === 'just-say-no') throw new IllegalMove('a Just Say No answers an action played against you');
  if (kind === 'double-rent') throw new IllegalMove('Double the Rent is played with a Rent card');
  if (kind === 'house' || kind === 'hotel') {
    const color = a.color;
    if (!color || !isComplete(me, color)) throw new IllegalMove('choose a full set of yours');
    if (!s0.buildAnywhere && (color === 'railroad' || color === 'utility')) throw new IllegalMove('not on Railroads or Utilities');
    const built = me.buildings.filter((b) => b.color === color).map((b) => b.card.action);
    if (built.includes(kind)) throw new IllegalMove(`that set already has a ${ACTION_NAME[kind]}`);
    if (kind === 'hotel' && !built.includes('house')) throw new IllegalMove('a set needs a House before a Hotel');
    const s = setPlayer({ ...s0, plays: s0.plays + 1 }, me.id, (p) => ({ ...p, hand: without(p.hand, card.id), buildings: [...p.buildings, { card, color }] }));
    return record(s, { player: me.id, kind: 'build', card: card.name, color });
  }

  let s = spend(s0, card.id);
  s = record(s, { player: me.id, kind: 'action', card: card.name, target: kind === 'pass-go' || kind === 'birthday' ? undefined : target?.id });
  const why = ACTION_NAME[kind!];
  switch (kind) {
    case 'pass-go':
      return drawCards(s, me.id, 2);
    case 'birthday':
      return { ...s, claims: others(s, me.id).map((p) => ({ to: me.id, from: p.id, kind: 'pay' as const, why, amount: BIRTHDAY })) };
    case 'debt-collector':
      return { ...s, claims: [{ to: me.id, from: needTarget().id, kind: 'pay', why, amount: DEBT }] };
    case 'sly-deal': {
      const t = needTarget();
      if (!stealable(t, a.take ?? -1)) throw new IllegalMove('choose a property that is not part of a full set');
      return { ...s, claims: [{ to: me.id, from: t.id, kind: 'steal', why, card: a.take }] };
    }
    case 'forced-deal': {
      const t = needTarget();
      if (!stealable(t, a.take ?? -1)) throw new IllegalMove('choose a property that is not part of a full set');
      if (!me.props.some((x) => x.card.id === a.give)) throw new IllegalMove('choose one of your properties to give');
      return { ...s, claims: [{ to: me.id, from: t.id, kind: 'swap', why, card: a.take, give: a.give }] };
    }
    case 'deal-breaker': {
      const t = needTarget();
      if (!a.color || !isComplete(t, a.color)) throw new IllegalMove('choose a full set');
      return { ...s, claims: [{ to: me.id, from: t.id, kind: 'set', why, color: a.color }] };
    }
    default:
      throw new IllegalMove('that card cannot be played');
  }
}

function pay(s: MdState, me: MdPlayer, c: Claim, ids: number[]): MdState {
  const all = payable(me);
  const chosen = [...new Set(ids)].map((id) => all.find((x) => x.id === id));
  if (chosen.some((x) => !x)) throw new IllegalMove('you can only pay with cards on your table that have a value');
  const total = chosen.reduce((n, x) => n + x!.value, 0);
  if (total < c.amount! && chosen.length < all.length) throw new IllegalMove(`that is ${total}M: you owe ${c.amount}M`);
  const next = give({ ...s, claims: s.claims.slice(1), nos: 0 }, me.id, c.to, chosen.map((x) => x!.id));
  return record(next, { player: me.id, kind: 'pay', target: c.to, amount: total, cards: chosen.map((x) => x!.name) });
}

function endTurn(s: MdState, me: MdPlayer, discard: number[]): MdState {
  const ids = [...new Set(discard)];
  const over = me.hand.length - HAND_LIMIT;
  if (ids.some((id) => !me.hand.some((c) => c.id === id))) throw new IllegalMove('you do not hold those cards');
  if (ids.length !== Math.max(0, over)) throw new IllegalMove(over > 0 ? `discard ${over} to keep ${HAND_LIMIT} cards` : 'you have nothing to discard');
  let out = setPlayer({ ...s, discard: [...s.discard, ...me.hand.filter((c) => ids.includes(c.id))] }, me.id, (p) => ({ ...p, hand: without(p.hand, ...ids) }));
  if (ids.length > 0) out = record(out, { player: me.id, kind: 'discard', count: ids.length });
  out = record(out, { player: me.id, kind: 'end' });
  let seat = s.turn;
  do seat = (seat + 1) % s.players.length;
  while (s.players[seat].out);
  return { ...out, turn: seat, phase: 'draw', plays: 0 };
}

function forfeit(s0: MdState, id: string): MdState {
  const seat = s0.players.findIndex((p) => p.id === id);
  const me = s0.players[seat];
  if (!me || me.out) return s0;
  // Everything they held goes to the discard pile.
  const cards = [...me.hand, ...me.bank, ...me.props.map((x) => x.card), ...me.buildings.map((x) => x.card)];
  let s = setPlayer(s0, id, (p) => ({ ...p, out: true, hand: [], bank: [], props: [], buildings: [] }));
  if (s.over) return finalize(s);
  s = record({ ...s, discard: [...s.discard, ...cards] }, { player: id, kind: 'leave' });
  if (s.turn === seat) {
    let next = seat;
    do next = (next + 1) % s.players.length;
    while (s.players[next].out && next !== seat);
    s = { ...s, turn: next, phase: 'draw', plays: 0, claims: [], nos: 0 };
  }
  return finalize(checkWin(settle(s)));
}

function applyMd(s: MdState, action: MdAction | KitCommonAction, actorId: string): MdState {
  if (action.type === 'REMATCH') {
    if (!s.over) throw new IllegalMove('the game is still going');
    const stay = s.players.filter((p) => !p.out);
    if (stay.length < 2) throw new IllegalMove('not enough players for another game');
    const next = createMd(stay.map((p) => ({ name: p.name, isAI: p.isAI, difficulty: p.difficulty })), s.seed, { setsToWin: s.setsToWin, buildAnywhere: s.buildAnywhere, oneDouble: s.oneDouble }, s.game + 1);
    return finalize({ ...next, players: next.players.map((p, i) => ({ ...p, id: stay[i].id })) });
  }
  if (action.type === 'RESIGN') return forfeit(s, actorId);
  if (s.over) throw new IllegalMove('the game is over');
  const me = playerOf(s, actorId);
  if (!me || me.out) throw new IllegalMove('you are not in this game');
  if (actorOf(s) !== me.id) throw new IllegalMove(s.claims.length > 0 ? 'wait for the action to be answered' : 'it is not your turn');

  const claim = s.claims[0];
  if (claim) {
    const answering = s.nos % 2 === 0;
    if (action.type === 'NO') {
      const no = me.hand.find((c) => c.action === 'just-say-no');
      if (!no) throw new IllegalMove('you do not hold a Just Say No');
      const out = setPlayer({ ...s, nos: s.nos + 1, discard: [...s.discard, no] }, me.id, (p) => ({ ...p, hand: without(p.hand, no.id) }));
      return finalize(checkWin(settle(record(out, { player: me.id, kind: 'no', target: answering ? claim.to : claim.from, card: claim.why, count: s.nos + 1 }))));
    }
    if (action.type === 'ACCEPT') {
      if (answering && claim.kind === 'pay') throw new IllegalMove('choose the cards you pay with');
      const next = { ...s, claims: s.claims.slice(1), nos: 0 };
      return finalize(checkWin(settle(answering ? fulfil(next, claim) : next)));
    }
    if (action.type === 'PAY' && answering && claim.kind === 'pay') return finalize(checkWin(settle(pay(s, me, claim, Array.isArray(action.cards) ? action.cards : []))));
    throw new IllegalMove('answer the action first');
  }

  if (action.type === 'DRAW') {
    if (s.phase !== 'draw') throw new IllegalMove('you have already drawn');
    const n = me.hand.length === 0 ? 5 : 2;
    return finalize(record({ ...drawCards(s, me.id, n), phase: 'play' }, { player: me.id, kind: 'draw', count: n }));
  }
  if (s.phase !== 'play') throw new IllegalMove('draw your cards first');
  if (action.type === 'END') return finalize(endTurn(s, me, Array.isArray(action.discard) ? action.discard : []));
  if (action.type === 'MOVE') {
    const placed = me.props.find((x) => x.card.id === action.card);
    if (!placed || placed.card.kind !== 'wild' || !placed.card.colors.includes(action.color)) throw new IllegalMove('only a wild property can change colour, to a colour it shows');
    if (placed.color === action.color) return s;
    const out = setPlayer(s, me.id, (p) => ({ ...p, props: p.props.map((x) => (x.card.id === action.card ? { ...x, color: action.color } : x)) }));
    return finalize(checkWin(record(out, { player: me.id, kind: 'move', card: placed.card.name, color: action.color })));
  }
  if (s.plays >= PLAYS) throw new IllegalMove('you have played 3 cards: end your turn');
  if (action.type === 'BANK') {
    const card = me.hand.find((c) => c.id === action.card);
    if (!card || card.kind === 'property' || card.kind === 'wild') throw new IllegalMove('only money and action cards go in the bank');
    const out = setPlayer({ ...s, plays: s.plays + 1 }, me.id, (p) => ({ ...p, hand: without(p.hand, card.id), bank: [...p.bank, card] }));
    return finalize(record(out, { player: me.id, kind: 'bank', card: card.name, amount: card.value }));
  }
  if (action.type === 'PROPERTY') {
    const card = me.hand.find((c) => c.id === action.card);
    if (!card || (card.kind !== 'property' && card.kind !== 'wild')) throw new IllegalMove('that is not a property in your hand');
    const color = card.kind === 'property' ? card.colors[0] : action.color;
    if (!color || !card.colors.includes(color)) throw new IllegalMove('choose a colour the wild card shows');
    const out = setPlayer({ ...s, plays: s.plays + 1 }, me.id, (p) => ({ ...p, hand: without(p.hand, card.id), props: [...p.props, { card, color }] }));
    return finalize(checkWin(record(out, { player: me.id, kind: 'property', card: card.name, color })));
  }
  if (action.type === 'PLAY') return finalize(checkWin(settle(playAction(s, me, action))));
  throw new IllegalMove('unknown action');
}

/** Who must act: the player answering a claim (or its claimant, answering a Just Say No), else the player whose turn it is. */
function actorOf(s: MdState): string | null {
  if (s.over) return null;
  const c = s.claims[0];
  if (c) return s.nos % 2 === 0 ? c.from : c.to;
  return s.players[s.turn].id;
}

// ---------------------------------------------------------------------------
// Bots.

/** The cheapest way to pay `amount` from `cards`: no more over it than needed, then as few cards as possible. */
export function cheapestPayment(cards: MdCard[], amount: number): MdCard[] {
  const total = cards.reduce((n, c) => n + c.value, 0);
  if (total <= amount) return cards;
  // best[v] = the fewest cards that add up to exactly v.
  const best: (MdCard[] | null)[] = Array.from({ length: total + 1 }, () => null);
  best[0] = [];
  for (const c of cards) for (let v = total; v >= c.value; v--) if (best[v - c.value] && (!best[v] || best[v - c.value]!.length + 1 < best[v]!.length)) best[v] = [...best[v - c.value]!, c];
  for (let v = amount; v <= total; v++) if (best[v]) return best[v]!;
  return cards;
}

/** How much a player wants to keep a property: more the nearer its set is to complete. */
function attachment(p: MdPlayer, placed: Placed): number {
  const n = pileOf(p, placed.color).length;
  return placed.card.value + (10 * Math.min(n, SET_SIZE[placed.color])) / SET_SIZE[placed.color] + (isComplete(p, placed.color) ? 20 : 0);
}

function botPayment(me: MdPlayer, amount: number, level: string, rand: () => number): number[] {
  if (level === 'easy') {
    const pool = [...payable(me)].sort(() => rand() - 0.5);
    const out: MdCard[] = [];
    for (const c of pool) {
      if (out.reduce((n, x) => n + x.value, 0) >= amount) break;
      out.push(c);
    }
    return out.map((c) => c.id);
  }
  const bankTotal = me.bank.reduce((n, c) => n + c.value, 0);
  if (bankTotal >= amount) {
    if (level === 'hard') return cheapestPayment(me.bank, amount).map((c) => c.id);
    // Biggest notes first, with no thought for change.
    const out: MdCard[] = [];
    for (const c of [...me.bank].sort((a, b) => b.value - a.value)) {
      if (out.reduce((n, x) => n + x.value, 0) >= amount) break;
      out.push(c);
    }
    return out.map((c) => c.id);
  }
  // The bank is not enough: all of it, then buildings and the properties least worth keeping.
  const keep = (x: Placed) => (level === 'hard' ? attachment(me, x) : x.card.value);
  const rest = [...me.buildings.map((b) => ({ card: b.card, keep: 4 })), ...me.props.filter((x) => x.card.value > 0).map((x) => ({ card: x.card, keep: keep(x) }))].sort((a, b) => a.keep - b.keep);
  const out = [...me.bank];
  let paid = bankTotal;
  for (const r of rest) {
    if (paid >= amount) break;
    out.push(r.card);
    paid += r.card.value;
  }
  return out.map((c) => c.id);
}

function botAnswer(s: MdState, me: MdPlayer, level: string, rand: () => number): MdAction {
  const c = s.claims[0];
  const keen = level === 'hard' ? 1 : level === 'normal' ? 0.6 : 0.25;
  if (s.nos % 2 === 1) {
    // My claim was refused: insist only when it is worth a card.
    const worth = c.kind === 'set' ? 1 : c.kind === 'pay' ? ((c.amount ?? 0) >= 5 ? 0.6 : 0.1) : 0.5;
    return holdsNo(me) && rand() < worth * keen ? { type: 'NO' } : { type: 'ACCEPT' };
  }
  if (holdsNo(me)) {
    const bankTotal = me.bank.reduce((n, x) => n + x.value, 0);
    const hurts = c.kind === 'set' ? 1 : c.kind === 'pay' ? ((c.amount ?? 0) > bankTotal && me.props.length > 0 ? 0.9 : level === 'hard' ? 0 : (c.amount ?? 0) >= 5 ? 0.5 : 0.1) : (() => {
      const placed = me.props.find((x) => x.card.id === c.card);
      return placed && pileOf(me, placed.color).length >= SET_SIZE[placed.color] - 1 ? 0.8 : 0.3;
    })();
    if (rand() < hurts * keen) return { type: 'NO' };
  }
  return c.kind === 'pay' ? { type: 'PAY', cards: botPayment(me, c.amount!, level, rand) } : { type: 'ACCEPT' };
}

/** The colour a wild in hand is best laid in: the set it brings nearest to complete. */
function bestColor(me: MdPlayer, card: MdCard): Color {
  const open = card.colors.filter((c) => !isComplete(me, c));
  const pool = open.length > 0 ? open : card.colors;
  return [...pool].sort((a, b) => (pileOf(me, b).length + 1) / SET_SIZE[b] - (pileOf(me, a).length + 1) / SET_SIZE[a])[0];
}

function botPlay(s: MdState, me: MdPlayer, level: string, rand: () => number): MdAction {
  const foes = others(s, me.id);
  const hand = me.hand;
  const find = (kind: ActionKind) => hand.find((c) => c.action === kind);
  const richest = [...foes].sort((a, b) => worthOf(b) - worthOf(a))[0];
  const end = (): MdAction => {
    const over = hand.length - HAND_LIMIT;
    if (over <= 0) return { type: 'END' };
    const spare = [...hand].sort((a, b) => keepValue(a) - keepValue(b));
    return { type: 'END', discard: spare.slice(0, over).map((c) => c.id) };
  };
  const keepValue = (c: MdCard) => (c.kind === 'property' || c.kind === 'wild' ? 8 + c.value : c.action === 'just-say-no' ? 9 : c.action === 'deal-breaker' ? 10 : c.value);
  if (s.plays >= PLAYS) return end();

  const hard = level === 'hard';
  // Easy often stops with plays to spare.
  if (level === 'easy' && rand() < 0.08) return end();
  const leader = [...foes].sort((a, b) => completeColors(b).length - completeColors(a).length || worthOf(b) - worthOf(a))[0];
  const anyone = foes[Math.floor(rand() * foes.length)];
  const go = find('pass-go');
  if (go && hand.length <= HAND_LIMIT) return { type: 'PLAY', card: go.id };

  // A full set to take.
  const breaker = find('deal-breaker');
  if (breaker) {
    const prize = foes.flatMap((p) => completeColors(p).map((color) => ({ p, color }))).sort((a, b) => Number(isComplete(me, a.color)) - Number(isComplete(me, b.color)) || rentOf(b.p, b.color) - rentOf(a.p, a.color))[0];
    if (prize) return { type: 'PLAY', card: breaker.id, target: prize.p.id, color: prize.color };
  }
  // Properties: whatever completes or extends a set first.
  const props = hand.filter((c) => c.kind === 'property' || c.kind === 'wild').map((c) => ({ c, color: bestColor(me, c) }));
  if (props.length > 0) {
    const pick = props.sort((a, b) => (pileOf(me, b.color).length + 1) / SET_SIZE[b.color] - (pileOf(me, a.color).length + 1) / SET_SIZE[a.color])[0];
    return { type: 'PROPERTY', card: pick.c.id, color: pick.color };
  }
  // Buildings on full sets.
  for (const kind of ['house', 'hotel'] as const) {
    const card = find(kind);
    const color = card && completeColors(me).find((c) => (s.buildAnywhere || (c !== 'railroad' && c !== 'utility')) && !me.buildings.some((b) => b.color === c && b.card.action === kind) && (kind === 'house' || me.buildings.some((b) => b.color === c && b.card.action === 'house')));
    if (card && color) return { type: 'PLAY', card: card.id, color };
  }
  // A property that brings one of my sets on, taken from someone.
  const takeable = foes.flatMap((p) => p.props.filter((x) => stealable(p, x.card.id)).map((x) => ({ p, x, gain: Math.max(...x.card.colors.filter((c) => !isComplete(me, c)).map((c) => (pileOf(me, c).length + 1) / SET_SIZE[c]), 0) + (pileOf(p, x.color).length >= SET_SIZE[x.color] - 1 ? 0.3 : 0) })));
  // Hard takes the card that helps most; the others take whatever is there.
  const wanted = hard ? [...takeable].sort((a, b) => b.gain - a.gain)[0] : takeable[Math.floor(rand() * takeable.length)];
  const sly = find('sly-deal');
  if (sly && wanted) return { type: 'PLAY', card: sly.id, target: wanted.p.id, take: wanted.x.card.id };
  const forced = find('forced-deal');
  const spare = [...me.props].filter((x) => !isComplete(me, x.color)).sort((a, b) => attachment(me, a) - attachment(me, b))[0];
  if (hard && forced && wanted && spare && wanted.gain > pileOf(me, spare.color).length / SET_SIZE[spare.color] + 0.2) return { type: 'PLAY', card: forced.id, target: wanted.p.id, take: wanted.x.card.id, give: spare.card.id };
  // Rent on the colour that pays most.
  const rents = hand
    .filter((c) => c.kind === 'rent')
    .map((c) => ({ c, color: [...c.colors].sort((a, b) => rentOf(me, b) - rentOf(me, a))[0] }))
    .map((r) => ({ ...r, amount: rentOf(me, r.color) }))
    .sort((a, b) => b.amount - a.amount)[0];
  // Hard charges whoever is ahead; Normal the richest; Easy anyone.
  const victim = hard && worthOf(leader) > 0 ? leader : level === 'easy' ? anyone : richest;
  if (rents && rents.amount >= 1 && foes.some((p) => worthOf(p) > 0)) {
    const double = find('double-rent');
    const doubles = hard && double && rents.amount >= 3 && s.plays + 2 <= PLAYS ? [double.id] : [];
    return { type: 'PLAY', card: rents.c.id, color: rents.color, target: victim.id, ...(doubles.length ? { doubles } : {}) };
  }
  const debt = find('debt-collector');
  if (debt && worthOf(victim) > 0) return { type: 'PLAY', card: debt.id, target: victim.id };
  const party = find('birthday');
  if (party && foes.some((p) => worthOf(p) > 0)) return { type: 'PLAY', card: party.id };
  if (go) return { type: 'PLAY', card: go.id };
  // Money in the bank; then spare action cards, so a debt does not cost property.
  const cash = hand.filter((c) => c.kind === 'money').sort((a, b) => b.value - a.value)[0];
  if (cash) return { type: 'BANK', card: cash.id };
  const bankTotal = me.bank.reduce((n, c) => n + c.value, 0);
  const idle = hand.filter((c) => (c.kind === 'rent' && rentOf(me, [...c.colors].sort((a, b) => rentOf(me, b) - rentOf(me, a))[0]) === 0) || c.action === 'double-rent' || c.action === 'house' || c.action === 'hotel').sort((a, b) => b.value - a.value)[0];
  if (idle && (bankTotal < 6 || hand.length > HAND_LIMIT)) return { type: 'BANK', card: idle.id };
  return end();
}

function mdBotAction(s: MdState, rand: () => number = Math.random): MdAction {
  const me = playerOf(s, actorOf(s) ?? '')!;
  const level = me.difficulty ?? 'normal';
  if (s.claims.length > 0) return botAnswer(s, me, level, rand);
  if (s.phase === 'draw') return { type: 'DRAW' };
  return botPlay(s, me, level, rand);
}

export const mdKit: GameKit<MdState, MdAction> = {
  seatError: (count) => (count >= 2 && count <= 5 ? null : 'Monopoly Deal is for 2-5 players'),
  create: (seats, seed, options) => createMd(seats, seed, (options ?? {}) as MdOptions),
  apply: applyMd,
  actor: actorOf,
  players: (s) => s.players,
  isOver: (s) => s.over,
  bot: (s, rand) => mdBotAction(s, rand),
  // Out of time: pay as cheaply as possible, give in to anything else, or draw and end the turn, discarding the lowest cards.
  timeout: (s) => {
    const me = playerOf(s, actorOf(s) ?? '')!;
    const c = s.claims[0];
    if (c) return s.nos % 2 === 0 && c.kind === 'pay' ? { type: 'PAY', cards: botPayment(me, c.amount!, 'hard', () => 0.5) } : { type: 'ACCEPT' };
    if (s.phase === 'draw') return { type: 'DRAW' };
    const over = me.hand.length - HAND_LIMIT;
    return over > 0 ? { type: 'END', discard: [...me.hand].sort((a, b) => a.value - b.value).slice(0, over).map((x) => x.id) } : { type: 'END' };
  },
  botDelay: (s) => (s.claims.length > 0 ? 1100 : s.phase === 'draw' ? 700 : 1000),
  setBot: (s, id, difficulty) => setPlayer(s, id, (p) => ({ ...p, isAI: true, difficulty })),
  forfeit,
  end: (s) => ({ ...s, over: true, claims: [], nos: 0 }),
  // Hands and the draw pile are hidden; banks, properties and the discard pile are open.
  redact: (s, viewer) => ({ ...s, deck: [], seed: 0, players: s.players.map((p) => (p.id === viewer ? p : { ...p, hand: [] })) }),
  turnMs: 60_000,
};
