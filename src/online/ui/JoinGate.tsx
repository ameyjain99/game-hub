import { useEffect, useState, type ReactNode } from 'react';
import { Loader } from '../../shared/Loader';

/** Ask the server whether a room exists. Fails open: if the check can't be
 *  reached, the join attempt itself still surfaces a real error. */
export async function fetchRoomExists(code: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/room-exists?code=${encodeURIComponent(code)}`);
    if (!res.ok) return true;
    const data = (await res.json()) as { exists?: boolean };
    return data.exists !== false;
  } catch {
    return true;
  }
}

/** Checks a join link's room exists before showing the name step; a missing
 *  room gets a "Couldn't join" dialog instead. */
export function JoinGate({ code, onBack, children }: { code: string; onBack: () => void; children: ReactNode }) {
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
      <div className="setup-screen g-screen">
        <Loader full label={`Looking for room ${code}...`} />
      </div>
    );
  }
  if (status === 'missing') {
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
  return <>{children}</>;
}
