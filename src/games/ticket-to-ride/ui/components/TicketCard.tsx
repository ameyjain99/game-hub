import { TicketDoneIcon, TicketFailIcon } from '../../../../shared/icons';
import type { Ticket } from '../../engine/types';
import { cityById } from '../../engine/maps';

const NAME = new Map([...cityById].map(([id, c]) => [id, c.name]));

interface Props {
  ticket: Ticket;
  /** undefined = unknown/in-progress, true = completed, false = not connected. */
  completed?: boolean;
  selected?: boolean;
  onToggle?: () => void;
  /** Fired on hover enter (true) / leave (false) – used to highlight the map. */
  onHover?: (hovering: boolean) => void;
}

export function TicketCard({ ticket, completed, selected, onToggle, onHover }: Props) {
  const status = completed === undefined ? '' : completed ? ' done' : ' missing';
  return (
    <button
      type="button"
      className={`ticket-card${selected ? ' selected' : ''}${status}${ticket.long ? ' long' : ''}`}
      title={ticket.long ? 'Long route' : undefined}
      onClick={onToggle}
      disabled={!onToggle && !onHover}
      data-ticket-id={ticket.id}
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
      onFocus={onHover ? () => onHover(true) : undefined}
      onBlur={onHover ? () => onHover(false) : undefined}
    >
      <span className="ticket-cities">
        {NAME.get(ticket.a)} → {NAME.get(ticket.b)}
      </span>
      <span className="ticket-points">{ticket.points}</span>
      {completed !== undefined && (
        <span className="ticket-status">{completed ? <TicketDoneIcon size={13} /> : <TicketFailIcon size={13} />}</span>
      )}
    </button>
  );
}
