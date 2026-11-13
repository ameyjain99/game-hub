import { useEffect, useState } from 'react';
import { Loader } from '../../../shared/Loader';
import { fetchRoomExists } from '../net/room';
import { TicketToRideProfile } from './TicketToRideProfile';
import type { MapId } from '../engine/types';

interface Props {
  code: string;
  onBack: () => void;
  onSubmit: (name: string, avatar: string, seatCount?: number, modeId?: string, mapId?: MapId) => void;
}

/**
 * Guards the join flow: before asking for a name, it checks the room actually
 * exists. While checking it shows a loader; a missing room gets a "no such room"
 * message instead of the name step.
 */
export function JoinRoomGate({ code, onBack, onSubmit }: Props) {
  const [status, setStatus] = useState<'checking' | 'ok' | 'missing'>('checking');

  useEffect(() => {
    let cancelled = false;
    setStatus('checking');
    fetchRoomExists(code).then((exists) => {
      if (!cancelled) setStatus(exists ? 'ok' : 'missing');
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (status === 'checking') {
    return (
      <div className="setup-screen">
        <Loader full label={`Looking for room ${code}…`} />
      </div>
    );
  }

  if (status === 'missing') {
    return (
      <div className="setup-screen">
        <div className="modal-backdrop">
          <div className="modal-card" role="alertdialog" aria-label="Could not join">
            <h2>Couldn’t join</h2>
            <p>
              No room with the code <strong>{code}</strong> is open right now. Check the code and try
              again.
            </p>
            <div className="modal-actions">
              <button type="button" className="primary" onClick={onBack}>
                Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <TicketToRideProfile action="join" onBack={onBack} onSubmit={onSubmit} />;
}
