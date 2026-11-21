import { useEffect, useState, type ReactNode } from 'react';
import { Loader } from '../../shared/Loader';
import type { RoomInfo } from '../../net/protocol';

/** Ask the server about a room code. Fails open: if the check can't be
 *  reached, the join attempt itself still surfaces a real error. */
export async function fetchRoomInfo(code: string): Promise<RoomInfo> {
  try {
    const res = await fetch(`/api/room-exists?code=${encodeURIComponent(code)}`);
    if (!res.ok) return { exists: true };
    const data = (await res.json()) as Partial<RoomInfo>;
    return { ...data, exists: data.exists !== false };
  } catch {
    return { exists: true };
  }
}

export async function fetchRoomExists(code: string): Promise<boolean> {
  return (await fetchRoomInfo(code)).exists;
}

type Seat = { index: number; name: string };

/**
 * Checks a join link before showing the name step. A missing room gets a
 * "Couldn't join" dialog. A game already under way can't take new players, but
 * a player who dropped out of it can take their seat back here (`onRejoin`).
 */
export function JoinGate({
  code,
  onBack,
  onRejoin,
  children,
}: {
  code: string;
  onBack: () => void;
  /** Take back a dropped seat in a started game. */
  onRejoin?: (seat: Seat) => void;
  children: ReactNode;
}) {
  const [info, setInfo] = useState<RoomInfo | null>(null);
  const [checks, setChecks] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setInfo(null);
    fetchRoomInfo(code).then((res) => {
      if (!cancelled) setInfo(res);
    });
    return () => {
      cancelled = true;
    };
  }, [code, checks]);

  if (!info) {
    return (
      <div className="setup-screen g-screen">
        <Loader full label={`Looking for room ${code}...`} />
      </div>
    );
  }
  if (!info.exists) {
    return (
      <div className="modal-backdrop">
        <div className="modal-card" role="alertdialog" aria-label="Could not join">
          <h2>Couldn't join</h2>
          <p>
            No room with the code <strong>{code}</strong> is open right now. Check the code and try again.
          </p>
          <div className="modal-actions">
            <button type="button" className="primary" onClick={onBack}>
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (info.started && onRejoin) {
    const seats = info.openSeats ?? [];
    return (
      <div className="modal-backdrop">
        <div className="modal-card g-rejoin" role="dialog" aria-label="Game in progress">
          <h2>This game is under way</h2>
          {seats.length > 0 ? (
            <>
              <p>Were you playing? Take your seat back and carry on where you left off.</p>
              <div className="g-rejoin-seats">
                {seats.map((s) => (
                  <button key={s.index} type="button" className="primary" onClick={() => onRejoin(s)}>
                    Rejoin as {s.name}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p>
              New players can't join mid-game, and no seat in room <strong>{code}</strong> is free. If you just lost
              your connection, your seat opens up within a few seconds.
            </p>
          )}
          <div className="modal-actions">
            <button type="button" className="g-btn g-btn-ghost" onClick={onBack}>
              Back
            </button>
            {seats.length === 0 && (
              <button type="button" className="primary" onClick={() => setChecks((n) => n + 1)}>
                Check again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
