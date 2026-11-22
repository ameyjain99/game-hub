/**
 * Cities & Knights: Catan's Cities & Knights expansion. This module holds its
 * pieces and numbers; the rules that move them live in engine.ts.
 *
 *  - Cities on forest, pasture and mountains make a commodity (paper,
 *    cloth, coin) in place of their second resource.
 *  - Commodities buy improvements in three areas; level 3 brings an ability,
 *    the first to level 4 takes the area's Metropolis.
 *  - Knights (1 to 3 strength) defend against the barbarian ship, which sails
 *    on the event die and attacks on the seventh space.
 *  - Progress cards (drawn by area level on the event die's gates) replace development cards.
 */
import type { Resource, Terrain } from './board';

export type Commodity = 'paper' | 'cloth' | 'coin';
export const COMMODITIES: Commodity[] = ['paper', 'cloth', 'coin'];
export type Goods = Record<Commodity, number>;
export const emptyGoods = (): Goods => ({ paper: 0, cloth: 0, coin: 0 });
export const goodsSize = (g: Partial<Goods>) => COMMODITIES.reduce((t, c) => t + (g[c] ?? 0), 0);

/** Commodities in the bank. */
export const GOODS_BANK = 12;

/** The commodity a city on this terrain makes. */
export const CITY_GOOD: Partial<Record<Terrain, Commodity>> = { forest: 'paper', pasture: 'cloth', mountains: 'coin' };

export type Area = 'trade' | 'politics' | 'science';
export const AREAS: Area[] = ['trade', 'politics', 'science'];
/** What each area's improvements are paid in. */
export const AREA_GOOD: Record<Area, Commodity> = { trade: 'cloth', politics: 'coin', science: 'paper' };
export const AREA_NAME: Record<Area, string> = { trade: 'Trade', politics: 'Politics', science: 'Science' };
/** What level 3 of each area brings. */
export const AREA_ABILITY: Record<Area, string> = {
  trade: 'Trade commodities with the bank 2 for 1.',
  politics: 'Promote knights to strength 3.',
  science: 'On a roll that pays you nothing, take any one resource.',
};
export const MAX_LEVEL = 5;
/** The level that takes an area's Metropolis. */
export const METROPOLIS_LEVEL = 4;

/** The event die: three ship faces and one gate for each area. */
export type EventDie = 'ship' | Area;
export const EVENT_DIE_FACES: EventDie[] = ['ship', 'ship', 'ship', 'trade', 'politics', 'science'];
/** The barbarian ship attacks on this space. */
export const BARBARIAN_TRACK = 7;

export interface Knight {
  player: string;
  /** Strength: 1 (basic), 2 (strong), 3 (mighty). */
  level: 1 | 2 | 3;
  active: boolean;
  /** The turn it was activated (it can't act until a later turn). */
  since: number;
  /** The turn it was last promoted (a knight is promoted at most once a turn). */
  promoted?: number;
}
/** Knights of each strength a player owns. */
export const KNIGHTS_PER_LEVEL = 2;
export const MAX_WALLS = 3;

export type ProgressCard =
  | 'alchemist'
  | 'inventor'
  | 'irrigation'
  | 'mining'
  | 'engineer'
  | 'roadbuilding'
  | 'medicine'
  | 'smith'
  | 'crane'
  | 'printer'
  | 'warlord'
  | 'bishop'
  | 'constitution'
  | 'deserter'
  | 'diplomat'
  | 'intrigue'
  | 'saboteur'
  | 'wedding'
  | 'spy'
  | 'merchant'
  | 'commercial-harbor'
  | 'resource-monopoly'
  | 'trade-monopoly'
  | 'merchant-fleet'
  | 'master-merchant';

const deck = (counts: Partial<Record<ProgressCard, number>>): ProgressCard[] => (Object.keys(counts) as ProgressCard[]).flatMap((e) => Array<ProgressCard>(counts[e]!).fill(e));

/** 18 progress cards in each area's deck, as in the original's three progress decks. */
export const PROGRESS_DECKS: Record<Area, ProgressCard[]> = {
  science: deck({ alchemist: 2, inventor: 2, irrigation: 2, mining: 2, engineer: 1, roadbuilding: 2, medicine: 2, smith: 2, crane: 2, printer: 1 }),
  politics: deck({ warlord: 2, bishop: 2, constitution: 1, deserter: 2, diplomat: 2, intrigue: 2, saboteur: 2, wedding: 2, spy: 3 }),
  trade: deck({ merchant: 6, 'commercial-harbor': 2, 'resource-monopoly': 4, 'trade-monopoly': 2, 'merchant-fleet': 2, 'master-merchant': 2 }),
};

