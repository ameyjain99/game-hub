import { expect, test } from 'vitest';
import { freshEvents } from '../../src/shared/ui/TableMoment';
import { createMonopolyGame } from '../../src/games/monopoly/engine/state';
import { monopolyMoments } from '../../src/games/monopoly/ui/MonopolyGame';
import { createUno, type UnoState } from '../../src/games/uno/engine';
import { unoMoments } from '../../src/games/uno/ui/UnoGame';

const who = (id: string) => (id === 'p0' ? 'You' : `Bot ${id.slice(1)}`);
const color = () => '#fff';
const titles = (list: { kicker?: unknown; title: unknown }[]) => list.map((m) => `${m.kicker ?? ''}: ${m.title}`);

test('freshEvents returns only what is new, oldest first, whatever order the log is kept in', () => {
  const e = (seq: number) => ({ seq });
  expect(freshEvents([e(2), e(1)], [e(4), e(3), e(2), e(1)])).toEqual([e(3), e(4)]);
  expect(freshEvents([e(1), e(2)], [e(1), e(2)])).toEqual([]);
  // A new game restarts the count: nothing from the old one is replayed.
  expect(freshEvents([e(9)], [e(1)])).toEqual([]);
});

test('Monopoly announces jail, a bankruptcy, a hotel and a heavy rent, and nothing for an ordinary turn', () => {
  const seats = [0, 1].map((i) => ({ name: `P${i}`, avatar: '', isAI: false, difficulty: 'normal' as const }));
  const base = createMonopolyGame(seats, 1, {});
  expect(monopolyMoments(base, structuredClone(base), who, color)).toEqual([]);

  const next = structuredClone(base);
  next.players[1].inJail = true;
  next.ownership[1] = { owner: 'p0', houses: 5, mortgaged: false };
  next.log.push('{p1} paid $40 rent to {p0}', '{p1} paid $450 rent to {p0}');
  expect(titles(monopolyMoments(base, next, who, color))).toEqual([
    'Bot 1: goes to jail',
    expect.stringMatching(/^You: built a hotel on /),
    'Bot 1: pays $450 rent',
  ]);

  const bust = structuredClone(base);
  bust.players[0].bankrupt = true;
  expect(titles(monopolyMoments(base, bust, who, color))).toEqual(['You: are bankrupt']);
});

test('Uno announces a colour choice, a call and a catch, but not an ordinary card', () => {
  const base = createUno([{ name: 'A', isAI: false }, { name: 'B', isAI: false }], 3, { variant: 'classic' });
  const wild = { id: 900, light: { kind: 'wild' as const, color: null }, dark: null };
  const plain = { id: 901, light: { kind: 'number' as const, color: 'red' as const, value: 4 }, dark: null };
  const after = (events: Omit<UnoState['history'][number], 'seq'>[]): UnoState => {
    const history = events.map((e, i) => ({ ...e, seq: (base.last?.seq ?? 0) + i + 1 })).reverse();
    return { ...base, history: [...history, ...base.history], last: history[0] };
  };
  expect(unoMoments(base, after([{ player: 'p1', kind: 'play', card: plain }]), who, color)).toEqual([]);
  expect(
    titles(
      unoMoments(
        base,
        after([
          { player: 'p1', kind: 'play', card: wild, color: 'blue' },
          { player: 'p1', kind: 'call' },
          { player: 'p0', kind: 'catch', target: 'p1', count: 2 },
        ]),
        who,
        color,
      ),
    ),
  ).toEqual(['Bot 1: chose Blue', 'Bot 1: "UNO!"', "You caught Bot 1: Didn't call UNO!"]);
});
