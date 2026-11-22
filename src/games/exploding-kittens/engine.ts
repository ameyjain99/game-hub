/**
 * Exploding Kittens (the original 56-card edition, 2-5 players).
 *
 * On your turn you play as many cards as you like, then draw one to end the
 * turn. Draw an Exploding Kitten and you are out, unless you hold a Defuse:
 * the Defuse is discarded and the Kitten goes back into the draw pile wherever
 * you choose, in secret. The last player left wins.
 *
 * Every action (a card or a combo) waits a moment before it takes effect, so
 * that any player may answer it with a Nope, and a Nope with another Nope.
 * An Exploding Kitten and a Defuse can never be Noped.
 */
import { DEALER_ID, IllegalMove, nextRandom, shuffle, type GameKit, type KitCommonAction, type KitPlayer, type KitSeat } from '../kit/engine';

const CAT_KINDS = ['tacocat', 'cattermelon', 'potato', 'beard', 'rainbow'] as const;
export type CatKind = (typeof CAT_KINDS)[number];
export type Kind = 'exploding' | 'defuse' | 'nope' | 'attack' | 'skip' | 'favor' | 'shuffle' | 'future' | CatKind;

/** The 56 cards of the box. */
export const COUNTS: Record<Kind, number> = {
  exploding: 4,
  defuse: 6,
  nope: 5,
  attack: 4,
  skip: 4,
  favor: 4,
  shuffle: 4,
  future: 5,
  tacocat: 4,
  cattermelon: 4,
  potato: 4,
  beard: 4,
  rainbow: 4,
};

export const CARD_NAME: Record<Kind, string> = {
  exploding: 'Exploding Kitten',
  defuse: 'Defuse',
  nope: 'Nope',
  attack: 'Attack',
  skip: 'Skip',
  favor: 'Favor',
  shuffle: 'Shuffle',
  future: 'See the Future',
  tacocat: 'Tacocat',
  cattermelon: 'Cattermelon',
  potato: 'Hairy Potato Cat',
  beard: 'Beard Cat',
  rainbow: 'Rainbow-Ralphing Cat',
};

export const isCat = (k: Kind): k is CatKind => (CAT_KINDS as readonly string[]).includes(k);

export interface Card {
  id: number;
  kind: Kind;
}

/** What a set of cards played together does. */
export type Play = 'attack' | 'skip' | 'favor' | 'shuffle' | 'future' | 'pair' | 'triple' | 'five';

interface EkPlayer extends KitPlayer {
  hand: Card[];
  handCount: number;
  /** Exploded, or gone from the table. */
  out: boolean;
  /** Gone from the table (not exploded). */
  left?: boolean;
  /** What this player knows of the draw pile, from the top down (null where they don't). */
  known: (Kind | null)[];
}

/** An action played and not yet in effect: the table may still Nope it. */
export interface Pending {
  by: string;
  play: Play;
  cards: Kind[];
  target?: string;
  /** Three of a kind: the card asked for. */
  named?: Kind;
  /** Five different cards: the discarded card to take (its id). */
  take?: number;
  /** Who has played a Nope on it, in order. An odd number cancels the action. */
  nopes: string[];
  /** Players who have said they will let it happen. */
  passed: string[];
}

export interface EkEvent {
  seq: number;
  player: string;
  kind: 'play' | 'nope' | 'cancel' | 'attack' | 'skip' | 'shuffle' | 'future' | 'ask' | 'give' | 'steal' | 'named' | 'take' | 'draw' | 'defuse' | 'insert' | 'explode' | 'leave';
  play?: Play;
  cards?: Kind[];
  target?: string;
  /** The card that changed hands or was drawn; only `privy` see it. */
  card?: Kind;
  privy?: string[];
  named?: Kind;
  got?: boolean;
  /** Attack: the turns the target must take. Nope: how many Nopes are on the action. */
  count?: number;
}

export interface EkOptions {
  /** Cards dealt to each player before the Defuse (7 by the official rules). */
  handSize?: number;
  /** Any two or three cards of one name make a combo (the official special combos). Off: only Cat Cards pair, and there are no threes or fives. */
  anyCombos?: boolean;
  /** An Attack played by a player under attack passes their remaining turns on, plus 2 (the official rule). Off: the next player always takes 2. */
  stackAttacks?: boolean;
  /** A third of the draw pile is set aside, unseen, before the Kittens go in. */
  shortGame?: boolean;
}

