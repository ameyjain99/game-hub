/**
 * The US standard Monopoly board (40 spaces), with official price/rent values
 * taken from the Hasbro rulebook but under generic, non-trademarked place names.
 *
 * `rent` for a property is a 6-tier table: [base, 1 house, 2, 3, 4, hotel]. The
 * full-set ×2 bonus is applied by the selector, not baked into the table. For a
 * railroad `rent` is the 4-tier [1,2,3,4]-owned table; utilities use dice
 * multipliers (×4 / ×10) computed in the selector, not `rent`.
 */

import { MEGA_CARD_TARGETS, MEGA_UK, MEGA_US } from './mega';

export type SpaceKind =
  | 'go'
  | 'property'
  | 'railroad'
  | 'utility'
  | 'tax'
  | 'chance'
  | 'chest'
  | 'jail'
  | 'free-parking'
  | 'go-to-jail'
  // Squares only the Mega Edition has.
  | 'auction'
  | 'bus-ticket'
  | 'birthday';

export type ColorGroup =
  | 'brown'
  | 'lightblue'
  | 'pink'
  | 'orange'
  | 'red'
  | 'yellow'
  | 'green'
  | 'darkblue';

export interface Space {
  id: number;
  name: string;
  kind: SpaceKind;
  /** Colour group (property spaces only). */
  group?: ColorGroup;
  /** Purchase price (property / railroad / utility). */
  price?: number;
  /** Rent table - 6 tiers for properties, 4 for railroads. */
  rent?: number[];
  /** Cost per house/hotel (property spaces only). */
  houseCost?: number;
  /** Rent with a skyscraper (Mega Edition streets only). */
  skyscraper?: number;
  /** Fixed amount owed (tax spaces only). */
  taxAmount?: number;
}

