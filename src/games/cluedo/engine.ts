/**
 * Cluedo on the kit. A murder envelope holds one suspect, one weapon and one
 * room; the other cards are dealt out. On your turn you roll two dice and walk
 * the corridors (or take a corner room's secret passage); in a room you have
 * just entered you may suggest a suspect and weapon there, and the players
 * after you, in turn, must show you one of the named cards if they hold one.
 * Name all three correctly to win; a wrong accusation puts you out, though you
 * still show cards.
 */
import { IllegalMove, nextRandom, shuffle, type GameKit, type KitCommonAction, type KitPlayer, type KitSeat } from '../kit/engine';
import { START, inRoom, passageFrom, reachable, type Reach, type Spot } from './board';
import { cluedoBot } from './bot';
import { ROOMS, SUSPECTS, WEAPONS, type Card, type Room, type Suspect, type Triple, type Weapon } from './engine/cards';

export const MIN_SEATS = 3;
export const MAX_SEATS = 6;
/** A game this long has stalled; the case closes unsolved. */
export const MAX_TURNS = 400;

export interface ClPlayer extends KitPlayer {
  suspect: Suspect;
  /** Your own cards (empty in others' views; see `cards`). */
  hand: Card[];
  /** How many cards the player holds. */
  cards: number;
  /** Out after a wrong accusation: no more turns, but still shows cards. */
  out: boolean;
  /** Left the game: their cards are laid face up for everyone. */
  left: boolean;
}

/** turn: before moving (roll, passage, stay, accuse). move: dice rolled, pick where to go.
 *  suggest: in a room you just entered (suggest once, accuse, or end). disprove: waiting on a card. */
export type Phase = 'turn' | 'move' | 'suggest' | 'disprove' | 'over';

export interface Suggestion {
  player: string;
  triple: Triple;
  /** Players asked in turn who had none of the three. */
  passed: string[];
  /** Who showed a card (null: nobody could). */
  disprover: string | null;
  /** The card shown; null in the views of everyone but the two players involved. */
  card: Card | null;
}

export type ClEvent =
  | { seq: number; kind: 'roll'; player: string; dice: [number, number] }
  | { seq: number; kind: 'move'; player: string; to: Room | null; passage?: boolean }
  | { seq: number; kind: 'suggest'; s: Suggestion }
  | { seq: number; kind: 'accuse'; player: string; triple: Triple; correct: boolean }
  | { seq: number; kind: 'left'; player: string; cards: Card[] };

export interface ClState {
  players: ClPlayer[];
  current: number;
  phase: Phase;
  seed: number;
  /** Hidden (all blanks) until the game is over. */
  solution: Triple;
  /** Where every suspect's token is, played or not. */
  pos: Record<Suspect, Spot>;
  weapons: Record<Weapon, Room>;
  dice: [number, number] | null;
  /** After a roll: where the token may go. */
  reach: Reach | null;
  /** Players whose token was pulled into a room by a suggestion since their last turn. */
  summoned: string[];
  /** This turn's suggestion is made. */
  suggested: boolean;
  /** The suggestion waiting on a card. */
  pending: { triple: Triple; disprover: string; passed: string[] } | null;
  log: ClEvent[];
  seq: number;
  turn: number;
  over: boolean;
  winner: string | null;
}

export type ClAction =
  | { type: 'ROLL' }
  | { type: 'PASSAGE' }
  /** Suggest in the room a suggestion pulled you into, without moving. */
  | { type: 'STAY' }
  | { type: 'MOVE'; to: Spot }
  | { type: 'SUGGEST'; suspect: Suspect; weapon: Weapon }
  | { type: 'SHOW'; card: Card }
  | { type: 'ACCUSE'; suspect: Suspect; weapon: Weapon; room: Room }
  | { type: 'END' };

const BLANK: Triple = { suspect: '' as Suspect, weapon: '' as Weapon, room: '' as Room };

const active = (p: ClPlayer) => !p.out && !p.left;
export const currentPlayer = (s: ClState) => s.players[s.current];
const by = (s: ClState, id: string) => s.players.find((p) => p.id === id);

function note(s: ClState, e: DistributiveOmit<ClEvent, 'seq'>) {
  s.seq += 1;
  s.log.push({ ...e, seq: s.seq } as ClEvent);
}
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;

