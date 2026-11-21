/**
 * The bots that fill empty seats. Each has a name no real player would type
 * (so it never clashes with a person at the table) and a temper that colours
 * the few words it says when something good or bad happens to it.
 */

export type Temper = 'grand' | 'sly' | 'sunny' | 'grumpy' | 'dramatic';

export const BOTS: readonly { name: string; temper: Temper }[] = [
  { name: 'Sir Rollsalot', temper: 'grand' },
  { name: 'Baron Bluff', temper: 'sly' },
  { name: 'Snake-Eyes Sue', temper: 'sly' },
  { name: "Cap'n Misdeal", temper: 'grumpy' },
  { name: 'Dame Doublesix', temper: 'grand' },
  { name: 'Professor Pawn', temper: 'grand' },
  { name: 'Checkmate Kate', temper: 'sly' },
  { name: 'Mme. Wildcard', temper: 'dramatic' },
  { name: 'Dr. Dicey', temper: 'sunny' },
  { name: 'Sheriff Shuffle', temper: 'grumpy' },
  { name: 'Lord Luckydraw', temper: 'grand' },
  { name: 'Miss Fortune', temper: 'dramatic' },
  { name: 'Old Man Gambit', temper: 'grumpy' },
  { name: 'Queenie Trumps', temper: 'grand' },
  { name: 'Ace McFace', temper: 'sunny' },
  { name: 'Pip Squeak', temper: 'sunny' },
  { name: 'Admiral All-In', temper: 'dramatic' },
  { name: 'Granny Gotcha', temper: 'sly' },
  { name: 'Uncle Upcard', temper: 'sunny' },
  { name: 'Major Meeple', temper: 'grand' },
  { name: 'Pawnelope', temper: 'sunny' },
  { name: 'Bishop Zigzag', temper: 'sly' },
  { name: 'Lady Ladders', temper: 'sunny' },
  { name: 'Hissy Fitz', temper: 'grumpy' },
  { name: 'Token Tony', temper: 'sunny' },
  { name: 'Bankroll Betty', temper: 'grand' },
  { name: 'Jack of Shades', temper: 'sly' },
  { name: 'Deuce Wilder', temper: 'dramatic' },
  { name: 'Chip Stackwell', temper: 'grand' },
  { name: 'Dot Domino', temper: 'sunny' },
  { name: 'Big Blind Bob', temper: 'grumpy' },
  { name: 'Auntie Ante', temper: 'sunny' },
  { name: 'Zugzwang Zoe', temper: 'sly' },
  { name: 'Mayor of Go', temper: 'grand' },
  { name: 'Sgt. Stalemate', temper: 'grumpy' },
  { name: 'Penny Ante', temper: 'sunny' },
  { name: 'Vowel Howell', temper: 'dramatic' },
  { name: 'Triple-Word Ted', temper: 'grand' },
  { name: 'Nana Nines', temper: 'sly' },
  { name: 'Colonel King-Me', temper: 'dramatic' },
  { name: 'Doc Doubles', temper: 'sunny' },
  { name: 'Tumbling Tess', temper: 'dramatic' },
  { name: 'Gus Gridlock', temper: 'grumpy' },
  { name: 'Wanda Wager', temper: 'sly' },
];

const LINES: Record<Temper, { good: string[]; bad: string[] }> = {
  grand: {
    good: ['As expected.', 'Splendid, simply splendid.', 'One does try.'],
    bad: ['How very irregular.', 'A temporary setback.', 'I meant to do that.'],
  },
  sly: {
    good: ['Just as I planned.', "Didn't see that coming, eh?", 'Too easy.'],
    bad: ["You'll pay for that.", 'Hm. Noted.', 'Lucky. Very lucky.'],
  },
  sunny: {
    good: ['Woohoo!', 'Yes! Did you see that?', 'What a day!'],
    bad: ['Oh no! Oh well.', 'Ha, good one!', 'Next time!'],
  },
  grumpy: {
    good: ['About time.', 'Finally.', 'Hmph. Fine.'],
    bad: ['Typical.', 'Of course. Of course!', "I'm not angry. I'm not."],
  },
  dramatic: {
    good: ['Behold!', 'The crowd goes wild!', 'Destiny!'],
    bad: ['Betrayal!', 'Noooo!', 'This is my villain origin.'],
  },
};

/** A name as the room compares names: no case, no spaces. */
export const nameKey = (name: string): string => name.toLowerCase().replace(/\s+/g, '');

const BOT_KEYS = new Map(BOTS.map((b) => [nameKey(b.name), b]));

/** Whether this is one of the bots' own names. */
export const isBotName = (name: string): boolean => BOT_KEYS.has(nameKey(name));

/**
 * `count` bot names nobody at the table holds yet, picked with `rand`.
 * `taken` are the names already seated (people and bots).
 */
export function pickBotNames(count: number, taken: readonly string[] = [], rand: () => number = Math.random): string[] {
  const used = new Set(taken.map(nameKey));
  const free = BOTS.map((b) => b.name).filter((n) => !used.has(nameKey(n)));
  const out: string[] = [];
  while (out.length < count && free.length > 0) out.push(free.splice(Math.floor(rand() * free.length), 1)[0]);
  // A table larger than the cast (it never is): fall back to numbered bots.
  for (let n = 1; out.length < count; n++) if (!used.has(nameKey(`Bot ${n}`))) out.push(`Bot ${n}`);
  return out;
}

/** What a bot says when something good or bad happens to it; null for a name that isn't a bot's. */
export function botLine(name: string, feel: 'good' | 'bad', rand: () => number = Math.random): string | null {
  const bot = BOT_KEYS.get(nameKey(name));
  if (!bot) return null;
  const lines = LINES[bot.temper][feel];
  return lines[Math.floor(rand() * lines.length)];
}
