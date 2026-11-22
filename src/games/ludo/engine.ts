/**
 * Ludo on the classic 15×15 cross board, played the way it's commonly played in
 * India (Ludo King style):
 *
 * - 2-4 players on the cross board; two players sit at opposite corners. Play
 *   runs clockwise: red, green, yellow, blue.
 * - 5-8 players on a star board with one arm for each player. Every arm is
 *   built like an arm of the cross, so each player still has 13 squares of
 *   track, a start square, a star and a home column of 5.
 * - A 6 brings a token out of the yard onto its start square.
 * - A 6 rolls again; a third 6 in a row ends the turn with no move.
 * - Landing on an opponent's token sends it back to its yard and earns a bonus
 *   roll - except on the safe squares (each start square and the four stars).
 * - Tokens of one colour may share a square (there are no blockades).
 * - After a lap of the track (52 squares on the cross, 13 for each arm) a
 *   token turns up its own home column; it needs the exact roll to reach home,
 *   which earns a bonus roll too.
 * - The first to bring all four tokens home wins.
 *
 * A token's progress runs from -1 (in the yard) through the track from its
 * start square, then its home column, to home: 0-50, 51-55 and 56 on the cross.
 */
import { assignPieces, IllegalMove, nextRandom, rollDie, type GameKit, type KitCommonAction, type KitPlayer, type KitSeat } from '../kit/engine';

/** The four colours of the cross board, in the order of its arms. */
export type CrossColor = 'red' | 'green' | 'yellow' | 'blue';
export type LudoColor = CrossColor | 'purple' | 'orange' | 'teal' | 'pink';
export const COLORS: CrossColor[] = ['red', 'green', 'yellow', 'blue'];
/** The colours a star board hands out, the classic four first. */
export const STAR_COLORS: LudoColor[] = [...COLORS, 'purple', 'orange', 'teal', 'pink'];
export const YARD = -1;
/** Track squares each arm adds to the lap. */
const PER_ARM = 13;
/** Squares in a home column. */
const COLUMN = 5;

/** The last track square of a lap, and home, as progress on a board of `arms` arms. */
export const lastTrack = (arms: number) => PER_ARM * arms - 2;
export const homeOf = (arms: number) => lastTrack(arms) + COLUMN + 1;
/** Home on the cross board. */
export const HOME = homeOf(4);
/** Start squares, and the star eight squares on from each, are safe. */
export const isSafe = (index: number) => index % PER_ARM === 0 || index % PER_ARM === 8;

/** Where each colour joins the track (an index into TRACK). */
export const START: Record<CrossColor, number> = { red: 0, green: 13, yellow: 26, blue: 39 };
/** Safe track squares: the four starts and the four stars eight squares on. */
export const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

/** The 52 track squares as [row, col] on the 15×15 grid, clockwise from red's start. */
export const TRACK: [number, number][] = [
  ...[1, 2, 3, 4, 5].map((c) => [6, c] as [number, number]),
  ...[5, 4, 3, 2, 1, 0].map((r) => [r, 6] as [number, number]),
  [0, 7],
  ...[0, 1, 2, 3, 4, 5].map((r) => [r, 8] as [number, number]),
  ...[9, 10, 11, 12, 13, 14].map((c) => [6, c] as [number, number]),
  [7, 14],
  ...[14, 13, 12, 11, 10, 9].map((c) => [8, c] as [number, number]),
  ...[9, 10, 11, 12, 13, 14].map((r) => [r, 8] as [number, number]),
  [14, 7],
  ...[14, 13, 12, 11, 10, 9].map((r) => [r, 6] as [number, number]),
  ...[5, 4, 3, 2, 1, 0].map((c) => [8, c] as [number, number]),
  [7, 0],
  [6, 0],
];

/** Each colour's home column, from the track inwards. */
export const HOME_COLUMN: Record<CrossColor, [number, number][]> = {
  red: [1, 2, 3, 4, 5].map((c) => [7, c] as [number, number]),
  green: [1, 2, 3, 4, 5].map((r) => [r, 7] as [number, number]),
  yellow: [13, 12, 11, 10, 9].map((c) => [7, c] as [number, number]),
  blue: [13, 12, 11, 10, 9].map((r) => [r, 7] as [number, number]),
};