/** Squares other tokens stand on. */
function blockedFor(s: ClState, me: Suspect): Set<number> {
  return new Set(
    SUSPECTS.filter((x) => x !== me)
      .map((x) => s.pos[x])
      .filter((p): p is number => !inRoom(p)),
  );
}

export function createCluedo(seats: KitSeat[], seed: number): ClState {
  let rest: Card[];
  let r: number;
  let next = seed;
  const pick = <T>(items: readonly T[]): T => {
    [r, next] = nextRandom(next);
    return items[Math.floor(r * items.length)];
  };
  const solution: Triple = { suspect: pick(SUSPECTS), weapon: pick(WEAPONS), room: pick(ROOMS) };
  [rest, next] = shuffle<Card>(
    [...SUSPECTS, ...WEAPONS, ...ROOMS].filter((c) => c !== solution.suspect && c !== solution.weapon && c !== solution.room),
    next,
  );
  let rooms: Room[];
  [rooms, next] = shuffle(ROOMS, next);
  const hands: Card[][] = seats.map(() => []);
  rest.forEach((c, i) => hands[i % seats.length].push(c));
  const s: ClState = {
    players: seats.map((p, i) => ({
      id: `p${i}`,
      name: p.name,
      isAI: p.isAI,
      difficulty: p.difficulty,
      suspect: SUSPECTS[i],
      hand: hands[i],
      cards: hands[i].length,
      out: false,
      left: false,
    })),
    // Miss Scarlett, the first seat, always starts.
    current: 0,
    phase: 'turn',
    seed: next,
    solution,
    pos: { ...START },
    weapons: Object.fromEntries(WEAPONS.map((w, i) => [w, rooms[i]])) as Record<Weapon, Room>,
    dice: null,
    reach: null,
    summoned: [],
    suggested: false,
    pending: null,
    log: [],
    seq: 0,
    turn: 1,
    over: false,
    winner: null,
  };
  return s;
}

/** The next player still in, after the current one; the case closes if none is left. */
function passTurn(s: ClState): ClState {
  s.dice = null;
  s.reach = null;
  s.suggested = false;
  s.pending = null;
  s.turn += 1;
  for (let step = 1; step <= s.players.length; step++) {
    const i = (s.current + step) % s.players.length;
    if (active(s.players[i])) {
      s.current = i;
      s.phase = 'turn';
      if (s.turn > MAX_TURNS) return close(s, null);
      return s;
    }
  }
  return close(s, null);
}

function close(s: ClState, winner: string | null): ClState {
  s.phase = 'over';
  s.over = true;
  s.winner = winner;
  s.dice = null;
  s.reach = null;
  s.pending = null;
  return s;
}

/** Into a room: there you may suggest. */
function enter(s: ClState, room: Room, passage = false): ClState {
  const me = currentPlayer(s);
  s.pos[me.suspect] = room;
  s.summoned = s.summoned.filter((id) => id !== me.id);
  s.dice = null;
  s.reach = null;
  s.phase = 'suggest';
  note(s, { kind: 'move', player: me.id, to: room, passage });
  return s;
}

/** The players after `from`, in seat order, who are asked to disprove (those who left hold no cards). */
function askOrder(s: ClState, from: number): ClPlayer[] {
  const n = s.players.length;
  return Array.from({ length: n - 1 }, (_, k) => s.players[(from + 1 + k) % n]).filter((p) => !p.left);
}

const named = (t: Triple): Card[] => [t.suspect, t.weapon, t.room];

/** The cards in `hand` that disprove `t`. */
export const matching = (hand: Card[], t: Triple): Card[] => hand.filter((c) => named(t).includes(c));

