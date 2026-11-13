/**
 * The US standard Monopoly board (40 spaces), with official price/rent values
 * taken from the Hasbro rulebook but under generic, non-trademarked place names.
 *
 * `rent` for a property is a 6-tier table: [base, 1 house, 2, 3, 4, hotel]. The
 * full-set ×2 bonus is applied by the selector, not baked into the table. For a
 * railroad `rent` is the 4-tier [1,2,3,4]-owned table; utilities use dice
 * multipliers (×4 / ×10) computed in the selector, not `rent`.
 */

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
  | 'go-to-jail';

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
  /** Rent table — 6 tiers for properties, 4 for railroads. */
  rent?: number[];
  /** Cost per house/hotel (property spaces only). */
  houseCost?: number;
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

/** Space ids that can be owned (property, railroad, utility). */
export const OWNABLE_IDS: number[] = BOARD.filter(
  (s) => s.kind === 'property' || s.kind === 'railroad' || s.kind === 'utility',
).map((s) => s.id);

/** All property space ids in a colour group. */
export function groupIds(group: ColorGroup): number[] {
  return BOARD.filter((s) => s.kind === 'property' && s.group === group).map((s) => s.id);
}

export const JAIL_ID = 10;
export const GO_TO_JAIL_ID = 30;
export const GO_SALARY = 200;
