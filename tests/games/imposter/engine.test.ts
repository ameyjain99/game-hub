import { describe, expect, test } from 'vitest';
import { DEALER_ID, IllegalMove, type KitCommonAction } from '../../../src/games/kit/engine';
import {
  DISCUSS_MS,
  clueError,
  createImposter,
  imposterKit,
  redactImposter,
  type ImposterAction,
  type ImposterState,
} from '../../../src/games/imposter/engine';
import { CATEGORIES, categoryById, wordsIn } from '../../../src/games/imposter/words';

const seats = (n: number, bots = 0) =>
  Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI: i >= n - bots, difficulty: 'normal' }));
const play = (s: ImposterState, a: ImposterAction | KitCommonAction, id: string) => imposterKit.apply(s, a, id);
const actor = (s: ImposterState) => imposterKit.actor(s)!;
const ids = (s: ImposterState) => s.players.map((p) => p.id);
const crewOf = (s: ImposterState) => ids(s).filter((id) => id !== s.round.imposter);

/** A clue no word in the list contains: "qaa", "qba", ... */
const fresh = (i: number) => `q${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`;

function allClues(s: ImposterState): ImposterState {
  let i = 0;
  while (s.phase === 'clues') s = play(s, { type: 'CLUE', text: fresh(i++) }, actor(s));
  return s;
}

/** Clues given, discussion skipped: the vote is open. */
function toVote(s: ImposterState): ImposterState {
  s = allClues(s);
  return play(s, imposterKit.auto!(s)!.action, DEALER_ID);
}

/** Everyone votes for `target`; `target` votes for `fallback`. */
function voteFor(s: ImposterState, target: string, fallback: string): ImposterState {
  for (const id of ids(s)) s = play(s, { type: 'VOTE', target: id === target ? fallback : target }, id);
  return s;
}

/** Run the game with every seat played by the bots and the dealer. */
function runBots(s: ImposterState, steps = 4000): ImposterState {
  for (let i = 0; i < steps && !s.over; i++) {
    const auto = imposterKit.auto!(s);
    s = auto ? play(s, auto.action, DEALER_ID) : play(s, imposterKit.bot(s), actor(s));
  }
  return s;
}

describe('the deal', () => {
  test('Classic: everyone but the imposter is told the word; the imposter is told only the category', () => {
    const s = createImposter(seats(5), 7, { mode: 'classic' });
    const imp = s.round.imposter;
    const crew = crewOf(s)[0];
    expect(ids(s)).toContain(imp);
    expect(wordsIn(categoryById(s.round.category))).toContain(s.round.word);

    const crewView = redactImposter(s, crew);
    expect(crewView.round.yours).toBe(s.round.word);
    expect(crewView.round.imposter).toBe('');
    expect(crewView.round.category).toBe(s.round.category);

    const impView = redactImposter(s, imp);
    expect(impView.round.yours).toBeNull();
    expect(impView.round.imposter).toBe(imp);
    expect(impView.round.category).toBe(s.round.category);
    expect(JSON.stringify(impView)).not.toContain(`"${s.round.word}"`);
    expect(impView.seed).toBe(0);
  });

  test('Decoy: the imposter gets the other word of a close pair and is not told they are the imposter', () => {
    const s = createImposter(seats(5), 3, { mode: 'decoy' });
    const pair = categoryById(s.round.category).pairs.find((p) => p.some((w) => w.word === s.round.word))!;
    expect(pair.map((w) => w.word).sort()).toEqual([s.round.word, s.round.decoy].sort());

    const impView = redactImposter(s, s.round.imposter);
    expect(impView.round.yours).toBe(s.round.decoy);
    expect(impView.round.imposter).toBe('');
    expect(JSON.stringify(impView)).not.toContain(`"${s.round.word}"`);
    expect(JSON.stringify(redactImposter(s, crewOf(s)[0]))).not.toContain(`"${s.round.decoy}"`);
  });

  test('seats: 3 to 10 players', () => {
    expect(imposterKit.seatError(2)).toMatch(/at least 3/);
    expect(imposterKit.seatError(3)).toBeNull();
    expect(imposterKit.seatError(10)).toBeNull();
    expect(imposterKit.seatError(11)).toMatch(/at most 10/);
  });
});