/** Number tokens the Inventor may not move. */
export const FIXED_TOKENS = [2, 6, 8, 12];
/** The merchant is worth a point to whoever placed it last. */
export const MERCHANT_POINTS = 1;

export const PROGRESS_AREA = Object.fromEntries((Object.keys(PROGRESS_DECKS) as Area[]).flatMap((g) => PROGRESS_DECKS[g].map((e) => [e, g]))) as Record<ProgressCard, Area>;

/** Progress cards worth a point, shown and kept the moment they're drawn. */
export const POINT_PROGRESS_CARDS: ProgressCard[] = ['printer', 'constitution'];
/** Progress cards you may hold at once (point progress cards aside). */
export const PROGRESS_LIMIT = 4;

export const PROGRESS_NAME: Record<ProgressCard, string> = {
  alchemist: 'Alchemist',
  inventor: 'Inventor',
  deserter: 'Deserter',
  diplomat: 'Diplomat',
  intrigue: 'Intrigue',
  merchant: 'Merchant',
  'commercial-harbor': 'Commercial Harbor',
  irrigation: 'Irrigation',
  mining: 'Mining',
  engineer: 'Engineer',
  roadbuilding: 'Road Building',
  medicine: 'Medicine',
  smith: 'Smith',
  crane: 'Crane',
  printer: 'Printer',
  warlord: 'Warlord',
  bishop: 'Bishop',
  constitution: 'Constitution',
  saboteur: 'Saboteur',
  wedding: 'Wedding',
  spy: 'Spy',
  'resource-monopoly': 'Resource Monopoly',
  'trade-monopoly': 'Trade Monopoly',
  'merchant-fleet': 'Merchant Fleet',
  'master-merchant': 'Master Merchant',
};

export const PROGRESS_TEXT: Record<ProgressCard, string> = {
  alchemist: 'Play it before you roll: you choose what both number dice show. The event die is rolled as usual and settled first.',
  inventor: 'Swap two number tokens anywhere on the island. Not a 2, 12, 6 or 8.',
  irrigation: 'Take 2 grain for each fields tile next to your settlements and cities.',
  mining: 'Take 2 ore for each mountains tile next to your settlements and cities.',
  engineer: 'Build a wall on one of your cities for free.',
  roadbuilding: 'Build two roads for free.',
  medicine: 'Your next city this turn costs 2 ore and 1 grain.',
  smith: 'Promote up to two of your knights for free this turn (each once a turn).',
  crane: 'Your next improvement this turn costs one commodity less.',
  printer: '1 point. Shown the moment it is drawn.',
  warlord: 'Activate all your knights for free.',
  bishop: 'Move the robber, and rob one card from each player with a building next to its new tile. Not before the first attack.',
  constitution: '1 point. Shown the moment it is drawn.',
  deserter: 'Choose a player: they remove one of their knights (their choice), and you may place one of yours of the same strength, free.',
  diplomat: 'Remove an open road (nothing of its owner at one end). If it is yours, you may build it again elsewhere, free.',
  intrigue: "Push off a rival's knight on a corner touching your road, without using a knight of your own.",
  saboteur: 'Every other player with as many points as you or more discards half their cards, rounded down, choosing which.',
  wedding: 'Every player with more points than you gives you 2 cards of their choice.',
  spy: "Look at another player's progress cards and take one.",
  merchant: "Put the merchant on a land tile next to your settlement or city. While it stays there you trade that tile's resource with the bank 2 for 1, and it is worth 1 point to you.",
  'commercial-harbor': 'This turn, offer each other player one resource from your hand. Each must give you a commodity of their choice for it; if they have none, you keep your card.',
  'resource-monopoly': 'Name a resource: every other player gives you up to 2 of it.',
  'trade-monopoly': 'Name a commodity: every other player gives you 1 of it.',
  'merchant-fleet': 'Name a resource or commodity: this turn you trade it with the bank 2 for 1.',
  'master-merchant': 'Look at the hand of a player with more points than you, and take any 2 cards.',
};

/** What a progress card asks for when you play it. */
export type ProgressCardNeed = 'player' | 'resource' | 'commodity' | 'card' | 'city' | 'dice' | 'tiles' | 'tile' | 'road' | 'knight';
export const PROGRESS_NEEDS: Partial<Record<ProgressCard, ProgressCardNeed>> = {
  spy: 'player',
  'master-merchant': 'player',
  deserter: 'player',
  'resource-monopoly': 'resource',
  'trade-monopoly': 'commodity',
  'merchant-fleet': 'card',
  engineer: 'city',
  alchemist: 'dice',
  inventor: 'tiles',
  merchant: 'tile',
  diplomat: 'road',
  intrigue: 'knight',
};

export type Card = Resource | Commodity;
export const CITIES_KNIGHTS_WIN_POINTS = 13;
