// Monopoly Deal: the 106-card deck, a turn, rent and paying, Just Say No, and the bots.
import { describe, expect, test } from 'vitest';
import { IllegalMove } from '../../../src/games/kit/engine';
import { ACTIONS, RENT, SET_SIZE, buildDeck, cheapestPayment, completeColors, createMd, isComplete, mdKit, rentOf, type ActionKind, type Color, type MdAction, type MdCard, type MdOptions, type MdState } from '../../../src/games/monopoly-deal/engine';
import { playOut } from './sim';

const DECK = buildDeck();
const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI: false }));
/** Cards by name (or action kind), each copy used once per table. */
function pick(used: Set<number>, name: string): MdCard {
  const card = DECK.find((c) => !used.has(c.id) && (c.name === name || c.action === name));
  if (!card) throw new Error(`no card left called ${name}`);
  used.add(card.id);
  return card;
}

interface Side {
  hand?: string[];
  bank?: string[];
  /** Properties as "Name" or "Name@color" for a wild. */
  props?: string[];
  buildings?: [ActionKind, Color][];
}

/** A game with p0 to move in the play phase and each player's cards as given. */
function table(sides: Side[], options: MdOptions = {}): MdState {
  const used = new Set<number>();
  const s = createMd(seats(sides.length), 5, options);
  const players = s.players.map((p, i) => {
    const side = sides[i];
    const hand = (side.hand ?? []).map((n) => pick(used, n));
    return {
      ...p,
      hand,
      handCount: hand.length,
      bank: (side.bank ?? []).map((n) => pick(used, n)),
      props: (side.props ?? []).map((spec) => {
        const [name, color] = spec.split('@');
        const card = pick(used, name);
        return { card, color: (color ?? card.colors[0]) as Color };
      }),
      buildings: (side.buildings ?? []).map(([kind, color]) => ({ card: pick(used, kind), color })),
    };
  });
  const deck = DECK.filter((c) => !used.has(c.id));
  return { ...s, players, turn: 0, phase: 'play', deck, deckCount: deck.length };
}
const act = (s: MdState, id: string, a: MdAction | { type: 'REMATCH' } | { type: 'RESIGN' }) => mdKit.apply(s, a, id);
const inHand = (s: MdState, player: number, name: string) => s.players[player].hand.find((c) => c.name === name || c.action === name)!.id;
const onTable = (s: MdState, player: number, name: string) => s.players[player].props.find((x) => x.card.name === name)!.card.id;
const names = (cards: { name: string }[]) => cards.map((c) => c.name);
const bank = (s: MdState, player: number) => s.players[player].bank.reduce((n, c) => n + c.value, 0);

describe('the deck', () => {
  test('106 playing cards: 20 money, 28 properties, 11 wilds, 13 rent, 34 action', () => {
    const count = (kind: string) => DECK.filter((c) => c.kind === kind).length;
    expect([DECK.length, count('money'), count('property'), count('wild'), count('rent'), count('action')]).toEqual([106, 20, 28, 11, 13, 34]);
    expect(DECK.filter((c) => c.kind === 'money').reduce((n, c) => n + c.value, 0)).toBe(57);
    expect(Object.fromEntries(Object.entries(ACTIONS).map(([k, [n]]) => [k, n]))).toEqual({ 'deal-breaker': 2, 'just-say-no': 3, 'sly-deal': 3, 'forced-deal': 3, 'debt-collector': 3, birthday: 3, 'pass-go': 10, house: 3, hotel: 2, 'double-rent': 2 });
    // The two multicoloured wilds are worth nothing; every other card has a value.
    expect(names(DECK.filter((c) => c.value === 0))).toEqual(['Multicolored Wild', 'Multicolored Wild']);
  });

  test('every colour has as many properties as its full set, and a rent for each', () => {
    for (const color of Object.keys(SET_SIZE) as Color[]) {
      expect(DECK.filter((c) => c.kind === 'property' && c.colors[0] === color), color).toHaveLength(SET_SIZE[color]);
      expect(RENT[color], color).toHaveLength(SET_SIZE[color]);
    }
  });

  test.each([2, 3, 4, 5])('%i players are dealt 5 cards each', (n) => {
    const s = createMd(seats(n), 3);
    expect(s.players.map((p) => p.hand.length)).toEqual(Array(n).fill(5));
    expect(s.deck).toHaveLength(106 - 5 * n);
    expect([s.phase, s.plays]).toEqual(['draw', 0]);
  });
});

