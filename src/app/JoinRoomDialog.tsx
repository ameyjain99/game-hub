import { useEffect, useRef, useState, type FormEvent } from 'react';
import { GAMES, gameColor } from '../games/registry';
import { GameIcon } from './GameIcon';
import { codeFrom } from './roomCode';

type Lookup =
  | { state: 'idle' }
  | { state: 'looking' }
  | { state: 'found'; gameId: string; title: string; color: string }
  | { state: 'missing' }
  | { state: 'error' };

/**
 * Join a friend's room from the hub. Paste the code or the invite link; as soon
 * as there's a whole code the server says which game the room is playing, and
 * Join opens that game's join screen.
 */
export function JoinRoomDialog({
  onJoin,
  onClose,
}: {
  onJoin: (gameId: string, code: string) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState('');
  const [lookup, setLookup] = useState<Lookup>({ state: 'idle' });
  // The code last asked about, so a slow answer for an older code is dropped.
  const asked = useRef('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const change = (text: string) => {
    const next = codeFrom(text);
    setCode(next);
    if (next === asked.current) return;
    asked.current = next;
    if (next.length !== 4) {
      setLookup({ state: 'idle' });
      return;
    }
    setLookup({ state: 'looking' });
    fetch(`/api/room-exists?code=${encodeURIComponent(next)}`)
      .then((res) => res.json() as Promise<{ exists: boolean; gameId?: string }>)
      .then((body) => {
        if (asked.current !== next) return;
        const game = body.exists ? GAMES.find((g) => g.id === body.gameId && g.status === 'live') : undefined;
        setLookup(game ? { state: 'found', gameId: game.id, title: game.title, color: gameColor(game) } : { state: 'missing' });
      })
      .catch(() => {
        if (asked.current === next) setLookup({ state: 'error' });
      });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (lookup.state === 'found') onJoin(lookup.gameId, code);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card hub-join-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hub-join-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="hub-join-title">Join a room</h2>
        <p>Paste the code or the invite link a friend sent you.</p>
        <form onSubmit={submit}>
          <input
            className="g-input g-code-input hub-join-code"
            aria-label="Room code"
            placeholder="ABCD"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={code}
            onChange={(e) => change(e.target.value)}
          />
          <div className="hub-join-status" role="status">
            {lookup.state === 'idle' && <span className="hub-join-hint">Room codes are four letters or numbers.</span>}
            {lookup.state === 'looking' && <span className="hub-join-hint">Finding the room...</span>}
            {lookup.state === 'found' && (
              <span className="hub-join-found">
                <span className="hub-join-tile" style={{ background: lookup.color }}>
                  <GameIcon gameId={lookup.gameId} accent={lookup.color} size={24} />
                </span>
                <span>
                  <strong>{lookup.title}</strong>
                  <small>Room {code}</small>
                </span>
              </span>
            )}
            {lookup.state === 'missing' && (
              <span className="hub-join-error">No open room with that code. Check it with whoever sent it.</span>
            )}
            {lookup.state === 'error' && <span className="hub-join-error">Couldn't reach the server. Try again.</span>}
          </div>
          <div className="hub-join-actions">
            <button type="button" className="g-btn g-btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={lookup.state !== 'found'}>
              {lookup.state === 'found' ? `Join ${lookup.title}` : 'Join'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