describe('clues', () => {
  test("clues go round the table from the round's first player, two each by default, then the table talks", () => {
    let s = createImposter(seats(4), 11);
    const order = s.round.order;
    expect(order).toHaveLength(4);
    const seen: string[] = [];
    let i = 0;
    while (s.phase === 'clues') {
      seen.push(actor(s));
      s = play(s, { type: 'CLUE', text: fresh(i++) }, actor(s));
    }
    expect(seen).toEqual([...order, ...order]);
    expect(s.phase).toBe('discuss');
    expect(imposterKit.actor(s)).toBeNull();
  });

  test('the clue count per player is an option', () => {
    const s = allClues(createImposter(seats(4), 11, { clues: 1 }));
    expect(s.round.clues).toHaveLength(4);
  });

  test("a clue is one new word, and a crew member's clue may not hold their word", () => {
    let s = createImposter(seats(5), 21, { mode: 'classic' });
    // Make sure the first clue-giver is crew.
    while (actor(s) === s.round.imposter) s = play(s, { type: 'CLUE', text: fresh(s.round.clues.length) }, actor(s));
    const crew = actor(s);
    const word = s.round.word.toLowerCase();
    expect(clueError(s, crew, 'two words')).toMatch(/one word/i);
    expect(clueError(s, crew, '')).toMatch(/one word/i);
    expect(clueError(s, crew, word)).toMatch(/your word/i);
    expect(clueError(s, crew, `${word}s`)).toMatch(/your word/i);
    expect(() => play(s, { type: 'CLUE', text: word }, crew)).toThrow(IllegalMove);
    s = play(s, { type: 'CLUE', text: 'quokka' }, crew);
    expect(clueError(s, actor(s), 'Quokka')).toMatch(/already/i);
  });

  test('a Classic imposter may give any new word: blocking the secret word would give it away', () => {
    const s = createImposter(seats(5), 21, { mode: 'classic' });
    expect(clueError(s, s.round.imposter, s.round.word)).toBeNull();
  });

  test('only the player whose turn it is may give a clue', () => {
    const s = createImposter(seats(4), 5);
    const other = ids(s).find((id) => id !== actor(s))!;
    expect(() => play(s, { type: 'CLUE', text: 'hello' }, other)).toThrow(IllegalMove);
  });

  test('a player who runs out of time gives no clue and play moves on', () => {
    const s = createImposter(seats(4), 5);
    const first = actor(s);
    const next = play(s, imposterKit.timeout(s), first);
    expect(next.round.clues[0]).toEqual({ player: first, text: null });
    expect(actor(next)).not.toBe(first);
  });
});

