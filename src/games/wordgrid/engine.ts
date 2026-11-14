/**
 * Wordgrid – a crossword tile game on GameHub's own board.
 *
 * 15×15 squares with premium squares in GameHub's own pattern (double/triple
 * letter, double/triple word; the centre star doubles the first word). 100
 * tiles in GameHub's own spread of letters and values, two of them blank.
 *
 * On your turn, lay tiles from your rack of seven in one row or column, all
 * joined up with tiles already down (the first word covers the centre). Every
 * word made must be in the dictionary (ENABLE). Letters score their value, with
 * premiums counting only under newly laid tiles; using all seven tiles earns 50
 * more. Instead of playing you may swap tiles (while the bag holds at least
 * seven) or pass.
 *
 * The game ends when someone plays their last tile with the bag empty – they
 * gain the value of everyone else's racks, which those players lose – or after
 * six scoreless turns in a row, when everyone loses what's left on their rack.
 */
import { IllegalMove, nextRandom, shuffle, type GameKit, type KitCommonAction, type KitPlayer, type KitSeat } from '../kit/engine';
import { getDictionary, step } from './dictionary';

export const N = 15;
export const CENTRE = 7 * N + 7;
export const RACK = 7;
export const BINGO = 50;

export type Premium = 'TW' | 'DW' | 'TL' | 'DL' | null;

/** The premium squares, defined on one eighth of the board and mirrored. */
function buildPremiums(): Premium[] {
  const grid: Premium[] = Array(N * N).fill(null);
  const eighth: [number, number, Premium][] = [
    [0, 3, 'TW'],
    [1, 7, 'DW'],
    [3, 5, 'DW'],
    [5, 5, 'DW'],
    [7, 7, 'DW'],
    [1, 4, 'TL'],
    [6, 6, 'TL'],
    [0, 0, 'DL'],
    [2, 2, 'DL'],
    [2, 6, 'DL'],
    [3, 6, 'DL'],
    [4, 7, 'DL'],
  ];
  for (const [r, c, p] of eighth) {
    for (const [a, b] of [
      [r, c],
      [c, r],
    ]) {
      for (const rr of [a, N - 1 - a]) for (const cc of [b, N - 1 - b]) grid[rr * N + cc] = p;
    }
  }
  return grid;
}

export const PREMIUMS = buildPremiums();

/** Letter counts and values ('?' is a blank). */
export const LETTERS: Record<string, [number, number]> = {
  E: [12, 1], A: [9, 1], I: [8, 1], O: [8, 1], N: [6, 1], R: [6, 1], T: [6, 1], S: [5, 1],
  L: [4, 2], U: [4, 2], D: [4, 2], G: [3, 2],
  C: [2, 3], M: [2, 3], H: [2, 3], P: [2, 3],
  B: [2, 4], F: [2, 4], Y: [2, 4], W: [2, 4],
  V: [2, 5], K: [1, 5], J: [1, 8], X: [1, 8], Q: [1, 10], Z: [1, 10],
  '?': [2, 0],
};
export const valueOf = (letter: string) => LETTERS[letter]?.[1] ?? 0;

export interface Tile {
  id: number;
  /** A–Z, or '?' for a blank. */
  letter: string;
}

export interface Placed {
  id: number;
  /** The letter it stands for (a blank's chosen letter). */
  letter: string;
  blank: boolean;
  by: string;
}

export interface WgPlayer extends KitPlayer {
  rack: Tile[];
  rackCount: number;
  score: number;
  out?: boolean;
}

export interface WgMove {
  player: string;
  kind: 'play' | 'exchange' | 'pass';
  words?: { word: string; score: number }[];
  score: number;
  cells?: number[];
  count?: number;
  bingo?: boolean;
  seq: number;
}

export interface WgState {
  players: WgPlayer[];
  turn: number;
  board: (Placed | null)[];
  bag: Tile[];
  bagCount: number;
  scoreless: number;
  last: WgMove | null;
  history: WgMove[];
  /** End-of-game rack adjustments, by player. */
  final: Record<string, number> | null;
  winner: string | null;
  over: boolean;
  game: number;
  wins: Record<string, number>;
  seed: number;
}