export const HAND_SIZES = [7, 5];

export interface EkState {
  players: EkPlayer[];
  turn: number;
  /** Turns the player to move still owes, this one included. */
  turnsLeft: number;
  /** Whether those turns come from an Attack. */
  attacked: boolean;
  /** The draw pile, top first. */
  deck: Card[];
  deckCount: number;
  discard: Card[];
  pending: Pending | null;
  /** A Favor in effect: `from` must choose a card to give `to`. */
  favor: { from: string; to: string } | null;
  /** The player who drew a Kitten and Defused it, choosing where it goes back. */
  defusing: string | null;
  kitten: Card | null;
  /** The top cards a See the Future showed, for the player who played it. */
  seen: { player: string; cards: Kind[] } | null;
  last: EkEvent | null;
  history: EkEvent[];
  winner: string | null;
  over: boolean;
  game: number;
  seed: number;
  handSize: number;
  anyCombos: boolean;
  stackAttacks: boolean;
  shortGame: boolean;
}

export type EkAction =
  | { type: 'PLAY'; cards: number[]; target?: string; named?: Kind; take?: number }
  | { type: 'NOPE' }
  /** Let the action waiting happen (you will not Nope it). */
  | { type: 'PASS' }
  /** The Nope window closing: the game's own step. */
  | { type: 'RESOLVE' }
  | { type: 'DRAW' }
  | { type: 'GIVE'; card: number }
  /** Put the Defused Kitten back `index` cards from the top (0 is the top). */
  | { type: 'INSERT'; index: number };

const HISTORY = 40;
/** How long an action waits for a Nope while a person who holds one may still play it. */
export const NOPE_MS = 4500;
/** How long a played card lies on the table before it takes effect when nobody is being waited for. */
const SETTLE_MS = 750;

const alive = (s: EkState) => s.players.filter((p) => !p.out);
const playerOf = (s: EkState, id: string) => s.players.find((p) => p.id === id);
const holds = (p: EkPlayer, kind: Kind) => p.hand.some((c) => c.kind === kind);

/** Kittens still in the draw pile: one fewer than the players left, less one being put back. */
export const kittensInDeck = (s: Pick<EkState, 'players' | 'defusing'>) => Math.max(0, s.players.filter((p) => !p.out).length - 1 - (s.defusing ? 1 : 0));

/** Whoever played the last card on the action waiting: they cannot Nope themselves. */
export const topOf = (p: Pending) => p.nopes[p.nopes.length - 1] ?? p.by;

function nextAlive(s: EkState, from: number): number {
  for (let step = 1; step <= s.players.length; step++) {
    const seat = (from + step) % s.players.length;
    if (!s.players[seat].out) return seat;
  }
  return from;
}

function finalize(s: EkState): EkState {
  return { ...s, deckCount: s.deck.length, players: s.players.map((p) => ({ ...p, handCount: p.hand.length })) };
}

function record(s: EkState, e: Omit<EkEvent, 'seq'>): EkState {
  const event = { ...e, seq: (s.last?.seq ?? 0) + 1 };
  return { ...s, last: event, history: [...s.history, event].slice(-HISTORY) };
}

const setPlayer = (s: EkState, id: string, change: (p: EkPlayer) => EkPlayer): EkState => ({ ...s, players: s.players.map((p) => (p.id === id ? change(p) : p)) });

/**
 * What these cards do when played together, or null if they are not a play:
 * one action card, two or three of a kind, or five different cards.
 */
export function playOf(kinds: Kind[], anyCombos: boolean): Play | null {
  if (kinds.some((k) => k === 'exploding')) return null;
  if (kinds.length === 1) {
    const k = kinds[0];
    return k === 'attack' || k === 'skip' || k === 'favor' || k === 'shuffle' || k === 'future' ? k : null;
  }
  const same = kinds.every((k) => k === kinds[0]);
  if (kinds.length === 2 && same) return anyCombos || isCat(kinds[0]) ? 'pair' : null;
  if (!anyCombos) return null;
  if (kinds.length === 3 && same) return 'triple';
  if (kinds.length === 5 && new Set(kinds).size === 5) return 'five';
  return null;
}

