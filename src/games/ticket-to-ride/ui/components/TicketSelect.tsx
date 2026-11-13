import { useState } from 'react';
import type { PlayerState } from '../../engine/types';
import { areConnected } from '../../engine/graph';
import { TicketCard } from './TicketCard';

interface Props {
  player: PlayerState;
  minKeep: number;
  title: string;
  onConfirm: (keptIds: string[]) => void;
  /** Hover a ticket to highlight its endpoints on the (still-visible) board. */
  onHoverCities?: (cities: Set<string> | null) => void;
}

/** Choose which drawn tickets to keep (setup: min 2, in-game draw: min 1). */
export function TicketSelect({
  player,
  minKeep,
  title,
  onConfirm,
  onHoverCities,
}: Props) {
  const list = player.pendingTickets;
  // Every drawn ticket starts kept; the player unticks the ones to return.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(list.map((t) => t.id)));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const enough = selected.size >= minKeep;

  return (
    <div className="popover ticket-select" data-testid="ticket-select">
      <div className="popover-head">
        <h3>{title}</h3>
        <span className="dialog-sub">
          Keep at least {minKeep}. Hover to see them on the map.
        </span>
      </div>
      <div className="ticket-list">
        {list.map((t) => (
          <TicketCard
            key={t.id}
            ticket={t}
            completed={areConnected(player.claimedRouteIds, t.a, t.b) || undefined}
            selected={selected.has(t.id)}
            onToggle={() => toggle(t.id)}
            onHover={onHoverCities ? (h) => onHoverCities(h ? new Set([t.a, t.b]) : null) : undefined}
          />
        ))}
      </div>
      <button
        type="button"
        className="primary"
        disabled={!enough}
        onClick={() => {
          onHoverCities?.(null);
          onConfirm([...selected]);
        }}
      >
        Keep {selected.size} ticket{selected.size === 1 ? '' : 's'}
      </button>
    </div>
  );
}