export interface Placement {
  id: number;
  cell: number;
  /** The letter a blank stands for. */
  letter?: string;
}

export type WgAction = { type: 'PLAY'; tiles: Placement[] } | { type: 'EXCHANGE'; ids: number[] } | { type: 'PASS' };

const HISTORY = 40;

// ---------------------------------------------------------------------------
// Laying and scoring tiles.

export interface Scored {
  words: { word: string; score: number; cells: number[] }[];
  score: number;
  bingo: boolean;
}

const rowOf = (i: number) => Math.floor(i / N);
const colOf = (i: number) => i % N;

/**
 * Check a placement against the board and score it. Returns the words made and
 * the total, or a reason it isn't allowed (dictionary not consulted unless `check`).
 */
export function evaluate(board: (Placed | null)[], tiles: { cell: number; letter: string; blank: boolean }[], check = true): Scored | { error: string } {
  if (tiles.length === 0) return { error: 'Lay at least one tile.' };
  const cells = tiles.map((t) => t.cell);
  if (new Set(cells).size !== cells.length) return { error: 'Two tiles on one square.' };
  if (cells.some((c) => c < 0 || c >= N * N || board[c])) return { error: 'That square is taken.' };
  const empty = board.every((p) => !p);
  if (empty && !cells.includes(CENTRE)) return { error: 'The first word must cover the centre star.' };
  if (empty && tiles.length < 2) return { error: 'The first word needs at least two letters.' };

  const sameRow = cells.every((c) => rowOf(c) === rowOf(cells[0]));
  const sameCol = cells.every((c) => colOf(c) === colOf(cells[0]));
  if (!sameRow && !sameCol) return { error: 'Lay tiles in one row or one column.' };
  const at = new Map(tiles.map((t) => [t.cell, t]));
  const letterAt = (c: number) => at.get(c)?.letter ?? board[c]?.letter ?? null;

  // Direction of the main word: along the line of tiles (a single tile picks whichever makes a word).
  const across = tiles.length > 1 ? sameRow : (() => {
    const c = cells[0];
    return (colOf(c) > 0 && !!board[c - 1]) || (colOf(c) < N - 1 && !!board[c + 1]);
  })();
  const stepBy = across ? 1 : N;
  const inLine = (from: number, d: number) => (across ? rowOf(from) === rowOf(from + d) : from + d >= 0 && from + d < N * N);

  // The main word: from the first tile back to the start, and on to the end, with no gaps.
  const sorted = [...cells].sort((a, b) => a - b);
  let start = sorted[0];
  while (inLine(start, -stepBy) && letterAt(start - stepBy)) start -= stepBy;
  let end = sorted[sorted.length - 1];
  for (let c = sorted[0]; c <= sorted[sorted.length - 1]; c += stepBy) if (!letterAt(c)) return { error: 'Tiles must be in one unbroken line.' };
  while (inLine(end, stepBy) && letterAt(end + stepBy)) end += stepBy;

  const wordAt = (from: number, to: number, d: number) => {
    let word = '';
    let sum = 0;
    let mult = 1;
    const span: number[] = [];
    for (let c = from; c <= to; c += d) {
      const t = at.get(c);
      const p = board[c];
      const letter = (t?.letter ?? p!.letter);
      const blank = t ? t.blank : p!.blank;
      let v = blank ? 0 : valueOf(letter);
      if (t) {
        const prem = PREMIUMS[c];
        if (prem === 'DL') v *= 2;
        if (prem === 'TL') v *= 3;
        if (prem === 'DW') mult *= 2;
        if (prem === 'TW') mult *= 3;
      }
      word += letter;
      sum += v;
      span.push(c);
    }
    return { word, score: sum * mult, cells: span };
  };

  const words: Scored['words'] = [];
  if (end > start) words.push(wordAt(start, end, stepBy));
  // Cross words through each new tile.
  const cross = across ? N : 1;
  for (const t of tiles) {
    let a = t.cell;
    const crossLine = (from: number, d: number) => (cross === 1 ? rowOf(from) === rowOf(from + d) : from + d >= 0 && from + d < N * N);
    while (crossLine(a, -cross) && letterAt(a - cross)) a -= cross;
    let b = t.cell;
    while (crossLine(b, cross) && letterAt(b + cross)) b += cross;
    if (b > a) words.push(wordAt(a, b, cross));
  }
  if (words.length === 0) return { error: 'Make a word of at least two letters.' };
  if (!empty) {
    const joined = words.some((w) => w.cells.some((c) => board[c]));
    if (!joined) return { error: 'Join your word to the tiles already down.' };
  }
  if (check) {
    const dict = getDictionary();
    if (!dict) return { error: 'The dictionary is still loading.' };
    const bad = words.find((w) => !dict.words.has(w.word));
    if (bad) return { error: `${bad.word} isn't in the dictionary.` };
  }
  const bingo = tiles.length === RACK;
  return { words, score: words.reduce((n, w) => n + w.score, 0) + (bingo ? BINGO : 0), bingo };
}

