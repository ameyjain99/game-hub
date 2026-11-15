/** Ticket to Ride's rule-book pictures, drawn with the game's own cards. */
import { CARD_COLORS } from '../engine/types';
import { TICKETS } from '../engine/data/usa/tickets';
import { CardChip } from './components/CardChip';
import { TicketCard } from './components/TicketCard';

export const TrainCards = () => (
  <div className="rf-row">
    {CARD_COLORS.map((c) => (
      <span key={c} className="rf-col">
        <CardChip card={c} />
        <span className="rf-label">{c[0].toUpperCase() + c.slice(1)}</span>
      </span>
    ))}
    <span className="rf-col">
      <CardChip card="locomotive" />
      <span className="rf-label">Locomotive (wild)</span>
    </span>
  </div>
);

export const Tickets = () => (
  <div className="rf-row" style={{ maxWidth: 420 }}>
    {TICKETS.slice(0, 3).map((t, i) => (
      <TicketCard key={t.id} ticket={t} completed={i === 0 ? true : i === 1 ? false : undefined} />
    ))}
  </div>
);
