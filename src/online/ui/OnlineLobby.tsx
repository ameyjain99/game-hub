import { useState } from 'react';
import { AddIcon, BackIcon, CloseIcon } from '../../shared/icons';
import { Loader } from '../../shared/Loader';
import { playerIdForSeat, type LobbyView } from '../../net/protocol';
import { seatName } from '../seatNames';
import { CopyButton } from './CopyButton';

export interface DifficultyOption {
  value: string;
  label: string;
}

interface Props {
  gameId: string;
  title: string;
  lobby: LobbyView | null;
  code: string | null;
  myPlayerId: string | null;
  difficulties: DifficultyOption[];
  /** Colour for a seat's token (the game's player colours). */
  colorFor: (index: number) => string;
  onSetSeatAi: (index: number, isAI: boolean, difficulty?: string) => void;
  onStart: () => void;
  onLeave: () => void;
}

/** The pre-game room shared by Monopoly and Cluedo: invite code + link, the
 *  seats (host fills empties with bots), then Start. */
export function OnlineLobby({ gameId, title, lobby, code, myPlayerId, difficulties, colorFor, onSetSeatAi, onStart, onLeave }: Props) {
  const [chosen, setChosen] = useState<Record<number, string>>({});
  const isHost = !!lobby && myPlayerId === playerIdForSeat(lobby.hostIndex);
  const filled = lobby ? lobby.seats.filter((s) => s.isAI || s.name !== null).length : 0;
  const total = lobby?.seatCount ?? 0;
  const ready = !!lobby && filled === total;
  const link = code ? `${window.location.origin}/${gameId}/join?room=${code}` : '';
  const defaultDiff = difficulties.find((d) => d.value === 'normal')?.value ?? difficulties[0]?.value;

  return (
    <div className="setup-screen g-screen">
      <button type="button" className="back-link" onClick={onLeave}>
        <BackIcon size={16} />
        {isHost ? 'Cancel room' : 'Leave room'}
      </button>
      <header className="g-head">
        <p className="g-eyebrow">{title}</p>
        <h1>Lobby</h1>
        <p className="tagline">{lobby ? `${filled} of ${total} seats filled` : 'Connecting to the room…'}</p>
      </header>

      {!lobby || !code ? (
        <Loader label="Connecting…" />
      ) : (
        <>
          <section className="g-panel g-invite" aria-label="Invite friends">
            <div className="g-invite-code">
              <span className="g-field-label">Room code</span>
              <span className="g-code" aria-label="Room code">
                {code}
              </span>
            </div>
            <div className="g-invite-actions">
              <CopyButton text={code} label="Copy code" />
              <CopyButton text={link} label="Copy invite link" />
            </div>
          </section>

          <section className="g-panel" aria-label="Players">
            <h2 className="g-panel-title">Players</h2>
            <ul className="g-seats">
              {lobby.seats.map((s) => {
                const open = !s.isAI && s.name === null;
                const me = playerIdForSeat(s.index) === myPlayerId;
                return (
                  <li key={s.index} className={`g-seat${open ? ' is-open' : ''}`}>
                    <span className="g-seat-token" style={{ background: open ? 'transparent' : colorFor(s.index), borderColor: colorFor(s.index) }} />
                    <span className="g-seat-name">{seatName(lobby, s)}</span>
                    <span className="g-seat-tags">
                      {me && <span className="g-tag">You</span>}
                      {s.index === lobby.hostIndex && <span className="g-tag">Host</span>}
                      {s.isAI && <span className="g-tag g-tag-dim">Bot · {difficulties.find((d) => d.value === s.difficulty)?.label ?? 'Normal'}</span>}
                      {!s.isAI && s.name !== null && !s.connected && <span className="g-tag g-tag-warn">Offline</span>}
                    </span>
                    {isHost && open && (
                      <span className="g-seat-controls">
                        <select
                          aria-label={`Seat ${s.index + 1} bot difficulty`}
                          value={chosen[s.index] ?? defaultDiff}
                          onChange={(e) => setChosen((c) => ({ ...c, [s.index]: e.target.value }))}
                        >
                          {difficulties.map((d) => (
                            <option key={d.value} value={d.value}>
                              {d.label}
                            </option>
                          ))}
                        </select>
                        <button type="button" className="g-btn g-btn-sm g-btn-ghost" onClick={() => onSetSeatAi(s.index, true, chosen[s.index] ?? defaultDiff)}>
                          <AddIcon size={14} />
                          Add bot
                        </button>
                      </span>
                    )}
                    {isHost && s.isAI && (
                      <button type="button" className="g-icon-btn" aria-label={`Remove bot from seat ${s.index + 1}`} onClick={() => onSetSeatAi(s.index, false)}>
                        <CloseIcon size={15} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <footer className="g-foot">
            {isHost ? (
              <>
                <button type="button" className="primary g-block" disabled={!ready} onClick={onStart}>
                  Start game
                </button>
                {!ready && <p className="g-hint">Waiting for friends — or add bots to the open seats.</p>}
              </>
            ) : (
              <Loader label="Waiting for the host to start…" />
            )}
          </footer>
        </>
      )}
    </div>
  );
}
