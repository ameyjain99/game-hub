import type { GameState } from '../../engine/types';
import { CardChip } from './CardChip';

interface Props {
  state: GameState;
  /** Whether the active human may draw right now. */
  canDraw: boolean;
  canDrawTickets: boolean;
  onDrawMarket: (index: number) => void;
  onDrawDeck: () => void;
  onDrawTickets: () => void;
}

export function Market({
  state,
  canDraw,
  canDrawTickets,
  onDrawMarket,
  onDrawDeck,
  onDrawTickets,
}: Props) {
  const midDraw = state.drawnThisTurn === 1;
  const deckEmpty = state.drawPile.length + state.discardPile.length === 0;

  return (
    <div className="market">
      <div className="market-row">
        <button
          type="button"
          className="deck-btn"
          disabled={!canDraw || deckEmpty}
          onClick={onDrawDeck}
          title="Draw a face-down train card"
        >
          <span className="deck-count">{state.drawPile.length}</span>
          <span className="deck-label">Color Cards Deck</span>
        </button>

        {state.market.map((card, i) => {
          const blockedLoco = midDraw && card === 'locomotive';
          return (
            <CardChip
              key={i}
              card={card}
              title={blockedLoco ? 'Cannot take a locomotive as your second draw' : `Draw ${card}`}
              dimmed={blockedLoco}
              onClick={canDraw && !blockedLoco ? () => onDrawMarket(i) : undefined}
            />
          );
        })}

        <button
          type="button"
          className="ticket-deck-btn"
          disabled={!canDrawTickets}
          onClick={onDrawTickets}
          title="Draw 3 destination tickets"
        >
          <span className="deck-count">{state.ticketPile.length}</span>
          <span className="deck-label">Destination Tickets</span>
        </button>
      </div>
    </div>
  );
}