function applyCluedo(prev: ClState, action: ClAction | KitCommonAction, actorId: string): ClState {
  if (action.type === 'REMATCH') {
    if (!prev.over) throw new IllegalMove('the case is still open');
    return createCluedo(
      prev.players.map((p) => ({ name: p.name, isAI: p.isAI, difficulty: p.difficulty })),
      nextRandom(prev.seed)[1],
    );
  }
  if (action.type === 'RESIGN') return forfeit(prev, actorId);
  if (prev.over) throw new IllegalMove('the case is closed');
  if (action.type === 'SHOW') {
    if (prev.phase !== 'disprove' || prev.pending?.disprover !== actorId) throw new IllegalMove('nobody asked you for a card');
    const p = by(prev, actorId)!;
    if (!matching(p.hand, prev.pending.triple).includes(action.card)) throw new IllegalMove('show one of the named cards you hold');
    const s = structuredClone(prev);
    const me = currentPlayer(s);
    note(s, { kind: 'suggest', s: { player: me.id, triple: s.pending!.triple, passed: s.pending!.passed, disprover: actorId, card: action.card } });
    s.pending = null;
    s.phase = 'suggest';
    return s;
  }
  if (currentPlayer(prev).id !== actorId) throw new IllegalMove('not your turn');
  const s = structuredClone(prev);
  const me = currentPlayer(s);
  const here = s.pos[me.suspect];
  switch (action.type) {
    case 'ROLL': {
      if (s.phase !== 'turn') throw new IllegalMove('you have already moved');
      let a: number;
      let b: number;
      [a, s.seed] = nextRandom(s.seed);
      [b, s.seed] = nextRandom(s.seed);
      s.dice = [1 + Math.floor(a * 6), 1 + Math.floor(b * 6)];
      note(s, { kind: 'roll', player: me.id, dice: s.dice });
      s.summoned = s.summoned.filter((id) => id !== me.id);
      s.reach = reachable(here, s.dice[0] + s.dice[1], blockedFor(s, me.suspect));
      // Shut in by other tokens: the turn ends where it stands.
      if (s.reach.rooms.length === 0 && Object.keys(s.reach.squares).length === 0) return passTurn(s);
      s.phase = 'move';
      return s;
    }
    case 'PASSAGE': {
      const to = inRoom(here) ? passageFrom(here) : undefined;
      if (s.phase !== 'turn' || !to) throw new IllegalMove('no secret passage here');
      return enter(s, to, true);
    }
    case 'STAY':
      if (s.phase !== 'turn' || !s.summoned.includes(me.id) || !inRoom(here)) throw new IllegalMove('you can only stay where a suggestion brought you');
      s.summoned = s.summoned.filter((id) => id !== me.id);
      s.phase = 'suggest';
      return s;
    case 'MOVE': {
      if (s.phase !== 'move' || !s.reach) throw new IllegalMove('roll first');
      const to = action.to;
      if (inRoom(to)) {
        if (!s.reach.rooms.includes(to)) throw new IllegalMove('that room is out of reach');
        return enter(s, to);
      }
      if (!(to in s.reach.squares)) throw new IllegalMove('that square is out of reach');
      s.pos[me.suspect] = to;
      note(s, { kind: 'move', player: me.id, to: null });
      return passTurn(s);
    }
    case 'SUGGEST': {
      if (s.phase !== 'suggest' || s.suggested || !inRoom(here)) throw new IllegalMove('you can suggest only in a room you have just entered');
      if (!SUSPECTS.includes(action.suspect) || !WEAPONS.includes(action.weapon)) throw new IllegalMove('name a suspect and a weapon');
      const triple: Triple = { suspect: action.suspect, weapon: action.weapon, room: here };
      s.suggested = true;
      // The named suspect and weapon are brought into the room.
      if (s.pos[action.suspect] !== here) {
        s.pos[action.suspect] = here;
        const owner = s.players.find((p) => p.suspect === action.suspect);
        if (owner && owner.id !== me.id && !s.summoned.includes(owner.id)) s.summoned.push(owner.id);
      }
      s.weapons[action.weapon] = here;
      const passed: string[] = [];
      for (const p of askOrder(s, s.current)) {
        if (matching(p.hand, triple).length > 0) {
          s.pending = { triple, disprover: p.id, passed };
          s.phase = 'disprove';
          return s;
        }
        passed.push(p.id);
      }
      note(s, { kind: 'suggest', s: { player: me.id, triple, passed, disprover: null, card: null } });
      return s;
    }
    case 'ACCUSE': {
      if (s.phase !== 'turn' && s.phase !== 'suggest') throw new IllegalMove('accuse before you roll or once you are done moving');
      if (!SUSPECTS.includes(action.suspect) || !WEAPONS.includes(action.weapon) || !ROOMS.includes(action.room)) throw new IllegalMove('name a suspect, a weapon and a room');
      const triple: Triple = { suspect: action.suspect, weapon: action.weapon, room: action.room };
      const t = s.solution;
      const correct = t.suspect === triple.suspect && t.weapon === triple.weapon && t.room === triple.room;
      note(s, { kind: 'accuse', player: me.id, triple, correct });
      if (correct) return close(s, me.id);
      me.out = true;
      return passTurn(s);
    }
    case 'END':
      if (s.phase !== 'suggest') throw new IllegalMove('move first');
      return passTurn(s);
  }
  throw new IllegalMove('unknown action');
}