describe('a turn', () => {
  test('draw 2, or 5 with an empty hand, then play', () => {
    const s = createMd(seats(2), 3);
    const me = s.players[s.turn].id;
    expect(() => act(s, me, { type: 'END' })).toThrow('draw your cards first');
    const drew = act(s, me, { type: 'DRAW' });
    expect([drew.players[drew.turn].hand.length, drew.phase]).toEqual([7, 'play']);
    expect(() => act(drew, me, { type: 'DRAW' })).toThrow('already drawn');
    const empty = { ...table([{}, {}]), phase: 'draw' as const };
    expect(act(empty, 'p0', { type: 'DRAW' }).players[0].hand).toHaveLength(5);
  });

  test('money and action cards go in the bank, properties in the collection, 3 cards at most', () => {
    let s = table([{ hand: ['5M', 'Pass Go', 'Boardwalk', '1M'] }, {}]);
    s = act(s, 'p0', { type: 'BANK', card: inHand(s, 0, '5M') });
    s = act(s, 'p0', { type: 'BANK', card: inHand(s, 0, 'Pass Go') });
    expect(() => act(s, 'p0', { type: 'BANK', card: inHand(s, 0, 'Boardwalk') })).toThrow('only money and action cards');
    s = act(s, 'p0', { type: 'PROPERTY', card: inHand(s, 0, 'Boardwalk') });
    expect([bank(s, 0), names(s.players[0].props.map((x) => x.card)), s.plays]).toEqual([6, ['Boardwalk'], 3]);
    expect(() => act(s, 'p0', { type: 'BANK', card: inHand(s, 0, '1M') })).toThrow('played 3 cards');
    const next = act(s, 'p0', { type: 'END' });
    expect([next.turn, next.phase, next.plays]).toEqual([1, 'draw', 0]);
  });

  test('ending with more than 7 cards means choosing the ones to discard', () => {
    const s = table([{ hand: ['1M', '1M', '1M', '2M', '2M', '2M', '3M', '3M', '4M'] }, {}]);
    expect(() => act(s, 'p0', { type: 'END' })).toThrow('discard 2');
    const ids = s.players[0].hand.slice(0, 2).map((c) => c.id);
    const next = act(s, 'p0', { type: 'END', discard: ids });
    expect([next.players[0].hand.length, next.discard.length, next.turn]).toEqual([7, 2, 1]);
    expect(() => act(table([{ hand: ['1M'] }, {}]), 'p0', { type: 'END', discard: [0] })).toThrow(IllegalMove);
  });

  test('Pass Go draws 2 more; an empty draw pile is rebuilt from the discards', () => {
    let s = table([{ hand: ['Pass Go'] }, {}]);
    s = act(s, 'p0', { type: 'PLAY', card: inHand(s, 0, 'Pass Go') });
    expect([s.players[0].hand.length, s.plays, names(s.discard)]).toEqual([2, 1, ['Pass Go']]);
    const dry = { ...table([{ hand: ['Pass Go'] }, {}]), deck: [], discard: DECK.slice(60, 63) };
    const after = act(dry, 'p0', { type: 'PLAY', card: inHand(dry, 0, 'Pass Go') });
    expect([after.players[0].hand.length, after.deck.length + after.discard.length]).toEqual([2, 2]);
  });

  test('a wild is laid in a colour it shows, and can be turned on your turn for free', () => {
    let s = table([{ hand: ['Red / Yellow Wild'], props: ['Kentucky Avenue', 'Indiana Avenue'] }, {}]);
    const wild = inHand(s, 0, 'Red / Yellow Wild');
    expect(() => act(s, 'p0', { type: 'PROPERTY', card: wild, color: 'green' })).toThrow('colour the wild card shows');
    s = act(s, 'p0', { type: 'PROPERTY', card: wild, color: 'red' });
    expect([isComplete(s.players[0], 'red'), s.plays]).toEqual([true, 1]);
    s = act(s, 'p0', { type: 'MOVE', card: wild, color: 'yellow' });
    expect([isComplete(s.players[0], 'red'), s.plays, rentOf(s.players[0], 'yellow')]).toEqual([false, 1, 2]);
    expect(() => act(s, 'p0', { type: 'MOVE', card: onTable(s, 0, 'Kentucky Avenue'), color: 'yellow' })).toThrow('only a wild');
  });
});