describe('talk and vote', () => {
  test('the talk ends when every human is ready, or by itself when its time is up', () => {
    const s = allClues(createImposter(seats(4, 2), 9));
    const auto = imposterKit.auto!(s)!;
    expect(auto.delay).toBe(DISCUSS_MS);
    expect(play(s, auto.action, DEALER_ID).phase).toBe('vote');
    const one = play(s, { type: 'READY' }, 'p0');
    expect(one.phase).toBe('discuss');
    expect(() => play(one, { type: 'READY' }, 'p0')).toThrow(IllegalMove);
    expect(play(one, { type: 'READY' }, 'p1').phase).toBe('vote');
  });

  test('a table of bots does not wait out the talk', () => {
    const s = allClues(createImposter(seats(4, 4), 9));
    expect(imposterKit.auto!(s)!.delay).toBeLessThan(DISCUSS_MS);
  });

  test('votes are cast in any order, kept secret until all are in, and you cannot vote for yourself', () => {
    let s = toVote(createImposter(seats(4), 13));
    expect(() => play(s, { type: 'VOTE', target: 'p2' }, 'p2')).toThrow(IllegalMove);
    s = play(s, { type: 'VOTE', target: 'p0' }, 'p2');
    expect(() => play(s, { type: 'VOTE', target: 'p1' }, 'p2')).toThrow(IllegalMove);
    const ballot = (v: ImposterState) => v.round.ballots[v.round.ballots.length - 1];
    expect(ballot(redactImposter(s, 'p1'))).toEqual({ p2: '?' });
    expect(ballot(redactImposter(s, 'p2'))).toEqual({ p2: 'p0' });
  });

  test('the player with the most votes is out; an imposter who escapes scores 2', () => {
    let s = toVote(createImposter(seats(5), 17));
    const [x, y] = crewOf(s);
    s = voteFor(s, x, y);
    expect(s.phase).toBe('reveal');
    expect(s.round.votedOut).toBe(x);
    expect(s.round.outcome).toBe('escaped');
    expect(s.players.find((p) => p.id === s.round.imposter)!.score).toBe(2);
    expect(s.players.filter((p) => p.id !== s.round.imposter).every((p) => p.score === 0)).toBe(true);
  });

  test('a tie goes to a runoff between the tied players; a second tie means nobody is out', () => {
    let s = toVote(createImposter(seats(4), 19));
    const [a, b, c, d] = ids(s);
    s = play(s, { type: 'VOTE', target: b }, a);
    s = play(s, { type: 'VOTE', target: a }, b);
    s = play(s, { type: 'VOTE', target: a }, c);
    s = play(s, { type: 'VOTE', target: b }, d);
    expect(s.phase).toBe('vote');
    expect(s.round.runoff).toBe(true);
    expect([...s.round.candidates].sort()).toEqual([a, b].sort());
    expect(() => play(s, { type: 'VOTE', target: d }, c)).toThrow(IllegalMove);
    s = play(s, { type: 'VOTE', target: b }, a);
    s = play(s, { type: 'VOTE', target: a }, b);
    s = play(s, { type: 'VOTE', target: a }, c);
    s = play(s, { type: 'VOTE', target: b }, d);
    expect(s.phase).toBe('reveal');
    expect(s.round.votedOut).toBeNull();
    expect(s.round.outcome).toBe('escaped');
  });

  test('a vote not cast in time counts for nobody', () => {
    let s = toVote(createImposter(seats(4), 23));
    const first = actor(s);
    s = play(s, imposterKit.timeout(s), first);
    expect(s.round.ballots[0][first]).toBeNull();
  });
});

describe('the outcome', () => {
  test('Classic: a caught imposter names the word; a right guess scores them 1', () => {
    let s = toVote(createImposter(seats(4), 29, { mode: 'classic' }));
    const imp = s.round.imposter;
    s = voteFor(s, imp, crewOf(s)[0]);
    expect(s.phase).toBe('guess');
    expect(actor(s)).toBe(imp);
    expect(redactImposter(s, crewOf(s)[0]).round.imposter).toBe(imp);
    expect(() => play(s, { type: 'GUESS', word: 'Nonsense' }, imp)).toThrow(IllegalMove);
    const right = play(s, { type: 'GUESS', word: s.round.word }, imp);
    expect(right.round.outcome).toBe('guessed');
    expect(right.players.find((p) => p.id === imp)!.score).toBe(1);
    expect(right.players.filter((p) => p.id !== imp).every((p) => p.score === 0)).toBe(true);
  });

  test('Classic: a wrong guess scores everyone else 1', () => {
    let s = toVote(createImposter(seats(4), 29, { mode: 'classic' }));
    const imp = s.round.imposter;
    s = voteFor(s, imp, crewOf(s)[0]);
    const wrong = wordsIn(categoryById(s.round.category)).find((w) => w !== s.round.word)!;
    s = play(s, { type: 'GUESS', word: wrong }, imp);
    expect(s.round.outcome).toBe('caught');
    expect(s.players.find((p) => p.id === imp)!.score).toBe(0);
    expect(s.players.filter((p) => p.id !== imp).every((p) => p.score === 1)).toBe(true);
  });

  test('Decoy: a caught imposter has no guess, and everyone else scores 1', () => {
    let s = toVote(createImposter(seats(4), 31, { mode: 'decoy' }));
    const imp = s.round.imposter;
    s = voteFor(s, imp, crewOf(s)[0]);
    expect(s.phase).toBe('reveal');
    expect(s.round.outcome).toBe('caught');
    expect(s.players.filter((p) => p.id !== imp).every((p) => p.score === 1)).toBe(true);
  });

  test('the reveal shows everyone the word, the decoy and the imposter', () => {
    let s = toVote(createImposter(seats(4), 31, { mode: 'decoy' }));
    s = voteFor(s, crewOf(s)[0], crewOf(s)[1]);
    const view = redactImposter(s, crewOf(s)[2] ?? s.round.imposter);
    expect(view.round.word).toBe(s.round.word);
    expect(view.round.decoy).toBe(s.round.decoy);
    expect(view.round.imposter).toBe(s.round.imposter);
  });
});

