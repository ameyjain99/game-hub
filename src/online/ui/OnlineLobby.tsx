import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AddIcon, BackIcon, CloseIcon } from '../../shared/icons';
import { gamePath } from '../../games/registry';
import { Loader } from '../../shared/Loader';
import { playerIdForSeat, type LobbyView } from '../../net/protocol';
import { seatName } from '../seatNames';
import { CopyButton } from './CopyButton';
import { LobbyCall } from './LobbyCall';
import type { MediaChat } from '../useMediaChat';
import type { LobbyRulesView } from './LobbyRules';
import { playJoin, playLeft } from '../../shared/sound';

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
  /** Colour for a seat's token (the game's player colours, which may depend on the table size). */
  colorFor: (index: number, seatCount: number) => string;
  onSetSeatAi: (index: number, isAI: boolean, difficulty?: string) => void;
  onStart: () => void;
  onLeave: () => void;
  /** The call: people in the lobby can already talk while they wait. */
  media?: MediaChat | null;
  /** The rules the host chose, shown to everyone; the host also gets the controls. */
  rules?: LobbyRulesView;
  /** The pieces a player can choose between (a character, a colour, a token). */
  pieces?: LobbyPiece[];
  onPickPiece?: (id: string) => void;
  /** Seat counts the game allows: the host can add a seat or take the last one away. */
  seatCounts?: number[];
  onSeatCount?: (seatCount: number) => void;
}

/** A piece on offer in the lobby. */
export interface LobbyPiece {
  id: string;
  label: string;
  /** How it looks (a coloured token, an icon). */
  node: ReactNode;
}

/** The pre-game room shared by Monopoly and Cluedo: invite code + link, the
 *  seats (host fills empties with bots), then Start. */
