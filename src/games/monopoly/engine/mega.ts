/**
 * Monopoly: The Mega Edition. A 52-square board (13 a side): one more street in
 * every colour set, a third utility (Gas Company), and three squares of its own
 * (Auction, Bus Ticket, Birthday Gift).
 *
 * Square order and prices follow the printed US (2006) and UK (2007) boards.
 * Rents, including the skyscraper rent of every street, are from the Mega
 * Edition properties reference on Wikibooks, checked for the US board against
 * each street's page on the Monopoly wiki. Where the two boards differ in a
 * slot (Arctic Avenue 80 / Elephant and Castle 60, and so on) each takes the
 * rents of its own price.
 */
import type { ColorGroup, Space, SpaceKind } from './board';

/** Rents by a street's standing in the game: [site, 1-4 houses, hotel], then with a skyscraper. */
const RENTS: Record<string, { rent: number[]; skyscraper: number }> = {
  r2: { rent: [2, 10, 30, 90, 160, 250], skyscraper: 750 },
  r4: { rent: [4, 20, 60, 180, 320, 450], skyscraper: 950 },
  r5: { rent: [5, 30, 80, 240, 360, 500], skyscraper: 950 },
  r6: { rent: [6, 30, 90, 270, 400, 550], skyscraper: 1050 },
  r8: { rent: [8, 40, 100, 300, 450, 600], skyscraper: 1100 },
  r10: { rent: [10, 50, 150, 450, 625, 750], skyscraper: 1250 },
  r12: { rent: [12, 60, 180, 500, 700, 900], skyscraper: 1400 },
  r14: { rent: [14, 70, 200, 550, 750, 950], skyscraper: 1450 },
  r16: { rent: [16, 80, 220, 600, 800, 1000], skyscraper: 1500 },
  r18: { rent: [18, 90, 250, 700, 875, 1050], skyscraper: 2050 },
  r20: { rent: [20, 100, 300, 750, 925, 1100], skyscraper: 2100 },
  r22: { rent: [22, 110, 330, 800, 975, 1150], skyscraper: 2150 },
  r24: { rent: [24, 120, 360, 850, 1025, 1200], skyscraper: 2200 },
  r26: { rent: [26, 130, 390, 900, 1100, 1275], skyscraper: 2275 },
  r28: { rent: [28, 150, 450, 1000, 1200, 1400], skyscraper: 2400 },
  r35: { rent: [35, 175, 500, 1100, 1300, 1500], skyscraper: 2500 },
  r50: { rent: [50, 200, 600, 1400, 1700, 2000], skyscraper: 3000 },
};

const HOUSE_COST: Record<ColorGroup, number> = { brown: 50, lightblue: 50, pink: 100, orange: 100, red: 150, yellow: 150, green: 200, darkblue: 200 };

/** A street as [name, price, rent key]; the other squares by a short code. */
type Row = [string, number, keyof typeof RENTS] | string;

/** The 52 squares in order. `X:Name` rows are: R railroad, U utility, T tax (`T:Name:amount`). */
function build(rows: Row[]): Space[] {
  const groups: ColorGroup[] = ['brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkblue'];
  // Which colour set each run of streets belongs to: the board goes through them in order.
  const sizes = [3, 4, 4, 4, 4, 4, 4, 3];
  let street = 0;
  const groupOf = (n: number) => {
    let seen = 0;
    for (let g = 0; g < sizes.length; g++) {
      seen += sizes[g];
      if (n < seen) return groups[g];
    }
    return 'darkblue';
  };
  const fixed: Record<string, { name: string; kind: SpaceKind }> = {
    GO: { name: 'Go', kind: 'go' },
    CC: { name: 'Community Chest', kind: 'chest' },
    CH: { name: 'Chance', kind: 'chance' },
    JAIL: { name: 'Jail', kind: 'jail' },
    FREE: { name: 'Free Parking', kind: 'free-parking' },
    GTJ: { name: 'Go To Jail', kind: 'go-to-jail' },
    AUCTION: { name: 'Auction', kind: 'auction' },
    BUS: { name: 'Bus Ticket', kind: 'bus-ticket' },
    GIFT: { name: 'Birthday Gift', kind: 'birthday' },
  };
  return rows.map((row, id): Space => {
    if (typeof row !== 'string') {
      const [name, price, key] = row;
      const group = groupOf(street++);
      return { id, name, kind: 'property', group, price, houseCost: HOUSE_COST[group], rent: RENTS[key].rent, skyscraper: RENTS[key].skyscraper };
    }
    if (fixed[row]) return { id, ...fixed[row] };
    const [code, name, amount] = row.split(':');
    if (code === 'R') return { id, name, kind: 'railroad', price: 200, rent: [25, 50, 100, 200] };
    if (code === 'U') return { id, name, kind: 'utility', price: 150 };
    return { id, name, kind: 'tax', taxAmount: Number(amount) };
  });
}

