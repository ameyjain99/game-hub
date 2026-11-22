/**
 * The catalog of games the hub offers. Each entry is metadata only; the actual
 * engine/UI for a game is wired where it's launched. `status: 'soon'` shows a
 * card that isn't yet playable. A game's colour comes from its category, and
 * its icon lives in GameIcon. The hub shows games in the order listed here.
 */
export type CategoryId = 'strategy' | 'race' | 'cards' | 'words' | 'party' | 'arcade';

export interface Category {
  id: CategoryId;
  label: string;
  /** Tile colour for every game in the category. */
  color: string;
}

export const CATEGORIES: Category[] = [
  { id: 'strategy', label: 'Strategy', color: '#D93A3F' },
  { id: 'race', label: 'Roll & race', color: '#2F9E62' },
  { id: 'cards', label: 'Cards', color: '#3558D4' },
  { id: 'words', label: 'Words & puzzles', color: '#E8701A' },
  { id: 'party', label: 'Party & deduction', color: '#7C4DBA' },
  { id: 'arcade', label: 'Skill & arcade', color: '#14868C' },
];

export interface GameEntry {
  /** The game's id: its URL path, room tag and server adapter key. */
  id: string;
  title: string;
  tagline: string;
  /** Human-readable player / time range, e.g. "2-5 · 30-60 min". */
  players: string;
  status: 'live' | 'soon';
  category: CategoryId;
}