export interface LudoPlayer extends KitPlayer {
  color: LudoColor;
  /** The arm of the board this player starts from and comes home on. */
  arm: number;
  tokens: number[];
  out?: boolean;
}

export interface LudoEvent {
  player: string;
  roll: number;
  kind: 'move' | 'no-move' | 'three-sixes';
  token?: number;
  from?: number;
  to?: number;
  captured?: { player: string; token: number; from: number }[];
  /** The same player rolls again. */
  bonus?: boolean;
  seq: number;
}

export interface LudoState {
  /** Arms of the board: 4 on the cross, one for each player on a star. */
  arms: number;
  players: LudoPlayer[];
  turn: number;
  /** 'roll' → waiting for a roll; 'move' → a token must be chosen for `dice`. */
  phase: 'roll' | 'move';
  dice: number | null;
  /** Sixes rolled in a row this turn. */
  sixes: number;
  /** Bumps with every roll (for the die's tumble). */
  rollSeq: number;
  last: LudoEvent | null;
  history: LudoEvent[];
  winner: string | null;
  over: boolean;
  game: number;
  score: Record<string, number>;
  seed: number;
}

export type LudoAction = { type: 'ROLL' } | { type: 'MOVE'; token: number };

const HISTORY = 30;

/** Which colours sit at a table of `n`. */
export function colorsFor(n: number): CrossColor[] {
  if (n === 2) return ['red', 'yellow'];
  if (n === 3) return ['red', 'green', 'yellow'];
  return COLORS;
}

/** The track square a token from `arm` stands on at `progress`, or null off the track. */
export function trackAt(arms: number, arm: number, progress: number): number | null {
  return progress >= 0 && progress <= lastTrack(arms) ? (PER_ARM * arm + progress) % (PER_ARM * arms) : null;
}

/** The track index a token stands on on the cross board, or null off the track. */
export function trackIndex(color: CrossColor, progress: number): number | null {
  return trackAt(4, COLORS.indexOf(color), progress);
}

/** Where a token would end up with `roll`, or null if it can't move. */
export function destination(progress: number, roll: number, arms = 4): number | null {
  if (progress === YARD) return roll === 6 ? 0 : null;
  const home = homeOf(arms);
  if (progress === home) return null;
  const to = progress + roll;
  return to <= home ? to : null;
}

/** The tokens `player` may move with `roll`. */
export function movableTokens(p: LudoPlayer, roll: number, arms = 4): number[] {
  return p.tokens.flatMap((t, i) => (destination(t, roll, arms) !== null ? [i] : []));
}

/** One token per distinct position (moving either of two stacked tokens is the same move). */
function distinctMoves(p: LudoPlayer, roll: number, arms: number): number[] {
  const seen = new Set<number>();
  return movableTokens(p, roll, arms).filter((i) => {
    if (seen.has(p.tokens[i])) return false;
    seen.add(p.tokens[i]);
    return true;
  });
}

function nextTurn(s: LudoState): number {
  for (let k = 1; k <= s.players.length; k++) {
    const i = (s.turn + k) % s.players.length;
    if (!s.players[i].out) return i;
  }
  return s.turn;
}

const record = (s: LudoState, e: LudoEvent): Pick<LudoState, 'last' | 'history'> => ({ last: e, history: [e, ...s.history].slice(0, HISTORY) });

function newGame(s: LudoState, game: number): LudoState {
  return {
    ...s,
    players: s.players.map((p) => ({ ...p, tokens: [YARD, YARD, YARD, YARD] })),
    turn: s.players.findIndex((p) => !p.out),
    phase: 'roll',
    dice: null,
    sixes: 0,
    last: null,
    history: [],
    winner: null,
    over: false,
    game,
  };
}

export function createLudo(seats: KitSeat[], seed: number): LudoState {
  // Up to four sit at the cross, each on their colour's arm. More than four get a star with an arm each, in seat order.
  const star = seats.length > 4;
  const colors = star ? assignPieces(seats, STAR_COLORS) : assignPieces(seats, COLORS, colorsFor(seats.length));
  const players = seats.map((seat, i) => ({ id: `p${i}`, name: seat.name, isAI: seat.isAI, difficulty: seat.difficulty, color: colors[i], arm: star ? i : COLORS.indexOf(colors[i] as CrossColor), tokens: [] as number[] }));
  const base = { arms: star ? seats.length : 4, players, score: Object.fromEntries(players.map((p) => [p.id, 0])), seed, rollSeq: 0 } as LudoState;
  return newGame(base, 1);
}

