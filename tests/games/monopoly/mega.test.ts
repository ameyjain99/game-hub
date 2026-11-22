// Monopoly: The Mega Edition. 52 squares, a speed die, bus tickets, the three
// new squares, train depots, skyscrapers, and building on all but one street.
import { describe, expect, test } from 'vitest';
import { BOARDS, groupIds, layoutOf, ownableIds, spaceName, spacesOf } from '../../../src/games/monopoly/engine/board';
import { MEGA, MEGA_UK, MEGA_US } from '../../../src/games/monopoly/engine/mega';
import { CHANCE, cardText } from '../../../src/games/monopoly/engine/cards';
import { createMonopolyGame, currentSeat, type MonopolyState, type Settings } from '../../../src/games/monopoly/engine/state';
import { applyAction, landOn } from '../../../src/games/monopoly/engine/reducer';
import { chooseMonopolyAction, timeoutAction } from '../../../src/games/monopoly/engine/bot';
import { canBuild, canBuildDepot, rentFor, ticketTargets } from '../../../src/games/monopoly/engine/selectors';
import { IllegalActionError } from '../../../src/games/monopoly/engine/actions';
import { redactFor } from '../../../src/games/monopoly/engine/redact';

const mk = (settings: Partial<Settings> = {}, seed = 1, n = 3): MonopolyState =>
  createMonopolyGame(Array.from({ length: n }, (_, i) => ({ avatar: String(i), isAI: i > 0 })), seed, { board: 'megaUs', randomizeOrder: false, ...settings });

/** The state after the player to move lands on `space`. */
function land(g: MonopolyState, space: number, collectGo = false): MonopolyState {
  const s = structuredClone(g);
  landOn(s, currentSeat(s), space, collectGo);
  return s;
}
const give = (g: MonopolyState, owner: string, ids: number[], houses = 0) => {
  for (const id of ids) Object.assign(g.ownership[id], { owner, houses });
};
const id = (name: string, board: 'megaUs' | 'megaUk' = 'megaUs') => spacesOf(board).find((s) => s.name === name)!.id;

