import type { GameState, Hand, Ticket, TrainCard } from './types';
import { emptyHand } from './deck';

/** A train card stands in for any hidden card: the client never reads its value. */
const HIDDEN_CARD: TrainCard = 'locomotive';
const hiddenTicket = (): Ticket => ({ id: '', a: '', b: '', points: 0 });

/** Only a hand's total count is public; collapse it into one bucket, hiding colors. */
function hiddenHand(real: Hand): Hand {
  const h = emptyHand();
  h.locomotive = Object.values(real).reduce((a, b) => a + b, 0);
  return h;
}

/**
 * Build the client-safe view of `state` for one player: the viewer sees their
 * own hand/tickets in full; everyone else's hidden info is reduced to counts,
 * and the draw/ticket piles and RNG seed are stripped. Once the game is over,
 * nothing is hidden (final results reveal all).
 */
export function redactStateFor(state: GameState, viewerId: string): GameState {
  if (state.phase === 'game-over') return state;
  const players = state.players.map((p) =>
    p.id === viewerId
      ? { ...p }
      : {
          ...p,
          hand: hiddenHand(p.hand),
          tickets: p.tickets.map(hiddenTicket),
          pendingTickets: p.pendingTickets.map(hiddenTicket),
        },
  );
  return {
    ...state,
    rngState: 0,
    drawPile: state.drawPile.map(() => HIDDEN_CARD),
    ticketPile: state.ticketPile.map(hiddenTicket),
    players,
  };
}
