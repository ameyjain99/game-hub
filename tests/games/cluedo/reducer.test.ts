import { expect, test } from 'vitest';
import { createCluedoGame, type CluedoState, type CluedoPlayer } from '../../../src/games/cluedo/engine/state';
import { reduce } from '../../../src/games/cluedo/engine/reducer';
import { redactFor } from '../../../src/games/cluedo/engine/redact';
import { ROOMS } from '../../../src/games/cluedo/engine/cards';

// A fully-formed state with sensible defaults; override per test.
function baseState(over: Partial<CluedoState> = {}): CluedoState {
  const players: CluedoPlayer[] = [
    { id: 'p1', suspect: 'Miss Scarlett', room: null, hand: [], eliminated: false, isAI: false },
    { id: 'p2', suspect: 'Colonel Mustard', room: null, hand: [], eliminated: false, isAI: false },
    { id: 'p3', suspect: 'Mrs White', room: null, hand: [], eliminated: false, isAI: false },
  ];
  return {
    players,
    current: 0,
    phase: 'decide',
    solution: { suspect: 'Professor Plum', weapon: 'Revolver', room: 'Kitchen' },
    weaponRooms: {
      Candlestick: 'Ballroom',
      Dagger: 'Hall',
      'Lead Pipe': 'Library',
      Revolver: 'Lounge',
      Rope: 'Conservatory',
      Spanner: 'Dining Room',
    },
    moveOptions: [],
    pendingSuggestion: null,
    pendingDisprover: null,
    lastReveal: null,
    history: [],
    winner: null,
    turn: 0,
    rngState: 12345,
    ...over,
  };
}

test('a new game deals distinct suspects and starts on the first player to roll', () => {
  const g = createCluedoGame(['p1', 'p2', 'p3'], { seed: 1 });
  expect(g.phase).toBe('roll');
  expect(g.current).toBe(0);
  expect(new Set(g.players.map((p) => p.suspect)).size).toBe(3);
  expect(g.players.every((p) => p.room === null)).toBe(true);
  expect(new Set(Object.values(g.weaponRooms)).size).toBe(6); // each weapon a distinct room
});

test('rolling from the hallway lets you enter any room', () => {
  const r = reduce(baseState({ phase: 'roll' }), { type: 'roll' });
  expect(r.phase).toBe('move');
  expect(r.moveOptions.slice().sort()).toEqual([...ROOMS].sort());
});

test('moving enters the chosen room and lets you act', () => {
  const s = baseState({ phase: 'move', moveOptions: ['Kitchen', 'Hall'] });
  const r = reduce(s, { type: 'move', room: 'Kitchen' });
  expect(r.players[0].room).toBe('Kitchen');
  expect(r.phase).toBe('decide');
});

test('a suggestion pulls the weapon and accused suspect into the room and asks the next holder to disprove', () => {
  const s = baseState({
    players: [
      { id: 'p1', suspect: 'Miss Scarlett', room: 'Kitchen', hand: [], eliminated: false, isAI: false },
      { id: 'p2', suspect: 'Colonel Mustard', room: null, hand: ['Revolver'], eliminated: false, isAI: false },
      { id: 'p3', suspect: 'Professor Plum', room: null, hand: [], eliminated: false, isAI: false },
    ],
  });
  const r = reduce(s, { type: 'suggest', suspect: 'Professor Plum', weapon: 'Revolver' });
  expect(r.weaponRooms.Revolver).toBe('Kitchen');
  expect(r.players[2].room).toBe('Kitchen'); // p3 plays Plum → pulled in
  expect(r.phase).toBe('disprove');
  expect(r.pendingDisprover).toBe('p2');
  expect(r.pendingSuggestion).toEqual({ suspect: 'Professor Plum', weapon: 'Revolver', room: 'Kitchen' });
});