export const BOARD: Space[] = [
  { id: 0, name: 'Go', kind: 'go' },
  { id: 1, name: 'Jakarta', kind: 'property', group: 'brown', price: 60, houseCost: 50, rent: [2, 10, 30, 90, 160, 250] },
  { id: 2, name: 'Community Chest', kind: 'chest' },
  { id: 3, name: 'Marrakesh', kind: 'property', group: 'brown', price: 60, houseCost: 50, rent: [4, 20, 60, 180, 320, 450] },
  { id: 4, name: 'Income Tax', kind: 'tax', taxAmount: 200 },
  { id: 5, name: 'North Station', kind: 'railroad', price: 200, rent: [25, 50, 100, 200] },
  { id: 6, name: 'Lisbon', kind: 'property', group: 'lightblue', price: 100, houseCost: 50, rent: [6, 30, 90, 270, 400, 550] },
  { id: 7, name: 'Chance', kind: 'chance' },
  { id: 8, name: 'Seville', kind: 'property', group: 'lightblue', price: 100, houseCost: 50, rent: [6, 30, 90, 270, 400, 550] },
  { id: 9, name: 'Porto', kind: 'property', group: 'lightblue', price: 120, houseCost: 50, rent: [8, 40, 100, 300, 450, 600] },
  { id: 10, name: 'Jail', kind: 'jail' },
  { id: 11, name: 'Dublin', kind: 'property', group: 'pink', price: 140, houseCost: 100, rent: [10, 50, 150, 450, 625, 750] },
  { id: 12, name: 'Power Company', kind: 'utility', price: 150 },
  { id: 13, name: 'Glasgow', kind: 'property', group: 'pink', price: 140, houseCost: 100, rent: [10, 50, 150, 450, 625, 750] },
  { id: 14, name: 'Edinburgh', kind: 'property', group: 'pink', price: 160, houseCost: 100, rent: [12, 60, 180, 500, 700, 900] },
  { id: 15, name: 'East Station', kind: 'railroad', price: 200, rent: [25, 50, 100, 200] },
  { id: 16, name: 'Oslo', kind: 'property', group: 'orange', price: 180, houseCost: 100, rent: [14, 70, 200, 550, 750, 950] },
  { id: 17, name: 'Community Chest', kind: 'chest' },
  { id: 18, name: 'Bergen', kind: 'property', group: 'orange', price: 180, houseCost: 100, rent: [14, 70, 200, 550, 750, 950] },
  { id: 19, name: 'Helsinki', kind: 'property', group: 'orange', price: 200, houseCost: 100, rent: [16, 80, 220, 600, 800, 1000] },
  { id: 20, name: 'Free Parking', kind: 'free-parking' },
  { id: 21, name: 'Vienna', kind: 'property', group: 'red', price: 220, houseCost: 150, rent: [18, 90, 250, 700, 875, 1050] },
  { id: 22, name: 'Chance', kind: 'chance' },
  { id: 23, name: 'Prague', kind: 'property', group: 'red', price: 220, houseCost: 150, rent: [18, 90, 250, 700, 875, 1050] },
  { id: 24, name: 'Budapest', kind: 'property', group: 'red', price: 240, houseCost: 150, rent: [20, 100, 300, 750, 925, 1100] },
  { id: 25, name: 'South Station', kind: 'railroad', price: 200, rent: [25, 50, 100, 200] },
  { id: 26, name: 'Athens', kind: 'property', group: 'yellow', price: 260, houseCost: 150, rent: [22, 110, 330, 800, 975, 1150] },
  { id: 27, name: 'Naples', kind: 'property', group: 'yellow', price: 260, houseCost: 150, rent: [22, 110, 330, 800, 975, 1150] },
  { id: 28, name: 'Water Company', kind: 'utility', price: 150 },
  { id: 29, name: 'Palermo', kind: 'property', group: 'yellow', price: 280, houseCost: 150, rent: [24, 120, 360, 850, 1025, 1200] },
  { id: 30, name: 'Go To Jail', kind: 'go-to-jail' },
  { id: 31, name: 'Montreal', kind: 'property', group: 'green', price: 300, houseCost: 200, rent: [26, 130, 390, 900, 1100, 1275] },
  { id: 32, name: 'Vancouver', kind: 'property', group: 'green', price: 300, houseCost: 200, rent: [26, 130, 390, 900, 1100, 1275] },
  { id: 33, name: 'Community Chest', kind: 'chest' },
  { id: 34, name: 'Toronto', kind: 'property', group: 'green', price: 320, houseCost: 200, rent: [28, 150, 450, 1000, 1200, 1400] },
  { id: 35, name: 'West Station', kind: 'railroad', price: 200, rent: [25, 50, 100, 200] },
  { id: 36, name: 'Chance', kind: 'chance' },
  { id: 37, name: 'Kyoto', kind: 'property', group: 'darkblue', price: 350, houseCost: 200, rent: [35, 175, 500, 1100, 1300, 1500] },
  { id: 38, name: 'Luxury Tax', kind: 'tax', taxAmount: 100 },
  { id: 39, name: 'Tokyo', kind: 'property', group: 'darkblue', price: 400, houseCost: 200, rent: [50, 200, 600, 1400, 1700, 2000] },
];

/**
 * The boards a game can be played on. The 40-square boards share their
 * squares, prices and rents; only the places, the money and a few square names
 * differ. The two Mega boards have 52 squares and their own rules (see mega.ts).
 * The published editions come first, then GameHub's own four. The Neo board
 * uses the base BOARD names (Jakarta, Marrakesh, ...) so it needs no PLACES entry.
 */
export type BoardId = 'world2008' | 'world2015' | 'us' | 'uk' | 'india' | 'europe' | 'megaUs' | 'megaUk' | 'classic' | 'neo' | 'world' | 'nations';
export type MegaBoardId = 'megaUs' | 'megaUk';