/** Move token `i` of the current player by the rolled die. */
function moveToken(s: LudoState, i: number): LudoState {
  const me = s.players[s.turn];
  const roll = s.dice!;
  const from = me.tokens[i];
  const to = destination(from, roll, s.arms);
  if (to === null) throw new IllegalMove("that token can't move");

  const captured: LudoEvent['captured'] = [];
  const landing = trackAt(s.arms, me.arm, to);
  let players = s.players.map((p, k) => (k === s.turn ? { ...p, tokens: p.tokens.map((t, j) => (j === i ? to : t)) } : p));
  if (landing !== null && !isSafe(landing)) {
    players = players.map((p) => {
      if (p.id === me.id || p.out) return p;
      return {
        ...p,
        tokens: p.tokens.map((t, j) => {
          if (trackAt(s.arms, p.arm, t) !== landing) return t;
          captured.push({ player: p.id, token: j, from: t });
          return YARD;
        }),
      };
    });
  }

  const home = homeOf(s.arms);
  const reachedHome = to === home;
  const bonus = roll === 6 || captured.length > 0 || reachedHome;
  const event: LudoEvent = { player: me.id, roll, kind: 'move', token: i, from, to, captured, bonus, seq: (s.last?.seq ?? 0) + 1 };
  const next: LudoState = { ...s, players, dice: null, phase: 'roll', ...record(s, event) };

  if (players[s.turn].tokens.every((t) => t === home)) {
    return { ...next, over: true, winner: me.id, score: { ...s.score, [me.id]: (s.score[me.id] ?? 0) + 1 } };
  }
  if (bonus) return { ...next, sixes: roll === 6 ? s.sixes : 0 };
  return { ...next, sixes: 0, turn: nextTurn(s) };
}

export function applyLudo(s: LudoState, action: LudoAction | KitCommonAction, actorId: string): LudoState {
  if (!s.players.some((p) => p.id === actorId)) throw new IllegalMove('not in this game');
  if (action.type === 'REMATCH') {
    if (!s.over || s.players.filter((p) => !p.out).length < 2) throw new IllegalMove('the game is still on');
    const [, seed] = nextRandom(s.seed);
    return newGame({ ...s, seed }, s.game + 1);
  }
  if (s.over) throw new IllegalMove('the game is over');
  if (action.type === 'RESIGN') return ludoKit.forfeit(s, actorId);
  const me = s.players[s.turn];
  if (me.id !== actorId) throw new IllegalMove('not your turn');

  if (action.type === 'ROLL') {
    if (s.phase !== 'roll') throw new IllegalMove('choose a token to move');
    const [roll, seed] = rollDie(s.seed);
    const sixes = roll === 6 ? s.sixes + 1 : 0;
    const base: LudoState = { ...s, seed, dice: roll, sixes, rollSeq: s.rollSeq + 1 };
    const seq = (s.last?.seq ?? 0) + 1;
    if (sixes === 3) {
      const e: LudoEvent = { player: me.id, roll, kind: 'three-sixes', seq };
      return { ...base, ...record(s, e), dice: null, sixes: 0, phase: 'roll', turn: nextTurn(s) };
    }
    const options = distinctMoves(me, roll, s.arms);
    if (options.length === 0) {
      const e: LudoEvent = { player: me.id, roll, kind: 'no-move', seq };
      return { ...base, ...record(s, e), dice: null, sixes: 0, phase: 'roll', turn: nextTurn(s) };
    }
    // A single choice plays itself.
    if (options.length === 1) return moveToken({ ...base, phase: 'move' }, options[0]);
    return { ...base, phase: 'move' };
  }
  if (action.type === 'MOVE') {
    if (s.phase !== 'move') throw new IllegalMove('roll first');
    if (!movableTokens(me, s.dice!, s.arms).includes(action.token)) throw new IllegalMove("that token can't move");
    return moveToken(s, action.token);
  }
  throw new IllegalMove('unknown action');
}

// ---------------------------------------------------------------------------
// The bot.

