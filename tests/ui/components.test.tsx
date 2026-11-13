// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Market } from '../../src/games/ticket-to-ride/ui/components/Market';
import { ClaimDialog } from '../../src/games/ticket-to-ride/ui/components/ClaimDialog';
import { TicketCard } from '../../src/games/ticket-to-ride/ui/components/TicketCard';
import { TicketSelect } from '../../src/games/ticket-to-ride/ui/components/TicketSelect';
import { Commentary } from '../../src/games/ticket-to-ride/ui/components/Commentary';
import { createGame } from '../../src/games/ticket-to-ride/engine/setup';
import { canPayFor, getRoute } from '../../src/games/ticket-to-ride/engine/selectors';
import { emptyHand } from '../../src/games/ticket-to-ride/engine/deck';
import { ticket } from '../ai/helpers';
import type { Hand, PlayerState } from '../../src/games/ticket-to-ride/engine/types';

afterEach(cleanup);

describe('Market', () => {
  it('renders 5 face-up cards and fires DRAW on click', () => {
    const state = createGame(
      [
        { name: 'A', isAI: false },
        { name: 'B', isAI: true },
      ],
      7,
    );
    const onDrawMarket = vi.fn();
    const { container } = render(
      <Market
        state={state}
        canDraw
        canDrawTickets
        onDrawMarket={onDrawMarket}
        onDrawDeck={() => {}}
        onDrawTickets={() => {}}
      />,
    );
    const cards = container.querySelectorAll('.market-row .card-chip');
    expect(cards.length).toBe(5);
    fireEvent.click(cards[0]);
    expect(onDrawMarket).toHaveBeenCalledWith(0);
  });
});

describe('Commentary', () => {
  it('renders log lines and the live status verbatim', () => {
    render(<Commentary log={['Amey drew a card from the deck.']} status={'100% focus: your turn.'} />);
    expect(screen.getByText('Amey drew a card from the deck.')).toBeTruthy();
    expect(screen.getByText('100% focus: your turn.')).toBeTruthy();
  });
});

describe('TicketSelect', () => {
  const player = { claimedRouteIds: [] } as unknown as PlayerState;

  it('starts with every drawn ticket kept and blocks going below the minimum', () => {
    const drawn = { ...player, pendingTickets: [ticket('denver', 'pittsburgh', 5), ticket('boston', 'miami', 7), ticket('calgary', 'phoenix', 3)] };
    const onConfirm = vi.fn();
    const { container } = render(<TicketSelect player={drawn} minKeep={2} title="Pick" onConfirm={onConfirm} />);
    const cards = container.querySelectorAll('[data-ticket-id]');
    expect(screen.getByRole('button', { name: /Keep 3 tickets/ })).toBeTruthy();
    fireEvent.click(cards[0]);
    fireEvent.click(cards[1]); // only one left kept, below the minimum of 2
    expect((screen.getByRole('button', { name: /Keep 1 ticket/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(cards[1]);
    fireEvent.click(screen.getByRole('button', { name: /Keep 2 tickets/ }));
    expect(onConfirm).toHaveBeenCalledWith(expect.arrayContaining([cards[1].getAttribute('data-ticket-id'), cards[2].getAttribute('data-ticket-id')]));
  });
});

describe('TicketCard', () => {
  it('fires onHover(true/false) on mouse enter and leave', () => {
    const onHover = vi.fn();
    render(
      <TicketCard
        ticket={{ id: 't', a: 'denver', b: 'pittsburgh', points: 11 }}
        onHover={onHover}
      />,
    );
    const card = screen.getByRole('button');
    fireEvent.mouseEnter(card);
    expect(onHover).toHaveBeenLastCalledWith(true);
    fireEvent.mouseLeave(card);
    expect(onHover).toHaveBeenLastCalledWith(false);
  });
});

describe('ClaimDialog', () => {
  it('lists exactly the legal combos and confirms one', () => {
    const hand: Hand = { ...emptyHand(), yellow: 1, locomotive: 1 };
    const route = getRoute('boston-new-york')!; // yellow, length 2
    const expected = canPayFor(hand, route);
    const onConfirm = vi.fn();

    render(
      <ClaimDialog routeId="boston-new-york" hand={hand} onConfirm={onConfirm} onCancel={() => {}} />,
    );
    const buttons = screen.getAllByRole('button', { name: /locomotive|yellow/i });
    // combos: {1 yellow + 1 loco}, {2 loco}? only 1 loco in hand, so {1 yellow +1 loco}
    expect(buttons.length).toBe(expected.length);
    fireEvent.click(buttons[0]);
    expect(onConfirm).toHaveBeenCalledWith(expected[0]);
  });
});
