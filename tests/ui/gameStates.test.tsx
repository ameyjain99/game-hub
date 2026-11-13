// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMonopolyGame, type MonopolyState } from '../../src/games/monopoly/engine/state';
import { MonopolyCenter } from '../../src/games/monopoly/ui/MonopolyCenter';
import { createCluedoGame, type CluedoState } from '../../src/games/cluedo/engine/state';
import { redactFor } from '../../src/games/cluedo/engine/redact';
import { CluedoActions } from '../../src/games/cluedo/ui/CluedoActions';

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
  expect((screen.getByRole('button', { name: /pay \$50/i }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: /roll for doubles/i }));
  expect(onAction).toHaveBeenCalledWith({ type: 'ROLL_JAIL' });
});

test('Monopoly: a shortfall offers bankruptcy and explains how to raise cash', () => {
  const g = mono();
  g.phase = 'action';
  g.players[0].cash = -40;
  g.pendingDebt = { debtor: 0, creditor: 1 };
  center(g);
  expect(screen.getByText(/you owe \$40 more/i)).toBeTruthy();
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
  expect(screen.getByText(/bot 1’s turn/i)).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});

const clNames = (id: string) => ({ a: 'Amey', b: 'Bot 1', c: 'Bot 2' })[id] ?? id;

function cluedoAt(over: Partial<CluedoState>): CluedoState {
  return { ...createCluedoGame(['a', 'b', 'c'], { seed: 3 }), ...over };
}

test('Cluedo: the disprover picks from only their matching cards', () => {
  const base = cluedoAt({});
  const matching = base.players[0].hand[0];
  const s: CluedoState = {
    ...base,
    current: 1,
    phase: 'disprove',
    pendingDisprover: 'a',
    pendingSuggestion: { suspect: 'Mr Green', weapon: 'Rope', room: 'Hall', [typeOfCard(matching)]: matching } as CluedoState['pendingSuggestion'],
  };
  const onAction = vi.fn();
  render(<CluedoActions view={redactFor(s, 'a')} meId="a" nameFor={clNames} onAction={onAction} onExit={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(matching) }));
  expect(onAction).toHaveBeenCalledWith({ type: 'disprove', card: matching });
});

test('Cluedo: the answer is shown to everyone when the case closes', () => {
  const s = cluedoAt({ phase: 'over', winner: 'b' });
  render(<CluedoActions view={redactFor(s, 'a')} meId="a" nameFor={clNames} onAction={() => {}} onExit={() => {}} />);
  expect(screen.getByText(/bot 1 solved it/i)).toBeTruthy();
  expect(screen.getByText(new RegExp(`It was ${s.solution.suspect}`))).toBeTruthy();
});

test('Cluedo: accusing asks for confirmation before eliminating anyone', () => {
  const base = cluedoAt({});
  const s: CluedoState = { ...base, phase: 'decide', players: base.players.map((p, i) => (i === 0 ? { ...p, room: 'Kitchen' } : p)) };
  const onAction = vi.fn();
  render(<CluedoActions view={redactFor(s, 'a')} meId="a" nameFor={clNames} onAction={onAction} onExit={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /make an accusation/i }));
  expect(screen.getByRole('dialog', { name: /make an accusation/i })).toBeTruthy();
  expect(onAction).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /^accuse$/i }));
  expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'accuse' }));
});

/** Which slot of a suggestion a card fills. */
function typeOfCard(card: string): 'suspect' | 'weapon' | 'room' {
  const suspects = ['Miss Scarlett', 'Colonel Mustard', 'Mrs White', 'Mr Green', 'Mrs Peacock', 'Professor Plum'];
  const weapons = ['Candlestick', 'Dagger', 'Lead Pipe', 'Revolver', 'Rope', 'Spanner'];
  return suspects.includes(card) ? 'suspect' : weapons.includes(card) ? 'weapon' : 'room';
}