export const BOARDS: { id: BoardId; name: string; blurb: string }[] = [
  { id: 'world2008', name: 'World 2008', blurb: 'Here & Now: The World Edition, 22 cities voted by fans, played in millions' },
  { id: 'world2015', name: 'World 2015', blurb: 'Here & Now: World Edition of 2015, from Madrid to Lima' },
  { id: 'us', name: 'US', blurb: 'The standard Atlantic City board, Mediterranean Avenue to Boardwalk' },
  { id: 'uk', name: 'UK', blurb: 'The standard London board, Old Kent Road to Mayfair, in pounds' },
  { id: 'india', name: 'India', blurb: 'The India Edition, Guwahati to Mumbai, in rupees' },
  { id: 'europe', name: 'Europe 1991', blurb: 'The European Edition: streets of eight countries and four airports' },
  { id: 'megaUs', name: 'Mega US', blurb: 'The Mega Edition: 52 squares, a speed die, bus tickets, skyscrapers and train depots' },
  { id: 'megaUk', name: 'Mega UK', blurb: 'The Mega Edition on the London board, Old Kent Road to Knightsbridge' },
  { id: 'classic', name: 'Classic', blurb: 'Brazil to the USA, country by country' },
  { id: 'neo', name: 'Neo', blurb: 'From Jakarta to Tokyo, by way of Europe' },
  { id: 'world', name: 'World', blurb: 'Great cities, Nairobi to London and New York' },
  { id: 'nations', name: 'Nations', blurb: 'Every colour set is a country, with its flag and airports' },
];

/** Places of every non-Neo board, keyed by square id. Squares not listed keep
 *  their base names (Go, Chance, ...). The six published editions follow their
 *  printed boards; World 2015's stations, utilities and tax names are World 2008's. */
