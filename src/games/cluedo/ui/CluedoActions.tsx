import { useState, type CSSProperties, type ReactNode } from 'react';
import type { CluedoAction } from '../engine/reducer';
import type { RedactedCluedoState } from '../engine/redact';
import { ROOMS, SUSPECTS, WEAPONS, type Card, type Room, type Suspect, type Weapon } from '../engine/cards';
import { Search } from '../../../shared/icons';
import { CardFace } from './CluedoHand';
import { SUSPECT_COLOR } from './palette';
import { describeReveal } from './revealText';

function Chips<T extends string>({
  label,
  items,
  value,
  onChange,
  dot,
}: {
  label: string;
  items: readonly T[];
  value: T;
  onChange: (v: T) => void;
  dot?: (v: T) => string;
}) {
  return (
    <div className="cl-chip-group" role="radiogroup" aria-label={label}>
      <span className="g-field-label">{label}</span>
      <div className="cl-chips">
        {items.map((it) => (
          <button
            key={it}
            type="button"
            role="radio"
            aria-checked={value === it}
            className={`cl-chip${value === it ? ' is-on' : ''}`}
            onClick={() => onChange(it)}
          >
            {dot && <span className="cl-chip-dot" style={{ background: dot(it) } as CSSProperties} />}
            {it}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Naming all three, with a clear warning: a wrong accusation knocks you out. */
function AccuseDialog({ onAccuse, onClose }: { onAccuse: (s: Suspect, w: Weapon, r: Room) => void; onClose: () => void }) {
  const [s, setS] = useState<Suspect>(SUSPECTS[0]);
  const [w, setW] = useState<Weapon>(WEAPONS[0]);
  const [r, setR] = useState<Room>(ROOMS[0]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card cl-accuse" role="dialog" aria-label="Make an accusation" onClick={(e) => e.stopPropagation()}>
        <h2>Make an accusation</h2>
        <p>Name the murderer, the weapon and the room. If you're wrong, you're out of the game (you still show cards).</p>
        <Chips label="Suspect" items={SUSPECTS} value={s} onChange={setS} dot={(x) => SUSPECT_COLOR[x]} />
        <Chips label="Weapon" items={WEAPONS} value={w} onChange={setW} />
        <Chips label="Room" items={ROOMS} value={r} onChange={setR} />
        <p className="cl-accuse-summary">
          It was <strong>{s}</strong> with the <strong>{w}</strong> in the <strong>{r}</strong>.
        </p>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="danger" onClick={() => onAccuse(s, w, r)}>
            Accuse
          </button>
        </div>
      </div>
    </div>
  );
}

function Panel({ kicker, title, children }: { kicker?: string; title?: string; children: ReactNode }) {
  return (
    <section className="cl-panel cl-act">
      {kicker && <p className="cl-kicker">{kicker}</p>}
      {title && <h2 className="cl-act-title">{title}</h2>}
      {children}
    </section>
  );
}

interface Props {
  view: RedactedCluedoState;
  meId: string;
  nameFor: (id: string) => string;
  onAction: (a: CluedoAction) => void;
  onExit: () => void;
}

/** The one decision in front of the viewer, with the latest suggestion's
 *  outcome alongside. */
export function CluedoActions({ view, meId, nameFor, onAction, onExit }: Props) {
  const [suspect, setSuspect] = useState<Suspect>(SUSPECTS[0]);
  const [weapon, setWeapon] = useState<Weapon>(WEAPONS[0]);
  const [accusing, setAccusing] = useState(false);

  const current = view.players[view.current];
  const me = view.players.find((p) => p.id === meId);
  const myTurn = current?.id === meId;
  const latest = view.lastReveal ? describeReveal(view.lastReveal, meId, nameFor) : null;
  const latestLine = latest ? (
    <p className="cl-latest">
      {latest.suggestion} <strong>{latest.outcome}</strong>
    </p>
  ) : null;

  if (view.phase === 'over') {
    return (
      <Panel kicker="Case closed" title={view.winner ? `${view.winner === meId ? 'You' : nameFor(view.winner)} solved it!` : 'Nobody solved it'}>
        {view.solution && (
          <>
            <p className="cl-muted">It was {view.solution.suspect}, with the {view.solution.weapon}, in the {view.solution.room}.</p>
            <div className="cl-hand">
              <CardFace card={view.solution.suspect} />
              <CardFace card={view.solution.weapon} />
              <CardFace card={view.solution.room} />
            </div>
          </>
        )}
        <div className="cl-act-row">
          <button type="button" className="primary" onClick={onExit}>
            Back to games
          </button>
        </div>
      </Panel>
    );
  }

  if (view.phase === 'disprove') {
    const s = view.pendingSuggestion!;
    if (view.pendingDisprover === meId) {
      const named: Card[] = [s.suspect, s.weapon, s.room];
      const matches = (me?.hand ?? []).filter((c) => named.includes(c));
      return (
        <Panel kicker="Disprove" title={`${nameFor(current.id)} suggested ${s.suspect} with the ${s.weapon} in the ${s.room}`}>
          <p className="cl-muted">You hold {matches.length > 1 ? 'some of these' : 'one of these'}. Show one card – only {nameFor(current.id)} will see it.</p>
          <div className="cl-hand">
            {matches.map((c) => (
              <CardFace key={c} card={c} onClick={() => onAction({ type: 'disprove', card: c })} />
            ))}
          </div>
        </Panel>
      );
    }
    return (
      <Panel kicker={myTurn ? 'Your suggestion' : `${nameFor(current.id)}'s turn`}>
        <p className="cl-status">{nameFor(view.pendingDisprover ?? '')} is checking their cards...</p>
        <p className="cl-muted">
          {myTurn ? 'You' : nameFor(current.id)} suggested {s.suspect} with the {s.weapon} in the {s.room}.
        </p>
      </Panel>
    );
  }

  if (!myTurn) {
    return (
      <Panel kicker={me?.eliminated ? "You're out – still showing cards" : undefined}>
        <p className="cl-status">{nameFor(current.id)} is taking their turn...</p>
        {latestLine}
      </Panel>
    );
  }

  if (view.phase === 'roll') {
    return (
      <Panel kicker={me?.room ? `In the ${me.room}` : 'In the hallway'} title="Your turn">
        {latestLine}
        <div className="cl-act-row">
          <button type="button" className="primary" onClick={() => onAction({ type: 'roll' })}>
            Roll &amp; move
          </button>
        </div>
      </Panel>
    );
  }

  if (view.phase === 'move') {
    return (
      <Panel kicker="Your turn" title="Move to a room">
        <div className="cl-chips">
          {view.moveOptions.map((r) => (
            <button key={r} type="button" className="cl-chip" onClick={() => onAction({ type: 'move', room: r })}>
              {r}
            </button>
          ))}
        </div>
        <p className="cl-muted">Or pick a highlighted room on the board.</p>
      </Panel>
    );
  }

  // decide
  const room = me?.room as Room;
  const suggested = view.lastReveal?.suggester === meId;
  return (
    <Panel kicker="Your turn" title={`In the ${room}`}>
      {suggested ? (
        latestLine
      ) : (
        <>
          <Chips label="Suspect" items={SUSPECTS} value={suspect} onChange={setSuspect} dot={(x) => SUSPECT_COLOR[x]} />
          <Chips label="Weapon" items={WEAPONS} value={weapon} onChange={setWeapon} />
        </>
      )}
      <div className="cl-act-row">
        {!suggested && (
          <button type="button" className="primary" onClick={() => onAction({ type: 'suggest', suspect, weapon })}>
            <Search size={16} />
            Suggest {suspect} with the {weapon}
          </button>
        )}
        {suggested && (
          <button type="button" className="primary" onClick={() => onAction({ type: 'endTurn' })}>
            End turn
          </button>
        )}
        <button type="button" className="g-btn g-btn-ghost" onClick={() => setAccusing(true)}>
          Make an accusation...
        </button>
        {!suggested && (
          <button type="button" className="g-btn g-btn-ghost" onClick={() => onAction({ type: 'endTurn' })}>
            End turn
          </button>
        )}
      </div>
      {accusing && (
        <AccuseDialog
          onClose={() => setAccusing(false)}
          onAccuse={(s, w, r) => {
            setAccusing(false);
            onAction({ type: 'accuse', suspect: s, weapon: w, room: r });
          }}
        />
      )}
    </Panel>
  );
}
