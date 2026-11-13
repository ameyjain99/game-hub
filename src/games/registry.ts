/**
 * The catalog of games the hub offers. Each entry is metadata only; the actual
 * engine/UI for a game is wired where it's launched. `status: 'soon'` shows a
 * card that isn't yet playable. `accent` + the matching icon in GameIcon come
 * from the GameHub design.
 */
export interface GameEntry {
  id: string;
  title: string;
  tagline: string;
  /** Human-readable player / time range, e.g. "2–5 · 30–60 min". */
  players: string;
  status: 'live' | 'soon';
  /** Brand accent colour for this game's card + icon. */
  accent: string;
}

export const GAMES: GameEntry[] = [
  {
    id: 'ticket-to-ride',
    title: 'Ticket to Ride',
    tagline: 'Claim train routes across the map and connect your destination tickets.',
    players: '2–5 · 30–60 min',
    status: 'live',
    accent: '#D93A3F',
  },
  {
    id: 'monopoly',
    title: 'Monopoly',
    tagline: 'Buy, trade and build until one player owns the board.',
    players: '2–6 · 60–120 min',
    status: 'live',
    accent: '#2F9E62',
  },
  {
    id: 'cluedo',
    title: 'Cluedo',
    tagline: 'Question, deduce and name who did it, where, and with what.',
    players: '3–6 · 20–45 min',
    status: 'live',
    accent: '#7C4DBA',
  },
  {
    id: 'catan',
    title: 'Catan',
    tagline: 'Trade resources, build roads and settlements, race to ten points.',
    players: '3–4 · 45–90 min',
    status: 'soon',
    accent: '#E8701A',
  },
];
