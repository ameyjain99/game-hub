import { expect, test } from 'vitest';
import { firstDisprover } from '../../../src/games/cluedo/engine/suggestion';
import type { Card } from '../../../src/games/cluedo/engine/cards';

const players = ['p1', 'p2', 'p3', 'p4'];

test('the first player clockwise from the suggester who holds a suggested card disproves', () => {
  const hands: Record<string, Card[]> = {
    p1: [],
    p2: ['Rope'], // no match
    p3: ['Professor Plum'], // matches the suspect
    p4: ['Kitchen'], // matches the room, but p3 comes first
  };
  const res = firstDisprover(
    players,
    'p1',
    { suspect: 'Professor Plum', weapon: 'Revolver', room: 'Kitchen' },
    hands,
  );
  expect(res).toEqual({ playerId: 'p3', matches: ['Professor Plum'] });
});

test('disprove order wraps past the end of the list and never uses the suggester', () => {
  const hands: Record<string, Card[]> = {
    p1: ['Kitchen'], // the suggester's own card is never used to disprove
    p2: [],
    p3: [],
    p4: ['Kitchen'],
  };
  // suggester p2 → order p3, p4, p1; p4 is the first holder
  const res = firstDisprover(
    players,
    'p2',
    { suspect: 'Mrs White', weapon: 'Dagger', room: 'Kitchen' },
    hands,
  );
  expect(res?.playerId).toBe('p4');
});

test('nobody can disprove when no other player holds any suggested card', () => {
  const hands: Record<string, Card[]> = {
    p1: ['Rope'],
    p2: ['Lounge'],
    p3: ['Mr Green'],
    p4: ['Hall'],
  };
  const res = firstDisprover(
    players,
    'p1',
    { suspect: 'Professor Plum', weapon: 'Revolver', room: 'Kitchen' },
    hands,
  );
  expect(res).toBeNull();
});

test('a disprover holding several suggested cards reports all of them', () => {
  const hands: Record<string, Card[]> = {
    p1: [],
    p2: ['Professor Plum', 'Kitchen', 'Rope'],
    p3: [],
    p4: [],
  };
  const res = firstDisprover(
    players,
    'p1',
    { suspect: 'Professor Plum', weapon: 'Revolver', room: 'Kitchen' },
    hands,
  );
  expect(res?.matches.slice().sort()).toEqual(['Kitchen', 'Professor Plum']);
});
