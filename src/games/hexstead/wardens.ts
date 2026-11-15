/**
 * Wardens: Hexstead's knights-and-towns expansion. This module holds its
 * pieces and numbers; the rules that move them live in engine.ts.
 *
 *  - Towns on forest, pasture and mountains make a commodity (parchment,
 *    linen, silver) in place of their second resource.
 *  - Commodities buy improvements in three guilds; level 3 brings an ability,
 *    the first to level 4 takes the guild's Capital.
 *  - Wardens (1 to 3 strength) defend against the marauder fleet, which sails
 *    on the omen die and lands on the seventh space.
 *  - Edicts (drawn by guild level on the omen die's gates) replace charters.
 */
import type { Resource, Terrain } from './board';

export type Commodity = 'parchment' | 'linen' | 'silver';
export const COMMODITIES: Commodity[] = ['parchment', 'linen', 'silver'];
export type Goods = Record<Commodity, number>;
export const emptyGoods = (): Goods => ({ parchment: 0, linen: 0, silver: 0 });
export const goodsSize = (g: Partial<Goods>) => COMMODITIES.reduce((t, c) => t + (g[c] ?? 0), 0);

/** Commodities in the bank. */
export const GOODS_BANK = 12;

/** The commodity a town on this terrain makes. */
export const TOWN_GOOD: Partial<Record<Terrain, Commodity>> = { forest: 'parchment', pasture: 'linen', mountains: 'silver' };

export type Guild = 'trade' | 'council' | 'academy';
export const GUILDS: Guild[] = ['trade', 'council', 'academy'];
/** What each guild's improvements are paid in. */
export const GUILD_GOOD: Record<Guild, Commodity> = { trade: 'linen', council: 'silver', academy: 'parchment' };
export const GUILD_NAME: Record<Guild, string> = { trade: 'Trade', council: 'Council', academy: 'Academy' };
/** What level 3 of each guild brings. */
export const GUILD_ABILITY: Record<Guild, string> = {
  trade: 'Trade commodities with the bank 2 for 1.',
  council: 'Promote wardens to strength 3.',
  academy: 'On a roll that pays you nothing, take any one resource.',
};
export const MAX_LEVEL = 5;
/** The level that takes a guild's Capital. */
export const CAPITAL_LEVEL = 4;

/** The omen die: three ship faces and one gate for each guild. */
export type Omen = 'ship' | Guild;
export const OMEN_FACES: Omen[] = ['ship', 'ship', 'ship', 'trade', 'council', 'academy'];
/** The marauder fleet lands on this space. */
export const MARAUDER_TRACK = 7;

export interface Warden {
  player: string;
  /** Strength: 1 (watch), 2 (guard), 3 (champion). */
  level: 1 | 2 | 3;
  active: boolean;
  /** The turn it was mustered (it can't act until a later turn). */
  since: number;
  /** The turn it was last promoted (a warden is promoted at most once a turn). */
  promoted?: number;
}
/** Wardens of each strength a player owns. */
export const WARDENS_PER_LEVEL = 2;
export const MAX_WALLS = 3;

export type Edict =
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

const deck = (counts: Partial<Record<Edict, number>>): Edict[] => (Object.keys(counts) as Edict[]).flatMap((e) => Array<Edict>(counts[e]!).fill(e));

/** 18 edicts in each guild's deck, as in the original's three progress decks. */
export const EDICT_DECKS: Record<Guild, Edict[]> = {
  academy: deck({ alchemist: 2, inventor: 2, irrigation: 2, mining: 2, engineer: 1, roadbuilding: 2, medicine: 2, smith: 2, crane: 2, printer: 1 }),
  council: deck({ warlord: 2, bishop: 2, constitution: 1, deserter: 2, diplomat: 2, intrigue: 2, saboteur: 2, wedding: 2, spy: 3 }),
  trade: deck({ merchant: 6, 'commercial-harbor': 2, 'resource-monopoly': 4, 'trade-monopoly': 2, 'merchant-fleet': 2, 'master-merchant': 2 }),
};

/** Number tokens the Inventor may not move. */
export const FIXED_TOKENS = [2, 6, 8, 12];
/** The merchant is worth a point to whoever placed it last. */
export const MERCHANT_POINTS = 1;

export const EDICT_GUILD = Object.fromEntries((Object.keys(EDICT_DECKS) as Guild[]).flatMap((g) => EDICT_DECKS[g].map((e) => [e, g]))) as Record<Edict, Guild>;