/** A player leaves: their cards go face up for all, and they no longer play or show cards. */
function forfeit(prev: ClState, id: string): ClState {
  const p = by(prev, id);
  if (!p || p.left || prev.over) return prev;
  const s = structuredClone(prev);
  const q = by(s, id)!;
  q.left = true;
  note(s, { kind: 'left', player: id, cards: q.hand });
  if (!s.players.some(active)) return close(s, null);
  if (currentPlayer(s).id === id) return passTurn(s);
  if (s.phase === 'disprove' && s.pending?.disprover === id) {
    // Ask on round the table from the player after the one who left.
    const me = currentPlayer(s);
    const n = s.players.length;
    const order = Array.from({ length: n - 1 }, (_, k) => s.players[(s.current + 1 + k) % n]);
    const passed = [...s.pending.passed];
    for (const x of order.slice(order.findIndex((o) => o.id === id) + 1).filter((o) => !o.left)) {
      if (matching(x.hand, s.pending.triple).length > 0) {
        s.pending = { ...s.pending, disprover: x.id, passed };
        return s;
      }
      passed.push(x.id);
    }
    note(s, { kind: 'suggest', s: { player: me.id, triple: s.pending.triple, passed, disprover: null, card: null } });
    s.pending = null;
    s.phase = 'suggest';
  }
  return s;
}

/** A player's view: no envelope until the end, no seed, others' hands hidden, and a
 *  shown card visible only to the player who asked and the one who showed it. */
export function redactCluedo(s: ClState, viewer: string): ClState {
  return {
    ...s,
    seed: 0,
    solution: s.over ? s.solution : BLANK,
    players: s.players.map((p) => (p.id === viewer || p.left ? p : { ...p, hand: [] })),
    log: s.log.map((e) =>
      e.kind === 'suggest' && e.s.card && viewer !== e.s.player && viewer !== e.s.disprover ? { ...e, s: { ...e.s, card: null } } : e,
    ),
  };
}

export const cluedoActor = (s: ClState): string | null =>
  s.over ? null : s.phase === 'disprove' ? s.pending!.disprover : currentPlayer(s).id;

export const cluedoKit: GameKit<ClState, ClAction> = {
  seatError(count) {
    if (count < MIN_SEATS) return `Cluedo needs at least ${MIN_SEATS} players`;
    return count > MAX_SEATS ? `Cluedo seats at most ${MAX_SEATS} players` : null;
  },
  create: (seats, seed) => createCluedo(seats, seed),
  apply: applyCluedo,
  actor: cluedoActor,
  players: (s) => s.players,
  isOver: (s) => s.over,
  bot: (s, rand = Math.random) => cluedoBot(s, rand),
  timeout(s) {
    if (s.phase === 'disprove') {
      const p = by(s, s.pending!.disprover)!;
      return { type: 'SHOW', card: matching(p.hand, s.pending!.triple)[0] };
    }
    if (s.phase === 'turn') return { type: 'ROLL' };
    if (s.phase === 'move') {
      const r = s.reach!;
      return { type: 'MOVE', to: r.rooms[0] ?? Number(Object.keys(r.squares)[0]) };
    }
    return { type: 'END' };
  },
  botDelay: (s) => (s.phase === 'suggest' && !s.suggested ? 1500 : s.phase === 'disprove' ? 1200 : 900),
  setBot: (s, id, difficulty) => ({ ...s, players: s.players.map((p) => (p.id === id ? { ...p, isAI: true, difficulty } : p)) }),
  forfeit,
  end: (s) => (s.over ? s : close(structuredClone(s), null)),
  redact: redactCluedo,
  turnMs: 45_000,
};