export function createEk(seats: KitSeat[], seed: number, options: EkOptions = {}, game = 1): EkState {
  const handSize = HAND_SIZES.includes(options.handSize ?? 7) ? (options.handSize ?? 7) : 7;
  let id = 0;
  const make = (kind: Kind, n: number): Card[] => Array.from({ length: n }, () => ({ id: id++, kind }));
  const ordinary = (Object.keys(COUNTS) as Kind[]).filter((k) => k !== 'exploding' && k !== 'defuse').flatMap((k) => make(k, COUNTS[k]));
  const defuses = make('defuse', COUNTS.defuse);
  const kittens = make('exploding', COUNTS.exploding);

  let [pile, s1] = shuffle(ordinary, seed);
  const players: EkPlayer[] = seats.map((seat, i) => {
    const hand = [...pile.slice(0, handSize), defuses[i]];
    pile = pile.slice(handSize);
    return { id: `p${i}`, name: seat.name, isAI: seat.isAI, difficulty: seat.difficulty, hand, handCount: hand.length, out: false, known: [] };
  });
  if (options.shortGame) pile = pile.slice(Math.floor(pile.length / 3));
  // Two spare Defuses at most go back in, so a small table is not swimming in them.
  const spare = defuses.slice(seats.length, seats.length + Math.min(2, defuses.length - seats.length));
  const [deck, s2] = shuffle([...pile, ...spare, ...kittens.slice(0, seats.length - 1)], s1);
  const [first, s3] = nextRandom(s2);
  return finalize({
    players,
    turn: Math.floor(first * seats.length),
    turnsLeft: 1,
    attacked: false,
    deck,
    deckCount: deck.length,
    discard: [],
    pending: null,
    favor: null,
    defusing: null,
    kitten: null,
    seen: null,
    last: null,
    history: [],
    winner: null,
    over: false,
    game,
    seed: s3,
    handSize,
    anyCombos: options.anyCombos !== false,
    stackAttacks: options.stackAttacks !== false,
    shortGame: !!options.shortGame,
  });
}

/** One of the player's turns is done: the next of them, or the next player's. */
function endTurn(s: EkState): EkState {
  if (s.turnsLeft > 1) return { ...s, turnsLeft: s.turnsLeft - 1 };
  return { ...s, turn: nextAlive(s, s.turn), turnsLeft: 1, attacked: false };
}

function checkWin(s: EkState): EkState {
  const left = alive(s);
  return left.length === 1 ? { ...s, over: true, winner: left[0].id, pending: null, favor: null, defusing: null } : s;
}

/** Everyone's knowledge of the pile after its top card is taken. */
const forgetTop = (s: EkState): EkState => ({ ...s, players: s.players.map((p) => ({ ...p, known: p.known.slice(1) })) });
const forgetAll = (s: EkState): EkState => ({ ...s, players: s.players.map((p) => ({ ...p, known: [] })) });

function moveCard(s: EkState, from: string, to: string, cardId: number): EkState {
  const card = playerOf(s, from)!.hand.find((c) => c.id === cardId)!;
  const taken = setPlayer(s, from, (p) => ({ ...p, hand: p.hand.filter((c) => c.id !== cardId) }));
  return setPlayer(taken, to, (p) => ({ ...p, hand: [...p.hand, card] }));
}

