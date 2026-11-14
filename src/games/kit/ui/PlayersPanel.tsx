import type { CSSProperties, ReactNode } from 'react';
import { SideSection } from './GameShell';

export interface PanelPlayer {
  id: string;
  name: string;
  /** The player's colour: their token ring and turn highlight. */
  color: string;
  /** What sits in the token (defaults to the name's initial / bot number). */
  badge?: ReactNode;
  /** A short line under the name (pieces left, square, team...). */
  detail?: ReactNode;
  /** Right-aligned (a score). */
  trailing?: ReactNode;
  active?: boolean;
  out?: boolean;
  you?: boolean;
}

/** A token's label: a bot's number ("Bot 2" → "2"), else the name's initial. */
export function tokenLabel(name: string): string {
  const digits = name.match(/\d+$/);
  return digits ? digits[0] : name.trim().slice(0, 1).toUpperCase();
}

/**
 * The players list: whose turn it is ringed in their colour; hovering a row
 * spotlights that player's pieces on the board (`onSpotlight`).
 */
export function PlayersPanel({
  players,
  title = 'Players',
  spotlight,
  onSpotlight,
}: {
  players: PanelPlayer[];
  title?: string;
  spotlight?: string | null;
  onSpotlight?: (id: string | null) => void;
}) {
  return (
    <SideSection title={title}>
      <ul className="kit-players">
        {players.map((p) => (
          <li
            key={p.id}
            className={`kit-player${p.active ? ' is-turn' : ''}${p.out ? ' is-out' : ''}${spotlight === p.id ? ' is-spot' : ''}`}
            style={{ '--tc': p.color } as CSSProperties}
            onMouseEnter={onSpotlight ? () => onSpotlight(p.id) : undefined}
            onMouseLeave={onSpotlight ? () => onSpotlight(null) : undefined}
            aria-current={p.active ? 'true' : undefined}
          >
            <span className="kit-token" aria-hidden="true">
              {p.badge ?? tokenLabel(p.name)}
            </span>
            <span className="kit-player-main">
              <span className="kit-player-name">
                {p.name}
                {p.you && p.name !== 'You' && <span className="kit-you">you</span>}
              </span>
              {p.detail && <span className="kit-player-detail">{p.detail}</span>}
            </span>
            {p.trailing !== undefined && <span className="kit-player-trailing">{p.trailing}</span>}
          </li>
        ))}
      </ul>
    </SideSection>
  );
}
