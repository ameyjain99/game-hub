// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { GameScreen } from '../../src/games/ticket-to-ride/ui/GameScreen';
import { makeState } from '../ai/helpers';
import type { GameState } from '../../src/games/ticket-to-ride/engine/types';

afterEach(cleanup);

/** Two humans (Alice=p0, Bob=p1) mid-game, with `current` to move. */
function humansTurn(current: number): GameState {
  const base = makeState({ players: 2 });
  return {
    ...base,
    current,
    players: base.players.map((p, i) => ({
      ...p,
      isAI: false,
      name: i === 0 ? 'Alice' : 'Bob',
      pendingTickets: [],
    })),
  };
}

const deckBtn = () => screen.getByTitle('Draw a face-down train card') as HTMLButtonElement;

test('with viewerId, shows that players hand even when it is not their turn', () => {
  render(<GameScreen state={humansTurn(1)} lastError={null} dispatch={vi.fn()} viewerId="p0" />);
  expect(screen.getByText("Alice's cards")).toBeTruthy(); // viewer's own hand, not Bob's
  expect(deckBtn().disabled).toBe(true); // can't act on someone else's turn
});

test('with viewerId, enables actions only on the viewers turn', () => {
  render(<GameScreen state={humansTurn(0)} lastError={null} dispatch={vi.fn()} viewerId="p0" />);
  expect(screen.getByText("Alice's cards")).toBeTruthy();
  expect(deckBtn().disabled).toBe(false); // the viewer may draw on their own turn
});