/** The action waiting takes effect, or is cancelled by an odd number of Nopes. */
function resolve(s0: EkState): EkState {
  const p = s0.pending!;
  let s: EkState = { ...s0, pending: null };
  if (p.nopes.length % 2 === 1) return record(s, { player: p.by, kind: 'cancel', play: p.play });
  const seat = s.players.findIndex((x) => x.id === p.by);
  switch (p.play) {
    case 'attack': {
      const turns = (s.stackAttacks && s.attacked ? s.turnsLeft : 0) + 2;
      const next = nextAlive(s, seat);
      s = { ...s, turn: next, turnsLeft: turns, attacked: true };
      return record(s, { player: p.by, kind: 'attack', target: s.players[next].id, count: turns });
    }
    case 'skip':
      return endTurn(record(s, { player: p.by, kind: 'skip' }));
    case 'shuffle': {
      const [deck, seed] = shuffle(s.deck, s.seed);
      return record(forgetAll({ ...s, deck, seed }), { player: p.by, kind: 'shuffle' });
    }
    case 'future': {
      const cards = s.deck.slice(0, 3).map((c) => c.kind);
      s = setPlayer(s, p.by, (x) => ({ ...x, known: [...cards, ...x.known.slice(cards.length)] }));
      return record({ ...s, seen: { player: p.by, cards } }, { player: p.by, kind: 'future' });
    }
    case 'favor': {
      const target = playerOf(s, p.target!);
      if (!target || target.out || target.hand.length === 0) return s;
      return record({ ...s, favor: { from: target.id, to: p.by } }, { player: p.by, kind: 'ask', target: target.id });
    }
    case 'pair': {
      const target = playerOf(s, p.target!);
      if (!target || target.out || target.hand.length === 0) return s;
      const [r, seed] = nextRandom(s.seed);
      const card = target.hand[Math.floor(r * target.hand.length)];
      s = moveCard({ ...s, seed }, target.id, p.by, card.id);
      return record(s, { player: p.by, kind: 'steal', target: target.id, card: card.kind, privy: [p.by, target.id] });
    }
    case 'triple': {
      const target = playerOf(s, p.target!);
      const card = target && !target.out ? target.hand.find((c) => c.kind === p.named) : undefined;
      if (card) s = moveCard(s, target!.id, p.by, card.id);
      return record(s, { player: p.by, kind: 'named', target: p.target, named: p.named, got: !!card });
    }
    case 'five': {
      const card = s.discard.find((c) => c.id === p.take);
      if (!card) return s;
      s = { ...s, discard: s.discard.filter((c) => c.id !== card.id) };
      s = setPlayer(s, p.by, (x) => ({ ...x, hand: [...x.hand, card] }));
      return record(s, { player: p.by, kind: 'take', card: card.kind });
    }
  }
}

function play(s: EkState, me: EkPlayer, a: Extract<EkAction, { type: 'PLAY' }>): EkState {
  const ids = Array.isArray(a.cards) ? a.cards : [];
  const cards = ids.map((id) => me.hand.find((c) => c.id === id));
  if (cards.length === 0 || cards.some((c) => !c) || new Set(ids).size !== ids.length) throw new IllegalMove('you do not hold those cards');
  const kinds = cards.map((c) => c!.kind);
  const what = playOf(kinds, s.anyCombos);
  if (!what) throw new IllegalMove('those cards cannot be played together');
  const pending: Pending = { by: me.id, play: what, cards: kinds, nopes: [], passed: [] };
  if (what === 'favor' || what === 'pair' || what === 'triple') {
    const target = playerOf(s, a.target ?? '');
    if (!target || target.out || target.id === me.id) throw new IllegalMove('choose another player still in the game');
    if (target.hand.length === 0) throw new IllegalMove('that player has no cards');
    pending.target = target.id;
  }
  if (what === 'triple') {
    if (!a.named || !(a.named in COUNTS) || a.named === 'exploding') throw new IllegalMove('name the card you want');
    pending.named = a.named;
  }
  if (what === 'five') {
    if (!s.discard.some((c) => c.id === a.take)) throw new IllegalMove('choose a card from the discard pile');
    pending.take = a.take;
  }
  const out = setPlayer({ ...s, seen: null }, me.id, (p) => ({ ...p, hand: p.hand.filter((c) => !ids.includes(c.id)) }));
  return record({ ...out, discard: [...out.discard, ...(cards as Card[])], pending }, { player: me.id, kind: 'play', play: what, cards: kinds, target: pending.target, named: pending.named });
}

