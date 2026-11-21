import type { LobbyView } from '../../../../net/protocol';
import { useDroppedSeat } from '../../../../online/ui/DisconnectBanner';
import { cleanName } from '../displayName';

interface Props {
  lobby: LobbyView;
  /** The engine id of the player whose turn it currently is. */
  currentPlayerId: string;
  onReplace: (index: number) => void;
  /** Remove the dropped player from the game entirely (cards/routes returned). */
  onRemove: (index: number) => void;
}

/**
 * Banner shown when a human player has dropped. Any remaining player can swap the
 * dropped seat for an AI so the game never stalls - including a dropped host
 * (otherwise the one person allowed to replace would be the one who's gone).
 * The dropped player takes the seat back from the AI when they return.
 */
export function DisconnectOverlay({ lobby, currentPlayerId, onReplace, onRemove }: Props) {
  // Prefer the player the game is actually waiting on - it's paused on their turn.
  const drop = useDroppedSeat(lobby, currentPlayerId);
  if (!drop) return null;
  const { seat, waiting: current, reconnecting } = drop;
  const who = seat.name ? cleanName(seat.name) : `Player ${seat.index + 1}`;

  // Most drops are a blip: give them a moment before offering to replace them.
  if (reconnecting) {
    return (
      <div className="disconnect-overlay" role="status">
        <span>{who} lost connection - giving them a moment to get back...</span>
      </div>
    );
  }

  return (
    <div className="disconnect-overlay" role="alert">
      <span>
        {who} disconnected{current ? ' - waiting for them to return...' : ''}
      </span>
      <div className="disconnect-actions">
        <button type="button" className="primary" onClick={() => onReplace(seat.index)}>
          Replace with AI
        </button>
        <button type="button" className="secondary" onClick={() => onRemove(seat.index)}>
          Remove from game
        </button>
      </div>
    </div>
  );
}