describe('sets, rent and buildings', () => {
  test('rent goes by the number of properties, and a House and Hotel add to a full set', () => {
    const s = table([{ props: ['Oriental Avenue', 'Vermont Avenue', 'Connecticut Avenue', 'Boardwalk'], buildings: [['house', 'lightblue'], ['hotel', 'lightblue']] }, {}]);
    const me = s.players[0];
    expect([rentOf(me, 'lightblue'), rentOf(me, 'darkblue'), rentOf(me, 'red')]).toEqual([10, 3, 0]);
    expect(completeColors(me)).toEqual(['lightblue']);
  });

  test('a set of nothing but multicoloured wilds is not a full set', () => {
    const s = table([{ props: ['Multicolored Wild@brown', 'Multicolored Wild@brown'] }, {}]);
    expect(isComplete(s.players[0], 'brown')).toBe(false);
  });

  test('a House needs a full set, a Hotel needs the House, and neither goes on Railroads', () => {
    let s = table([{ hand: ['house', 'hotel', 'house'], props: ['Park Place', 'Boardwalk', 'Electric Company', 'Water Works', 'Kentucky Avenue'] }, {}]);
    const [house, hotel] = [inHand(s, 0, 'house'), inHand(s, 0, 'hotel')];
    expect(() => act(s, 'p0', { type: 'PLAY', card: house, color: 'red' })).toThrow('full set');
    expect(() => act(s, 'p0', { type: 'PLAY', card: house, color: 'utility' })).toThrow('Railroads or Utilities');
    expect(() => act(s, 'p0', { type: 'PLAY', card: hotel, color: 'darkblue' })).toThrow('House before a Hotel');
    s = act(s, 'p0', { type: 'PLAY', card: house, color: 'darkblue' });
    expect(() => act(s, 'p0', { type: 'PLAY', card: inHand(s, 0, 'house'), color: 'darkblue' })).toThrow('already has a House');
    s = act(s, 'p0', { type: 'PLAY', card: hotel, color: 'darkblue' });
    expect(rentOf(s.players[0], 'darkblue')).toBe(15);
    const loose = table([{ hand: ['house'], props: ['Electric Company', 'Water Works'] }, {}], { buildAnywhere: true });
    expect(rentOf(act(loose, 'p0', { type: 'PLAY', card: inHand(loose, 0, 'house'), color: 'utility' }).players[0], 'utility')).toBe(5);
  });

  test('three full sets of different colours win at once', () => {
    const s = table([{ hand: ['Baltic Avenue'], props: ['Mediterranean Avenue', 'Park Place', 'Boardwalk', 'Electric Company', 'Water Works'] }, {}]);
    const won = act(s, 'p0', { type: 'PROPERTY', card: inHand(s, 0, 'Baltic Avenue') });
    expect([won.over, won.winner]).toEqual([true, 'p0']);
    const two = table([{ hand: ['Baltic Avenue'], props: ['Mediterranean Avenue', 'Park Place', 'Boardwalk'] }, {}], { setsToWin: 2 });
    expect(act(two, 'p0', { type: 'PROPERTY', card: inHand(two, 0, 'Baltic Avenue') }).winner).toBe('p0');
  });
});

