import { expect, test } from 'vitest';
import { advanceAi } from '../../src/games/ticket-to-ride/ai/driver';
import { aiActor } from '../../src/games/ticket-to-ride/engine/selectors';
import { createGame } from '../../src/games/ticket-to-ride/engine/setup';
import type { GameState } from '../../src/games/ticket-to-ride/engine/types';

const humanVsBot = (): GameState =>
  createGame(
    [
      { name: 'Human', isAI: false },
      { name: 'Bot', isAI: true, difficulty: 'normal' },
    ],
    42,
  );

test('advanceAi plays all AI setup picks and AI turns until a human must act', () => {
  const out = advanceAi(humanVsBot());
  expect(aiActor(out)).toBeNull(); // no AI left to act
  // the human is now the one to move (or the game is over)
  expect(out.phase === 'game-over' || !out.players[out.current].isAI).toBe(true);
});

test('advanceAi is a no-op when a human must act', () => {
  const base = humanVsBot();
  const state: GameState = {
    ...base,
    phase: 'turn',
    current: 0,
    players: base.players.map((p) => ({ ...p, pendingTickets: [] })),
  };
  expect(advanceAi(state)).toBe(state);
});
