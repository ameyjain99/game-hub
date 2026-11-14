// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Dice } from '../../src/games/monopoly/ui/Dice';
import { MonopolyBoard } from '../../src/games/monopoly/ui/MonopolyBoard';
import { MonopolyCenter } from '../../src/games/monopoly/ui/MonopolyCenter';
import { MonopolySidebar } from '../../src/games/monopoly/ui/MonopolySidebar';
import { MonopolyGame } from '../../src/games/monopoly/ui/MonopolyGame';
import { createMonopolyGame, type MonopolyState } from '../../src/games/monopoly/engine/state';
import { applyAction } from '../../src/games/monopoly/engine/reducer';
import { BOARD } from '../../src/games/monopoly/engine/board';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const nameFor = (id: string) => (id === 'p0' ? 'You' : `Bot ${id.slice(1)}`);

/** Two seats, You first. Seed 5's first roll lands You on Seville (8), unowned. */
function game(): MonopolyState {
  return createMonopolyGame(
    [
      { avatar: '', isAI: false },
      { avatar: '', isAI: true },
    ],
    5,
    { randomizeOrder: false },
  );
}

/** You rolled and bought Seville: your move, free to manage or trade. */
function afterBuy(): MonopolyState {
  return applyAction(applyAction(game(), { type: 'ROLL' }), { type: 'BUY' });
}

const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('dice', () => {
  test('a new roll tumbles, then settles on the rolled faces', () => {
    const { container, rerender } = render(<Dice values={[2, 6]} rollKey={1} />);
    expect(container.querySelector('.mono-dice.is-rolling')).toBeNull(); // no tumble on mount
    rerender(<Dice values={[3, 4]} rollKey={2} />);
    expect(container.querySelector('.mono-dice.is-rolling')).toBeTruthy();
    tick(800);
    expect(container.querySelector('.mono-dice.is-rolling')).toBeNull();
    expect(screen.getByRole('img', { name: 'Rolled 3 and 4' })).toBeTruthy();
  });
});

describe('tokens', () => {
  const board = (view: MonopolyState) => (
    <MonopolyBoard view={view} nameFor={nameFor} actorId="p0" onInspect={() => {}}>
      <span />
    </MonopolyBoard>
  );

  test('a token walks square by square to where it landed', () => {
    const start = game();
    const { rerender } = render(board(start));
    expect(screen.getByRole('img', { name: `You on ${BOARD[0].name}` })).toBeTruthy();
    const moved = { ...start, players: start.players.map((p) => (p.id === 'p0' ? { ...p, position: 8 } : p)) };
    rerender(board(moved));
    tick(0);
    expect(screen.queryByRole('img', { name: `You on ${BOARD[8].name}` })).toBeNull(); // still walking
    tick(2000);
    expect(screen.getByRole('img', { name: `You on ${BOARD[8].name}` })).toBeTruthy();
  });

  test('a token sent to jail goes straight there', () => {
    const start = game();
    const at30 = { ...start, players: start.players.map((p) => (p.id === 'p0' ? { ...p, position: 30 } : p)) };
    const { rerender } = render(board(at30));
    const jailed = { ...at30, players: at30.players.map((p) => (p.id === 'p0' ? { ...p, position: 10, inJail: true } : p)) };
    rerender(board(jailed));
    tick(0);
    expect(screen.getByRole('img', { name: `You on ${BOARD[10].name}, in jail` })).toBeTruthy();
  });
});

describe('drawn card', () => {
  const center = (view: MonopolyState) => (
    <MonopolyCenter
      view={view}
      meId="p0"
      onAction={vi.fn()}
      nameFor={nameFor}
      inspected={null}
      onCloseInspect={() => {}}
      onOpenTrade={() => {}}
      onExit={() => {}}
    />
  );

  test('the card drawn on this roll is shown, naming who drew it', () => {
    const v = { ...afterBuy(), rollSeq: 3, lastCard: { deck: 'chance' as const, text: 'Speeding fine. Pay $15.', playerId: 'p1', atRoll: 3 } };
    render(center(v));
    const card = screen.getByRole('note', { name: /chance/i });
    expect(card.textContent).toContain('Speeding fine. Pay $15.');
    expect(card.textContent).toContain('Bot 1');
  });

  test('a card from an earlier roll is not', () => {
    const v = { ...afterBuy(), rollSeq: 4, lastCard: { deck: 'chest' as const, text: 'old', playerId: 'p1', atRoll: 3 } };
    render(center(v));
    expect(screen.queryByRole('note', { name: /community chest/i })).toBeNull();
  });

  test('the card can be put away', () => {
    const v = { ...afterBuy(), rollSeq: 3, lastCard: { deck: 'chest' as const, text: 'Bank error.', playerId: 'p0', atRoll: 3 } };
    render(center(v));
    fireEvent.click(screen.getByRole('button', { name: /put the card away/i }));
    expect(screen.queryByRole('note', { name: /community chest/i })).toBeNull();
  });
});

describe('player panels', () => {
  const side = (view: MonopolyState) => (
    <MonopolySidebar view={view} meId="p0" nameFor={nameFor} onAction={vi.fn()} onInspect={() => {}} onTradeWith={() => {}} />
  );

  test('a change in cash floats the amount by the player, briefly', () => {
    const v = afterBuy();
    const { rerender } = render(side(v));
    const paid = { ...v, players: v.players.map((p) => (p.id === 'p1' ? { ...p, cash: p.cash + 200 } : p)) };
    rerender(side(paid));
    expect(screen.getByText('+$200')).toBeTruthy();
    tick(2500);
    expect(screen.queryByText('+$200')).toBeNull();
  });

  test('each player shows their net worth', () => {
    render(side(game()));
    expect(screen.getAllByText('Net $1,500')).toHaveLength(2);
  });

  test('a held Get Out of Jail Free card is shown', () => {
    const v = game();
    v.players[1].getOutCards = 1;
    render(side(v));
    expect(screen.getByText(/jail-free/i)).toBeTruthy();
  });

  test('the full game log is one tap away, newest first', () => {
    const v = afterBuy();
    render(side(v));
    const log = screen.getByRole('group', { name: /game log/i });
    const items = log.querySelectorAll('li');
    expect(items.length).toBe(v.log.length);
    expect(items[0].textContent).toBe(v.log[v.log.length - 1].replace('{p0}', 'You'));
  });
});

describe('trade shortcut', () => {
  const screenFor = (view: MonopolyState) =>
    render(<MonopolyGame view={view} meId="p0" nameFor={nameFor} onAction={vi.fn()} onExit={() => {}} exitLabel="Back" />);

  test('on your free move, an opponent row opens a trade with them', () => {
    screenFor(afterBuy());
    fireEvent.click(screen.getByRole('button', { name: 'Trade with Bot 1' }));
    expect((screen.getByRole('combobox', { name: /trade partner/i }) as HTMLSelectElement).value).toBe('p1');
  });

  test('not while it is someone else’s move', () => {
    screenFor(game()); // You still have to roll
    expect(screen.queryByRole('button', { name: 'Trade with Bot 1' })).toBeNull();
  });
});