describe('rent and paying', () => {
  test('a two-colour Rent card charges everyone; each chooses what to pay with, and no change is given', () => {
    let s = table([{ hand: ['Rent: Dark Blue / Green'], props: ['Park Place'] }, { bank: ['5M', '1M'] }, { bank: ['1M', '5M'] }]);
    s = act(s, 'p0', { type: 'PLAY', card: inHand(s, 0, 'Rent: Dark Blue / Green'), color: 'darkblue' });
    expect(s.claims).toMatchObject([{ from: 'p1', amount: 3 }, { from: 'p2', amount: 3 }]);
    expect(mdKit.actor(s)).toBe('p1');
    expect(() => act(s, 'p0', { type: 'END' })).toThrow('wait for the action');
    const [five, one] = s.players[1].bank.map((c) => c.id);
    expect(() => act(s, 'p1', { type: 'PAY', cards: [one] })).toThrow('you owe 3M');
    s = act(s, 'p1', { type: 'PAY', cards: [five] });
    expect([bank(s, 0), bank(s, 1), mdKit.actor(s)]).toEqual([5, 1, 'p2']);
    // A player with exactly 3M on the table: it is all paid without asking.
    const exact = table([{ hand: ['Rent: Dark Blue / Green'], props: ['Park Place'] }, { bank: ['1M', '2M'] }]);
    const paid = act(exact, 'p0', { type: 'PLAY', card: inHand(exact, 0, 'Rent: Dark Blue / Green'), color: 'darkblue' });
    expect([bank(paid, 0), bank(paid, 1), paid.claims]).toEqual([3, 0, []]);
  });

  test('a player with nothing pays nothing; one with too little pays everything, properties included', () => {
    const s = table([{ hand: ['debt-collector', 'debt-collector'] }, {}, { bank: ['1M'], props: ['Boardwalk', 'Multicolored Wild@red'] }]);
    const none = act(s, 'p0', { type: 'PLAY', card: inHand(s, 0, 'debt-collector'), target: 'p1' });
    expect([none.claims, none.last?.kind, mdKit.actor(none)]).toEqual([[], 'broke', 'p0']);
    const poor = act(none, 'p0', { type: 'PLAY', card: inHand(none, 0, 'debt-collector'), target: 'p2' });
    expect(mdKit.actor(poor)).toBe('p0');
    expect([bank(poor, 0), names(poor.players[0].props.map((x) => x.card)), names(poor.players[2].props.map((x) => x.card))]).toEqual([1, ['Boardwalk'], ['Multicolored Wild']]);
  });

  test('a property paid arrives in the collection; a building paid arrives in the bank', () => {
    let s = table([{ hand: ['debt-collector'] }, { props: ['Park Place', 'Boardwalk', 'Kentucky Avenue'], buildings: [['house', 'darkblue']] }]);
    s = act(s, 'p0', { type: 'PLAY', card: inHand(s, 0, 'debt-collector'), target: 'p1' });
    const house = s.players[1].buildings[0].card.id;
    s = act(s, 'p1', { type: 'PAY', cards: [house, onTable(s, 1, 'Kentucky Avenue')] });
    expect([bank(s, 0), names(s.players[0].props.map((x) => x.card)), s.players[1].buildings]).toEqual([3, ['Kentucky Avenue'], []]);
  });

  test('Double the Rent doubles it and counts as a card; an any-colour Rent charges one player', () => {
    let s = table([{ hand: ['Rent: any colour', 'double-rent', 'double-rent'], props: ['Park Place', 'Boardwalk'] }, { bank: ['10M', '5M', '5M', '4M', '4M', '4M'] }, { bank: ['3M'] }]);
    const doubles = s.players[0].hand.filter((c) => c.action === 'double-rent').map((c) => c.id);
    expect(() => act(s, 'p0', { type: 'PLAY', card: inHand(s, 0, 'Rent: any colour'), color: 'darkblue', doubles })).toThrow('choose another player');
    const strict = { ...s, oneDouble: true };
    expect(() => act(strict, 'p0', { type: 'PLAY', card: inHand(s, 0, 'Rent: any colour'), color: 'darkblue', target: 'p1', doubles })).toThrow('only one Double');
    s = act(s, 'p0', { type: 'PLAY', card: inHand(s, 0, 'Rent: any colour'), color: 'darkblue', target: 'p1', doubles });
    // 8M twice doubled is 32M: all p1 has on the table, so it is paid outright.
    expect([s.last, bank(s, 0), bank(s, 1), s.plays]).toMatchObject([{ kind: 'pay', amount: 32 }, 32, 0, 3]);
    const none = table([{ hand: ['Rent: Red / Yellow'], props: ['Park Place'] }, {}]);
    expect(() => act(none, 'p0', { type: 'PLAY', card: inHand(none, 0, 'Rent: Red / Yellow'), color: 'red' })).toThrow('no property of that colour');
    expect(() => act(none, 'p0', { type: 'PLAY', card: inHand(none, 0, 'Rent: Red / Yellow'), color: 'darkblue' })).toThrow('colours on the Rent card');
  });

  test("It's My Birthday takes 2M from everyone", () => {
    let s = table([{ hand: ['birthday'] }, { bank: ['2M', '3M'] }, { bank: ['5M', '1M'] }]);
    s = act(s, 'p0', { type: 'PLAY', card: inHand(s, 0, 'birthday') });
    s = act(s, 'p1', { type: 'PAY', cards: [s.players[1].bank[0].id] });
    s = act(s, 'p2', { type: 'PAY', cards: [s.players[2].bank[0].id] });
    expect([bank(s, 0), bank(s, 1), bank(s, 2), mdKit.actor(s)]).toEqual([7, 3, 1, 'p0']);
  });

  test('the cheapest payment overpays as little as it can, with as few cards as it can', () => {
    const cards = ['1M', '1M', '2M', '5M', '10M'].map((n, i) => ({ ...DECK.find((c) => c.name === n)!, id: i }));
    expect(names(cheapestPayment(cards, 3))).toEqual(['1M', '2M']);
    expect(names(cheapestPayment(cards, 6))).toEqual(['1M', '5M']);
    expect(names(cheapestPayment(cards, 8))).toEqual(['1M', '2M', '5M']);
    expect(names(cheapestPayment(cards, 11))).toEqual(['1M', '10M']);
    expect(cheapestPayment(cards, 40)).toHaveLength(5);
  });
});