const PLACES: Record<Exclude<BoardId, 'neo' | MegaBoardId>, Record<number, string>> = {
  world2008: {
    1: 'Gdynia', 3: 'Taipei', 5: 'Monopoly Rail',
    6: 'Tokyo', 8: 'Barcelona', 9: 'Athens',
    11: 'Istanbul', 12: 'Solar Energy', 13: 'Kyiv',
    14: 'Toronto', 15: 'Monopoly Air', 16: 'Rome',
    18: 'Shanghai', 19: 'Vancouver', 21: 'Sydney',
    23: 'New York', 24: 'London', 25: 'Monopoly Cruise',
    26: 'Beijing', 27: 'Hong Kong', 28: 'Wind Energy',
    29: 'Jerusalem', 31: 'Paris', 32: 'Belgrade',
    34: 'Cape Town', 35: 'Monopoly Space', 37: 'Riga',
    38: 'Super Tax', 39: 'Montreal',
  },
  world2015: {
    1: 'Madrid', 3: 'Giethoorn', 5: 'Monopoly Rail',
    6: 'Taipei', 8: 'Cape Town', 9: 'Queenstown',
    11: 'Sydney', 12: 'Solar Energy', 13: 'Amsterdam',
    14: 'New York', 15: 'Monopoly Air', 16: 'Tokyo',
    18: 'Moscow', 19: 'London', 21: 'Belgrade',
    23: 'Athens', 24: 'Belfast', 25: 'Monopoly Cruise',
    26: 'Santiago', 27: 'Mexico City', 28: 'Wind Energy',
    29: 'Warsaw', 31: 'Istanbul', 32: 'Lisbon',
    34: 'Riga', 35: 'Monopoly Space', 37: 'Hong Kong',
    38: 'Super Tax', 39: 'Lima',
  },
  us: {
    1: 'Mediterranean Avenue', 3: 'Baltic Avenue', 5: 'Reading Railroad',
    6: 'Oriental Avenue', 8: 'Vermont Avenue', 9: 'Connecticut Avenue',
    11: 'St. Charles Place', 12: 'Electric Company', 13: 'States Avenue',
    14: 'Virginia Avenue', 15: 'Pennsylvania Railroad', 16: 'St. James Place',
    18: 'Tennessee Avenue', 19: 'New York Avenue', 21: 'Kentucky Avenue',
    23: 'Indiana Avenue', 24: 'Illinois Avenue', 25: 'B. & O. Railroad',
    26: 'Atlantic Avenue', 27: 'Ventnor Avenue', 28: 'Water Works',
    29: 'Marvin Gardens', 31: 'Pacific Avenue', 32: 'North Carolina Avenue',
    34: 'Pennsylvania Avenue', 35: 'Short Line', 37: 'Park Place',
    39: 'Boardwalk',
  },
  uk: {
    1: 'Old Kent Road', 3: 'Whitechapel Road', 5: 'King\'s Cross Station',
    6: 'The Angel, Islington', 8: 'Euston Road', 9: 'Pentonville Road',
    11: 'Pall Mall', 12: 'Electric Company', 13: 'Whitehall',
    14: 'Northumberland Avenue', 15: 'Marylebone Station', 16: 'Bow Street',
    18: 'Marlborough Street', 19: 'Vine Street', 21: 'Strand',
    23: 'Fleet Street', 24: 'Trafalgar Square', 25: 'Fenchurch Street Station',
    26: 'Leicester Square', 27: 'Coventry Street', 28: 'Water Works',
    29: 'Piccadilly', 31: 'Regent Street', 32: 'Oxford Street',
    34: 'Bond Street', 35: 'Liverpool Street Station', 37: 'Park Lane',
    38: 'Super Tax', 39: 'Mayfair',
  },
  india: {
    1: 'Guwahati', 3: 'Bhubaneshwar', 5: 'Chennai Central Railway Station',
    6: 'Panaji (Goa)', 8: 'Agra', 9: 'Vadodara',
    11: 'Ludhiana', 12: 'Electric Company', 13: 'Patna',
    14: 'Bhopal', 15: 'Howrah Railway Station', 16: 'Indore',
    18: 'Nagpur', 19: 'Kochi', 21: 'Lucknow',
    23: 'Chandigarh', 24: 'Jaipur', 25: 'New Delhi Railway Station',
    26: 'Pune', 27: 'Hyderabad', 28: 'Water Works',
    29: 'Ahmedabad', 31: 'Kolkata', 32: 'Chennai',
    34: 'Bengaluru', 35: 'Chhatrapati Shivaji Terminus', 37: 'Delhi',
    38: 'Super Tax', 39: 'Mumbai',
  },
  europe: {
    1: 'Strandvejen', 3: 'Slotsgade', 5: 'Luxembourg Airport',
    6: 'Avenue Louise', 8: 'Rue des Bouchers', 9: 'Grand-Place',
    11: 'Coolsingel', 12: 'Electric Company', 13: 'Lange Poten',
    14: 'Kalverstraat', 15: 'Portugal Airport', 16: 'Paseo de la Castellana',
    18: 'Gran Vía', 19: 'Las Ramblas', 21: 'Oxford Street',
    23: 'Piccadilly', 24: 'Park Lane', 25: 'Athens Airport',
    26: 'Via Veneto', 27: 'Via Condotti', 28: 'Water Works',
    29: 'Via Monte Napoleone', 31: 'Avenue Foch', 32: 'Avenue des Champs-Élysées',
    34: 'Rue de la Paix', 35: 'Dublin Airport', 37: 'Königsallee',
    38: 'Super Tax', 39: 'Kurfürstendamm',
  },
  // Classic: each colour set is one country (Brazil, Israel, Italy, Germany, China, France, UK, USA).
  classic: {
    1: 'Salvador',      3: 'Rio de Janeiro',
    5: 'GRU Airport',
    6: 'Haifa',         8: 'Tel Aviv',    9: 'Jerusalem',
    11: 'Naples',       13: 'Venice',     14: 'Rome',
    15: 'FCO Airport',
    16: 'Hamburg',      18: 'Munich',     19: 'Berlin',
    21: 'Chengdu',      23: 'Shanghai',   24: 'Beijing',
    25: 'PEK Airport',
    26: 'Nice',         27: 'Lyon',       29: 'Paris',
    31: 'Edinburgh',    32: 'Manchester', 34: 'London',
    35: 'LHR Airport',
    37: 'Chicago',      39: 'New York',
  },
  world: {
    1: 'Nairobi', 3: 'Lima',
    5: 'Grand Central',
    6: 'Cairo', 8: 'Istanbul', 9: 'Bangkok',
    11: 'Mexico City', 13: 'Buenos Aires', 14: 'Rio de Janeiro',
    15: 'St Pancras',
    16: 'Mumbai', 18: 'Beijing', 19: 'Seoul',
    21: 'Berlin', 23: 'Rome', 24: 'Madrid',
    25: 'Gare du Nord',
    26: 'Sydney', 27: 'Singapore', 29: 'Dubai',
    31: 'Shanghai', 32: 'Hong Kong', 34: 'Paris',
    35: 'Tokyo Station',
    37: 'London', 39: 'New York',
  },
  nations: {
    1: 'Luxor', 3: 'Cairo',
    5: 'DEL Airport',
    6: 'Jaipur', 8: 'Delhi', 9: 'Mumbai',
    11: 'Seville', 13: 'Barcelona', 14: 'Madrid',
    15: 'HND Airport',
    16: 'Osaka', 18: 'Kyoto', 19: 'Tokyo',
    21: 'Perth', 23: 'Melbourne', 24: 'Sydney',
    25: 'CDG Airport',
    26: 'Nice', 27: 'Lyon', 29: 'Paris',
    31: 'Edinburgh', 32: 'Manchester', 34: 'London',
    35: 'JFK Airport',
    37: 'Chicago', 39: 'New York',
  },
};

