/**
 * Lineup – play a card, place a chip, and line up five in a row.
 *
 * The board shows every card of two decks except the Jacks, each twice, with a
 * free corner in each corner. GameHub's own arrangement: one deck fills the top
 * half in a fixed shuffled order, and the bottom half mirrors it through the
 * centre with the suits swapped (♠↔♥, ♦↔♣), so a card's two spaces are always
 * far apart.
 *
 * On your turn you play a card from your hand and put a chip on one of its two
 * spaces; then you draw. Jacks are wild:
 *  - a two-eyed Jack (♦ ♣) places a chip on any open space;
 *  - a one-eyed Jack (♥ ♠) removes an opponent's chip – never one that's part of
 *    a completed line.
 * A card whose spaces are both covered is dead: once per turn you may discard it
 * and draw a replacement before playing.
 * Five in a row in any direction makes a line; the corners count for everyone.
 * A second line may reuse one chip of the first. Two players or two teams need
 * two lines; three need one.
 *
 * Teams: 2 teams for 2, 4, 8 or 10 players; 3 teams for 3, 6, 9 or 12. Teammates
 * sit alternately (seat i is on team i mod teams).
 */
import { IllegalMove, nextRandom, shuffle, type GameKit, type KitCommonAction, type KitPlayer, type KitSeat } from '../kit/engine';

const SWAP_SUIT: Record<string, string> = { S: 'H', H: 'S', D: 'C', C: 'D' };

/** The board, row-major (XX = free corner; T = ten). */
function buildBoard(): string[] {
  const deck = 'SDCH'.split('').flatMap((suit) => 'A23456789TQK'.split('').map((rank) => rank + suit));
  const [order] = shuffle(deck, 2026);
  const board: string[] = Array(100).fill('');
  const corners = [0, 9, 90, 99];
  corners.forEach((c) => (board[c] = 'XX'));
  let k = 0;
  for (let i = 0; i < 50; i++) if (!corners.includes(i)) board[i] = order[k++];
  for (let i = 50; i < 100; i++) if (!corners.includes(i)) board[i] = board[99 - i][0] + SWAP_SUIT[board[99 - i][1]];
  return board;
}

export const BOARD: string[] = buildBoard();
export const CORNERS = new Set([0, 9, 90, 99]);
export const PLAYER_COUNTS = [2, 3, 4, 6, 8, 9, 10, 12];
const HAND_SIZE: Record<number, number> = { 2: 7, 3: 6, 4: 6, 6: 5, 8: 4, 9: 4, 10: 3, 12: 3 };

export const isTwoEyed = (card: string) => card === 'JD' || card === 'JC';
export const isOneEyed = (card: string) => card === 'JH' || card === 'JS';
export const teamsFor = (players: number) => (players % 3 === 0 ? 3 : 2);
export const sequencesNeeded = (teams: number) => (teams === 2 ? 2 : 1);

/** Board spaces showing `card`. */
export const cellsOf = (card: string): number[] => BOARD.flatMap((c, i) => (c === card ? [i] : []));

export interface SeqPlayer extends KitPlayer {
  team: number;
  hand: string[];
  /** In a redacted view, how many cards an opponent holds. */
  handCount: number;
  out?: boolean;
}

export interface SeqPlay {
  player: string;
  card: string;
  kind: 'place' | 'remove' | 'dead' | 'discard';
  cell?: number;
  /** The team whose chip was removed. */
  removedTeam?: number;
  /** New sequences this play made. */
  made?: number;
  seq: number;
}

export interface SeqState {
  players: SeqPlayer[];
  teams: number;
  needed: number;
  turn: number;
  /** Each space's chip: a team index, or null. */
  chips: (number | null)[];
  sequences: { team: number; cells: number[] }[];
  deck: string[];
  deckCount: number;
  discard: string[];
  /** A dead card was already swapped this turn. */
  swapped: boolean;
  last: SeqPlay | null;
  history: SeqPlay[];
  winner: number | null;
  over: boolean;
  game: number;
  /** Games won by each team. */
  score: number[];
  seed: number;
}

export type SeqAction =
  /** Play hand card `card` (an index) on `cell`. */
  | { type: 'PLAY'; card: number; cell: number }
  /** Swap a dead card for a fresh one. */
  | { type: 'DEAD'; card: number }
  /** With no legal play at all: discard a card and draw. */
  | { type: 'DISCARD'; card: number };