function draw(s0: EkState, me: EkPlayer): EkState {
  const card = s0.deck[0];
  if (!card) throw new IllegalMove('the draw pile is empty');
  let s = forgetTop({ ...s0, deck: s0.deck.slice(1), seen: null });
  if (card.kind !== 'exploding') {
    s = setPlayer(s, me.id, (p) => ({ ...p, hand: [...p.hand, card] }));
    return endTurn(record(s, { player: me.id, kind: 'draw', card: card.kind, privy: [me.id] }));
  }
  const defuse = me.hand.find((c) => c.kind === 'defuse');
  if (defuse) {
    s = setPlayer(s, me.id, (p) => ({ ...p, hand: p.hand.filter((c) => c.id !== defuse.id) }));
    return record({ ...s, discard: [...s.discard, defuse], defusing: me.id, kitten: card }, { player: me.id, kind: 'defuse' });
  }
  // No Defuse: the player is out, their hand is discarded and the Kitten leaves the game.
  s = setPlayer(s, me.id, (p) => ({ ...p, out: true, hand: [], known: [] }));
  s = record({ ...s, discard: [...s.discard, ...me.hand] }, { player: me.id, kind: 'explode' });
  return checkWin({ ...s, turn: nextAlive(s, s.turn), turnsLeft: 1, attacked: false });
}

function insert(s: EkState, me: EkPlayer, index: number): EkState {
  if (!Number.isInteger(index) || index < 0 || index > s.deck.length) throw new IllegalMove('choose a place in the draw pile');
  const deck = [...s.deck.slice(0, index), s.kitten!, ...s.deck.slice(index)];
  // Only the player who placed it knows where it is; what anyone else knew of the pile may have moved.
  const players = s.players.map((p) => {
    if (p.id !== me.id) return { ...p, known: [] };
    const known = p.known.slice();
    while (known.length < index) known.push(null);
    known.splice(index, 0, 'exploding');
    return { ...p, known };
  });
  return endTurn(record({ ...s, deck, players, defusing: null, kitten: null }, { player: me.id, kind: 'insert' }));
}

/** A player leaves the table: their cards are discarded and one Kitten leaves the pile with them. */
function forfeit(s0: EkState, id: string): EkState {
  const seat = s0.players.findIndex((p) => p.id === id);
  const me = s0.players[seat];
  if (!me || me.out) return s0;
  let s = setPlayer(s0, id, (p) => ({ ...p, out: true, left: true, hand: [], known: [] }));
  if (s.over) return finalize(s);
  s = { ...s, discard: [...s.discard, ...me.hand] };
  if (s.defusing === id) s = { ...s, defusing: null, kitten: null };
  else {
    const at = s.deck.findIndex((c) => c.kind === 'exploding');
    if (at >= 0) s = forgetAll({ ...s, deck: s.deck.filter((_, i) => i !== at) });
  }
  if (s.pending && (s.pending.by === id || s.pending.target === id)) s = { ...s, pending: null };
  if (s.favor && (s.favor.from === id || s.favor.to === id)) s = { ...s, favor: null };
  s = record(s, { player: id, kind: 'leave' });
  if (s.turn === seat) s = { ...s, turn: nextAlive(s, seat), turnsLeft: 1, attacked: false, pending: null };
  return finalize(checkWin(s));
}