/** Nations board: one country per colour set. */
const NATION_FLAGS: Record<ColorGroup, string> = {
  brown:     '\u{1F1EA}\u{1F1EC}', // Egypt
  lightblue: '\u{1F1EE}\u{1F1F3}', // India
  pink:      '\u{1F1EA}\u{1F1F8}', // Spain
  orange:    '\u{1F1EF}\u{1F1F5}', // Japan
  red:       '\u{1F1E6}\u{1F1FA}', // Australia
  yellow:    '\u{1F1EB}\u{1F1F7}', // France
  green:     '\u{1F1EC}\u{1F1E7}', // UK
  darkblue:  '\u{1F1FA}\u{1F1F8}', // USA
};

/** Classic board: one country per colour set. */
const CLASSIC_FLAGS: Record<ColorGroup, string> = {
  brown:     '\u{1F1E7}\u{1F1F7}', // Brazil
  lightblue: '\u{1F1EE}\u{1F1F1}', // Israel
  pink:      '\u{1F1EE}\u{1F1F9}', // Italy
  orange:    '\u{1F1E9}\u{1F1EA}', // Germany
  red:       '\u{1F1E8}\u{1F1F3}', // China
  yellow:    '\u{1F1EB}\u{1F1F7}', // France
  green:     '\u{1F1EC}\u{1F1E7}', // UK
  darkblue:  '\u{1F1FA}\u{1F1F8}', // USA
};

/** Europe 1991: the streets of each colour set are in one member state. */
const EUROPE_FLAGS: Record<ColorGroup, string> = {
  brown:     '\u{1F1E9}\u{1F1F0}', // Denmark
  lightblue: '\u{1F1E7}\u{1F1EA}', // Belgium
  pink:      '\u{1F1F3}\u{1F1F1}', // Netherlands
  orange:    '\u{1F1EA}\u{1F1F8}', // Spain
  red:       '\u{1F1EC}\u{1F1E7}', // Great Britain
  yellow:    '\u{1F1EE}\u{1F1F9}', // Italy
  green:     '\u{1F1EB}\u{1F1F7}', // France
  darkblue:  '\u{1F1E9}\u{1F1EA}', // Germany
};

const FLAGS: Partial<Record<BoardId, Record<ColorGroup, string>>> = { nations: NATION_FLAGS, classic: CLASSIC_FLAGS, europe: EUROPE_FLAGS };

export const isMega = (board: BoardId): board is MegaBoardId => board === 'megaUs' || board === 'megaUk';

/** The squares of a board: the standard 40, or a Mega board's 52. */
export function spacesOf(board: BoardId): Space[] {
  return board === 'megaUs' ? MEGA_US : board === 'megaUk' ? MEGA_UK : BOARD;
}

/** A board's shape: how many squares, how many to a side, and where Jail and Go To Jail are. */
export function layoutOf(board: BoardId): { size: number; side: number; jail: number; goToJail: number } {
  const size = spacesOf(board).length;
  const side = size / 4;
  return { size, side, jail: side, goToJail: side * 3 };
}

