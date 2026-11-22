// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMonopolyGame, type MonopolyState } from '../../src/games/monopoly/engine/state';
import { MonopolyCenter } from '../../src/games/monopoly/ui/MonopolyCenter';

afterEach(cleanup);

function mono(): MonopolyState {
  return createMonopolyGame(
    [
      { avatar: '', isAI: false, name: 'Amey' },
      { avatar: '', isAI: true, name: 'Bot 1' },
    ],
    1,
    { randomizeOrder: false },
  );
}

const monoNames = (id: string) => (id === 'p0' ? 'Amey' : 'Bot 1');

function center(view: MonopolyState, onAction = vi.fn()) {
  render(
    <MonopolyCenter
      view={view}
      meId="p0"
      onAction={onAction}
      nameFor={monoNames}
      inspected={null}
      onCloseInspect={() => {}}
      onOpenTrade={() => {}}
      onExit={() => {}}
    />,
  );
  return onAction;
}

test('Monopoly: a jailed player gets roll / pay choices, pay disabled when broke', () => {
  const g = mono();
  g.phase = 'jail';
  g.players[0].inJail = true;
  g.players[0].cash = 30;
  const onAction = center(g);
  expect((screen.getByRole('button', { name: /pay ₥50/i }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: /roll for doubles/i }));
  expect(onAction).toHaveBeenCalledWith({ type: 'ROLL_JAIL' });
});

test('Monopoly: a shortfall offers bankruptcy and explains how to raise cash', () => {
  const g = mono();
  g.phase = 'action';
  g.players[0].cash = -40;
  g.pendingDebt = { debtor: 0, creditor: 1 };
  center(g);
  expect(screen.getByText(/you owe ₥40 more/i)).toBeTruthy();
  expect(screen.getByRole('button', { name: /declare bankruptcy/i })).toBeTruthy();
});

test('Monopoly: game over names the winner and ranks survivors', () => {
  const g = mono();
  g.phase = 'over';
  g.winner = 'p1';
  center(g);
  expect(screen.getByText(/bot 1 wins/i)).toBeTruthy();
  expect(screen.getByRole('button', { name: /back to games/i })).toBeTruthy();
});

test('Monopoly: while another player moves, there is no stray action button', () => {
  const g = mono();
  g.current = 1;
  center(g);
  expect(screen.getByText(/bot 1's turn/i)).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});