function applyEk(s: EkState, action: EkAction | KitCommonAction, actorId: string): EkState {
  if (action.type === 'REMATCH') {
    if (!s.over) throw new IllegalMove('the game is still going');
    const seats = s.players.filter((p) => !p.left).map((p) => ({ name: p.name, isAI: p.isAI, difficulty: p.difficulty }));
    if (seats.length < 2) throw new IllegalMove('not enough players for another game');
    const next = createEk(seats, s.seed, { handSize: s.handSize, anyCombos: s.anyCombos, stackAttacks: s.stackAttacks, shortGame: s.shortGame }, s.game + 1);
    // Seats keep their ids, so a room's players stay who they were.
    const ids = s.players.filter((p) => !p.left).map((p) => p.id);
    return finalize({ ...next, players: next.players.map((p, i) => ({ ...p, id: ids[i] })) });
  }
  if (action.type === 'RESIGN') return forfeit(s, actorId);
  if (s.over) throw new IllegalMove('the game is over');

  if (action.type === 'RESOLVE') {
    if (actorId !== DEALER_ID || !s.pending) throw new IllegalMove('nothing to resolve');
    return finalize(checkWin(resolve(s)));
  }
  const me = playerOf(s, actorId);
  if (!me || me.out) throw new IllegalMove('you are not in this game');

  if (action.type === 'NOPE' || action.type === 'PASS') {
    const p = s.pending;
    if (!p) throw new IllegalMove('there is nothing to Nope');
    if (action.type === 'PASS') return p.passed.includes(me.id) ? s : { ...s, pending: { ...p, passed: [...p.passed, me.id] } };
    if (topOf(p) === me.id) throw new IllegalMove('you cannot Nope your own card');
    const nope = me.hand.find((c) => c.kind === 'nope');
    if (!nope) throw new IllegalMove('you do not hold a Nope');
    const out = setPlayer(s, me.id, (x) => ({ ...x, hand: x.hand.filter((c) => c.id !== nope.id) }));
    const nopes = [...p.nopes, me.id];
    return finalize(record({ ...out, discard: [...out.discard, nope], pending: { ...p, nopes, passed: [] } }, { player: me.id, kind: 'nope', target: topOf(p), count: nopes.length }));
  }
  if (s.pending) throw new IllegalMove('wait: the last card can still be Noped');

  if (action.type === 'GIVE') {
    if (s.favor?.from !== me.id) throw new IllegalMove('nobody asked you for a Favor');
    const card = me.hand.find((c) => c.id === action.card);
    if (!card) throw new IllegalMove('you do not hold that card');
    const to = s.favor.to;
    return finalize(record(moveCard({ ...s, favor: null }, me.id, to, card.id), { player: me.id, kind: 'give', target: to, card: card.kind, privy: [me.id, to] }));
  }
  if (action.type === 'INSERT') {
    if (s.defusing !== me.id) throw new IllegalMove('you have no Kitten to put back');
    return finalize(insert(s, me, action.index));
  }
  if (s.favor) throw new IllegalMove('waiting for the Favor');
  if (s.defusing) throw new IllegalMove('waiting for the Kitten to go back in the pile');
  if (s.players[s.turn].id !== me.id) throw new IllegalMove('it is not your turn');
  if (action.type === 'PLAY') return finalize(play(s, me, action));
  if (action.type === 'DRAW') return finalize(draw(s, me));
  throw new IllegalMove('unknown action');
}

/** The player who must act: a bot weighing a Nope, a Favor's giver, the Defuser, or the player whose turn it is. */
function actorOf(s: EkState): string | null {
  if (s.over) return null;
  if (s.pending) {
    const top = topOf(s.pending);
    const bot = alive(s).find((p) => p.isAI && p.id !== top && !s.pending!.passed.includes(p.id) && holds(p, 'nope'));
    return bot?.id ?? null;
  }
  if (s.favor) return s.favor.from;
  if (s.defusing) return s.defusing;
  return s.players[s.turn].id;
}

/** People who hold a Nope and have not yet said whether they will use it on the action waiting. */
const undecided = (s: EkState) => (s.pending ? alive(s).filter((p) => !p.isAI && p.id !== topOf(s.pending!) && !s.pending!.passed.includes(p.id) && holds(p, 'nope')) : []);

// ---------------------------------------------------------------------------
// Bots. They know only what a player would: their hand, the discard pile, how
// many cards everyone holds, and what they have seen of the draw pile.

/** How much a card is worth keeping, for choosing what to give away or throw into a combo. */
const WORTH: Record<Kind, number> = { exploding: 0, defuse: 100, nope: 60, attack: 52, skip: 46, future: 30, shuffle: 28, favor: 24, tacocat: 10, cattermelon: 10, potato: 10, beard: 10, rainbow: 10 };

/** The chance the next card is a Kitten, as far as `me` can tell. */
function danger(s: EkState, me: EkPlayer): number {
  if (me.known[0] === 'exploding') return 1;
  if (me.known[0]) return 0;
  const sure = me.known.filter((k) => k === 'exploding').length;
  const unknown = s.deckCount - me.known.filter((k) => k !== null).length;
  return unknown > 0 ? Math.max(0, kittensInDeck(s) - sure) / unknown : 0;
}

