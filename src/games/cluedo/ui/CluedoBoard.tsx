import type { CSSProperties } from 'react';
import type { RedactedCluedoState, RedactedPlayer } from '../engine/redact';
import { SECRET_PASSAGES, type Room } from '../engine/cards';
import { DoorOpen } from '../../../shared/icons';
import { SUSPECT_COLOR, inkOn, suspectInitial } from './palette';

/** The nine rooms laid out as the mansion (corner rooms share secret passages). */
const LAYOUT: Room[] = [
  'Study', 'Hall', 'Lounge',
  'Library', 'Billiard Room', 'Dining Room',
  'Conservatory', 'Ballroom', 'Kitchen',
];

function Token({ p, meId, nameFor }: { p: RedactedPlayer; meId: string; nameFor: (id: string) => string }) {
  return (
    <span
      className={`cl-token${p.id === meId ? ' is-me' : ''}${p.eliminated ? ' is-out' : ''}`}
      style={{ '--tc': SUSPECT_COLOR[p.suspect], color: inkOn(p.suspect) } as CSSProperties}
      title={`${nameFor(p.id)} — ${p.suspect}`}
    >
      {suspectInitial(p.suspect)}
    </span>
  );
}

interface Props {
  view: RedactedCluedoState;
  meId: string;
  nameFor: (id: string) => string;
  /** Rooms the viewer may move to right now (empty unless it's their move). */
  reachable: Room[];
  onMove: (room: Room) => void;
}

/** The mansion: each room with its occupants, weapons and secret passage. */
export function CluedoBoard({ view, meId, nameFor, reachable, onMove }: Props) {
  const scene = view.pendingSuggestion?.room ?? view.lastReveal?.suggestion.room ?? null;
  const hallway = view.players.filter((p) => p.room === null);

  return (
    <div className="cl-board-wrap">
      <div className="cl-board" role="group" aria-label="Mansion">
        {LAYOUT.map((room) => {
          const here = view.players.filter((p) => p.room === room);
          const weapons = Object.entries(view.weaponRooms)
            .filter(([, r]) => r === room)
            .map(([w]) => w);
          const passage = SECRET_PASSAGES[room];
          const canGo = reachable.includes(room);
          const mine = view.players.find((p) => p.id === meId)?.room === room;
          const className = `cl-room${canGo ? ' is-reachable' : ''}${scene === room ? ' is-scene' : ''}${mine ? ' is-mine' : ''}`;
          const body = (
            <>
              <span className="cl-room-head">
                <span className="cl-room-name">{room}</span>
                {passage && (
                  <span className="cl-passage" title={`Secret passage to the ${passage}`}>
                    <DoorOpen size={12} />
                    {passage}
                  </span>
                )}
              </span>
              <span className="cl-room-tokens">
                {here.map((p) => (
                  <Token key={p.id} p={p} meId={meId} nameFor={nameFor} />
                ))}
              </span>
              {weapons.length > 0 && (
                <span className="cl-room-weapons">
                  {weapons.map((w) => (
                    <span key={w} className="cl-weapon">
                      {w}
                    </span>
                  ))}
                </span>
              )}
              {canGo && <span className="cl-room-cta">Move here</span>}
            </>
          );
          return canGo ? (
            <button key={room} type="button" className={className} aria-label={`Move to the ${room}`} onClick={() => onMove(room)}>
              {body}
            </button>
          ) : (
            <div key={room} className={className} aria-label={room}>
              {body}
            </div>
          );
        })}
      </div>
      {hallway.length > 0 && (
        <div className="cl-hallway">
          <span className="cl-hallway-label">Hallway</span>
          <span className="cl-room-tokens">
            {hallway.map((p) => (
              <Token key={p.id} p={p} meId={meId} nameFor={nameFor} />
            ))}
          </span>
        </div>
      )}
    </div>
  );
}
