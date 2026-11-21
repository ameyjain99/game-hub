// The boards a game can be played on: the same squares and prices, other places.
import { expect, test } from 'vitest';
import { BOARD, BOARDS, OWNABLE_IDS, boardOf, spaceFlag, spaceName } from '../../../src/games/monopoly/engine/board';
import { CHANCE, cardText } from '../../../src/games/monopoly/engine/cards';
import { createMonopolyGame } from '../../../src/games/monopoly/engine/state';
import { applyAction } from '../../../src/games/monopoly/engine/reducer';
import { chooseMonopolyAction } from '../../../src/games/monopoly/engine/bot';

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, avatar: '', isAI: true, difficulty: 'normal' as const }));

test('every board names all 28 lots, stations and utilities, each once, in plain ASCII', () => {
  expect(BOARDS.map((b) => b.id)).toEqual(['hasbro', 'classic', 'neo', 'world', 'nations', 'india']);
  for (const b of BOARDS) expect(b.name.length).toBeLessThanOrEqual(8); // short enough for a picker
  for (const { id } of BOARDS) {
    const names = OWNABLE_IDS.map((sq) => spaceName(sq, id));
    expect(new Set(names).size).toBe(28);
    for (const n of names) expect(n).toMatch(/^[A-Za-z .']+$/);
  }
});

test('the Neo board keeps its names, and the others differ on every lot', () => {
  for (const sp of BOARD) expect(spaceName(sp.id, 'neo')).toBe(sp.name);
  for (const sq of OWNABLE_IDS.filter((x) => BOARD[x].kind === 'property')) {
    expect(spaceName(sq, 'world')).not.toBe(BOARD[sq].name);
    expect(spaceName(sq, 'india')).not.toBe(spaceName(sq, 'world'));
  }
  expect(spaceName(39, 'world')).toBe('New York');
  expect(spaceName(39, 'india')).toBe('Mumbai');
  expect(spaceName(0, 'india')).toBe('Go');
  expect(spaceName(39, 'hasbro')).toBe('Montreal');
  expect(spaceName(39, 'classic')).toBe('New York');
});

test('on the Nations board every colour set is one country, with its flag, and the stations are airports', () => {
  const lots = BOARD.filter((sp) => sp.kind === 'property');
  const byGroup = new Map<string, Set<string>>();
  for (const sp of lots) byGroup.set(sp.group!, new Set([...(byGroup.get(sp.group!) ?? []), spaceFlag(sp.id, 'nations')!]));
  expect(byGroup.size).toBe(8);
  for (const flags of byGroup.values()) expect(flags.size).toBe(1);
  expect(new Set([...byGroup.values()].map((f) => [...f][0])).size).toBe(8);
  for (const sp of BOARD.filter((x) => x.kind === 'railroad')) expect(spaceName(sp.id, 'nations')).toMatch(/^[A-Z]{3} Airport$/);
  expect(spaceFlag(39, 'neo')).toBeNull();
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
  expect(cardText(card, 'hasbro')).toBe('Advance to Montreal.');
  expect(cardText(card, 'classic')).toBe('Advance to New York.');
  expect(cardText(card, 'world')).toBe('Advance to New York.');
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
