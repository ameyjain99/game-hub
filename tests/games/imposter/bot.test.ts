import { expect, test } from 'vitest';
import { DEALER_ID } from '../../../src/games/kit/engine';
import { createImposter, imposterKit, type ImposterState } from '../../../src/games/imposter/engine';
import { categoryById, entryFor } from '../../../src/games/imposter/words';

const bots = (n: number, difficulty: string) => Array.from({ length: n }, (_, i) => ({ name: `Bot ${i}`, isAI: true, difficulty }));

/** A seeded RNG so the bots' choices repeat. */
function rng(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** A round with the given clues already on the table. */
function withClues(s: ImposterState, clues: [string, string][]): ImposterState {
  return { ...s, round: { ...s.round, clues: clues.map(([player, text]) => ({ player, text })), turn: clues.length } };
}

test('a crew bot clues from its own word, or now and then from the category as a whole', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const s = createImposter(bots(5, 'normal'), seed);
    const me = imposterKit.actor(s)!;
    if (me === s.round.imposter) continue;
    const a = imposterKit.bot(s, rng(seed));
    expect(a.type).toBe('CLUE');
    const cat = categoryById(s.round.category);
    expect([...entryFor(cat, s.round.word)!.clues, ...cat.general]).toContain((a as { text: string }).text);
  }
});

test('a hard Classic imposter clues toward the word the others are hinting at', () => {
  let s = createImposter(bots(4, 'hard'), 5, { mode: 'classic' });
  const crew = s.round.order.filter((id) => id !== s.round.imposter);
  const hints = entryFor(categoryById(s.round.category), s.round.word)!.clues;
  // Every crew member has clued; the imposter is last in the order.
  s = withClues({ ...s, round: { ...s.round, order: [...crew, s.round.imposter] } }, crew.map((id, i) => [id, hints[i]]));
  const a = imposterKit.bot(s, rng(1));
  expect(a.type).toBe('CLUE');
  expect(hints).toContain((a as { text: string }).text);
});

test('hard bots vote for the player whose clues fit a different word', () => {
  let s = createImposter(bots(4, 'hard'), 9, { mode: 'decoy' });
  const cat = categoryById(s.round.category);
  const real = entryFor(cat, s.round.word)!.clues.filter((c) => !entryFor(cat, s.round.decoy)!.clues.includes(c));
  const fake = entryFor(cat, s.round.decoy)!.clues.filter((c) => !entryFor(cat, s.round.word)!.clues.includes(c));
  const clues: [string, string][] = s.players.map((p, i) => [p.id, p.id === s.round.imposter ? fake[0] : real[i]]);
  s = withClues(s, clues);
  s = { ...s, phase: 'vote', round: { ...s.round, ballots: [{}], candidates: s.players.map((p) => p.id) } };
  // Each crew bot, in turn, votes for the imposter.
  for (const p of s.players) {
    if (p.id === s.round.imposter) {
      s = imposterKit.apply(s, { type: 'VOTE', target: s.players.find((q) => q.id !== p.id)!.id }, p.id);
      continue;
    }
    const me = imposterKit.actor(s)!;
    const a = imposterKit.bot(s, rng(3));
    expect(a).toEqual({ type: 'VOTE', target: s.round.imposter });
    s = imposterKit.apply(s, a, me);
  }
});

test('a caught hard imposter names the word the clues point at', () => {
  let s = createImposter(bots(4, 'hard'), 13, { mode: 'classic' });
  const hints = entryFor(categoryById(s.round.category), s.round.word)!.clues;
  const crew = s.players.filter((p) => p.id !== s.round.imposter);
  s = withClues(s, crew.map((p, i) => [p.id, hints[i]]));
  s = { ...s, phase: 'guess', round: { ...s.round, votedOut: s.round.imposter } };
  expect(imposterKit.bot(s, rng(2))).toEqual({ type: 'GUESS', word: s.round.word });
});

/** How often the imposter is voted out across bot games at a table of these levels
 *  (counting only rounds where the imposter is at `imposterLevel`, if given). */
function catchRate(levels: string[], mode: 'classic' | 'decoy', games: number, imposterLevel?: string): number {
  let caught = 0;
  let rounds = 0;
  for (let seed = 1; seed <= games; seed++) {
    const rand = rng(seed * 7);
    let s = createImposter(
      levels.map((difficulty, i) => ({ name: `Bot ${i}`, isAI: true, difficulty })),
      seed,
      { mode, rounds: 3 },
    );
    while (!s.over) {
      const auto = imposterKit.auto!(s);
      s = auto ? imposterKit.apply(s, auto.action, DEALER_ID) : imposterKit.apply(s, imposterKit.bot(s, rand), imposterKit.actor(s)!);
    }
    for (const h of s.history) {
      if (imposterLevel && s.players.find((p) => p.id === h.imposter)!.difficulty !== imposterLevel) continue;
      rounds++;
      if (h.votedOut === h.imposter) caught++;
    }
  }
  return caught / rounds;
}

test('a hard crew catches an easy imposter more often than an easy crew catches a hard one', () => {
  for (const mode of ['classic', 'decoy'] as const) {
    const strong = catchRate(['hard', 'hard', 'hard', 'hard', 'easy'], mode, 200, 'easy');
    const weak = catchRate(['easy', 'easy', 'easy', 'easy', 'hard'], mode, 200, 'hard');
    expect(strong, mode).toBeGreaterThan(weak + 0.2);
  }
});

test('at a table of normal bots neither side always wins', () => {
  for (const mode of ['classic', 'decoy'] as const) {
    const rate = catchRate(Array(5).fill('normal'), mode, 60);
    expect(rate, mode).toBeGreaterThan(0.2);
    expect(rate, mode).toBeLessThan(0.9);
  }
});