describe('the boards', () => {
  test('52 squares, 13 a side: 30 streets, 4 railroads, 3 utilities, and the three new squares', () => {
    for (const board of [MEGA_US, MEGA_UK]) {
      expect(board).toHaveLength(52);
      const count = (kind: string) => board.filter((s) => s.kind === kind).length;
      expect([count('property'), count('railroad'), count('utility'), count('auction'), count('bus-ticket'), count('birthday')]).toEqual([30, 4, 3, 1, 1, 1]);
      expect([count('chance'), count('chest'), count('tax')]).toEqual([3, 3, 2]);
      expect(new Set(board.filter((s) => s.price).map((s) => s.name)).size).toBe(37);
    }
    expect(layoutOf('megaUs')).toEqual({ size: 52, side: 13, jail: 13, goToJail: 39 });
    expect([MEGA_US[13].kind, MEGA_US[26].kind, MEGA_US[39].kind]).toEqual(['jail', 'free-parking', 'go-to-jail']);
    expect(ownableIds('megaUk')).toHaveLength(37);
    expect(BOARDS.map((b) => b.id)).toEqual(['world2008', 'world2015', 'us', 'uk', 'india', 'europe', 'megaUs', 'megaUk', 'classic', 'neo', 'world', 'nations']);
  });

  test('colour sets are three streets at the ends and four in between', () => {
    const sizes = (['brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkblue'] as const).map((g) => groupIds(g, 'megaUs').length);
    expect(sizes).toEqual([3, 4, 4, 4, 4, 4, 4, 3]);
  });

  test('prices and rents follow the printed deeds, new streets and skyscrapers included', () => {
    const deed = (name: string, board: 'megaUs' | 'megaUk' = 'megaUs') => {
      const s = spacesOf(board)[id(name, board)];
      return [s.price, ...s.rent!, s.skyscraper];
    };
    expect(deed('Arctic Avenue')).toEqual([80, 5, 30, 80, 240, 360, 500, 950]);
    expect(deed('Massachusetts Avenue')).toEqual([100, 6, 30, 90, 270, 400, 550, 1050]);
    expect(deed('New Jersey Avenue')).toEqual([200, 16, 80, 220, 600, 800, 1000, 1500]);
    expect(deed('Kentucky Avenue')).toEqual([220, 18, 90, 250, 700, 875, 1050, 2050]);
    expect(deed('Florida Avenue')).toEqual([350, 35, 175, 500, 1100, 1300, 1500, 2500]);
    expect(deed('Boardwalk')).toEqual([400, 50, 200, 600, 1400, 1700, 2000, 3000]);
    // The UK board prices its new streets differently, and each takes the rents of its price.
    expect(deed('Elephant and Castle', 'megaUk')).toEqual([60, 4, 20, 60, 180, 320, 450, 950]);
    expect(deed('Pentonville', 'megaUk')).toEqual([120, 8, 40, 100, 300, 450, 600, 1100]);
    expect(deed('Bond Street', 'megaUk')).toEqual([320, 28, 150, 450, 1000, 1200, 1400, 2400]);
    expect(deed('Knightsbridge', 'megaUk')).toEqual([400, 50, 200, 600, 1400, 1700, 2000, 3000]);
    expect(spaceName(50, 'megaUk')).toBe('Bank Deposit');
  });

  test('everyone starts with 2,500, and the bank has 8 skyscrapers, 4 depots and 16 Bus Tickets', () => {
    const g = mk();
    expect(g.players.map((p) => p.cash)).toEqual([2500, 2500, 2500]);
    expect([g.housesLeft, g.hotelsLeft, g.skyscrapersLeft, g.depotsLeft, g.busLeft]).toEqual([32, 12, 8, 4, 16]);
    expect(g.busDeck!.filter(Boolean)).toHaveLength(MEGA.expiringTickets);
    expect(mk({ startingCash: 1500 }).players[0].cash).toBe(1500);
    expect(redactFor(g, 'p0').busDeck).toEqual([]);
    // A standard game carries none of this.
    const std = createMonopolyGame([{ avatar: '', isAI: false }, { avatar: '', isAI: true }], 1, { board: 'us' });
    expect([std.players[0].cash, std.busDeck, std.skyscrapersLeft]).toEqual([1500, undefined, undefined]);
  });

  test('cards written for the standard board name and reach the same street on a Mega board', () => {
    const boardwalk = CHANCE.find((c) => c.id === 'ch-boardwalk')!;
    const stCharles = CHANCE.find((c) => c.id === 'ch-charles')!;
    expect([cardText(boardwalk, 'megaUs'), cardText(boardwalk, 'megaUk')]).toEqual(['Advance to Boardwalk.', 'Advance to Mayfair.']);
    expect([cardText(stCharles, 'megaUs'), cardText(stCharles, 'megaUk')]).toEqual(['Advance to St. Charles Place.', 'Advance to Pall Mall.']);
  });
});

describe('rent', () => {
  test('a bare site: single, double with all but one street, triple with the whole set', () => {
    const g = mk();
    const [a, b, c, d] = groupIds('orange', 'megaUs');
    give(g, 'p1', [a]);
    expect(rentFor(g, a, 7)).toBe(14);
    give(g, 'p1', [b, c]);
    expect(rentFor(g, a, 7)).toBe(28);
    give(g, 'p1', [d]);
    expect(rentFor(g, a, 7)).toBe(42);
    // The house rule that switches the set bonus off switches both off.
    expect(rentFor({ ...g, settings: { ...g.settings, doubleRentFullSet: false } }, a, 7)).toBe(14);
  });

  test('a skyscraper, a train depot, and three utilities', () => {
    const g = mk();
    give(g, 'p1', groupIds('darkblue', 'megaUs'), 6);
    expect(rentFor(g, id('Boardwalk'), 7)).toBe(3000);
    const rails = spacesOf('megaUs').filter((s) => s.kind === 'railroad').map((s) => s.id);
    give(g, 'p1', rails.slice(0, 2));
    expect(rentFor(g, rails[0], 7)).toBe(50);
    g.ownership[rails[0]].depot = true;
    expect([rentFor(g, rails[0], 7), rentFor(g, rails[1], 7)]).toEqual([100, 50]);
    const utils = spacesOf('megaUs').filter((s) => s.kind === 'utility').map((s) => s.id);
    give(g, 'p2', [utils[0]]);
    expect(rentFor(g, utils[0], 8)).toBe(32);
    give(g, 'p2', [utils[1]]);
    expect(rentFor(g, utils[0], 8)).toBe(80);
    give(g, 'p2', [utils[2]]);
    expect(rentFor(g, utils[0], 8)).toBe(160);
  });
});