/** Edicts worth a point, shown and kept the moment they're drawn. */
export const POINT_EDICTS: Edict[] = ['printer', 'constitution'];
/** Edicts you may hold at once (point edicts aside). */
export const EDICT_LIMIT = 4;

export const EDICT_NAME: Record<Edict, string> = {
  alchemist: 'Alchemist',
  inventor: 'Inventor',
  deserter: 'Deserter',
  diplomat: 'Diplomat',
  intrigue: 'Intrigue',
  merchant: 'Merchant',
  'commercial-harbor': 'Commercial Harbour',
  irrigation: 'Irrigation',
  mining: 'Mining',
  engineer: 'Engineer',
  roadbuilding: 'Road Crew',
  medicine: 'Physician',
  smith: 'Smith',
  crane: 'Crane',
  printer: 'Printing Press',
  warlord: 'Muster Call',
  bishop: 'Bishop',
  constitution: 'Charter of Rights',
  saboteur: 'Saboteur',
  wedding: 'Wedding',
  spy: 'Spy',
  'resource-monopoly': 'Corner the Market',
  'trade-monopoly': 'Guild Levy',
  'merchant-fleet': 'Merchant Fleet',
  'master-merchant': 'Master Merchant',
};

export const EDICT_TEXT: Record<Edict, string> = {
  alchemist: 'Play it before you roll: you choose what both number dice show. The omen die is rolled as usual and settled first.',
  inventor: 'Swap two number tokens anywhere on the island. Not a 2, 12, 6 or 8.',
  irrigation: 'Take 2 grain for each fields tile next to your homesteads and towns.',
  mining: 'Take 2 stone for each mountains tile next to your homesteads and towns.',
  engineer: 'Build a wall on one of your towns for free.',
  roadbuilding: 'Build two roads for free.',
  medicine: 'Your next town this turn costs 2 stone and 1 grain.',
  smith: 'Promote up to two of your wardens for free this turn (each once a turn).',
  crane: 'Your next improvement this turn costs one commodity less.',
  printer: '1 point. Shown the moment it is drawn.',
  warlord: 'Muster all your wardens for free.',
  bishop: 'Move the raider, and rob one card from each player with a building next to its new tile. Not before the first landing.',
  constitution: '1 point. Shown the moment it is drawn.',
  deserter: 'Choose a player: they remove one of their wardens (their choice), and you may place one of yours of the same strength, free.',
  diplomat: 'Remove an open road (nothing of its owner at one end). If it is yours, you may build it again elsewhere, free.',
  intrigue: "Push off a rival's warden on a corner touching your road, without using a warden of your own.",
  saboteur: 'Every other player with as many points as you or more discards half their cards, rounded down, choosing which.',
  wedding: 'Every player with more points than you gives you 2 cards of their choice.',
  spy: "Look at another player's edicts and take one.",
  merchant: "Put the merchant on a land tile next to your homestead or town. While it stays there you trade that tile's resource with the bank 2 for 1, and it is worth 1 point to you.",
  'commercial-harbor': 'This turn, offer each other player one resource from your hand. Each must give you a commodity of their choice for it; if they have none, you keep your card.',
  'resource-monopoly': 'Name a resource: every other player gives you up to 2 of it.',
  'trade-monopoly': 'Name a commodity: every other player gives you 1 of it.',
  'merchant-fleet': 'Name a resource or commodity: this turn you trade it with the bank 2 for 1.',
  'master-merchant': 'Look at the hand of a player with more points than you, and take any 2 cards.',
};

/** What an edict asks for when you play it. */
export type EdictNeed = 'player' | 'resource' | 'commodity' | 'card' | 'town' | 'dice' | 'tiles' | 'tile' | 'road' | 'warden';
export const EDICT_NEEDS: Partial<Record<Edict, EdictNeed>> = {
  spy: 'player',
  'master-merchant': 'player',
  deserter: 'player',
  'resource-monopoly': 'resource',
  'trade-monopoly': 'commodity',
  'merchant-fleet': 'card',
  engineer: 'town',
  alchemist: 'dice',
  inventor: 'tiles',
  merchant: 'tile',
  diplomat: 'road',
  intrigue: 'warden',
};

export type Card = Resource | Commodity;
export const WARDENS_WIN_POINTS = 13;
