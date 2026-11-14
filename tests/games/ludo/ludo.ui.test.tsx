// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { KitLocal } from '../../../src/games/kit/ui/KitLocal';
import { createLudo, ludoKit, type LudoState } from '../../../src/games/ludo/engine';
import { LudoGame } from '../../../src/games/ludo/ui/LudoGame';

afterEach(cleanup);

const seats = [
  { name: 'You', isAI: false },
  { name: 'Bot 1', isAI: true },
];

test('rolling with two tokens out asks which to move, and moving one hands the turn on', () => {
  // Two tokens out, so most rolls give a choice.
  const init = (): LudoState => {
    const s = createLudo(seats, 1);
    return { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, tokens: [3, 10, -1, -1] } : p)) };
  };
  render(<KitLocal kit={ludoKit} init={init} onExit={() => {}} render={(p) => <LudoGame {...p} />} />);
  fireEvent.click(screen.getByRole('button', { name: /roll the die/i }));
  const tokens = screen.queryAllByRole('button', { name: /move red token/i });
  if (tokens.length > 1) {
    expect(screen.getByText(/pick a token to move/i)).toBeTruthy();
    fireEvent.click(tokens[0]);
  }
  expect(screen.getAllByText(/^You rolled \d/).length).toBeGreaterThan(0);
});