describe('rounds and the end', () => {
  test('each round brings a new word, and nobody is the imposter twice until everyone has been once', () => {
    let s = createImposter(seats(5, 5), 41, { rounds: 'each' });
    const imposters: string[] = [];
    const words: string[] = [];
    for (let i = 0; i < 40 && !s.over; i++) {
      const before = s.round.number;
      imposters.push(s.round.imposter);
      words.push(s.round.word);
      while (!s.over && s.round.number === before) {
        const auto = imposterKit.auto!(s);
        s = auto ? play(s, auto.action, DEALER_ID) : play(s, imposterKit.bot(s), actor(s));
      }
    }
    expect(s.over).toBe(true);
    expect(imposters).toHaveLength(5);
    expect(new Set(imposters).size).toBe(5);
    expect(new Set(words).size).toBe(5);
  });

  test('after the set number of rounds the top score wins, ties sharing the win', () => {
    const s = runBots(createImposter(seats(4, 4), 43, { rounds: 3 }));
    expect(s.over).toBe(true);
    expect(s.history).toHaveLength(3);
    const top = Math.max(...s.players.map((p) => p.score));
    expect([...s.winners].sort()).toEqual(s.players.filter((p) => p.score === top).map((p) => p.id).sort());
  });

  test('an imposter who leaves voids the round; fewer than three players ends the game', () => {
    let s = createImposter(seats(5), 47);
    const imp = s.round.imposter;
    s = imposterKit.forfeit(s, imp);
    expect(s.phase).toBe('reveal');
    expect(s.round.outcome).toBe('void');
    expect(s.players.every((p) => p.score === 0)).toBe(true);
    s = play(s, imposterKit.auto!(s)!.action, DEALER_ID);
    expect(s.round.imposter).not.toBe(imp);
    const live = s.players.filter((p) => !p.out).map((p) => p.id);
    s = imposterKit.forfeit(s, live[0]);
    s = imposterKit.forfeit(s, live[1]);
    expect(s.over).toBe(true);
  });

  test('a crew member who leaves mid-clue is skipped', () => {
    let s = createImposter(seats(5), 53);
    const next = s.round.order[1];
    if (next === s.round.imposter) return;
    s = imposterKit.forfeit(s, next);
    s = play(s, { type: 'CLUE', text: 'hello' }, actor(s));
    expect(actor(s)).toBe(s.round.order[2]);
  });

  test('a rematch deals a new game for the same seats and options', () => {
    const s = runBots(createImposter(seats(4, 4), 59, { rounds: 3, mode: 'decoy' }));
    const again = play(s, { type: 'REMATCH' }, 'p0');
    expect(again.over).toBe(false);
    expect(again.mode).toBe('decoy');
    expect(again.totalRounds).toBe(3);
    expect(again.players.every((p) => p.score === 0)).toBe(true);
  });

  test('bots play whole games of both modes to the end with legal moves only', () => {
    for (const mode of ['classic', 'decoy'] as const) {
      for (let seed = 1; seed <= 12; seed++) {
        const n = 3 + (seed % 8);
        const s = runBots(createImposter(seats(n, n), seed, { mode, rounds: 3, clues: (1 + (seed % 3)) as 1 | 2 | 3 }));
        expect(s.over, `${mode} seed ${seed}`).toBe(true);
      }
    }
  });
});

test('every word list entry is usable: unique words, twelve different clues each, none holding its word', () => {
  const all = CATEGORIES.flatMap((c) => wordsIn(c));
  expect(new Set(all).size).toBe(all.length);
  for (const c of CATEGORIES) {
    expect(c.pairs).toHaveLength(5);
    for (const w of c.pairs.flat()) {
      expect(w.clues, w.word).toHaveLength(12);
      expect(new Set(w.clues).size, w.word).toBe(12);
      const s = createImposter(seats(3), 1);
      const crew = { ...s, round: { ...s.round, word: w.word, imposter: 'p2' } };
      for (const clue of w.clues) expect(clueError(crew, 'p0', clue), `${w.word}: ${clue}`).toBeNull();
    }
  }
});
