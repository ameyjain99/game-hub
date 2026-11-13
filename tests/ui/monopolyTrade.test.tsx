// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMonopolyGame, type MonopolyState } from '../../src/games/monopoly/engine/state';
import { TradeDialog, TradeOffer } from '../../src/games/monopoly/ui/MonopolyTrade';
import { MonopolyAuction } from '../../src/games/monopoly/ui/MonopolyAuction';

afterEach(cleanup);

function game(): MonopolyState {
  return createMonopolyGame(
    [
      { avatar: 'a', isAI: false },
      { avatar: 'b', isAI: true },
    ],
    1,
    { randomizeOrder: false },
  );
}

const nameFor = (id: string) => id;

test('the trade dialog proposes a trade with the chosen property and closes', () => {
  const g = game();
  g.ownership[1].owner = 'p0';
  g.phase = 'action';
  const onAction = vi.fn();
  const onClose = vi.fn();
  render(<TradeDialog view={g} meId="p0" onAction={onAction} onClose={onClose} nameFor={nameFor} />);
  const send = screen.getByRole('button', { name: /send offer/i }) as HTMLButtonElement;
  expect(send.disabled).toBe(true); // an empty offer can't be sent
  fireEvent.click(screen.getByLabelText('Jakarta'));
  fireEvent.click(send);
  expect(onAction).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'PROPOSE_TRADE',
      trade: expect.objectContaining({ from: 'p0', to: 'p1', give: expect.objectContaining({ properties: [1] }) }),
    }),
  );
  expect(onClose).toHaveBeenCalled();
});

test('the recipient can accept an incoming offer', () => {
  const g = game();
  g.phase = 'trade';
  g.pendingTrade = {
    from: 'p1',
    to: 'p0',
    give: { cash: 100, properties: [], getOutCards: 0 },
    receive: { cash: 0, properties: [], getOutCards: 0 },
  };
  const onAction = vi.fn();
  render(<TradeOffer view={g} onAction={onAction} nameFor={nameFor} />);
  expect(screen.getByText('$100')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /accept/i }));
  expect(onAction).toHaveBeenCalledWith({ type: 'RESPOND_TRADE', accept: true });
});

test('the auction panel disables a bid above cash and advances on pass', () => {
  const g = game();
  g.players[0].cash = 50;
  g.pendingAuction = { spaceId: 1, participants: [0, 1], passed: [], highBid: 100, highBidder: 1, turn: 0 };
  const onAction = vi.fn();
  render(<MonopolyAuction view={g} meId="p0" onAction={onAction} nameFor={nameFor} />);
  expect((screen.getByRole('button', { name: /place bid/i }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: /^pass$/i }));
  expect(onAction).toHaveBeenCalledWith({ type: 'PASS_BID' });
});

test('a quick raise bids the standing bid plus the step', () => {
  const g = game();
  g.pendingAuction = { spaceId: 1, participants: [0, 1], passed: [], highBid: 40, highBidder: 1, turn: 0 };
  const onAction = vi.fn();
  render(<MonopolyAuction view={g} meId="p0" onAction={onAction} nameFor={nameFor} />);
  fireEvent.click(screen.getByRole('button', { name: '+$50' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'BID', amount: 90 });
});
