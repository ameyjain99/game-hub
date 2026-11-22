// The boards a game can be played on: their order, names, money and square names.
import { expect, test } from 'vitest';
import { BOARD, BOARDS, MONOPOLY_MONEY, OWNABLE_IDS, boardCurrency, boardOf, isMega, ownableIds, spaceFlag, spaceName, stationWord } from '../../../src/games/monopoly/engine/board';
import { CHANCE, cardText } from '../../../src/games/monopoly/engine/cards';
import { createMonopolyGame } from '../../../src/games/monopoly/engine/state';
import { applyAction } from '../../../src/games/monopoly/engine/reducer';
import { chooseMonopolyAction } from '../../../src/games/monopoly/engine/bot';

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, avatar: '', isAI: true, difficulty: 'normal' as const }));

test('the published editions come first, then our own four, and every board names each of its lots once', () => {
  expect(BOARDS.map((b) => b.id)).toEqual(['world2008', 'world2015', 'us', 'uk', 'india', 'europe', 'megaUs', 'megaUk', 'classic', 'neo', 'world', 'nations']);
  for (const b of BOARDS) expect(b.name.length).toBeLessThanOrEqual(12); // short enough for a picker
  for (const { id } of BOARDS) {
    const names = ownableIds(id).map((sq) => spaceName(sq, id));
    expect(new Set(names).size, id).toBe(isMega(id) ? 37 : 28);
    // Letters (accented ones too), spaces and plain punctuation: no curly quotes or long dashes.
    for (const n of names) expect(n).toMatch(/^[\p{L} .,'&()-]+$/u);
  }
});

test('the Neo board keeps its names, and the others differ on every lot', () => {
  for (const sp of BOARD) expect(spaceName(sp.id, 'neo')).toBe(sp.name);
  for (const sq of OWNABLE_IDS.filter((x) => BOARD[x].kind === 'property')) {
    expect(spaceName(sq, 'world')).not.toBe(BOARD[sq].name);
    expect(spaceName(sq, 'india')).not.toBe(spaceName(sq, 'world'));
    expect(spaceName(sq, 'us')).not.toBe(spaceName(sq, 'uk'));
  }
  expect(spaceName(39, 'world')).toBe('New York');
  expect(spaceName(0, 'india')).toBe('Go');
  expect(spaceName(39, 'classic')).toBe('New York');
});

test('the standard editions follow their printed boards, square names included', () => {
  expect([1, 5, 12, 28, 38, 39].map((sq) => spaceName(sq, 'us'))).toEqual(['Mediterranean Avenue', 'Reading Railroad', 'Electric Company', 'Water Works', 'Luxury Tax', 'Boardwalk']);
  expect([1, 5, 6, 25, 38, 39].map((sq) => spaceName(sq, 'uk'))).toEqual(['Old Kent Road', "King's Cross Station", 'The Angel, Islington', 'Fenchurch Street Station', 'Super Tax', 'Mayfair']);
  expect([1, 3, 5, 6, 35, 37, 39].map((sq) => spaceName(sq, 'india'))).toEqual(['Guwahati', 'Bhubaneshwar', 'Chennai Central Railway Station', 'Panaji (Goa)', 'Chhatrapati Shivaji Terminus', 'Delhi', 'Mumbai']);
  expect([1, 5, 9, 18, 32, 39].map((sq) => spaceName(sq, 'europe'))).toEqual(['Strandvejen', 'Luxembourg Airport', 'Grand-Place', 'Gran Vía', 'Avenue des Champs-Élysées', 'Kurfürstendamm']);
  expect([1, 5, 12, 28, 37, 39].map((sq) => spaceName(sq, 'world2008'))).toEqual(['Gdynia', 'Monopoly Rail', 'Solar Energy', 'Wind Energy', 'Riga', 'Montreal']);
  expect([1, 3, 37, 39].map((sq) => spaceName(sq, 'world2015'))).toEqual(['Madrid', 'Giethoorn', 'Hong Kong', 'Lima']);
});

test('each board has its own money and its own word for the four transport squares', () => {
  // Rupees in India, pounds on the European boards, dollars on the US ones, Monopoly money where countries mix.
  const M = MONOPOLY_MONEY;
  expect(BOARDS.map((b) => boardCurrency(b.id))).toEqual([M, M, '$', '£', '₹', '£', '$', '£', M, M, M, M]);
  expect([stationWord('us'), stationWord('uk'), stationWord('europe'), stationWord('world2008'), stationWord('neo')]).toEqual(['Railroad', 'Station', 'Airport', 'Transport', 'Station']);
  const nearest = CHANCE.find((c) => c.id === 'ch-rail1')!;
  expect([cardText(nearest, 'us'), cardText(nearest, 'europe'), cardText(nearest)]).toEqual(['Advance to the nearest Railroad.', 'Advance to the nearest Airport.', 'Advance to the nearest Station.']);
});

test('on the Nations, Classic and Europe boards every colour set is one country, with its flag', () => {
  const lots = BOARD.filter((sp) => sp.kind === 'property');
  for (const board of ['nations', 'classic', 'europe'] as const) {
    const byGroup = new Map<string, Set<string>>();
    for (const sp of lots) byGroup.set(sp.group!, new Set([...(byGroup.get(sp.group!) ?? []), spaceFlag(sp.id, board)!]));
    expect(byGroup.size).toBe(8);
    for (const flags of byGroup.values()) expect(flags.size).toBe(1);
    expect(new Set([...byGroup.values()].map((f) => [...f][0])).size, board).toBe(8);
  }
  for (const board of ['nations', 'europe'] as const) for (const sp of BOARD.filter((x) => x.kind === 'railroad')) expect(spaceName(sp.id, board)).toMatch(/Airport$/);
  expect(spaceFlag(39, 'neo')).toBeNull();
  expect(spaceFlag(39, 'us')).toBeNull();
  expect(spaceFlag(5, 'nations')).toBeNull();
  expect([spaceName(34, 'nations'), spaceName(39, 'nations')]).toEqual(['London', 'New York']);
});

test('an unknown board falls back to Neo', () => {
  expect(boardOf('atlantis')).toBe('neo');
  expect(boardOf(undefined)).toBe('neo');
  expect(boardOf('india')).toBe('india');
  expect(createMonopolyGame(seats(2), 3, { board: 'atlantis' as never }).settings.board).toBe('neo');
});

test('cards that send you somewhere name the place on the board in play', () => {
  const card = CHANCE.find((c) => c.id === 'ch-boardwalk')!;
  expect(cardText(card, 'neo')).toBe('Advance to Tokyo.');
  expect(cardText(card, 'world2008')).toBe('Advance to Montreal.');
  expect(cardText(card, 'us')).toBe('Advance to Boardwalk.');
  expect(cardText(card, 'uk')).toBe('Advance to Mayfair.');
  expect(cardText(card, 'classic')).toBe('Advance to New York.');
  expect(cardText(card, 'india')).toBe('Advance to Mumbai.');
});

test('a game on the India board talks about Indian cities, never the Neo ones', () => {
  let s = createMonopolyGame(seats(3), 5, { board: 'india', roundLimit: 6, randomizeOrder: false });
  for (let i = 0; i < 20_000 && s.phase !== 'over'; i++) s = applyAction(s, chooseMonopolyAction(s));
  const log = s.log.join('\n');
  const neoOnly = OWNABLE_IDS.map((sq) => BOARD[sq].name).filter((n) => !OWNABLE_IDS.some((sq) => spaceName(sq, 'india') === n));
  for (const n of neoOnly) expect(log).not.toContain(n);
  expect(OWNABLE_IDS.some((sq) => log.includes(`bought ${spaceName(sq, 'india')}`))).toBe(true);
});
