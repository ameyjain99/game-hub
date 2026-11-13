import { expect, test } from 'vitest';
import { notebookFacts } from '../../../src/games/cluedo/engine/deduction';
import type { RedactedCluedoState } from '../../../src/games/cluedo/engine/redact';

function view(over: Partial<RedactedCluedoState> = {}): RedactedCluedoState {
  return {
    you: 'p1',
    players: [
      { id: 'p1', suspect: 'Miss Scarlett', room: null, eliminated: false, isAI: false, handCount: 2, hand: ['Rope', 'Hall'] },
      { id: 'p2', suspect: 'Colonel Mustard', room: null, eliminated: false, isAI: true, handCount: 2 },
      { id: 'p3', suspect: 'Mrs White', room: null, eliminated: false, isAI: true, handCount: 2 },
    ],
    current: 0,
    phase: 'decide',
    weaponRooms: { Candlestick: 'Ballroom', Dagger: 'Hall', 'Lead Pipe': 'Library', Revolver: 'Lounge', Rope: 'Conservatory', Spanner: 'Dining Room' },
    moveOptions: [],
    pendingSuggestion: null,
    pendingDisprover: null,
    lastReveal: null,
    history: [],
    winner: null,
    solution: null,
    ...over,
  };
}

test('your own hand counts as known, and is ruled out of the solution', () => {
  const f = notebookFacts(view());
  expect(f.knownByPlayer.p1).toEqual(['Rope', 'Hall']);
  expect(f.stillPossible.rooms).not.toContain('Hall');
  expect(f.stillPossible.weapons).not.toContain('Rope');
});

test('a card shown to you is attributed to the disprover and ruled out', () => {
  const f = notebookFacts(
    view({
      history: [
        { suggester: 'p1', suggestion: { suspect: 'Professor Plum', weapon: 'Revolver', room: 'Kitchen' }, disprover: 'p2', card: 'Revolver' },
      ],
    }),
  );
  expect(f.knownByPlayer.p2).toEqual(['Revolver']);
  expect(f.stillPossible.weapons).not.toContain('Revolver');
});

test('cards hidden from you (no card revealed) stay possible', () => {
  const f = notebookFacts(
    view({
      history: [
        { suggester: 'p2', suggestion: { suspect: 'Professor Plum', weapon: 'Candlestick', room: 'Study' }, disprover: 'p3', card: null },
      ],
    }),
  );
  // You didn't see the card, so nothing new is known and all three stay possible.
  expect(f.knownByPlayer.p3).toBeUndefined();
  expect(f.stillPossible.suspects).toContain('Professor Plum');
  expect(f.stillPossible.rooms).toContain('Study');
});
