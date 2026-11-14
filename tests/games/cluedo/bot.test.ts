import { expect, test } from 'vitest';
import { createCluedoGame, type CluedoState } from '../../../src/games/cluedo/engine/state';
import { reduce } from '../../../src/games/cluedo/engine/reducer';
import { chooseCluedoAction } from '../../../src/games/cluedo/engine/bot';

test('the bot rolls when it is time to roll', () => {
  const g = createCluedoGame(['p1', 'p2', 'p3'], { seed: 1 });
  expect(chooseCluedoAction(g)).toEqual({ type: 'roll' });
});

test('the bot moves to one of the offered rooms', () => {
  const g = reduce(createCluedoGame(['p1', 'p2', 'p3'], { seed: 1 }), { type: 'roll' });
  const a = chooseCluedoAction(g);
  expect(a.type).toBe('move');
  if (a.type === 'move') expect(g.moveOptions).toContain(a.room);
});

test('the bot makes a legal suggestion, then ends its turn', () => {
  let g = createCluedoGame(['p1', 'p2', 'p3'], { seed: 1 });
  g = reduce(g, { type: 'roll' });
  g = reduce(g, chooseCluedoAction(g)); // move
  expect(g.phase).toBe('decide');

  const suggestion = chooseCluedoAction(g);
  expect(suggestion.type).toBe('suggest');
  g = reduce(g, suggestion);
  if (g.phase === 'disprove') g = reduce(g, chooseCluedoAction(g)); // a bot disproves
  expect(g.phase).toBe('decide');
  // After its one suggestion it ends the turn – unless that suggestion already
  // revealed the whole solution, in which case it (correctly) accuses.
  expect(['endTurn', 'accuse']).toContain(chooseCluedoAction(g).type);
});

test('the bot disproves with a card it actually holds', () => {
  const s: CluedoState = {
    players: [
      { id: 'p1', suspect: 'Miss Scarlett', room: 'Kitchen', hand: [], eliminated: false, isAI: false },
      { id: 'p2', suspect: 'Colonel Mustard', room: null, hand: ['Revolver', 'Hall'], eliminated: false, isAI: true },
      { id: 'p3', suspect: 'Mrs White', room: null, hand: [], eliminated: false, isAI: true },
    ],
    current: 0,
    phase: 'disprove',
    solution: { suspect: 'Professor Plum', weapon: 'Candlestick', room: 'Study' },
    weaponRooms: { Candlestick: 'Ballroom', Dagger: 'Hall', 'Lead Pipe': 'Library', Revolver: 'Lounge', Rope: 'Conservatory', Spanner: 'Dining Room' },
    moveOptions: [],
    pendingSuggestion: { suspect: 'Professor Plum', weapon: 'Revolver', room: 'Kitchen' },
    pendingDisprover: 'p2',
    lastReveal: null,
    history: [],
    winner: null,
    turn: 0,
    rngState: 1,
  };
  const a = chooseCluedoAction(s);
  expect(a).toEqual({ type: 'disprove', card: 'Revolver' });
});

function decideState(over: Partial<CluedoState> = {}): CluedoState {
  return {
    players: [
      { id: 'p1', suspect: 'Miss Scarlett', room: 'Kitchen', hand: [], eliminated: false, isAI: true },
      { id: 'p2', suspect: 'Colonel Mustard', room: null, hand: [], eliminated: false, isAI: true },
      { id: 'p3', suspect: 'Mrs White', room: null, hand: [], eliminated: false, isAI: true },
    ],
    current: 0,
    phase: 'decide',
    solution: { suspect: 'Professor Plum', weapon: 'Candlestick', room: 'Study' },
    weaponRooms: { Candlestick: 'Ballroom', Dagger: 'Hall', 'Lead Pipe': 'Library', Revolver: 'Lounge', Rope: 'Conservatory', Spanner: 'Dining Room' },
    moveOptions: [],
    pendingSuggestion: null,
    pendingDisprover: null,
    lastReveal: null,
    history: [],
    winner: null,
    turn: 0,
    rngState: 1,
    ...over,
  };
}

test('the bot accuses when its own undisproved suggestion reveals the solution', () => {
  const suggestion = { suspect: 'Professor Plum' as const, weapon: 'Candlestick' as const, room: 'Study' as const };
  const s = decideState({
    // p1 suggested the solution, no one disproved, and p1 holds none of the three.
    history: [{ suggester: 'p1', suggestion, disprover: null, card: null }],
    lastReveal: { suggester: 'p1', suggestion, disprover: null, card: null },
  });
  expect(chooseCluedoAction(s)).toEqual({ type: 'accuse', ...suggestion });
});

test('the bot accuses the sole remaining card in each category (elimination)', () => {
  // p1 holds every non-solution card, so only the solution remains unaccounted for.
  const nonSolution = [
    'Miss Scarlett', 'Colonel Mustard', 'Mrs White', 'Mr Green', 'Mrs Peacock',
    'Dagger', 'Lead Pipe', 'Revolver', 'Rope', 'Spanner',
    'Kitchen', 'Ballroom', 'Conservatory', 'Dining Room', 'Billiard Room', 'Library', 'Lounge', 'Hall',
  ] as const;
  const s = decideState({ players: [
    { id: 'p1', suspect: 'Miss Scarlett', room: 'Kitchen', hand: [...nonSolution], eliminated: false, isAI: true },
    { id: 'p2', suspect: 'Colonel Mustard', room: null, hand: [], eliminated: false, isAI: true },
    { id: 'p3', suspect: 'Mrs White', room: null, hand: [], eliminated: false, isAI: true },
  ] });
  expect(chooseCluedoAction(s)).toEqual({ type: 'accuse', suspect: 'Professor Plum', weapon: 'Candlestick', room: 'Study' });
});

test('an easy bot still accuses once the solution is certain (so all-easy games can end)', () => {
  const nonSolution = [
    'Miss Scarlett', 'Colonel Mustard', 'Mrs White', 'Mr Green', 'Mrs Peacock',
    'Dagger', 'Lead Pipe', 'Revolver', 'Rope', 'Spanner',
    'Kitchen', 'Ballroom', 'Conservatory', 'Dining Room', 'Billiard Room', 'Library', 'Lounge', 'Hall',
  ] as const;
  const s = decideState({ players: [
    { id: 'p1', suspect: 'Miss Scarlett', room: 'Kitchen', hand: [...nonSolution], eliminated: false, isAI: true, difficulty: 'easy' },
    { id: 'p2', suspect: 'Colonel Mustard', room: null, hand: [], eliminated: false, isAI: true, difficulty: 'easy' },
    { id: 'p3', suspect: 'Mrs White', room: null, hand: [], eliminated: false, isAI: true, difficulty: 'easy' },
  ] });
  expect(chooseCluedoAction(s).type).toBe('accuse');
});

test('the bot does not accuse when the solution is not yet known', () => {
  const s = decideState({ players: [
    { id: 'p1', suspect: 'Miss Scarlett', room: 'Kitchen', hand: ['Rope'], eliminated: false, isAI: true },
    { id: 'p2', suspect: 'Colonel Mustard', room: null, hand: [], eliminated: false, isAI: true },
    { id: 'p3', suspect: 'Mrs White', room: null, hand: [], eliminated: false, isAI: true },
  ] });
  expect(chooseCluedoAction(s).type).not.toBe('accuse');
});