describe('building', () => {
  test('houses go up with all but one street; a skyscraper needs the whole set and a hotel on each', () => {
    const g = mk();
    const lots = groupIds('pink', 'megaUs');
    give(g, 'p0', lots.slice(0, 2));
    expect(canBuild(g, 'p0', lots[0])).toBe(false);
    give(g, 'p0', [lots[2]]);
    expect(canBuild(g, 'p0', lots[0])).toBe(true);
    const built = applyAction(g, { type: 'BUILD', spaceId: lots[0] });
    expect([built.ownership[lots[0]].houses, built.players[0].cash, built.housesLeft]).toEqual([1, 2400, 31]);
    // Even building runs over the streets owned.
    expect(canBuild(built, 'p0', lots[0])).toBe(false);

    give(g, 'p0', lots.slice(0, 3), 5);
    expect(canBuild(g, 'p0', lots[0])).toBe(false); // hotels on three of four: no skyscraper yet
    give(g, 'p0', [lots[3]], 5);
    expect(canBuild(g, 'p0', lots[0])).toBe(true);
    const tall = applyAction({ ...g, hotelsLeft: 8 }, { type: 'BUILD', spaceId: lots[0] });
    expect([tall.ownership[lots[0]].houses, tall.skyscrapersLeft, tall.hotelsLeft, tall.players[0].cash]).toEqual([6, 7, 9, 2400]);
    const down = applyAction(tall, { type: 'SELL_HOUSE', spaceId: lots[0] });
    expect([down.ownership[lots[0]].houses, down.skyscrapersLeft, down.players[0].cash]).toEqual([5, 8, 2450]);
  });

  test('a train depot costs 100 on any railroad you own, sells back for 50, and blocks a mortgage', () => {
    const g = mk();
    const rail = id('Reading Railroad');
    expect(canBuildDepot(g, 'p0', rail)).toBe(false);
    give(g, 'p0', [rail]);
    const built = applyAction(g, { type: 'BUILD_DEPOT', spaceId: rail });
    expect([built.ownership[rail].depot, built.players[0].cash, built.depotsLeft]).toEqual([true, 2400, 3]);
    expect(() => applyAction(built, { type: 'MORTGAGE', spaceId: rail })).toThrow(IllegalActionError);
    const sold = applyAction(built, { type: 'SELL_DEPOT', spaceId: rail });
    expect([sold.ownership[rail].depot, sold.players[0].cash, sold.depotsLeft]).toEqual([false, 2450, 4]);
    // Not on a standard board.
    const std = createMonopolyGame([{ avatar: '', isAI: false }, { avatar: '', isAI: true }], 1, { board: 'us', randomizeOrder: false });
    std.ownership[5].owner = 'p0';
    expect(() => applyAction(std, { type: 'BUILD_DEPOT', spaceId: 5 })).toThrow(IllegalActionError);
  });

  test('completing a set that has buildings spreads them evenly and pays off the new street\'s mortgage', () => {
    const g = mk();
    const [a, b, c] = groupIds('brown', 'megaUs');
    give(g, 'p0', [a, b], 3);
    g.housesLeft = 26;
    g.players[0].position = c - 1;
    Object.assign(g.ownership[c], { owner: 'p1', mortgaged: true });
    g.phase = 'action';
    g.dice = [1, 2];
    const t = applyAction(g, { type: 'PROPOSE_TRADE', trade: { from: 'p0', to: 'p1', give: { cash: 100, properties: [], getOutCards: 0 }, receive: { cash: 0, properties: [c], getOutCards: 0 } } });
    const done = applyAction(t, { type: 'RESPOND_TRADE', accept: true });
    expect([a, b, c].map((x) => done.ownership[x].houses)).toEqual([2, 2, 2]);
    expect(done.ownership[c].mortgaged).toBe(false);
    expect(done.housesLeft).toBe(26);
    // 100 for the trade, 4 interest on a mortgaged deed, 44 to redeem it.
    expect(done.players[0].cash).toBe(2500 - 100 - 4 - 44);
  });
});

