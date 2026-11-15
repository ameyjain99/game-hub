/**
 * Imposter bots. A bot sees only what its seat sees (the redacted view). It
 * gives clues from its word's clue list; a Classic imposter bot works out the
 * likely word from the clues before it and clues toward that. In the vote,
 * every clue that fits the bot's word clears a player, and clues that fit a
 * neighbouring word, fit only the category, or never came count against them.
 * Lower levels add more noise to every choice.
 */
import { imposterActor, redactImposter, type ImposterAction, type ImposterState } from './engine';
import { categoryById, entryFor, norm, type Category } from './words';

type Level = 'easy' | 'normal' | 'hard';
const NOISE: Record<Level, number> = { easy: 6, normal: 1.5, hard: 0.3 };
/** How often a Decoy bot checks whether its word is the odd one out. */
const DOUBT: Record<Level, number> = { easy: 0.2, normal: 0.75, hard: 1 };

const pick = <T>(items: T[], rand: () => number): T => items[Math.floor(rand() * items.length)];

/** How well the clues others gave fit each word of the category. */
function fitByWord(v: ImposterState, me: string, cat: Category): Map<string, number> {
  const given = v.round.clues.filter((c) => c.player !== me && c.text).map((c) => norm(c.text!));
  const fit = new Map<string, number>();
  for (const w of cat.pairs.flat()) {
    const list = w.clues.map(norm);
    fit.set(w.word, given.reduce((t, c) => t + (c === norm(w.word) ? 3 : list.includes(c) ? 1 : 0), 0));
  }
  return fit;
}

/** The word with the best fit (null if no clue fits any word); `noise` blurs the ranking. */
function likeliest(fit: Map<string, number>, noise: number, rand: () => number): string | null {
  let best: string | null = null;
  let top = 0;
  for (const [word, n] of fit) {
    const value = n + rand() * noise;
    if (n > 0 && value > top) [best, top] = [word, value];
  }
  return best;
}

/** The word this bot believes the crew holds. A Classic imposter reads it off the
 *  clues; a Decoy bot whose word the table's clues don't fit may realise it holds
 *  the odd word out (hard always checks, normal mostly, easy now and then). */
function believed(v: ImposterState, me: string, cat: Category, level: Level, rand: () => number): string | null {
  const fit = fitByWord(v, me, cat);
  if (!v.round.yours) return likeliest(fit, NOISE[level] / 3, rand);
  const doubts = rand() < DOUBT[level];
  const other = likeliest(fit, 0, rand);
  if (doubts && other && other !== v.round.yours && fit.get(other)! >= (fit.get(v.round.yours) ?? 0) + 2) return other;
  return v.round.yours;
}

function giveClue(v: ImposterState, me: string, cat: Category, level: Level, rand: () => number): ImposterAction {
  const used = new Set(v.round.clues.filter((c) => c.text).map((c) => norm(c.text!)));
  const own = v.round.yours ? norm(v.round.yours) : null;
  const ok = (t: string) => {
    const n = norm(t);
    return !used.has(n) && (!own || (!n.includes(own) && !own.includes(n)));
  };
  const general = cat.general.filter(ok);
  const target = believed(v, me, cat, level, rand);
  let options: string[] = [];
  if (target && target === v.round.yours) {
    // Crew (or so it believes): a clue from its word. Clues another word shares
    // keep the word from the imposter; clues only this word has prove you know it.
    const list = entryFor(cat, target)?.clues.filter(ok) ?? [];
    const others = new Set(cat.pairs.flat().filter((w) => w.word !== target).flatMap((w) => w.clues));
    const shared = list.filter((c) => others.has(c));
    const subtle = level === 'hard' ? 0.6 : level === 'normal' ? 0.35 : 0;
    const vague = level === 'easy' ? 0 : 0.12;
    const r = rand();
    if (r < vague) options = general;
    else if (r < vague + subtle) options = shared;
    if (options.length === 0) options = list;
  } else {
    // An imposter (told, or worked out in Decoy): clue toward the likeliest word, or stay vague.
    const bold = level === 'hard' ? 0.85 : level === 'normal' ? 0.6 : 0.25;
    if (target && rand() < bold) options = entryFor(cat, target)?.clues.filter(ok) ?? [];
    if (options.length === 0) options = general;
    if (options.length === 0) options = cat.pairs.flat().flatMap((w) => w.clues).filter(ok);
  }
  if (options.length === 0) options = general;
  return options.length > 0 ? { type: 'CLUE', text: pick(options, rand) } : { type: 'PASS' };
}

/** How suspicious `id`'s clues look to a bot that believes the word is `word`. */
function suspicion(v: ImposterState, id: string, word: string | null, cat: Category): number {
  const mine = word ? (entryFor(cat, word)?.clues ?? []) : [];
  let total = 0;
  for (const c of v.round.clues) {
    if (c.player !== id) continue;
    if (c.text === null) {
      total += 2;
      continue;
    }
    const n = norm(c.text);
    if (word && (n === norm(word) || mine.some((m) => norm(m) === n))) total -= 2;
    else if (cat.pairs.flat().some((w) => w.word !== word && w.clues.some((m) => norm(m) === n))) total += 2;
    else if (cat.general.some((m) => norm(m) === n)) total += 1;
  }
  return total;
}

function vote(v: ImposterState, me: string, cat: Category, level: Level, rand: () => number): string | null {
  const word = believed(v, me, cat, level, rand);
  const choices = v.round.candidates.filter((id) => id !== me && v.players.some((p) => p.id === id && !p.out));
  let best: string | null = null;
  let top = -Infinity;
  for (const id of choices) {
    const value = suspicion(v, id, word, cat) + rand() * NOISE[level];
    if (value > top) [best, top] = [id, value];
  }
  return best;
}

/** How often a caught imposter misreads the clues: [chance, how many of the best fits it may land on]. */
const SLIP: Record<Level, [number, number]> = { easy: [0.5, 6], normal: [0.3, 3], hard: [0.15, 2] };

function guess(v: ImposterState, me: string, cat: Category, level: Level, rand: () => number): string {
  const fit = fitByWord(v, me, cat);
  const ranked = [...fit].map(([word, n]) => ({ word, value: n + rand() * 0.1 })).sort((a, b) => b.value - a.value);
  const [chance, spread] = SLIP[level];
  return rand() < chance ? ranked[Math.floor(rand() * spread)].word : ranked[0].word;
}

export function imposterBot(full: ImposterState, rand: () => number): ImposterAction {
  const me = imposterActor(full);
  if (!me) return { type: 'PASS' };
  const v = redactImposter(full, me);
  const level = (full.players.find((p) => p.id === me)?.difficulty ?? 'normal') as Level;
  const cat = categoryById(v.round.category);
  switch (v.phase) {
    case 'clues':
      return giveClue(v, me, cat, level in NOISE ? level : 'normal', rand);
    case 'vote':
      return { type: 'VOTE', target: vote(v, me, cat, level in NOISE ? level : 'normal', rand) };
    case 'guess':
      return { type: 'GUESS', word: guess(v, me, cat, level in NOISE ? level : 'normal', rand) };
    default:
      return { type: 'PASS' };
  }
}
