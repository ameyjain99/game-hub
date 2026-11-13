import type { CSSProperties } from 'react';
import type { RedactedCluedoState } from '../engine/redact';
import { SUSPECT_COLOR, inkOn, suspectInitial } from './palette';

/** Everyone at the table: character, where they are, cards held, who's up. */
export function CluedoPlayers({
  view,
  meId,
  nameFor,
  actorId,
}: {
  view: RedactedCluedoState;
  meId: string;
  nameFor: (id: string) => string;
  actorId: string | null | undefined;
}) {
  return (
    <ul className="cl-players" aria-label="Players">
      {view.players.map((p) => (
        <li
          key={p.id}
          className={`cl-player${p.id === actorId && view.phase !== 'over' ? ' is-turn' : ''}${p.eliminated ? ' is-out' : ''}`}
          style={{ '--tc': SUSPECT_COLOR[p.suspect] } as CSSProperties}
        >
          <span className="cl-token is-static" style={{ '--tc': SUSPECT_COLOR[p.suspect], color: inkOn(p.suspect) } as CSSProperties}>
            {suspectInitial(p.suspect)}
          </span>
          <span className="cl-player-text">
            <span className="cl-player-name">
              {nameFor(p.id)}
              {p.id === meId && nameFor(p.id) !== 'You' && <span className="g-tag">You</span>}
              {p.eliminated && <span className="g-tag g-tag-warn">Out</span>}
            </span>
            <span className="cl-player-meta">
              {p.suspect} · {p.room ?? 'Hallway'}
            </span>
          </span>
          <span className="cl-player-cards" title="Cards in hand">
            {p.handCount}
            <span> cards</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