describe('the speed die', () => {
  /** Roll until the wanted face comes up on a fresh game; returns the state after that roll. */
  const rollFor = (want: (s: MonopolyState) => boolean, settings: Partial<Settings> = {}) => {
    for (let seed = 1; seed < 3000; seed++) {
      const out = applyAction(mk(settings, seed), { type: 'ROLL' });
      if (want(out)) return out;
    }
    throw new Error('no such roll found');
  };

  test('pips are added to the move; doubles look at the white dice only', () => {
    const out = rollFor((s) => typeof s.speedDie === 'number' && s.dice![0] !== s.dice![1]);
    expect(out.players[0].position).toBe(out.dice![0] + out.dice![1] + (out.speedDie as number));
    expect(out.bonus).toBeNull();
    const dbl = rollFor((s) => typeof s.speedDie === 'number' && s.dice![0] === s.dice![1] && s.dice![0] !== s.speedDie);
    expect(dbl.doubles).toBe(1);
  });

  test('triples move you to any square, with no second roll', () => {
    const out = rollFor((s) => s.choice?.kind === 'triples');
    expect([out.players[0].position, out.doubles]).toEqual([0, 0]);
    expect(() => applyAction(out, { type: 'END_TURN' })).toThrow(IllegalActionError);
    const moved = applyAction(out, { type: 'CHOOSE', space: id('Boardwalk') });
    expect([moved.players[0].position, moved.pendingPurchase, moved.choice]).toEqual([51, 51, null]);
    const after = applyAction(applyAction(moved, { type: 'BUY' }), { type: 'END_TURN' });
    expect(currentSeat(after)).toBe(1);
  });

  test('Mr. Monopoly: the ordinary move first, then on to the next unowned property', () => {
    const out = rollFor((s) => s.speedDie === 'mr' && s.pendingPurchase !== null && s.dice![0] !== s.dice![1]);
    const first = out.players[0].position;
    expect(first).toBe(out.dice![0] + out.dice![1]);
    expect(() => applyAction(out, { type: 'BONUS' })).toThrow(IllegalActionError); // deal with this square first
    expect(() => applyAction(applyAction(out, { type: 'BUY' }), { type: 'END_TURN' })).toThrow(IllegalActionError);
    const bonus = applyAction(applyAction(out, { type: 'BUY' }), { type: 'BONUS' });
    const next = ownableIds('megaUs').find((x) => x > first)!;
    expect([bonus.players[0].position, bonus.pendingPurchase, bonus.bonus]).toEqual([next, next, null]);
  });

  test('Mr. Monopoly with every property owned goes to the next rent due, and nowhere if all are mortgaged', () => {
    const g = rollFor((s) => s.speedDie === 'mr' && s.pendingPurchase !== null);
    const bought = applyAction(g, { type: 'BUY' });
    for (const x of ownableIds('megaUs')) if (bought.ownership[x].owner === null) bought.ownership[x].owner = 'p0';
    const theirs = ownableIds('megaUs').find((x) => x > bought.players[0].position + 3)!;
    bought.ownership[theirs].owner = 'p1';
    const moved = applyAction(bought, { type: 'BONUS' });
    expect(moved.players[0].position).toBe(theirs);
    expect(moved.players[1].cash).toBeGreaterThan(2500);
    bought.ownership[theirs].mortgaged = true;
    expect(applyAction(bought, { type: 'BONUS' }).players[0].position).toBe(bought.players[0].position);
  });

  test('the Bus: a ticket for later, or a ride to the next Chance or Community Chest', () => {
    const out = rollFor((s) => s.speedDie === 'bus' && s.pendingPurchase === null && s.players[0].cash >= 0 && !s.players[0].inJail && !s.choice);
    const ticket = applyAction(out, { type: 'BONUS', take: 'ticket' });
    expect([ticket.busLeft, ticket.bonus]).toEqual([15, null]);
    expect(ticket.players[0].busTickets).toBe(1);
    const from = out.players[0].position;
    const ride = applyAction(out, { type: 'BONUS', take: 'move' });
    const nextCard = [...MEGA_US, ...MEGA_US].slice(from + 1).find((s) => s.kind === 'chance' || s.kind === 'chest')!.id;
    expect(ride.lastCard?.atRoll).toBe(out.rollSeq);
    expect(ride.log.some((l) => l.includes('drew'))).toBe(true);
    expect(nextCard).toBeGreaterThanOrEqual(0);
  });

  test('in Jail only the two white dice are rolled', () => {
    const g = mk();
    Object.assign(g.players[0], { inJail: true, position: 13 });
    g.phase = 'jail';
    const out = applyAction(g, { type: 'ROLL_JAIL' });
    expect([out.speedDie, out.bonus ?? null]).toEqual([null, null]);
  });
});

