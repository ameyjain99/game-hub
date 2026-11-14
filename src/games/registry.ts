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
  id: string;
  title: string;
  tagline: string;
  /** Human-readable player / time range, e.g. "2–5 · 30–60 min". */
  players: string;
  status: 'live' | 'soon';
  category: CategoryId;
}

export const GAMES: GameEntry[] = [
  {
    id: 'ticket-to-ride',
    title: 'Ticket to Ride',
    tagline: 'Claim train routes across the map and connect your destination tickets.',
    players: '2–5 · 30–60 min',
    status: 'live',
    category: 'strategy',
  },
  {
    id: 'monopoly',
    title: 'Monopoly',
    tagline: 'Buy, trade and build until one player owns the board.',
    players: '2–6 · 60–120 min',
    status: 'live',
    category: 'race',
  },
  {
    id: 'cluedo',
    title: 'Cluedo',
    tagline: 'Question, deduce and name who did it, where, and with what.',
    players: '3–6 · 20–45 min',
    status: 'soon',
    category: 'party',
  },
  {
    id: 'catan',
    title: 'Catan',
    tagline: 'Trade resources, build roads and settlements, race to ten points.',
    players: '3–4 · 45–90 min',
    status: 'soon',
    category: 'strategy',
  },
  {
    id: 'last-card',
    title: 'Last Card',
    tagline: 'Match the colour or the symbol, play the wilds, and shed every card. Classic or Flip.',
    players: '2–10 · 15–30 min',
    status: 'live',
    category: 'cards',
  },
  {
    id: 'chess',
    title: 'Chess',
    tagline: 'Plan your moves, trade pieces and checkmate the king.',
    players: '2 · 10–60 min',
    status: 'live',
    category: 'strategy',
  },
  {
    id: 'wordgrid',
    title: 'Wordgrid',
    tagline: 'Lay letter tiles in crossword style and chase the premium squares.',
    players: '2–4 · 45–90 min',
    status: 'live',
    category: 'words',
  },
  {
    id: 'ludo',
    title: 'Ludo',
    tagline: 'Roll the die and race all four of your tokens home.',
    players: '2–4 · 20–40 min',
    status: 'live',
    category: 'race',
  },
  // {
  //   id: 'carrom',
  //   title: 'Carrom',
  //   tagline: 'Flick the striker and sink your coins in the corner pockets.',
  //   players: '2–4 · 20–30 min',
  //   status: 'soon',
  //   category: 'arcade',
  // },
  {
    id: 'poker',
    title: 'Poker',
    tagline: 'Read the table, bet with nerve and take the pot.',
    players: '2–9 · 30+ min',
    status: 'soon',
    category: 'cards',
  },
  {
    id: 'imposter',
    title: 'Imposter',
    tagline: 'One player is bluffing. Talk it out and vote them off.',
    players: '4–10 · 10–15 min',
    status: 'soon',
    category: 'party',
  },
  {
    id: 'sudoku',
    title: 'Sudoku',
    tagline: 'Fill the grid so every row, column and box holds 1 to 9.',
    players: '1 · 5–30 min',
    status: 'live',
    category: 'words',
  },
  {
    id: 'snakes-and-ladders',
    title: 'Snakes & Ladders',
    tagline: 'Climb the ladders, slide down the snakes, reach 100 first.',
    players: '2–6 · 10–20 min',
    status: 'live',
    category: 'race',
  },
  {
    id: 'blockyard',
    title: 'Blockyard',
    tagline: 'Break, place and build together in a blocky 3D world.',
    players: '1–8 · open-ended',
    status: 'live',
    category: 'arcade',
  },
  {
    id: 'checkers',
    title: 'Checkers',
    tagline: "Jump your opponent's pieces and crown your own.",
    players: '2 · 15–30 min',
    status: 'live',
    category: 'strategy',
  },
  {
    id: 'solitaire',
    title: 'Solitaire',
    tagline: 'Sort the deck into suits from ace to king, on your own.',
    players: '1 · 5–15 min',
    status: 'live',
    category: 'cards',
  },
  {
    id: 'lineup',
    title: 'Lineup',
    tagline: 'Play a card, place a chip and line up five in a row – in teams.',
    players: '2–12 · 20–30 min',
    status: 'live',
    category: 'strategy',
  },
  {
    id: 'tic-tac-toe',
    title: 'Tic-Tac-Toe',
    tagline: 'Three in a row wins. A quick one between longer games.',
    players: '2 · 1–2 min',
    status: 'live',
    category: 'words',
  },
  {
    id: 'minesweeper',
    title: 'Minesweeper',
    tagline: 'Open the field, flag the mines, clear every safe square. Four levels.',
    players: '1 · 1–10 min',
    status: 'live',
    category: 'words',
  },
  // {
  //   id: 'paper-io',
  //   title: 'Paper.io',
  //   tagline: 'Leave your trail, loop back and claim the most ground.',
  //   players: '2–10 · 3–5 min',
  //   status: 'soon',
  //   category: 'arcade',
  // },
  // {
  //   id: 'parcheesi',
  //   title: 'Parcheesi',
  //   tagline: 'Race your pawns around the board and capture on the way.',
  //   players: '2–4 · 30–60 min',
  //   status: 'soon',
  //   category: 'race',
  // },
  // {
  //   id: 'jackaroo',
  //   title: 'Jackaroo',
  //   tagline: 'Play cards to move your marbles round the track and home.',
  //   players: '4 · 30–45 min',
  //   status: 'soon',
  //   category: 'race',
  // },
];

/** The tile colour of a game: its category's colour. */
export function gameColor(game: GameEntry): string {
  return CATEGORIES.find((c) => c.id === game.category)?.color ?? '#3a3d44';
}

/** Games in `category` (or all, for null) whose title contains `query`, in catalog order. */
export function filterGames(games: GameEntry[], category: CategoryId | null, query: string): GameEntry[] {
  const q = query.trim().toLowerCase();
  return games.filter((g) => (!category || g.category === category) && (!q || g.title.toLowerCase().includes(q)));
}