describe('taking properties', () => {
  test('a Sly Deal takes a property, but not from a full set', () => {
    const s = table([{ hand: ['sly-deal'] }, { props: ['Kentucky Avenue', 'Park Place', 'Boardwalk'] }]);
    const sly = inHand(s, 0, 'sly-deal');
    expect(() => act(s, 'p0', { type: 'PLAY', card: sly, target: 'p1', take: onTable(s, 1, 'Boardwalk') })).toThrow('not part of a full set');
    const after = act(s, 'p0', { type: 'PLAY', card: sly, target: 'p1', take: onTable(s, 1, 'Kentucky Avenue') });
    expect([names(after.players[0].props.map((x) => x.card)), after.players[1].props.length, after.claims]).toEqual([['Kentucky Avenue'], 2, []]);
  });

  test('a Forced Deal swaps one of yours for one of theirs', () => {
    const s = table([{ hand: ['forced-deal'], props: ['Baltic Avenue'] }, { props: ['Boardwalk'] }]);
    const after = act(s, 'p0', { type: 'PLAY', card: inHand(s, 0, 'forced-deal'), target: 'p1', take: onTable(s, 1, 'Boardwalk'), give: onTable(s, 0, 'Baltic Avenue') });
    expect([names(after.players[0].props.map((x) => x.card)), names(after.players[1].props.map((x) => x.card))]).toEqual([['Boardwalk'], ['Baltic Avenue']]);
    expect(() => act(s, 'p0', { type: 'PLAY', card: inHand(s, 0, 'forced-deal'), target: 'p1', take: onTable(s, 1, 'Boardwalk'), give: 9999 })).toThrow('one of your properties');
  });

  test('a Deal Breaker takes a full set with its buildings, and can win the game', () => {
    const s = table([{ hand: ['deal-breaker'], props: ['Mediterranean Avenue', 'Baltic Avenue', 'Electric Company', 'Water Works'] }, { props: ['Park Place', 'Boardwalk', 'Kentucky Avenue'], buildings: [['house', 'darkblue']] }]);
    const card = inHand(s, 0, 'deal-breaker');
    expect(() => act(s, 'p0', { type: 'PLAY', card, target: 'p1', color: 'red' })).toThrow('full set');
    const after = act(s, 'p0', { type: 'PLAY', card, target: 'p1', color: 'darkblue' });
    expect([rentOf(after.players[0], 'darkblue'), names(after.players[1].props.map((x) => x.card)), after.players[1].buildings, after.winner]).toEqual([11, ['Kentucky Avenue'], [], 'p0']);
  });
});