const HISTORY = 24;
const DIRS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

const ownedBy = (s: Pick<SeqState, 'chips'>, cell: number, team: number) => CORNERS.has(cell) || s.chips[cell] === team;
const locked = (s: SeqState, cell: number) => s.sequences.some((q) => q.cells.includes(cell));

/** Whether a (non-Jack) card has no open space left. */
export function isDead(s: Pick<SeqState, 'chips'>, card: string): boolean {
  if (card[0] === 'J') return false;
  return cellsOf(card).every((c) => s.chips[c] !== null);
}

/** Where a card may be played for `team`. */
export function targetsFor(s: SeqState, card: string, team: number): number[] {
  if (isTwoEyed(card)) return s.chips.flatMap((c, i) => (c === null && !CORNERS.has(i) ? [i] : []));
  if (isOneEyed(card)) return s.chips.flatMap((c, i) => (c !== null && c !== team && !locked(s, i) ? [i] : []));
  return cellsOf(card).filter((c) => s.chips[c] === null);
}

/** Every legal (card, cell) play for the player to move. */
export function legalPlays(s: SeqState): { card: number; cell: number }[] {
  const me = s.players[s.turn];
  return me.hand.flatMap((card, i) => targetsFor(s, card, me.team).map((cell) => ({ card: i, cell })));
}