function botNope(s: EkState, me: EkPlayer, level: string, rand: () => number): EkAction {
  const p = s.pending!;
  const stands = p.nopes.length % 2 === 0;
  const aimedAtMe = p.target === me.id || (p.play === 'attack' && s.players[nextAlive(s, s.players.findIndex((x) => x.id === p.by))].id === me.id);
  let want = 0;
  if (stands && aimedAtMe && p.by !== me.id) {
    const exposed = !holds(me, 'defuse');
    want = p.play === 'attack' ? (exposed ? 0.9 : 0.45) : p.play === 'favor' ? 0.35 : 0.55;
  } else if (!stands && p.by === me.id) {
    // My own card was Noped: answer if it mattered.
    want = p.play === 'attack' || p.play === 'skip' ? 0.7 : 0.3;
  } else if (!stands && aimedAtMe) want = 0;
  const keen = level === 'hard' ? 1 : level === 'normal' ? 0.7 : 0.3;
  return rand() < want * keen ? { type: 'NOPE' } : { type: 'PASS' };
}

function botInsert(s: EkState, level: string, rand: () => number): EkAction {
  const size = s.deck.length;
  if (level === 'easy') return { type: 'INSERT', index: Math.floor(rand() * (size + 1)) };
  // More turns of my own to come: bury it. Otherwise leave it near the top for whoever is next.
  if (s.turnsLeft > 1) return { type: 'INSERT', index: Math.min(size, Math.ceil(size / 2) + Math.floor(rand() * (Math.floor(size / 2) + 1))) };
  const reach = level === 'hard' ? 2 : 4;
  return { type: 'INSERT', index: Math.min(size, Math.floor(rand() * reach)) };
}

function botTurn(s: EkState, me: EkPlayer, level: string, rand: () => number): EkAction {
  const others = alive(s).filter((p) => p.id !== me.id && p.handCount > 0);
  const richest = [...others].sort((a, b) => b.handCount - a.handCount)[0];
  const pick = (kind: Kind) => me.hand.find((c) => c.kind === kind);
  const one = (kind: Kind): EkAction | null => (pick(kind) ? { type: 'PLAY', cards: [pick(kind)!.id] } : null);
  const target = () => (level === 'hard' ? richest : others[Math.floor(rand() * others.length)]);
  /** Two or three cats of a kind, the commonest first. */
  const cats = (n: number) => CAT_KINDS.map((k) => me.hand.filter((c) => c.kind === k)).filter((g) => g.length >= n).sort((a, b) => b.length - a.length)[0]?.slice(0, n);

  if (level === 'easy') {
    const playable = (['attack', 'skip', 'shuffle', 'future', 'favor'] as Kind[]).filter((k) => pick(k) && (k !== 'favor' || others.length > 0));
    if (playable.length > 0 && rand() < 0.22) {
      const kind = playable[Math.floor(rand() * playable.length)];
      return { type: 'PLAY', cards: [pick(kind)!.id], ...(kind === 'favor' ? { target: target().id } : {}) };
    }
    return { type: 'DRAW' };
  }

  const p = danger(s, me);
  const safe = holds(me, 'defuse');
  const hard = level === 'hard';
  if (p === 1) return one('attack') ?? one('skip') ?? one('shuffle') ?? { type: 'DRAW' };
  // Look before drawing when the pile is dangerous and its top is unknown.
  if (me.known[0] == null && pick('future') && p > (hard ? (safe ? 0.2 : 0.1) : 0.3)) return one('future')!;
  // No Defuse: go and get one.
  if (!safe && others.length > 0) {
    const inDiscard = s.discard.find((c) => c.kind === 'defuse');
    if (hard && s.anyCombos && inDiscard) {
      const spare = [...me.hand].sort((a, b) => WORTH[a.kind] - WORTH[b.kind]).filter((c, i, all) => all.findIndex((x) => x.kind === c.kind) === i);
      if (spare.length >= 5 && WORTH[spare[4].kind] < WORTH.nope) return { type: 'PLAY', cards: spare.slice(0, 5).map((c) => c.id), take: inDiscard.id };
    }
    const three = s.anyCombos ? cats(3) : undefined;
    if (three && (hard || rand() < 0.5)) return { type: 'PLAY', cards: three.map((c) => c.id), target: target().id, named: 'defuse' };
    const two = cats(2);
    if (two && (hard || rand() < 0.5)) return { type: 'PLAY', cards: two.map((c) => c.id), target: target().id };
    if (pick('favor') && (hard || rand() < 0.5)) return { type: 'PLAY', cards: [pick('favor')!.id], target: target().id };
  }
  // Too dangerous to draw: end the turn another way.
  if (p > (safe ? (hard ? 0.5 : 0.75) : hard ? 0.18 : 0.34)) {
    const dodge = one('skip') ?? one('attack') ?? (me.known[0] == null ? null : one('shuffle'));
    if (dodge) return dodge;
  }
  // Under attack with turns to spare, pass them on.
  if (hard && s.turnsLeft > 1 && pick('attack') && p > 0.08) return one('attack')!;
  return { type: 'DRAW' };
}