export function OnlineLobby({ gameId, title, lobby, code, myPlayerId, difficulties, colorFor, onSetSeatAi, onStart, onLeave, media, rules, pieces, onPickPiece, seatCounts, onSeatCount }: Props) {
  const [chosen, setChosen] = useState<Record<number, string>>({});
  const isHost = !!lobby && myPlayerId === playerIdForSeat(lobby.hostIndex);
  const filled = lobby ? lobby.seats.filter((s) => s.isAI || s.name !== null).length : 0;
  const total = lobby?.seatCount ?? 0;
  const ready = !!lobby && filled === total;
  const link = code ? `${window.location.origin}${gamePath(gameId)}/join?room=${code}` : '';
  const defaultDiff = difficulties.find((d) => d.value === 'normal')?.value ?? difficulties[0]?.value;

  // A sound when someone sits down or gets up, so a host doing something else notices.
  const humans = lobby ? lobby.seats.filter((s) => !s.isAI && s.name !== null).length : null;
  const humansBefore = useRef(humans);
  useEffect(() => {
    if (humans !== null && humansBefore.current !== null && humans !== humansBefore.current) (humans > humansBefore.current ? playJoin : playLeft)();
    humansBefore.current = humans;
  }, [humans]);

  const mySeat = lobby?.seats.find((s) => playerIdForSeat(s.index) === myPlayerId);
  const takenPieces = new Set((lobby?.seats ?? []).filter((s) => s !== mySeat && (s.isAI || s.name !== null)).map((s) => s.avatar));
  const pieceOf = (id: string) => pieces?.find((p) => p.id === id);
  const last = lobby?.seats[lobby.seats.length - 1];
  const canAdd = isHost && !!onSeatCount && !!seatCounts?.includes(total + 1);
  const canRemove = isHost && !!onSeatCount && !!last && !!seatCounts?.includes(total - 1) && (last.isAI || last.name === null);

  return (
    <div className="setup-screen g-screen g-lobby">
      <button type="button" className="back-link" onClick={onLeave}>
        <BackIcon size={16} />
        {isHost ? 'Cancel room' : 'Leave room'}
      </button>
      <header className="g-head">
        <p className="g-eyebrow">{title}</p>
        <h1>Lobby</h1>
        <p className="tagline">{lobby ? `${filled} of ${total} seats filled` : 'Connecting to the room...'}</p>
      </header>

      {!lobby || !code ? (
        <Loader label="Connecting..." />
      ) : (
        <>
          <div className="g-lobby-main">
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
                    {!open && pieceOf(s.avatar) ? (
                      <span className="g-seat-piece" title={pieceOf(s.avatar)!.label}>
                        {pieceOf(s.avatar)!.node}
                      </span>
                    ) : (
                      <span className="g-seat-token" style={{ background: open ? 'transparent' : colorFor(s.index, lobby.seatCount), borderColor: colorFor(s.index, lobby.seatCount) }} />
                    )}
                    <span className="g-seat-name">{seatName(lobby, s)}</span>
                    <span className="g-seat-tags">
                      {me && <span className="g-tag">You</span>}
                      {s.index === lobby.hostIndex && <span className="g-tag">Host</span>}
                      {s.isAI && <span className="g-tag g-tag-dim">Bot · {difficulties.find((d) => d.value === s.difficulty)?.label ?? 'Normal'}</span>}
                      {!s.isAI && s.name !== null && !s.connected && <span className="g-tag g-tag-warn">Offline</span>}
                    </span>
                    {isHost && open && difficulties.length > 0 && (
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
            {(canAdd || canRemove) && (
              <div className="g-seat-count">
                {canAdd && (
                  <button type="button" className="g-btn g-btn-sm g-btn-ghost" onClick={() => onSeatCount!(total + 1)}>
                    <AddIcon size={14} />
                    Add a seat
                  </button>
                )}
                {canRemove && (
                  <button type="button" className="g-btn g-btn-sm g-btn-ghost" onClick={() => onSeatCount!(total - 1)}>
                    <CloseIcon size={14} />
                    Remove the last seat
                  </button>
                )}
              </div>
            )}
          </section>

          <footer className="g-foot">
            {isHost ? (
              <>
                <button type="button" className="primary g-block" disabled={!ready} onClick={onStart}>
                  Start game
                </button>
                {!ready && (
                  <p className="g-hint">
                    {difficulties.length > 0
                      ? 'Waiting for friends - or add bots to the open seats.'
                      : 'Waiting for your opponent to join.'}
                  </p>
                )}
              </>
            ) : (
              <Loader label="Waiting for the host to start..." />
            )}
          </footer>
          </div>
          <div className="g-lobby-side">
          <LobbyCall lobby={lobby} myPlayerId={myPlayerId} media={media} colorFor={colorFor} />

          {pieces && pieces.length > 0 && mySeat && onPickPiece && (
            <section className="g-panel" aria-label="Your piece">
              <h2 className="g-panel-title">Your piece</h2>
              <div className="g-pieces" role="radiogroup" aria-label="Your piece">
                {pieces.map((p) => {
                  const taken = takenPieces.has(p.id);
                  const mine = mySeat.avatar === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={mine}
                      aria-label={`${p.label}${taken ? ' (taken)' : ''}`}
                      className={`g-piece${mine ? ' is-mine' : ''}`}
                      disabled={taken}
                      onClick={() => onPickPiece(p.id)}
                    >
                      {p.node}
                      <span className="g-piece-label">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {rules && (rules.summary.length > 0 || rules.editor) && (
            <section className="g-panel g-lobby-rules" aria-label="Rules for this game">
              <h2 className="g-panel-title">Rules for this game</h2>
              {isHost && rules.editor ? (
                <div className="g-lobby-rules-edit">{rules.editor}</div>
              ) : (
                <ul className="g-lobby-rules-list">
                  {rules.summary.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
              {isHost && rules.editor && <p className="g-hint">Everyone in the room sees these as you change them.</p>}
            </section>
          )}

          </div>
        </>
      )}
    </div>
  );
}
