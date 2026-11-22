/**
 * Imposter: a word-bluffing party game. Each round everyone but one player is
 * told a secret word from a category; the imposter is told only the category
 * (Classic) or handed a close neighbour of the word without being told
 * (Decoy). Players take turns giving one-word clues, talk it over, and vote
 * someone out. Catch the imposter and the crew scores; a Classic imposter who
 * is caught can still steal a point by naming the word.
 *
 * The kit has one actor at a time, so votes are cast in any order but the
 * clock and the bots work through the voters one by one; the talk before the
 * vote is a timed step the game ends by itself (`auto`).
 */
import {
  DEALER_ID,
  IllegalMove,
  nextRandom,
  shuffle,
  type GameKit,
  type KitCommonAction,
  type KitPlayer,
  type KitSeat,
} from '../kit/engine';
import { imposterBot } from './bot';
import { CATEGORIES, categoryById, norm, wordsIn } from './words';

export type Mode = 'classic' | 'decoy';
export type RoundsSetting = 3 | 5 | 'each';
export type CluesSetting = 1 | 2 | 3;

interface ImposterOptions {
  mode?: Mode;
  rounds?: RoundsSetting;
  clues?: CluesSetting;
}

export const MODES: Record<Mode, { name: string; hint: string }> = {
  classic: { name: 'Classic', hint: 'The imposter knows, sees only the category, and can steal the round by naming the word' },
  decoy: { name: 'Decoy', hint: 'The imposter gets a close but different word and does not know they are the imposter' },
};

/** How long the table talks before the vote opens by itself. */
export const DISCUSS_MS = 60_000;
/** The longest clue accepted. */
export const MAX_CLUE = 20;
export const MIN_SEATS = 3;
export const MAX_SEATS = 10;

interface ImpPlayer extends KitPlayer {
  score: number;
  /** Left the game: skipped for clues and votes. */
  out: boolean;
}

interface Clue {
  player: string;
  /** Null: the clock ran out before a clue was given. */
  text: string | null;
}

type Phase = 'clues' | 'discuss' | 'vote' | 'guess' | 'reveal' | 'over';

/** escaped: not voted out. guessed: voted out but named the word. caught: voted out.
 *  void: the imposter left, so the round scores nothing. */
export type Outcome = 'escaped' | 'guessed' | 'caught' | 'void';

interface Round {
  number: number;
  category: string;
  /** The crew's word (hidden until the reveal; see `yours`). */
  word: string;
  /** Decoy mode: the imposter's word. Empty in Classic and until the reveal. */
  decoy: string;
  /** Hidden ('') from everyone but a Classic imposter until the vote catches them or the reveal. */
  imposter: string;
  /** In a player's view: the word they were shown (null for a Classic imposter). */
  yours?: string | null;
  /** Clue order this round: live players from the round's first clue-giver. */
  order: string[];
  clues: Clue[];
  /** Index of the next clue slot (order.length slots per pass). */
  turn: number;
  /** Talk: humans ready to vote. */
  ready: string[];
  /** One ballot per vote held (a runoff adds a second): voter -> target, null for no vote.
   *  Others' targets read '?' until the ballot is counted. */
  ballots: Record<string, string | null>[];
  candidates: string[];
  runoff: boolean;
  votedOut: string | null;
  guess: string | null;
  outcome: Outcome | null;
  /** Points scored this round. */
  points: Record<string, number>;
}

interface RoundSummary {
  number: number;
  category: string;
  word: string;
  decoy: string;
  imposter: string;
  votedOut: string | null;
  guess: string | null;
  outcome: Outcome;
  points: Record<string, number>;
}

export interface ImposterState {
  mode: Mode;
  cluesEach: CluesSetting;
  totalRounds: number;
  rounds: RoundsSetting;
  seed: number;
  players: ImpPlayer[];
  /** Who is still to be the imposter this cycle (hidden). */
  queue: string[];
  /** Words already dealt this game (hidden). */
  used: string[];
  /** Seat index that clues first this round. */
  first: number;
  round: Round;
  history: RoundSummary[];
  phase: Phase;
  seq: number;
  over: boolean;
  winners: string[];
}