function ekBotAction(s: EkState, rand: () => number = Math.random): EkAction {
  const me = playerOf(s, actorOf(s) ?? '')!;
  const level = me.difficulty ?? 'normal';
  if (s.pending) return botNope(s, me, level, rand);
  if (s.favor?.from === me.id) {
    const give = level === 'easy' ? me.hand[Math.floor(rand() * me.hand.length)] : [...me.hand].sort((a, b) => WORTH[a.kind] - WORTH[b.kind])[0];
    return { type: 'GIVE', card: give.id };
  }
  if (s.defusing === me.id) return botInsert(s, level, rand);
  return botTurn(s, me, level, rand);
}

export const ekKit: GameKit<EkState, EkAction> = {
  seatError: (count) => (count >= 2 && count <= 5 ? null : 'Exploding Kittens is for 2-5 players'),
  create: (seats, seed, options) => createEk(seats, seed, (options ?? {}) as EkOptions),
  apply: applyEk,
  actor: actorOf,
  players: (s) => s.players,
  isOver: (s) => s.over,
  bot: (s, rand) => ekBotAction(s, rand),
  // Out of time: draw, give your least useful card, or drop the Kitten somewhere in the pile.
  timeout: (s) => {
    if (s.favor) {
      const from = playerOf(s, s.favor.from)!;
      return { type: 'GIVE', card: [...from.hand].sort((a, b) => WORTH[a.kind] - WORTH[b.kind])[0].id };
    }
    if (s.defusing) return { type: 'INSERT', index: Math.floor(nextRandom(s.seed)[0] * (s.deck.length + 1)) };
    return { type: 'DRAW' };
  },
  botDelay: (s) => (s.pending ? 500 : s.defusing ? 1400 : 1100),
  // Nobody left to act on the action waiting: it takes effect once the people who could Nope it have had their moment.
  auto: (s) => (s.pending && !s.over && actorOf(s) === null ? { action: { type: 'RESOLVE' }, delay: undecided(s).length > 0 ? NOPE_MS : SETTLE_MS } : null),
  setBot: (s, id, difficulty) => setPlayer(s, id, (p) => ({ ...p, isAI: true, difficulty })),
  forfeit,
  end: (s) => ({ ...s, over: true, pending: null, favor: null, defusing: null }),
  // Your own hand and what you know of the pile; everyone's card counts; the whole discard pile.
  redact: (s, viewer) => ({
    ...s,
    deck: [],
    kitten: null,
    seed: 0,
    seen: s.seen?.player === viewer ? s.seen : null,
    pending: s.pending ? { ...s.pending, passed: s.pending.passed.filter((id) => id === viewer) } : null,
    players: s.players.map((p) => (p.id === viewer || s.over ? p : { ...p, hand: [], known: [] })),
    last: s.last && hideCard(s.last, viewer),
    history: s.history.map((e) => hideCard(e, viewer)),
  }),
  turnMs: 40_000,
};

function hideCard(e: EkEvent, viewer: string): EkEvent {
  if (!e.privy || e.privy.includes(viewer)) return e;
  const { card: _card, ...rest } = e;
  return rest;
}