/** The sequences a chip on `cell` completes for `team` (at most one per direction). */
function newSequences(s: SeqState, cell: number, team: number): { team: number; cells: number[] }[] {
  const found: { team: number; cells: number[] }[] = [];
  const existing = s.sequences.filter((q) => q.team === team);
  for (const [dr, dc] of DIRS) {
    // The run of this team's spaces through `cell` along the line.
    const run: number[] = [cell];
    for (const sign of [-1, 1]) {
      let r = Math.floor(cell / 10) + dr * sign;
      let c = (cell % 10) + dc * sign;
      while (r >= 0 && r < 10 && c >= 0 && c < 10 && ownedBy(s, r * 10 + c, team)) {
        if (sign < 0) run.unshift(r * 10 + c);
        else run.push(r * 10 + c);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (run.length < 5) continue;
    const at = run.indexOf(cell);
    for (let start = Math.max(0, at - 4); start <= Math.min(at, run.length - 5); start++) {
      const window = run.slice(start, start + 5);
      // A new sequence may share at most one space with each of the team's others.
      const ok = [...existing, ...found].every((q) => q.cells.filter((x) => window.includes(x)).length <= 1);
      if (ok) {
        found.push({ team, cells: window });
        break;
      }
    }
  }
  return found;
}

/** Draw the top card, reshuffling the discards if the deck has run out. */
function draw(s: SeqState): { card: string | null; deck: string[]; discard: string[]; seed: number } {
  let deck = s.deck;
  let discard = s.discard;
  let seed = s.seed;
  if (deck.length === 0 && discard.length > 0) {
    [deck, seed] = shuffle(discard, seed);
    discard = [];
  }
  if (deck.length === 0) return { card: null, deck, discard, seed };
  return { card: deck[0], deck: deck.slice(1), discard, seed };
}

function nextTurn(s: SeqState): number {
  for (let k = 1; k <= s.players.length; k++) {
    const i = (s.turn + k) % s.players.length;
    if (!s.players[i].out) return i;
  }
  return s.turn;
}

const record = (s: SeqState, p: SeqPlay) => ({ last: p, history: [p, ...s.history].slice(0, HISTORY) });

/** Replace hand card `index` of the current player with a drawn card. */
function replaceCard(s: SeqState, index: number): SeqState {
  const me = s.players[s.turn];
  const played = me.hand[index];
  const pile = [played, ...s.discard];
  const d = draw({ ...s, discard: pile });
  const hand = me.hand.filter((_, i) => i !== index);
  if (d.card) hand.push(d.card);
  const players = s.players.map((p, i) => (i === s.turn ? { ...p, hand, handCount: hand.length } : p));
  return { ...s, players, deck: d.deck, deckCount: d.deck.length, discard: d.discard, seed: d.seed };
}

function deal(s: SeqState, game: number): SeqState {
  let [deck, seed] = shuffle([...BOARD.filter((c) => c !== 'XX'), 'JD', 'JD', 'JC', 'JC', 'JH', 'JH', 'JS', 'JS'], s.seed);
  const size = HAND_SIZE[s.players.length] ?? 3;
  const players = s.players.map((p) => {
    const hand = deck.slice(0, size);
    deck = deck.slice(size);
    return { ...p, hand, handCount: hand.length };
  });
  return {
    ...s,
    players,
    deck,
    deckCount: deck.length,
    discard: [],
    seed,
    chips: Array(100).fill(null),
    sequences: [],
    turn: 0,
    swapped: false,
    last: null,
    history: [],
    winner: null,
    over: false,
    game,
  };
}

export function createLineup(seats: KitSeat[], seed: number): SeqState {
  const teams = teamsFor(seats.length);
  const players = seats.map((seat, i) => ({ id: `p${i}`, name: seat.name, isAI: seat.isAI, difficulty: seat.difficulty, team: i % teams, hand: [], handCount: 0 }));
  const base = { players, teams, needed: sequencesNeeded(teams), score: Array(teams).fill(0), seed } as unknown as SeqState;
  return deal(base, 1);
}

export function applyLineup(s: SeqState, action: SeqAction | KitCommonAction, actorId: string): SeqState {
  if (!s.players.some((p) => p.id === actorId)) throw new IllegalMove('not in this game');
  if (action.type === 'REMATCH') {
    if (!s.over || s.players.filter((p) => !p.out).length < 2) throw new IllegalMove('the game is still on');
    const [, seed] = nextRandom(s.seed);
    return deal({ ...s, seed }, s.game + 1);
  }
  if (s.over) throw new IllegalMove('the game is over');
  if (action.type === 'RESIGN') return lineupKit.forfeit(s, actorId);
  const me = s.players[s.turn];
  if (me.id !== actorId) throw new IllegalMove('not your turn');
  const card = me.hand[(action as { card: number }).card];
  if (card === undefined) throw new IllegalMove('no such card');
  const seq = (s.last?.seq ?? 0) + 1;

  if (action.type === 'DEAD') {
    if (s.swapped) throw new IllegalMove("you've already swapped a dead card this turn");
    if (!isDead(s, card)) throw new IllegalMove("that card isn't dead");
    return { ...replaceCard(s, action.card), swapped: true, ...record(s, { player: me.id, card, kind: 'dead', seq }) };
  }

  if (action.type === 'DISCARD') {
    if (legalPlays(s).length > 0) throw new IllegalMove('you have a card you can play');
    const next = replaceCard(s, action.card);
    return { ...next, swapped: false, turn: nextTurn(s), ...record(s, { player: me.id, card, kind: 'discard', seq }) };
  }

  if (action.type !== 'PLAY') throw new IllegalMove('unknown action');
  if (!targetsFor(s, card, me.team).includes(action.cell)) throw new IllegalMove("that card can't go there");

  if (isOneEyed(card)) {
    const removedTeam = s.chips[action.cell]!;
    const chips = s.chips.map((c, i) => (i === action.cell ? null : c));
    const next = replaceCard({ ...s, chips }, action.card);
    return { ...next, swapped: false, turn: nextTurn(s), ...record(s, { player: me.id, card, kind: 'remove', cell: action.cell, removedTeam, seq }) };
  }

  const chips = s.chips.map((c, i) => (i === action.cell ? me.team : c));
  const placed = { ...s, chips };
  const made = newSequences(placed, action.cell, me.team);
  const sequences = [...s.sequences, ...made];
  const next = replaceCard({ ...placed, sequences }, action.card);
  const event = record(s, { player: me.id, card, kind: 'place', cell: action.cell, made: made.length, seq });
  if (sequences.filter((q) => q.team === me.team).length >= s.needed) {
    const score = s.score.map((n, t) => (t === me.team ? n + 1 : n));
    return { ...next, ...event, over: true, winner: me.team, score };
  }
  return { ...next, ...event, swapped: false, turn: nextTurn(s) };
}

// ---------------------------------------------------------------------------
// The bot.

const OWN = [0, 2, 9, 40, 400, 5000];
const BLOCK = [0, 1, 6, 30, 900, 0];

/** How much a chip of `team` on `cell` builds its lines and blocks others'. */
function cellValue(s: SeqState, cell: number, team: number): { build: number; block: number } {
  let build = 0;
  let block = 0;
  const r0 = Math.floor(cell / 10);
  const c0 = cell % 10;
  for (const [dr, dc] of DIRS) {
    for (let k = -4; k <= 0; k++) {
      const window: number[] = [];
      for (let j = 0; j < 5; j++) {
        const r = r0 + dr * (k + j);
        const c = c0 + dc * (k + j);
        if (r < 0 || r > 9 || c < 0 || c > 9) break;
        window.push(r * 10 + c);
      }
      if (window.length < 5) continue;
      const others = window.filter((x) => x !== cell);
      const theirs = new Set(others.filter((x) => s.chips[x] !== null && s.chips[x] !== team).map((x) => s.chips[x]));
      const mine = others.filter((x) => ownedBy(s, x, team)).length;
      if (theirs.size === 0) build += OWN[mine + 1];
      // One opponent building here, with none of ours in the way: placing blocks them.
      if (theirs.size === 1 && !others.some((x) => s.chips[x] === team)) {
        const t = [...theirs][0];
        block = Math.max(block, BLOCK[others.filter((x) => s.chips[x] === t || CORNERS.has(x)).length]);
      }
    }
  }
  return { build, block };
}

/** The bot's move for the player to act. */
export function seqBotAction(s: SeqState, rand: () => number = Math.random): SeqAction {
  const me = s.players[s.turn];
  const level = me.difficulty ?? 'normal';
  // Swap a dead card first.
  if (!s.swapped) {
    const dead = me.hand.findIndex((c) => isDead(s, c));
    if (dead >= 0) return { type: 'DEAD', card: dead };
  }
  const plays = legalPlays(s);
  if (plays.length === 0) return { type: 'DISCARD', card: 0 };
  if (level === 'easy' && rand() < 0.5) {
    const p = plays[Math.floor(rand() * plays.length)];
    return { type: 'PLAY', ...p };
  }
  let best = plays[0];
  let bestScore = -Infinity;
  for (const p of plays) {
    const card = me.hand[p.card];
    let score: number;
    if (isOneEyed(card)) {
      // Worth it to break a threat; otherwise keep it.
      const victim = s.chips[p.cell]!;
      score = cellValue({ ...s, chips: s.chips.map((c, i) => (i === p.cell ? null : c)) }, p.cell, victim).build * 0.9 - 120;
    } else {
      const v = cellValue(s, p.cell, me.team);
      score = v.build + v.block * (level === 'hard' ? 1.1 : 0.9);
      if (isTwoEyed(card)) score -= level === 'hard' ? 220 : 120; // save wild Jacks for when they matter
    }
    score += rand() * 3;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return { type: 'PLAY', ...best };
}

export const lineupKit: GameKit<SeqState, SeqAction> = {
  seatError: (count) => (PLAYER_COUNTS.includes(count) ? null : `Lineup is for ${PLAYER_COUNTS.join(', ')} players`),
  create: (seats, seed) => createLineup(seats, seed),
  apply: applyLineup,
  actor: (s) => (s.over ? null : s.players[s.turn].id),
  players: (s) => s.players,
  isOver: (s) => s.over,
  bot: (s, rand) => seqBotAction(s, rand),
  timeout: (s) => seqBotAction(s),
  botDelay: (s) => (s.last?.kind === 'dead' ? 600 : 1100),
  setBot: (s, id, difficulty) => ({ ...s, players: s.players.map((p) => (p.id === id ? { ...p, isAI: true, difficulty } : p)) }),
  forfeit: (s, id) => {
    const players = s.players.map((p) => (p.id === id ? { ...p, out: true } : p));
    const teamsLeft = new Set(players.filter((p) => !p.out).map((p) => p.team));
    const next = { ...s, players };
    if (s.over) return next;
    if (teamsLeft.size === 1) {
      const team = [...teamsLeft][0];
      return { ...next, over: true, winner: team, score: s.score.map((n, t) => (t === team ? n + 1 : n)) };
    }
    return s.players[s.turn].id === id ? { ...next, swapped: false, turn: nextTurn(next) } : next;
  },
  end: (s) => ({ ...s, over: true }),
  // Hands are private and the deck order is secret.
  redact: (s, viewer) => ({
    ...s,
    deck: [],
    players: s.players.map((p) => (p.id === viewer ? p : { ...p, hand: [] })),
  }),
  turnMs: 45_000,
};