/** How many opponent tokens could hit track square `idx` next turn. */
function threats(s: LudoState, me: LudoPlayer, idx: number): number {
  if (isSafe(idx)) return 0;
  const lap = PER_ARM * s.arms;
  let n = 0;
  for (const p of s.players) {
    if (p.id === me.id || p.out) continue;
    for (const t of p.tokens) {
      const at = trackAt(s.arms, p.arm, t);
      if (at !== null) {
        const gap = (idx - at + lap) % lap;
        // Within a roll behind, and not about to turn into its own home column first.
        if (gap >= 1 && gap <= 6 && t + gap <= lastTrack(s.arms)) n++;
      } else if (t === YARD && PER_ARM * p.arm === idx) n++;
    }
  }
  return n;
}

/** The bot's token for the current roll. */
function chooseToken(s: LudoState, rand: () => number = Math.random): number {
  const me = s.players[s.turn];
  const roll = s.dice!;
  const options = movableTokens(me, roll, s.arms);
  const level = me.difficulty ?? 'normal';
  const home = homeOf(s.arms);
  const last = lastTrack(s.arms);
  if (level === 'easy' && rand() < 0.6) return options[Math.floor(rand() * options.length)];
  let best = options[0];
  let bestScore = -Infinity;
  for (const i of options) {
    const from = me.tokens[i];
    const to = destination(from, roll, s.arms)!;
    const landing = trackAt(s.arms, me.arm, to);
    let score = to * 0.4;
    if (from === YARD) score += 45;
    if (to === home) score += 70;
    if (to > last && from <= last) score += 30; // into the home column: out of reach
    if (landing !== null) {
      for (const p of s.players) {
        if (p.id === me.id || p.out || isSafe(landing)) continue;
        for (const t of p.tokens) if (trackAt(s.arms, p.arm, t) === landing) score += 60 + t;
      }
      if (isSafe(landing)) score += 15;
      score -= threats(s, me, landing) * (level === 'hard' ? 28 : 18);
    }
    const here = trackAt(s.arms, me.arm, from);
    if (here !== null) score += threats(s, me, here) * (level === 'hard' ? 22 : 12); // getting out of danger
    score += rand() * 2;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/** How long a token's walk takes to watch. */
export function eventMs(e: LudoEvent | null): number {
  if (!e || e.kind !== 'move') return 0;
  const steps = e.from === YARD ? 1 : e.to! - e.from!;
  return steps * 140 + (e.captured?.length ? 600 : 0);
}

export const ludoKit: GameKit<LudoState, LudoAction> = {
  seatError: (count) => (count >= 2 && count <= 8 ? null : 'Ludo is for 2-8 players'),
  create: (seats, seed) => createLudo(seats, seed),
  pieces: COLORS,
  apply: applyLudo,
  actor: (s) => (s.over ? null : s.players[s.turn].id),
  players: (s) => s.players,
  isOver: (s) => s.over,
  bot: (s, rand) => (s.phase === 'roll' ? { type: 'ROLL' } : { type: 'MOVE', token: chooseToken(s, rand) }),
  timeout: (s) => (s.phase === 'roll' ? { type: 'ROLL' } : { type: 'MOVE', token: chooseToken(s) }),
  // A roll lands, then a pause to choose; each move is watched before the next roll.
  botDelay: (s) => (s.phase === 'move' ? 750 : 600 + eventMs(s.last)),
  setBot: (s, id, difficulty) => ({ ...s, players: s.players.map((p) => (p.id === id ? { ...p, isAI: true, difficulty } : p)) }),
  forfeit: (s, id) => {
    const players = s.players.map((p) => (p.id === id ? { ...p, out: true, tokens: p.tokens.map(() => YARD) } : p));
    const left = players.filter((p) => !p.out);
    const next = { ...s, players };
    if (s.over) return next;
    if (left.length === 1) return { ...next, over: true, winner: left[0].id, score: { ...s.score, [left[0].id]: (s.score[left[0].id] ?? 0) + 1 } };
    return s.players[s.turn].id === id ? { ...next, phase: 'roll', dice: null, sixes: 0, turn: nextTurn(next) } : next;
  },
  end: (s) => ({ ...s, over: true }),
  redact: (s) => s,
  turnMs: 20_000,
};
