import { playerIdForSeat, type LobbyView } from '../../net/protocol';
import { seatName } from '../seatNames';

/**
 * Shown to everyone still at the table when a human player drops, so the game
 * never stalls on them. Prefers the player the game is waiting on. `onRemove` is
 * optional: a game that can't take a seat out (Cluedo's hands must stay in play)
 * offers only the bot replacement.
 */
export function DisconnectBanner({
  lobby,
  waitingOnId,
  onReplace,
  onRemove,
}: {
  lobby: LobbyView;
  waitingOnId?: string | null;
  onReplace: (index: number) => void;
  onRemove?: (index: number) => void;
}) {
  const dropped = lobby.seats.filter((s) => !s.isAI && s.name !== null && !s.connected);
  if (dropped.length === 0) return null;
  const seat = dropped.find((s) => playerIdForSeat(s.index) === waitingOnId) ?? dropped[0];
  const waiting = playerIdForSeat(seat.index) === waitingOnId;
  return (
    <div className="g-banner" role="alert">
      <span className="g-banner-text">
        <strong>{seatName(lobby, seat)}</strong> disconnected{waiting ? ' — the game is waiting on them.' : '.'}
      </span>
      <span className="g-banner-actions">
        <button type="button" className="g-btn g-btn-sm g-btn-light" onClick={() => onReplace(seat.index)}>
          Replace with a bot
        </button>
        {onRemove && (
          <button type="button" className="g-btn g-btn-sm g-btn-ghost" onClick={() => onRemove(seat.index)}>
            Remove from game
          </button>
        )}
      </span>
    </div>
  );
}