// ---------------------------------------------------------------------------
// The game.

function nextSeat(s: WgState): number {
  for (let k = 1; k <= s.players.length; k++) {
    const i = (s.turn + k) % s.players.length;
    if (!s.players[i].out) return i;
  }
  return s.turn;
}

const record = (s: WgState, m: Omit<WgMove, 'seq'>): Pick<WgState, 'last' | 'history'> => {
  const move = { ...m, seq: (s.last?.seq ?? 0) + 1 };
  return { last: move, history: [move, ...s.history].slice(0, HISTORY) };
};

function draw(bag: Tile[], n: number): [Tile[], Tile[]] {
  return [bag.slice(0, n), bag.slice(n)];
}

const rackValue = (rack: Tile[]) => rack.reduce((n, t) => n + valueOf(t.letter), 0);

function finish(s: WgState, outSeat: number | null): WgState {
  const final: Record<string, number> = {};
  let bonus = 0;
  for (const [i, p] of s.players.entries()) {
    if (p.out || i === outSeat) continue;
    const v = rackValue(p.rack);
    final[p.id] = -v;
    bonus += v;
  }
  if (outSeat !== null) final[s.players[outSeat].id] = bonus;
  const players = s.players.map((p) => ({ ...p, score: p.score + (final[p.id] ?? 0) }));
  const live = players.filter((p) => !p.out);
  const top = Math.max(...live.map((p) => p.score));
  const leaders = live.filter((p) => p.score === top);
  const winner = leaders.length === 1 ? leaders[0].id : null;
  const wins = winner ? { ...s.wins, [winner]: (s.wins[winner] ?? 0) + 1 } : s.wins;
  return { ...s, players, final, winner, over: true, wins };
}

function newGame(s: WgState, game: number): WgState {
  const tiles: Tile[] = [];
  let id = 0;
  for (const [letter, [count]] of Object.entries(LETTERS)) for (let k = 0; k < count; k++) tiles.push({ id: id++, letter });
  let [bag, seed] = shuffle(tiles, s.seed);
  const players = s.players.map((p) => {
    const [rack, rest] = draw(bag, p.out ? 0 : RACK);
    bag = rest;
    return { ...p, rack, rackCount: rack.length, score: 0 };
  });
  const turn = (game - 1) % s.players.length;
  return { ...s, players, turn: s.players[turn].out ? 0 : turn, board: Array(N * N).fill(null), bag, bagCount: bag.length, seed, scoreless: 0, last: null, history: [], final: null, winner: null, over: false, game };
}

export function createWordgrid(seats: KitSeat[], seed: number): WgState {
  const players = seats.map((seat, i) => ({ id: `p${i}`, name: seat.name, isAI: seat.isAI, difficulty: seat.difficulty, rack: [], rackCount: 0, score: 0 }));
  return newGame({ players, seed, wins: Object.fromEntries(players.map((p) => [p.id, 0])) } as unknown as WgState, 1);
}