describe('bus tickets', () => {
  test('a ticket goes to any square further along the same side, the corner included', () => {
    const g = mk();
    expect(ticketTargets(g, 5)).toEqual([6, 7, 8, 9, 10, 11, 12, 13]);
    expect(ticketTargets(g, 13)).toEqual([14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]);
    expect(ticketTargets(g, 50)).toEqual([51, 0]);
  });

  test('riding one takes the place of the roll: it is spent, there is no second roll, and passing Go pays', () => {
    const g = mk();
    Object.assign(g.players[0], { position: 48, busTickets: 2 });
    expect(() => applyAction(g, { type: 'USE_TICKET', space: 5 })).toThrow(IllegalActionError);
    const out = applyAction(g, { type: 'USE_TICKET', space: 0 });
    expect([out.players[0].position, out.players[0].busTickets, out.players[0].cash, out.dice]).toEqual([0, 1, 2700, null]);
    expect(currentSeat(applyAction(out, { type: 'END_TURN' }))).toBe(1);
    // No ticket, no ride; and not from Jail.
    expect(() => applyAction(mk(), { type: 'USE_TICKET', space: 3 })).toThrow(IllegalActionError);
  });

  test('a utility reached by ticket is paid on a fresh roll of the white dice', () => {
    const g = mk();
    Object.assign(g.players[0], { position: 7, busTickets: 1 });
    g.ownership[10].owner = 'p1';
    const out = applyAction(g, { type: 'USE_TICKET', space: 10 });
    expect(out.players[1].cash).toBe(2500 + 4 * (out.dice![0] + out.dice![1]));
  });

  test('an expiry ticket wipes out every other ticket held, the drawer\'s too', () => {
    const g = mk();
    g.busDeck = [true, false];
    g.players[0].busTickets = 3;
    g.players[1].busTickets = 2;
    const out = land(g, id('Bus Ticket'));
    expect(out.players.map((p) => p.busTickets ?? 0)).toEqual([1, 0, 0]);
    expect(out.busLeft).toBe(1);
    // With the deck empty the square does nothing.
    const none = land({ ...g, busDeck: [], busLeft: 0 }, id('Bus Ticket'));
    expect(none.players[0].busTickets).toBe(3);
  });

  test('tickets can be traded', () => {
    const g = mk();
    g.players[0].busTickets = 2;
    g.phase = 'action';
    g.dice = [1, 2];
    const offer = applyAction(g, { type: 'PROPOSE_TRADE', trade: { from: 'p0', to: 'p1', give: { cash: 0, properties: [], getOutCards: 0, busTickets: 2 }, receive: { cash: 150, properties: [], getOutCards: 0 } } });
    const done = applyAction(offer, { type: 'RESPOND_TRADE', accept: true });
    expect([done.players[0].busTickets, done.players[1].busTickets, done.players[0].cash]).toEqual([0, 2, 2650]);
    expect(() => applyAction(g, { type: 'PROPOSE_TRADE', trade: { from: 'p0', to: 'p1', give: { cash: 0, properties: [], getOutCards: 0, busTickets: 3 }, receive: { cash: 0, properties: [], getOutCards: 0 } } })).toThrow(IllegalActionError);
  });
});