export type ImposterAction =
  | { type: 'CLUE'; text: string }
  /** No clue (the clock ran out). */
  | { type: 'PASS' }
  /** Done talking: a human is ready to vote. */
  | { type: 'READY' }
  /** The talk's time is up (the dealer). */
  | { type: 'START_VOTE' }
  | { type: 'VOTE'; target: string | null }
  | { type: 'GUESS'; word: string }
  /** On to the next round after the reveal (the dealer). */
  | { type: 'NEXT' };

const live = (s: ImposterState) => s.players.filter((p) => !p.out);
const isLive = (s: ImposterState, id: string) => s.players.some((p) => p.id === id && !p.out);
const currentBallot = (r: Round) => r.ballots[r.ballots.length - 1];

/** The word `id` was shown this round (null for a Classic imposter). */
function wordFor(s: ImposterState, id: string): string | null {
  if (id !== s.round.imposter) return s.round.word;
  return s.mode === 'decoy' ? s.round.decoy : null;
}

/** Why `text` can't be `id`'s clue right now, or null if it can. */
export function clueError(s: ImposterState, id: string, text: string): string | null {
  const t = text.trim();
  if (!/^[A-Za-z][A-Za-z'-]*$/.test(t)) return 'Give one word, letters only.';
  if (t.length > MAX_CLUE) return `Keep it under ${MAX_CLUE + 1} letters.`;
  const n = norm(t);
  if (s.round.clues.some((c) => c.text !== null && norm(c.text) === n)) return 'That clue was already given this round.';
  const own = wordFor(s, id);
  if (own) {
    const w = norm(own);
    if (n.includes(w) || (n.length >= 3 && w.includes(n))) return "You can't use your word or part of it.";
  }
  return null;
}

/** The player whose clue is due. */
function clueGiver(s: ImposterState): string | null {
  const r = s.round;
  return s.phase === 'clues' ? r.order[r.turn % r.order.length] : null;
}

function pickImposter(s: ImposterState): string {
  let queue = s.queue.filter((id) => isLive(s, id));
  if (queue.length === 0) {
    [queue, s.seed] = shuffle(
      live(s).map((p) => p.id),
      s.seed,
    );
  }
  const [id, ...rest] = queue;
  s.queue = rest;
  return id;
}

/** A category and word (and, in Decoy, its pair) not dealt yet this game. */
function pickWords(s: ImposterState): { category: string; word: string; decoy: string } {
  const options = CATEGORIES.flatMap((c) =>
    c.pairs
      .filter(([a, b]) => !s.used.includes(a.word) && !s.used.includes(b.word))
      .map((pair) => ({ category: c.id, pair })),
  );
  // Over a hundred rounds in, start the list again.
  if (options.length === 0) {
    s.used = [];
    return pickWords(s);
  }
  let r: number;
  [r, s.seed] = nextRandom(s.seed);
  const { category, pair } = options[Math.floor(r * options.length)];
  [r, s.seed] = nextRandom(s.seed);
  const [word, decoy] = r < 0.5 ? [pair[0].word, pair[1].word] : [pair[1].word, pair[0].word];
  s.used.push(word, decoy);
  return { category, word, decoy: s.mode === 'decoy' ? decoy : '' };
}

function startRound(s: ImposterState, number: number): void {
  const seats = s.players.length;
  // The first clue-giver moves one live seat round the table each round.
  let first = s.first;
  for (let i = 0; i < seats; i++) {
    first = (first + 1) % seats;
    if (!s.players[first].out) break;
  }
  s.first = first;
  const order = [...s.players.slice(first), ...s.players.slice(0, first)].filter((p) => !p.out).map((p) => p.id);
  const imposter = pickImposter(s);
  const { category, word, decoy } = pickWords(s);
  s.round = {
    number,
    category,
    word,
    decoy,
    imposter,
    order,
    clues: [],
    turn: 0,
    ready: [],
    ballots: [],
    candidates: [],
    runoff: false,
    votedOut: null,
    guess: null,
    outcome: null,
    points: {},
  };
  s.phase = 'clues';
}

export function createImposter(seats: KitSeat[], seed: number, options?: unknown): ImposterState {
  const o = (options ?? {}) as ImposterOptions;
  const mode: Mode = o.mode === 'decoy' ? 'decoy' : 'classic';
  const rounds: RoundsSetting = o.rounds === 3 || o.rounds === 'each' ? o.rounds : 5;
  const cluesEach: CluesSetting = o.clues === 1 || o.clues === 3 ? o.clues : 2;
  const [r, next] = nextRandom(seed);
  const s: ImposterState = {
    mode,
    cluesEach,
    rounds,
    totalRounds: rounds === 'each' ? seats.length : rounds,
    seed: next,
    players: seats.map((p, i) => ({ id: `p${i}`, name: p.name, isAI: p.isAI, difficulty: p.difficulty, score: 0, out: false })),
    queue: [],
    used: [],
    // startRound moves on one seat, so this makes a random seat clue first.
    first: (Math.floor(r * seats.length) + seats.length - 1) % seats.length,
    round: null as unknown as Round,
    history: [],
    phase: 'clues',
    seq: 0,
    over: false,
    winners: [],
  };
  startRound(s, 1);
  return s;
}

/** Past every clue slot of a player who has left; into the talk once all are given. */
function advanceClues(s: ImposterState): void {
  const r = s.round;
  const slots = r.order.length * s.cluesEach;
  while (r.turn < slots && !isLive(s, r.order[r.turn % r.order.length])) r.turn += 1;
  if (r.turn >= slots) {
    s.phase = 'discuss';
    r.ready = [];
  }
}

function startVote(s: ImposterState, candidates: string[]): void {
  s.phase = 'vote';
  s.round.candidates = candidates;
  s.round.ballots.push({});
}

function score(s: ImposterState, outcome: Outcome): void {
  const r = s.round;
  r.outcome = outcome;
  const award = (id: string, n: number) => {
    r.points[id] = (r.points[id] ?? 0) + n;
    s.players.find((p) => p.id === id)!.score += n;
  };
  if (outcome === 'escaped') award(r.imposter, 2);
  else if (outcome === 'guessed') award(r.imposter, 1);
  else if (outcome === 'caught') for (const p of live(s)) if (p.id !== r.imposter) award(p.id, 1);
  s.phase = 'reveal';
}

/** The voted-out player is decided: the imposter escapes, or is caught (and, in Classic, guesses). */
function resolve(s: ImposterState, out: string | null): void {
  s.round.votedOut = out;
  if (out !== s.round.imposter) return score(s, 'escaped');
  if (s.mode === 'classic') {
    s.phase = 'guess';
    return;
  }
  score(s, 'caught');
}

function tally(s: ImposterState): void {
  const r = s.round;
  const counts = new Map<string, number>();
  for (const target of Object.values(currentBallot(r))) {
    if (target && isLive(s, target)) counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  const most = Math.max(0, ...counts.values());
  const top = [...counts].filter(([, n]) => n === most && n > 0).map(([id]) => id);
  if (top.length === 1) return resolve(s, top[0]);
  if (top.length > 1 && !r.runoff) {
    r.runoff = true;
    return startVote(s, top);
  }
  resolve(s, null);
}

/** Everyone still in has voted: count the ballot. */
function maybeTally(s: ImposterState): void {
  const ballot = currentBallot(s.round);
  if (live(s).every((p) => p.id in ballot)) tally(s);
}

/** Everyone human is done talking (a bot table never waits). */
function maybeOpenVote(s: ImposterState): void {
  if (live(s).every((p) => p.isAI || s.round.ready.includes(p.id))) startVote(s, live(s).map((p) => p.id));
}

function finish(s: ImposterState): void {
  s.phase = 'over';
  s.over = true;
  const contenders = live(s).length > 0 ? live(s) : s.players;
  const top = Math.max(...contenders.map((p) => p.score));
  s.winners = contenders.filter((p) => p.score === top).map((p) => p.id);
}

function nextRound(s: ImposterState): void {
  const r = s.round;
  s.history.push({
    number: r.number,
    category: r.category,
    word: r.word,
    decoy: r.decoy,
    imposter: r.imposter,
    votedOut: r.votedOut,
    guess: r.guess,
    outcome: r.outcome ?? 'void',
    points: r.points,
  });
  if (r.number >= s.totalRounds || live(s).length < MIN_SEATS) return finish(s);
  startRound(s, r.number + 1);
}

function applyImposter(prev: ImposterState, action: ImposterAction | KitCommonAction, actorId: string): ImposterState {
  if (action.type === 'REMATCH') {
    if (!prev.over) throw new IllegalMove('the game is still going');
    return createImposter(
      prev.players.map((p) => ({ name: p.name, isAI: p.isAI, difficulty: p.difficulty })),
      nextRandom(prev.seed)[1],
      { mode: prev.mode, rounds: prev.rounds, clues: prev.cluesEach },
    );
  }
  if (action.type === 'RESIGN') return forfeit(prev, actorId);
  if (prev.over) throw new IllegalMove('the game is over');
  const s = structuredClone(prev);
  const r = s.round;
  s.seq += 1;
  switch (action.type) {
    case 'CLUE':
    case 'PASS': {
      if (clueGiver(s) !== actorId) throw new IllegalMove('not your turn to give a clue');
      let text: string | null = null;
      if (action.type === 'CLUE') {
        const err = clueError(s, actorId, String(action.text ?? ''));
        if (err) throw new IllegalMove(err);
        text = action.text.trim();
      }
      r.clues.push({ player: actorId, text });
      r.turn += 1;
      advanceClues(s);
      return s;
    }
    case 'READY': {
      const p = s.players.find((q) => q.id === actorId);
      if (s.phase !== 'discuss' || !p || p.out || p.isAI || r.ready.includes(actorId)) throw new IllegalMove('nothing to be ready for');
      r.ready.push(actorId);
      maybeOpenVote(s);
      return s;
    }
    case 'START_VOTE':
      if (actorId !== DEALER_ID || s.phase !== 'discuss') throw new IllegalMove('the vote is not due');
      startVote(s, live(s).map((p) => p.id));
      return s;
    case 'VOTE': {
      if (s.phase !== 'vote' || !isLive(s, actorId)) throw new IllegalMove('no vote is open');
      const ballot = currentBallot(r);
      if (actorId in ballot) throw new IllegalMove('you have already voted');
      const target = action.target;
      if (target !== null && (target === actorId || !r.candidates.includes(target) || !isLive(s, target))) {
        throw new IllegalMove('vote for another player in the vote');
      }
      ballot[actorId] = target;
      maybeTally(s);
      return s;
    }
    case 'GUESS': {
      if (s.phase !== 'guess' || actorId !== r.imposter) throw new IllegalMove('no guess is due');
      const options = wordsIn(categoryById(r.category));
      if (action.word !== '' && !options.includes(action.word)) throw new IllegalMove('pick one of the category\'s words');
      r.guess = action.word || null;
      score(s, action.word === r.word ? 'guessed' : 'caught');
      return s;
    }
    case 'NEXT':
      if (actorId !== DEALER_ID || s.phase !== 'reveal') throw new IllegalMove('the round is still going');
      nextRound(s);
      return s;
  }
  throw new IllegalMove('unknown action');
}

/** Who acts now: the clue-giver; in a vote the bots first, then each human not yet voted; the caught imposter. */
export function imposterActor(s: ImposterState): string | null {
  if (s.over) return null;
  switch (s.phase) {
    case 'clues':
      return clueGiver(s);
    case 'vote': {
      const ballot = currentBallot(s.round);
      const waiting = live(s).filter((p) => !(p.id in ballot));
      return (waiting.find((p) => p.isAI) ?? waiting[0])?.id ?? null;
    }
    case 'guess':
      return s.round.imposter;
    default:
      return null;
  }
}

function forfeit(prev: ImposterState, id: string): ImposterState {
  const p = prev.players.find((q) => q.id === id);
  if (!p || p.out || prev.over) return prev;
  const s = structuredClone(prev);
  const r = s.round;
  s.players.find((q) => q.id === id)!.out = true;
  s.queue = s.queue.filter((q) => q !== id);
  if (live(s).length < MIN_SEATS) {
    if (s.phase !== 'reveal') r.outcome = r.outcome ?? 'void';
    finish(s);
    return s;
  }
  if (s.phase === 'reveal') return s;
  if (id === r.imposter) {
    score(s, 'void');
    return s;
  }
  if (s.phase === 'clues') advanceClues(s);
  else if (s.phase === 'discuss') maybeOpenVote(s);
  else if (s.phase === 'vote') {
    delete currentBallot(r)[id];
    maybeTally(s);
  }
  return s;
}

/** A player's view: no seed or imposter queue, words and the imposter hidden until they
 *  are known to this player, and others' votes hidden until the ballot is counted. */
export function redactImposter(s: ImposterState, viewer: string): ImposterState {
  const r = s.round;
  const revealed = s.phase === 'reveal' || s.phase === 'over';
  const seated = s.players.some((p) => p.id === viewer);
  const knowsImposter = revealed || s.phase === 'guess' || (s.mode === 'classic' && viewer === r.imposter);
  const ballots = r.ballots.map((b, i) =>
    s.phase === 'vote' && i === r.ballots.length - 1
      ? Object.fromEntries(Object.entries(b).map(([voter, target]) => [voter, voter === viewer ? target : '?']))
      : b,
  );
  return {
    ...s,
    seed: 0,
    queue: [],
    used: [],
    round: {
      ...r,
      word: revealed ? r.word : '',
      decoy: revealed ? r.decoy : '',
      imposter: knowsImposter ? r.imposter : '',
      yours: seated ? wordFor(s, viewer) : null,
      ballots,
    },
  };
}

export const imposterKit: GameKit<ImposterState, ImposterAction> = {
  seatError(count) {
    if (count < MIN_SEATS) return `Imposter needs at least ${MIN_SEATS} players`;
    return count > MAX_SEATS ? `Imposter seats at most ${MAX_SEATS} players` : null;
  },
  create: createImposter,
  apply: applyImposter,
  actor: imposterActor,
  players: (s) => s.players,
  isOver: (s) => s.over,
  bot: (s, rand = Math.random) => imposterBot(s, rand),
  timeout(s) {
    if (s.phase === 'vote') return { type: 'VOTE', target: null };
    if (s.phase === 'guess') return { type: 'GUESS', word: '' };
    return { type: 'PASS' };
  },
  botDelay: (s) => (s.phase === 'clues' ? 1700 : s.phase === 'guess' ? 2200 : 900),
  auto(s) {
    if (s.over) return null;
    if (s.phase === 'discuss') return { action: { type: 'START_VOTE' }, delay: live(s).some((p) => !p.isAI) ? DISCUSS_MS : 1200 };
    if (s.phase === 'reveal') return { action: { type: 'NEXT' }, delay: 8000 };
    return null;
  },
  setBot: (s, id, difficulty) => ({ ...s, players: s.players.map((p) => (p.id === id ? { ...p, isAI: true, difficulty } : p)) }),
  forfeit,
  end(s) {
    if (s.over) return s;
    const next = structuredClone(s);
    finish(next);
    return next;
  },
  redact: redactImposter,
  turnMs: 40_000,
};
