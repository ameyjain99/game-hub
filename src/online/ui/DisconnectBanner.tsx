import { useEffect, useRef, useState } from 'react';
import { playerIdForSeat, type LobbyView, type SeatView } from '../../net/protocol';
import { seatName } from '../seatNames';

/** How long a dropped player gets to reconnect before the table is offered a
 *  bot or a removal. Most drops are a blip that heals well inside this. */
export const DROP_GRACE_MS = 15_000;

/**
 * The dropped human seat the table should hear about (the one the game is
 * waiting on, if any), and whether it is still inside its grace period.
 */
export function useDroppedSeat(
  lobby: LobbyView,
  waitingOnId?: string | null,
): { seat: SeatView; waiting: boolean; reconnecting: boolean } | null {
  const since = useRef(new Map<number, number>());
  const [, tick] = useState(0);
  const dropped = lobby.seats.filter((s) => !s.isAI && s.name !== null && !s.connected);
  const now = Date.now();
  for (const s of dropped) if (!since.current.has(s.index)) since.current.set(s.index, now);
  for (const i of [...since.current.keys()]) if (!dropped.some((s) => s.index === i)) since.current.delete(i);

  const seat = dropped.find((s) => playerIdForSeat(s.index) === waitingOnId) ?? dropped[0];
  const left = seat ? DROP_GRACE_MS - (now - since.current.get(seat.index)!) : 0;
  const reconnecting = left > 0;
  useEffect(() => {
    if (!reconnecting) return;
    const t = setTimeout(() => tick((n) => n + 1), left);
    return () => clearTimeout(t);
  }, [seat?.index, reconnecting]); // eslint-disable-line react-hooks/exhaustive-deps

  return seat ? { seat, waiting: playerIdForSeat(seat.index) === waitingOnId, reconnecting } : null;
}

/**
 * Shown to everyone still at the table when a human player drops, so the game
 * never stalls on them. For the first few seconds it only says they are
 * reconnecting; if they stay gone it offers a bot (they take the seat back when
 * they return) or a removal (for good). `onRemove` is optional: a game that
 * can't take a seat out (Cluedo's hands must stay in play) offers only the bot.
 * `onReplace` is optional too: a game without online bots (Chess) offers only
 * the removal, which ends it in your favour.
 */
export function DisconnectBanner({
  lobby,
  waitingOnId,
  onReplace,
  onRemove,
}: {
  lobby: LobbyView;
  waitingOnId?: string | null;
  onReplace?: (index: number) => void;
  onRemove?: (index: number) => void;
}) {
  const drop = useDroppedSeat(lobby, waitingOnId);
  if (!drop) return null;
  const { seat, waiting, reconnecting } = drop;
  if (reconnecting) {
    return (
      <div className="g-banner is-soft" role="status">
        <span className="g-banner-text">
          <strong>{seatName(lobby, seat)}</strong> lost connection. Giving them a moment to get back...
        </span>
      </div>
    );
  }
  return (
    <div className="g-banner" role="alert">
      <span className="g-banner-text">
        <strong>{seatName(lobby, seat)}</strong> disconnected{waiting ? ' - the game is waiting on them.' : '.'}
        {onReplace && ' A bot can cover until they are back.'}
      </span>
      <span className="g-banner-actions">
        {onReplace && (
          <button type="button" className="g-btn g-btn-sm g-btn-light" onClick={() => onReplace(seat.index)}>
            Replace with a bot
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            className={`g-btn g-btn-sm ${onReplace ? 'g-btn-ghost' : 'g-btn-light'}`}
            onClick={() => onRemove(seat.index)}
          >
            Remove from game
          </button>
        )}
      </span>
    </div>
  );
}

/** How long "Bob is back" stays up. */
const BACK_MS = 4_000;

/**
 * Says so when a player who had dropped is back at the table (their seat is
 * theirs again, whether or not a bot covered it meanwhile).
 */
export function ReturnBanner({ lobby }: { lobby: LobbyView }) {
  const away = useRef(new Set<number>());
  const [back, setBack] = useState<{ index: number; name: string } | null>(null);
  const signature = lobby.seats.map((s) => `${s.index}:${s.name !== null && !s.isAI && s.connected ? 1 : 0}:${s.covering ? 1 : 0}`).join('|');
  useEffect(() => {
    let returned: SeatView | undefined;
    for (const s of lobby.seats) {
      const gone = s.name !== null && (s.covering || (!s.isAI && !s.connected));
      if (gone) away.current.add(s.index);
      else if (away.current.delete(s.index) && s.name !== null && !s.isAI && s.connected) returned = s;
    }
    if (!returned) return;
    setBack({ index: returned.index, name: seatName(lobby, returned) });
    const t = setTimeout(() => setBack(null), BACK_MS);
    return () => clearTimeout(t);
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!back) return null;
  return (
    <div className="g-banner is-good" role="status">
      <span className="g-banner-text">
        <strong>{back.name}</strong> is back.
      </span>
    </div>
  );
}

/** Shown to a player whose own link to the server is down. */
export function OfflineBanner({ connected }: { connected: boolean }) {
  if (connected) return null;
  return (
    <div className="g-banner is-offline" role="status">
      <span className="g-banner-text">
        <strong>You're offline.</strong> Reconnecting - your seat is being held.
      </span>
    </div>
  );
}