export const GAMES: GameEntry[] = [
  {
    id: 'ticket-to-ride',
    title: 'Ticket to Ride',
    tagline: 'Claim train routes across the map and connect your destination tickets.',
    players: '2-5 · 30-60 min',
    status: 'live',
    category: 'strategy',
  },
  {
    id: 'monopoly',
    title: 'Monopoly',
    tagline: 'Buy, trade and build until one player owns the board.',
    players: '2-6 · 60-120 min',
    status: 'live',
    category: 'race',
  },
  {
    id: 'cluedo',
    title: 'Cluedo',
    tagline: 'Question, deduce and name who did it, where, and with what.',
    players: '3-6 · 20-45 min',
    status: 'live',
    category: 'party',
  },
  {
    id: 'catan',
    title: 'Catan',
    tagline: 'Settle a hex island, trade lumber for ore, and build to ten points. With Seafarers and Cities & Knights.',
    players: '3-6 · 45-120 min',
    status: 'live',
    category: 'strategy',
  },
  {
    id: 'uno',
    title: 'Uno',
    tagline: 'Match the colour or the symbol, play the wilds, and shed every card. Classic, Flip or No Mercy.',
    players: '2-10 · 15-30 min',
    status: 'live',
    category: 'cards',
  },
  {
    id: 'exploding-kittens',
    title: 'Exploding Kittens',
    tagline: 'Draw cards until someone draws a Kitten. Attack, Skip, Nope and Defuse your way to being the last one standing.',
    players: '2-5 · 15 min',
    status: 'live',
    category: 'cards',
  },
  {
    id: 'monopoly-deal',
    title: 'Monopoly Deal',
    tagline: 'The Monopoly card game: bank money, charge rent, steal sets, and be first to three full property sets.',
    players: '2-5 · 15 min',
    status: 'live',
    category: 'cards',
  },
  {
    id: 'chess',
    title: 'Chess',
    tagline: 'Plan your moves, trade pieces and checkmate the king.',
    players: '2 · 10-60 min',
    status: 'live',
    category: 'strategy',
  },
  {
    id: 'scrabble',
    title: 'Scrabble',
    tagline: 'Lay letter tiles in crossword style and chase the premium squares.',
    players: '2-4 · 45-90 min',
    status: 'live',
    category: 'words',
  },
  {
    id: 'ludo',
    title: 'Ludo',
    tagline: 'Roll the die and race all four of your tokens home. A cross board for up to four, a star board for up to eight.',
    players: '2-8 · 20-60 min',
    status: 'live',
    category: 'race',
  },
  // {
  //   id: 'carrom',
  //   title: 'Carrom',
  //   tagline: 'Flick the striker and sink your coins in the corner pockets.',
  //   players: '2-4 · 20-30 min',
  //   status: 'soon',
  //   category: 'arcade',
  // },
  {
    id: 'imposter',
    title: 'Imposter',
    tagline: 'One player is bluffing. Give one-word clues, talk it out and vote them off.',
    players: '3-10 · 10-20 min',
    status: 'live',
    category: 'party',
  },
  {
    id: 'sudoku',
    title: 'Sudoku',
    tagline: 'Fill the grid so every row, column and box holds 1 to 9.',
    players: '1 · 5-30 min',
    status: 'live',
    category: 'words',
  },
  {
    id: 'snakes-and-ladders',
    title: 'Snakes & Ladders',
    tagline: 'Climb the ladders, slide down the snakes, reach 100 first.',
    players: '2-6 · 10-20 min',
    status: 'live',
    category: 'race',
  },
  {
    id: 'poker',
    title: 'Poker',
    tagline: "Hold'em, Omaha, Short Deck, Stud and Razz. Read the table and take the pot.",
    players: '2-9 · 20-60 min',
    status: 'live',
    category: 'cards',
  },
  {
    id: 'minecraft',
    title: 'Minecraft',
    tagline: 'Break, place and build together in a blocky 3D world.',
    players: '1-8 · open-ended',
    status: 'live',
    category: 'arcade',
  },
  {
    id: 'checkers',
    title: 'Checkers',
    tagline: "Jump your opponent's pieces and crown your own.",
    players: '2 · 15-30 min',
    status: 'live',
    category: 'strategy',
  },
  {
    id: 'solitaire',
    title: 'Solitaire',
    tagline: 'Sort the deck into suits from ace to king, on your own.',
    players: '1 · 5-15 min',
    status: 'live',
    category: 'cards',
  },
  {
    id: 'tic-tac-toe',
    title: 'Tic-Tac-Toe',
    tagline: 'Three in a row wins. A quick one between longer games.',
    players: '2 · 1-2 min',
    status: 'live',
    category: 'words',
  },
  {
    id: 'sequence',
    title: 'Sequence',
    tagline: 'Play a card, place a chip and line up five in a row - in teams.',
    players: '2-12 · 20-30 min',
    status: 'live',
    category: 'strategy',
  },
  {
    id: 'minesweeper',
    title: 'Minesweeper',
    tagline: 'Open the field, flag the mines, clear every safe square. Four levels.',
    players: '1 · 1-10 min',
    status: 'live',
    category: 'words',
  },
  // {
  //   id: 'paper-io',
  //   title: 'Paper.io',
  //   tagline: 'Leave your trail, loop back and claim the most ground.',
  //   players: '2-10 · 3-5 min',
  //   status: 'soon',
  //   category: 'arcade',
  // },
  // {
  //   id: 'parcheesi',
  //   title: 'Parcheesi',
  //   tagline: 'Race your pawns around the board and capture on the way.',
  //   players: '2-4 · 30-60 min',
  //   status: 'soon',
  //   category: 'race',
  // },
  // {
  //   id: 'jackaroo',
  //   title: 'Jackaroo',
  //   tagline: 'Play cards to move your marbles round the track and home.',
  //   players: '4 · 30-45 min',
  //   status: 'soon',
  //   category: 'race',
  // },
];

/** A game's URL path, e.g. `/uno`. */
export const gamePath = (id: string): string => `/${id}`;

/** The tile colour of a game: its category's colour. */
export function gameColor(game: GameEntry): string {
  return CATEGORIES.find((c) => c.id === game.category)?.color ?? '#3a3d44';
}

/** Games in `category` (or all, for null) whose title contains `query`, in catalog order. */
export function filterGames(games: GameEntry[], category: CategoryId | null, query: string): GameEntry[] {
  const q = query.trim().toLowerCase();
  return games.filter((g) => (!category || g.category === category) && (!q || g.title.toLowerCase().includes(q)));
}