export function applyWordgrid(s: WgState, action: WgAction | KitCommonAction, actorId: string): WgState {
  const seat = s.players.findIndex((p) => p.id === actorId);
  if (seat < 0) throw new IllegalMove('not in this game');
  if (action.type === 'REMATCH') {
    if (!s.over || s.players.filter((p) => !p.out).length < 2) throw new IllegalMove('the game is still on');
    const [, seed] = nextRandom(s.seed);
    return newGame({ ...s, seed }, s.game + 1);
  }
  if (s.over) throw new IllegalMove('the game is over');
  if (action.type === 'RESIGN') return wordgridKit.forfeit(s, actorId);
  if (s.turn !== seat) throw new IllegalMove('not your turn');
  const me = s.players[seat];

  if (action.type === 'PASS') {
    const next = { ...s, turn: nextSeat(s), scoreless: s.scoreless + 1, ...record(s, { player: me.id, kind: 'pass', score: 0 }) };
    return next.scoreless >= 6 ? finish(next, null) : next;
  }

  if (action.type === 'EXCHANGE') {
    if (s.bag.length < RACK) throw new IllegalMove('the bag needs at least seven tiles to swap');
    const ids = new Set(action.ids);
    if (ids.size === 0 || ![...ids].every((id) => me.rack.some((t) => t.id === id))) throw new IllegalMove('pick tiles from your rack');
    const out = me.rack.filter((t) => ids.has(t.id));
    const [fresh, rest] = draw(s.bag, out.length);
    const [bag, seed] = shuffle([...rest, ...out], s.seed);
    const rack = [...me.rack.filter((t) => !ids.has(t.id)), ...fresh];
    const players = s.players.map((p, i) => (i === seat ? { ...p, rack, rackCount: rack.length } : p));
    const next = { ...s, players, bag, bagCount: bag.length, seed, turn: nextSeat(s), scoreless: s.scoreless + 1, ...record(s, { player: me.id, kind: 'exchange', score: 0, count: out.length }) };
    return next.scoreless >= 6 ? finish(next, null) : next;
  }

  if (action.type !== 'PLAY') throw new IllegalMove('unknown action');
  const used = new Set<number>();
  const laid = action.tiles.map((p) => {
    const tile = me.rack.find((t) => t.id === p.id);
    if (!tile || used.has(p.id)) throw new IllegalMove("those tiles aren't on your rack");
    used.add(p.id);
    const blank = tile.letter === '?';
    const letter = blank ? (p.letter ?? '').toUpperCase() : tile.letter;
    if (!/^[A-Z]$/.test(letter)) throw new IllegalMove('choose a letter for the blank');
    return { id: tile.id, cell: p.cell, letter, blank };
  });
  const result = evaluate(s.board, laid);
  if ('error' in result) throw new IllegalMove(result.error);
  const board = s.board.map((c, i) => {
    const t = laid.find((l) => l.cell === i);
    return t ? { id: t.id, letter: t.letter, blank: t.blank, by: me.id } : c;
  });
  const [fresh, bag] = draw(s.bag, laid.length);
  const rack = [...me.rack.filter((t) => !used.has(t.id)), ...fresh];
  const players = s.players.map((p, i) => (i === seat ? { ...p, rack, rackCount: rack.length, score: p.score + result.score } : p));
  const move = record(s, { player: me.id, kind: 'play', score: result.score, words: result.words.map((w) => ({ word: w.word, score: w.score })), cells: laid.map((l) => l.cell), bingo: result.bingo });
  const next: WgState = { ...s, board, players, bag, bagCount: bag.length, scoreless: 0, ...move };
  if (rack.length === 0 && bag.length === 0) return finish(next, seat);
  return { ...next, turn: nextSeat(s) };
}

// ---------------------------------------------------------------------------
// The bot: every legal move (anchors, cross-checks, trie walk), then a pick by level.

export interface Candidate {
  tiles: Placement[];
  score: number;
}

const A = 65;