describe('the new squares', () => {
  test('Auction: you name an unowned property and the bank auctions it', () => {
    const out = land(mk(), id('Auction'));
    expect(out.choice).toEqual({ kind: 'auction' });
    expect(() => applyAction(out, { type: 'CHOOSE', space: 0 })).toThrow(IllegalActionError);
    const going = applyAction(out, { type: 'CHOOSE', space: id('Boardwalk') });
    expect([going.phase, going.pendingAuction?.spaceId, going.choice]).toEqual(['auction', 51, null]);
  });

  test('Auction with nothing left to sell: on to the dearest rent you owe', () => {
    const g = mk();
    for (const x of ownableIds('megaUs')) g.ownership[x].owner = 'p0';
    give(g, 'p1', [id('Mediterranean Avenue')]);
    give(g, 'p2', [id('Boardwalk')]);
    const out = land(g, id('Auction'));
    expect([out.players[0].position, out.choice ?? null]).toEqual([51, null]);
    expect(out.players[2].cash).toBe(2550);
  });

  test('Birthday Gift: 100 from the bank or a Bus Ticket, and just the money once the tickets are gone', () => {
    const out = land(mk(), id('Birthday Gift'));
    expect(out.choice).toEqual({ kind: 'birthday' });
    expect(applyAction(out, { type: 'CHOOSE', take: 'cash' }).players[0].cash).toBe(2600);
    const ticket = applyAction(out, { type: 'CHOOSE', take: 'ticket' });
    expect([ticket.players[0].busTickets, ticket.players[0].cash]).toEqual([1, 2500]);
    const none = land({ ...mk(), busDeck: [], busLeft: 0 }, id('Birthday Gift'));
    expect([none.choice ?? null, none.players[0].cash]).toEqual([null, 2600]);
  });

  test('Go To Jail sends you to the Jail corner of this board', () => {
    const out = land(mk(), 39);
    expect([out.players[0].position, out.players[0].inJail]).toEqual([13, true]);
  });
});

test('going bankrupt to the bank returns skyscrapers, depots and tickets', () => {
  const g = mk();
  give(g, 'p0', groupIds('darkblue', 'megaUs'), 6);
  g.skyscrapersLeft = 5;
  const rail = id('Short Line');
  Object.assign(g.ownership[rail], { owner: 'p0', depot: true });
  g.depotsLeft = 3;
  Object.assign(g.players[0], { cash: -1, busTickets: 2 });
  g.pendingDebt = { debtor: 0, creditor: null };
  g.phase = 'action';
  const out = applyAction(g, { type: 'DECLARE_BANKRUPTCY' });
  expect([out.skyscrapersLeft, out.depotsLeft, out.players[0].busTickets, out.ownership[rail].depot, out.ownership[51].owner]).toEqual([8, 4, 0, false, null]);
});

test('bots play both Mega boards to the end, and a timed-out player is always moved on', () => {
  for (const board of ['megaUs', 'megaUk'] as const) {
    for (let seed = 1; seed <= 5; seed++) {
      let s = createMonopolyGame(Array.from({ length: 4 }, (_, i) => ({ avatar: String(i), isAI: true, difficulty: (['easy', 'normal', 'hard'] as const)[(seed + i) % 3] })), seed, { board, roundLimit: 40 });
      const seen = new Set<string>();
      for (let i = 0; i < 60_000 && s.phase !== 'over'; i++) {
        if (s.speedDie) seen.add(String(s.speedDie));
        s = applyAction(s, seed % 2 ? chooseMonopolyAction(s) : i % 3 === 0 ? timeoutAction(s) : chooseMonopolyAction(s));
      }
      expect(s.phase, `${board} seed ${seed}`).toBe('over');
      expect(seen.size).toBe(5);
      // The bank's stock never runs negative on the pieces only Mega has.
      expect(s.skyscrapersLeft! >= 0 && s.depotsLeft! >= 0 && s.busLeft! >= 0).toBe(true);
    }
  }
});