/** The flag a lot flies on a board whose colour sets are countries, else null. */
export function spaceFlag(id: number, board: BoardId = 'neo'): string | null {
  const group = spacesOf(board)[id].group;
  return (group && FLAGS[board]?.[group]) || null;
}

/** The board an option names, or Neo when it names none we know. */
export const boardOf = (id: unknown): BoardId => (BOARDS.some((b) => b.id === id) ? (id as BoardId) : 'neo');

/** What a square is called on a board. */
export function spaceName(id: number, board: BoardId = 'neo'): string {
  if (isMega(board)) return spacesOf(board)[id].name;
  return (board !== 'neo' && PLACES[board][id]) || BOARD[id].name;
}

/** The square with this name on a board, if any. */
export function spaceByName(name: string, board: BoardId = 'neo'): Space | undefined {
  return spacesOf(board).find((sp) => spaceName(sp.id, board) === name);
}

/** The square a card written for the standard board means on this one. */
export function cardSpace(standardId: number, board: BoardId): number {
  return isMega(board) ? (MEGA_CARD_TARGETS[board][standardId] ?? standardId) : standardId;
}

/** What a board calls its four transport squares, in a sentence ("the nearest Railroad"). */
export function stationWord(board: BoardId = 'neo'): string {
  if (board === 'us' || board === 'megaUs') return 'Railroad';
  if (board === 'europe') return 'Airport';
  if (board === 'world2008' || board === 'world2015') return 'Transport';
  return 'Station';
}

/** Monopoly money, for boards that mix countries. The app's font draws this character as an M with two bars (see tokens.css). */
export const MONOPOLY_MONEY = '\u20A5';

/** A board's currency symbol: rupees in India, pounds on the European boards, dollars on the US ones, Monopoly money where countries mix. */
export function boardCurrency(board: BoardId = 'neo'): string {
  if (board === 'india') return '\u20B9';
  if (board === 'uk' || board === 'europe' || board === 'megaUk') return '\u00A3';
  if (board === 'us' || board === 'megaUs') return '$';
  return MONOPOLY_MONEY;
}

const trim = (n: number) => String(Math.round(n * 100) / 100);

/**
 * An amount as a board prints it. World 2008 plays in millions: every standard
 * amount times 10,000, written 600K or 4M. The game's own sums stay the same.
 */
export function formatMoney(amount: number, board: BoardId = 'neo'): string {
  const sign = amount < 0 ? '-' : '';
  const n = Math.abs(amount);
  if (board === 'world2008') {
    const v = n * 10_000;
    return `${sign}${MONOPOLY_MONEY}${v >= 1_000_000 ? `${trim(v / 1_000_000)}M` : v === 0 ? '0' : `${trim(v / 1_000)}K`}`;
  }
  return `${sign}${boardCurrency(board)}${n.toLocaleString('en-US')}`;
}

/** Rewrite the dollar amounts in a line of text (a log line, a card) the way a board prints money. */
export function moneyText(text: string, board: BoardId = 'neo'): string {
  if (board !== 'world2008' && boardCurrency(board) === '$') return text;
  return text.replace(/\$(\d[\d,]*)/g, (_, digits: string) => formatMoney(Number(digits.replace(/,/g, '')), board));
}

const isOwnable = (s: Space) => s.kind === 'property' || s.kind === 'railroad' || s.kind === 'utility';

/** Standard-board space ids that can be owned (property, railroad, utility). */
export const OWNABLE_IDS: number[] = BOARD.filter(isOwnable).map((s) => s.id);

/** The space ids of a board that can be owned. */
export function ownableIds(board: BoardId): number[] {
  return isMega(board) ? spacesOf(board).filter(isOwnable).map((s) => s.id) : OWNABLE_IDS;
}

/** All property space ids in a colour group, on a board. */
export function groupIds(group: ColorGroup, board: BoardId): number[] {
  return spacesOf(board).filter((s) => s.kind === 'property' && s.group === group).map((s) => s.id);
}