/** All legal plays for `rack` on `board` (dictionary required). */
export function generateMoves(board: (Placed | null)[], rack: Tile[]): Candidate[] {
  const dict = getDictionary();
  if (!dict) return [];
  const t = dict.trie;
  const out: Candidate[] = [];
  const seen = new Set<string>();
  const empty = board.every((p) => !p);
  for (const across of [true, false]) {
    // Work on rows; for the down direction, read the board transposed.
    const get = (r: number, c: number) => (r < 0 || c < 0 || r >= N || c >= N ? null : across ? board[r * N + c] : board[c * N + r]);
    const cellOf = (r: number, c: number) => (across ? r * N + c : c * N + r);
    // Letters allowed at each empty square by the words crossing it.
    const crossOk: (number | null)[] = Array(N * N).fill(null);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (get(r, c)) continue;
        let above = '';
        for (let k = r - 1; k >= 0 && get(k, c); k--) above = get(k, c)!.letter + above;
        let below = '';
        for (let k = r + 1; k < N && get(k, c); k++) below += get(k, c)!.letter;
        if (!above && !below) continue;
        let mask = 0;
        for (let ch = 0; ch < 26; ch++) if (dict.words.has(above + String.fromCharCode(A + ch) + below)) mask |= 1 << ch;
        crossOk[r * N + c] = mask;
      }
    }
    const allowed = (r: number, c: number, ch: number) => {
      const m = crossOk[r * N + c];
      return m === null || (m & (1 << ch)) !== 0;
    };
    const isAnchor = (r: number, c: number) =>
      !get(r, c) && (empty ? cellOf(r, c) === CENTRE : !!(get(r - 1, c) || get(r + 1, c) || get(r, c - 1) || get(r, c + 1)));

    const counts = new Map<string, number>();
    for (const tile of rack) counts.set(tile.letter, (counts.get(tile.letter) ?? 0) + 1);
    const take = (letter: string) => {
      counts.set(letter, counts.get(letter)! - 1);
    };
    const giveBack = (letter: string) => counts.set(letter, counts.get(letter)! + 1);

    const record = (r: number, placed: { c: number; letter: string; blank: boolean }[]) => {
      if (placed.length === 0) return;
      const pool = [...rack];
      const tiles: Placement[] = [];
      for (const p of placed) {
        const k = pool.findIndex((x) => (p.blank ? x.letter === '?' : x.letter === p.letter));
        const tile = pool.splice(k, 1)[0];
        tiles.push({ id: tile.id, cell: cellOf(r, p.c), ...(p.blank ? { letter: p.letter } : {}) });
      }
      const key = tiles.map((x) => `${x.cell}${x.letter ?? ''}${rack.find((y) => y.id === x.id)!.letter}`).sort().join('|');
      if (seen.has(key)) return;
      const result = evaluate(board, tiles.map((x) => ({ cell: x.cell, letter: x.letter ?? rack.find((y) => y.id === x.id)!.letter, blank: !!x.letter })), false);
      if ('error' in result) return;
      seen.add(key);
      out.push({ tiles, score: result.score });
    };

    const extendRight = (r: number, c: number, node: number, placed: { c: number; letter: string; blank: boolean }[], anchorPassed: boolean) => {
      if (c >= N || !get(r, c)) {
        if (t.end[node] && anchorPassed && placed.length > 0 && (c >= N || !get(r, c))) record(r, placed);
        if (c >= N) return;
        for (let k = t.child[node]; k; k = t.sibling[k]) {
          const ch = t.letter[k];
          if (!allowed(r, c, ch)) continue;
          const letter = String.fromCharCode(A + ch);
          if ((counts.get(letter) ?? 0) > 0) {
            take(letter);
            placed.push({ c, letter, blank: false });
            extendRight(r, c + 1, k, placed, true);
            placed.pop();
            giveBack(letter);
          }
          if ((counts.get('?') ?? 0) > 0) {
            take('?');
            placed.push({ c, letter, blank: true });
            extendRight(r, c + 1, k, placed, true);
            placed.pop();
            giveBack('?');
          }
        }
      } else {
        const k = step(t, node, get(r, c)!.letter.charCodeAt(0) - A);
        if (k) extendRight(r, c + 1, k, placed, anchorPassed);
      }
    };

    const leftPart = (r: number, anchor: number, node: number, placed: { c: number; letter: string; blank: boolean }[], limit: number) => {
      // The left part sits just before the anchor: shift it into place as it grows.
      extendRight(r, anchor, node, placed.map((p, i) => ({ ...p, c: anchor - placed.length + i })), false);
      if (limit <= 0) return;
      for (let k = t.child[node]; k; k = t.sibling[k]) {
        const letter = String.fromCharCode(A + t.letter[k]);
        for (const blank of [false, true]) {
          const key = blank ? '?' : letter;
          if ((counts.get(key) ?? 0) <= 0) continue;
          take(key);
          placed.push({ c: 0, letter, blank });
          leftPart(r, anchor, k, placed, limit - 1);
          placed.pop();
          giveBack(key);
        }
      }
    };

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (!isAnchor(r, c)) continue;
        if (c > 0 && get(r, c - 1)) {
          // Tiles already to the left: the word starts with them.
          let s0 = c - 1;
          while (s0 > 0 && get(r, s0 - 1)) s0--;
          let node = 0;
          for (let k = s0; k < c && node >= 0; k++) node = step(t, node, get(r, k)!.letter.charCodeAt(0) - A) || -1;
          if (node > 0) extendRight(r, c, node, [], false);
        } else {
          // Empty squares to the left (not anchors themselves) can take a left part.
          let limit = 0;
          for (let k = c - 1; k >= 0 && !get(r, k) && !isAnchor(r, k); k--) limit++;
          leftPart(r, c, 0, [], Math.min(limit, rack.length - 1));
        }
      }
    }
  }
  return out;
}