test('a suggestion no one can disprove records an empty reveal and returns to the decision', () => {
  const s = baseState({
    players: [
      { id: 'p1', suspect: 'Miss Scarlett', room: 'Kitchen', hand: [], eliminated: false, isAI: false },
      { id: 'p2', suspect: 'Colonel Mustard', room: null, hand: ['Rope'], eliminated: false, isAI: false },
      { id: 'p3', suspect: 'Mrs White', room: null, hand: ['Hall'], eliminated: false, isAI: false },
    ],
  });
  const r = reduce(s, { type: 'suggest', suspect: 'Professor Plum', weapon: 'Revolver' });
  expect(r.phase).toBe('decide');
  expect(r.lastReveal).toEqual({
    suggester: 'p1',
    suggestion: { suspect: 'Professor Plum', weapon: 'Revolver', room: 'Kitchen' },
    disprover: null,
    card: null,
  });
});

test('disproving records the shown card and returns to the decision', () => {
  const suggestion = { suspect: 'Professor Plum' as const, weapon: 'Revolver' as const, room: 'Kitchen' as const };
  const s = baseState({
    phase: 'disprove',
    pendingSuggestion: suggestion,
    pendingDisprover: 'p2',
    players: [
      { id: 'p1', suspect: 'Miss Scarlett', room: 'Kitchen', hand: [], eliminated: false, isAI: false },
      { id: 'p2', suspect: 'Colonel Mustard', room: null, hand: ['Revolver'], eliminated: false, isAI: false },
      { id: 'p3', suspect: 'Mrs White', room: null, hand: [], eliminated: false, isAI: false },
    ],
  });
  const r = reduce(s, { type: 'disprove', card: 'Revolver' });
  expect(r.phase).toBe('decide');
  expect(r.lastReveal).toEqual({ suggester: 'p1', suggestion, disprover: 'p2', card: 'Revolver' });
  expect(r.pendingDisprover).toBeNull();
});

test('a correct accusation wins the game', () => {
  const r = reduce(baseState(), { type: 'accuse', suspect: 'Professor Plum', weapon: 'Revolver', room: 'Kitchen' });
  expect(r.phase).toBe('over');
  expect(r.winner).toBe('p1');
});

test('a wrong accusation eliminates the player and passes the turn', () => {
  const r = reduce(baseState(), { type: 'accuse', suspect: 'Mrs White', weapon: 'Revolver', room: 'Kitchen' });
  expect(r.players[0].eliminated).toBe(true);
  expect(r.winner).toBeNull();
  expect(r.phase).toBe('roll');
  expect(r.current).toBe(1);
});

test('ending a turn advances past eliminated players', () => {
  const s = baseState();
  s.players[1].eliminated = true;
  const r = reduce(s, { type: 'endTurn' });
  expect(r.current).toBe(2);
  expect(r.phase).toBe('roll');
});

test('redaction hides the solution and other hands but keeps your own', () => {
  const s = baseState({
    players: [
      { id: 'p1', suspect: 'Miss Scarlett', room: null, hand: ['Rope', 'Hall'], eliminated: false, isAI: false },
      { id: 'p2', suspect: 'Colonel Mustard', room: null, hand: ['Revolver', 'Kitchen'], eliminated: false, isAI: false },
      { id: 'p3', suspect: 'Mrs White', room: null, hand: ['Dagger'], eliminated: false, isAI: false },
    ],
  });
  const v = redactFor(s, 'p1');
  expect(v.solution).toBeNull(); // only revealed once the game is over
  expect(v.players.find((p) => p.id === 'p1')!.hand).toEqual(['Rope', 'Hall']);
  const other = v.players.find((p) => p.id === 'p2')!;
  expect(other.hand).toBeUndefined();
  expect(other.handCount).toBe(2);
});

test('only the suggester and disprover see which card was shown', () => {
  const s = baseState({
    lastReveal: {
      suggester: 'p1',
      suggestion: { suspect: 'Professor Plum', weapon: 'Revolver', room: 'Kitchen' },
      disprover: 'p2',
      card: 'Revolver',
    },
  });
  expect(redactFor(s, 'p1').lastReveal!.card).toBe('Revolver');
  expect(redactFor(s, 'p2').lastReveal!.card).toBe('Revolver');
  expect(redactFor(s, 'p3').lastReveal!.card).toBeNull();
});