describe('Just Say No', () => {
  const start = (attacker: string[], victim: string[]) => {
    const s = table([{ hand: ['sly-deal', ...attacker] }, { hand: victim, props: ['Boardwalk'] }]);
    return act(s, 'p0', { type: 'PLAY', card: inHand(s, 0, 'sly-deal'), target: 'p1', take: onTable(s, 1, 'Boardwalk') });
  };

  test('holding one, you are asked: refuse, or let the action happen', () => {
    const s = start([], ['just-say-no']);
    expect([mdKit.actor(s), s.claims.length]).toEqual(['p1', 1]);
    const refused = act(s, 'p1', { type: 'NO' });
    expect([refused.claims, refused.players[1].props.length, names(refused.discard), mdKit.actor(refused)]).toEqual([[], 1, ['Sly Deal', 'Just Say No'], 'p0']);
    const let_ = act(s, 'p1', { type: 'ACCEPT' });
    expect([let_.players[0].props.length, let_.players[1].hand.length]).toEqual([1, 1]);
  });

  test('a Just Say No can be answered with another, and that one too', () => {
    let s = act(start(['just-say-no'], ['just-say-no', 'just-say-no']), 'p1', { type: 'NO' });
    expect([mdKit.actor(s), s.nos]).toEqual(['p0', 1]);
    expect(act(s, 'p0', { type: 'ACCEPT' }).players[1].props).toHaveLength(1);
    s = act(s, 'p0', { type: 'NO' });
    expect([mdKit.actor(s), s.nos]).toEqual(['p1', 2]);
    s = act(s, 'p1', { type: 'NO' });
    expect([s.claims, s.players[1].props.length, s.plays]).toEqual([[], 1, 1]);
  });

  test('against rent on everyone it protects only the player who plays it', () => {
    let s = table([{ hand: ['Rent: Dark Blue / Green'], props: ['Park Place'] }, { hand: ['just-say-no'], bank: ['5M'] }, { bank: ['5M'] }]);
    s = act(s, 'p0', { type: 'PLAY', card: inHand(s, 0, 'Rent: Dark Blue / Green'), color: 'darkblue' });
    s = act(s, 'p1', { type: 'NO' });
    expect([bank(s, 1), mdKit.actor(s)]).toEqual([5, 'p2']);
    s = act(s, 'p2', { type: 'PAY', cards: [s.players[2].bank[0].id] });
    expect(bank(s, 0)).toBe(5);
  });

  test('it cannot be played as a card of your own turn', () => {
    const s = table([{ hand: ['just-say-no', 'double-rent'] }, {}]);
    expect(() => act(s, 'p0', { type: 'PLAY', card: inHand(s, 0, 'just-say-no') })).toThrow('answers an action');
    expect(() => act(s, 'p0', { type: 'PLAY', card: inHand(s, 0, 'double-rent') })).toThrow('with a Rent card');
    expect(() => act(s, 'p0', { type: 'NO' })).toThrow(IllegalMove);
  });
});