/** The bot's move. */
export function wgBotAction(s: WgState, rand: () => number = Math.random): WgAction {
  const me = s.players[s.turn];
  const moves = generateMoves(s.board, me.rack).sort((a, b) => b.score - a.score);
  if (moves.length === 0) {
    if (s.bag.length >= RACK) {
      // Swap the awkward letters: duplicates and the heavy ones.
      const ids = me.rack.filter((t, i) => valueOf(t.letter) >= 4 || me.rack.findIndex((u) => u.letter === t.letter) !== i).map((t) => t.id);
      return { type: 'EXCHANGE', ids: ids.length ? ids : me.rack.map((t) => t.id) };
    }
    return { type: 'PASS' };
  }
  const level = me.difficulty ?? 'normal';
  if (level === 'hard') return { type: 'PLAY', tiles: moves[0].tiles };
  const pct = level === 'easy' ? 0.55 + rand() * 0.4 : 0.1 + rand() * 0.3;
  return { type: 'PLAY', tiles: moves[Math.min(moves.length - 1, Math.floor(moves.length * pct))].tiles };
}

export const wordgridKit: GameKit<WgState, WgAction> = {
  seatError: (count) => (count >= 2 && count <= 4 ? null : 'Wordgrid is for 2–4 players'),
  create: (seats, seed) => createWordgrid(seats, seed),
  apply: applyWordgrid,
  actor: (s) => (s.over ? null : s.players[s.turn].id),
  players: (s) => s.players,
  isOver: (s) => s.over,
  bot: (s, rand) => wgBotAction(s, rand),
  timeout: () => ({ type: 'PASS' }),
  botDelay: () => 1300,
  setBot: (s, id, difficulty) => ({ ...s, players: s.players.map((p) => (p.id === id ? { ...p, isAI: true, difficulty } : p)) }),
  forfeit: (s, id) => {
    const seat = s.players.findIndex((p) => p.id === id);
    const players = s.players.map((p) => (p.id === id ? { ...p, out: true } : p));
    // Their tiles go back in the bag.
    const [bag, seed] = shuffle([...s.bag, ...s.players[seat].rack], s.seed);
    const next = { ...s, players: players.map((p) => (p.id === id ? { ...p, rack: [], rackCount: 0 } : p)), bag, bagCount: bag.length, seed };
    if (s.over) return next;
    if (players.filter((p) => !p.out).length === 1) return finish(next, null);
    return s.turn === seat ? { ...next, turn: nextSeat(next) } : next;
  },
  end: (s) => (s.over ? s : finish(s, null)),
  // Racks are private and the bag order is secret.
  redact: (s, viewer) => ({ ...s, bag: [], players: s.players.map((p) => (p.id === viewer ? p : { ...p, rack: [] })) }),
  turnMs: 120_000,
};