export const MEGA_US: Space[] = build([
  'GO', ['Mediterranean Avenue', 60, 'r2'], 'CC', ['Baltic Avenue', 60, 'r4'], ['Arctic Avenue', 80, 'r5'], 'T:Income Tax:200', 'R:Reading Railroad',
  ['Massachusetts Avenue', 100, 'r6'], ['Oriental Avenue', 100, 'r6'], 'CH', 'U:Gas Company', ['Vermont Avenue', 100, 'r6'], ['Connecticut Avenue', 120, 'r8'],
  'JAIL', 'AUCTION', ['Maryland Avenue', 140, 'r10'], ['St. Charles Place', 140, 'r10'], 'U:Electric Company', ['States Avenue', 140, 'r10'], ['Virginia Avenue', 160, 'r12'],
  'R:Pennsylvania Railroad', ['St. James Place', 180, 'r14'], 'CC', ['Tennessee Avenue', 180, 'r14'], ['New York Avenue', 200, 'r16'], ['New Jersey Avenue', 200, 'r16'],
  'FREE', ['Kentucky Avenue', 220, 'r18'], 'CH', ['Indiana Avenue', 220, 'r18'], ['Illinois Avenue', 240, 'r20'], ['Michigan Avenue', 240, 'r20'], 'BUS', 'R:B. & O. Railroad',
  ['Atlantic Avenue', 260, 'r22'], ['Ventnor Avenue', 260, 'r22'], 'U:Water Works', ['Marvin Gardens', 280, 'r24'], ['California Avenue', 280, 'r24'],
  'GTJ', ['Pacific Avenue', 300, 'r26'], ['South Carolina Avenue', 300, 'r26'], ['North Carolina Avenue', 300, 'r26'], 'CC', ['Pennsylvania Avenue', 320, 'r28'],
  'R:Short Line', 'CH', 'GIFT', ['Florida Avenue', 350, 'r35'], ['Park Place', 350, 'r35'], 'T:Luxury Tax:100', ['Boardwalk', 400, 'r50'],
]);

export const MEGA_UK: Space[] = build([
  'GO', ['Old Kent Road', 60, 'r2'], 'CC', ['The Whitechapel', 60, 'r4'], ['Elephant and Castle', 60, 'r4'], 'T:Income Tax:200', "R:King's Cross Station",
  ['The Angel Islington', 100, 'r6'], ['Euston Road', 100, 'r6'], 'CH', 'U:Gas Company', ['Pentonville', 120, 'r8'], ['Edgware Road', 120, 'r8'],
  'JAIL', 'AUCTION', ['Pall Mall', 140, 'r10'], ['Whitehall', 140, 'r10'], 'U:Electric Company', ['Northumberland Avenue', 160, 'r12'], ['Downing Street', 160, 'r12'],
  'R:Marylebone Station', ['Bow Street', 180, 'r14'], 'CC', ['Marlborough Street', 180, 'r14'], ['Vine Street', 200, 'r16'], ['High Holborn', 200, 'r16'],
  'FREE', ['Strand', 220, 'r18'], 'CH', ['Fleet Street', 220, 'r18'], ['Trafalgar Square', 240, 'r20'], ['Aldwych', 240, 'r20'], 'BUS', 'R:Fenchurch Street Station',
  ['Leicester Square', 260, 'r22'], ['Coventry Street', 260, 'r22'], 'U:Water Works', ['Piccadilly', 280, 'r24'], ['Shaftesbury Avenue', 280, 'r24'],
  'GTJ', ['Regent Street', 300, 'r26'], ['Oxford Street', 300, 'r26'], ['Bond Street', 320, 'r28'], 'CC', ['Savile Row', 320, 'r28'],
  'R:Liverpool Street Station', 'CH', 'GIFT', ['Park Lane', 350, 'r35'], ['Mayfair', 350, 'r35'], 'T:Bank Deposit:100', ['Knightsbridge', 400, 'r50'],
]);

/** Where a card written for the standard board sends you on a Mega board (Go, the first station, and three named streets). */
export const MEGA_CARD_TARGETS: Record<'megaUs' | 'megaUk', Record<number, number>> = {
  megaUs: { 0: 0, 5: 6, 11: 16, 24: 30, 39: 51 },
  megaUk: { 0: 0, 5: 6, 11: 15, 24: 30, 39: 49 },
};

/** Pieces and money that only the Mega Edition has. */
export const MEGA = {
  startingCash: 2500,
  skyscrapers: 8,
  depots: 4,
  depotCost: 100,
  busTickets: 16,
  /** Bus Tickets that make every other ticket held expire when they are drawn. */
  expiringTickets: 3,
  birthdayGift: 100,
} as const;