describe('hidden cards, leaving, the clock and a rematch', () => {
  test('hands and the draw pile are hidden; banks and properties are open', () => {
    const s = table([{ hand: ['5M'], bank: ['1M'] }, { hand: ['2M'], props: ['Boardwalk'] }]);
    const view = mdKit.redact(s, 'p0');
    expect([view.deck, view.seed, view.players[0].hand.length, view.players[1].hand, view.players[1].handCount, view.players[1].props.length]).toEqual([[], 0, 1, [], 1, 1]);
  });

  test('a player who leaves gives everything to the discard pile; the last one left wins', () => {
    const s = table([{ hand: ['5M'], bank: ['1M'] }, { props: ['Boardwalk'] }, {}]);
    const gone = mdKit.forfeit(s, 'p0');
    expect([gone.players[0].out, gone.discard.length, gone.turn, gone.phase, gone.over]).toEqual([true, 2, 1, 'draw', false]);
    expect(mdKit.forfeit(gone, 'p1')).toMatchObject({ over: true, winner: 'p2' });
  });

  test('out of time: draw, end the turn discarding the lowest cards, or pay as cheaply as possible', () => {
    expect(mdKit.timeout({ ...table([{}, {}]), phase: 'draw' })).toEqual({ type: 'DRAW' });
    const full = table([{ hand: ['1M', '10M', '5M', '5M', '4M', '4M', '4M', '3M'] }, {}]);
    expect(mdKit.timeout(full)).toEqual({ type: 'END', discard: [inHand(full, 0, '1M')] });
    let s = table([{ hand: ['debt-collector'] }, { hand: ['just-say-no'], bank: ['10M', '5M', '1M'] }]);
    s = act(s, 'p0', { type: 'PLAY', card: inHand(s, 0, 'debt-collector'), target: 'p1' });
    expect(mdKit.timeout(s)).toEqual({ type: 'PAY', cards: [s.players[1].bank[1].id] });
  });

  test('a rematch deals a new game to those who stayed, under the same rules', () => {
    const s = createMd(seats(3), 5, { setsToWin: 2, buildAnywhere: true });
    expect(() => act(s, 'p0', { type: 'REMATCH' })).toThrow('still going');
    const next = act(mdKit.end(mdKit.forfeit(s, 'p1')), 'p0', { type: 'REMATCH' });
    expect([next.players.map((p) => p.id), next.game, next.setsToWin, next.buildAnywhere, next.over]).toEqual([['p0', 'p2'], 2, 2, true, false]);
  });
});

describe('bots', () => {
  test('bots of every level finish whole games, at every table size and under every house rule', () => {
    for (let n = 2; n <= 5; n++) {
      for (const options of [{}, { setsToWin: 4, buildAnywhere: true, oneDouble: true }, { setsToWin: 2 }]) {
        for (let seed = 1; seed <= 8; seed++) {
          const s = playOut(Array.from({ length: n }, (_, i) => ['easy', 'normal', 'hard'][(i + seed) % 3]), seed * 17 + n, options);
          expect(s.over, `seed ${seed}, ${n} players`).toBe(true);
          expect(completeColors(s.players.find((p) => p.id === s.winner)!).length).toBeGreaterThanOrEqual(s.setsToWin);
          // No card is ever lost or made: all 106 are somewhere.
          const held = s.players.reduce((sum, p) => sum + p.hand.length + p.bank.length + p.props.length + p.buildings.length, 0);
          expect(held + s.deck.length + s.discard.length).toBe(106);
        }
      }
    }
  });

  test('a stronger level wins more often: easy, then normal, then hard', () => {
    const winRate = (strong: string, weak: string) => {
      let wins = 0;
      const games = 240;
      for (let seed = 1; seed <= games; seed++) {
        const levels = [weak, weak, weak, weak];
        levels[seed % 4] = strong;
        if (playOut(levels, seed).winner === `p${seed % 4}`) wins++;
      }
      return wins / games;
    };
    // One player among three of the level below: an even field would win 25%.
    expect(winRate('normal', 'easy')).toBeGreaterThan(0.34);
    expect(winRate('hard', 'normal')).toBeGreaterThan(0.32);
  });
});
