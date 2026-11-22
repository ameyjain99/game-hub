import { useEffect, useState, type CSSProperties } from 'react';
import { GameShell, SideSection } from '../../kit/ui/GameShell';
import { PlayersPanel } from '../../kit/ui/PlayersPanel';
import { ResultCard } from '../../kit/ui/ResultCard';
import { KitVideos, type KitScreenProps } from '../../kit/ui/KitOnline';
import { Die } from '../../kit/ui/Die';
import { TableMomentBanner, freshEvents, useTableMoments, type TableMoment } from '../../../shared/ui/TableMoment';
import { useCues } from '../../kit/ui/useCues';
import { CheckIcon, CloseIcon } from '../../../shared/icons';
import { inRoom, passageFrom } from '../board';
import { cluedoActor, matching, type ClAction, type ClEvent, type ClState, type Suggestion } from '../engine';
import { ROOMS, SUSPECTS, WEAPONS, type Card, type Room, type Suspect, type Triple, type Weapon } from '../engine/cards';
import { know } from '../knowledge';
import { CardFace, CluedoHand } from './CluedoHand';
import { Mansion } from './Mansion';
import { SUSPECT_COLOR, inkOn, suspectInitial } from './palette';
import { CL_SOUNDS, clCues } from './sound';

export const clSeatColor = (i: number) => SUSPECT_COLOR[SUSPECTS[i % SUSPECTS.length]];

const tripleText = (t: Triple) => `${t.suspect}, the ${t.weapon}, the ${t.room}`;

/** One line for a suggestion, from the viewer's side. */
function suggestionLine(sg: Suggestion, who: (id: string) => string, meId: string): string {
  const asked = `${who(sg.player)} suggested ${tripleText(sg.triple)}`;
  if (!sg.disprover) return `${asked}. Nobody could show a card.`;
  if (sg.card) return sg.player === meId ? `${who(sg.disprover)} showed you the ${sg.card}.` : `You showed ${who(sg.player)} the ${sg.card}.`;
  return `${asked}. ${who(sg.disprover)} showed a card.`;
}

/** How long each player's answer takes to come round the table. */
const PASS_MS = 700;

/**
 * A suggestion going round the table, one player at a time, as it does with
 * real cards: "Riya can't help... Bob can't help... Maya shows a card". The
 * game works the answers out at once; this plays them out so they can be followed.
 */
function PassAround({ passed, disprover, shown, who }: { passed: string[]; disprover: string | null; shown: boolean; who: (id: string) => string }) {
  const [step, setStep] = useState(0);
  const total = passed.length + 1;
  useEffect(() => {
    if (step >= total) return;
    const t = setTimeout(() => setStep((n) => n + 1), PASS_MS);
    return () => clearTimeout(t);
  }, [step, total]);
  return (
    <ol className="cl-pass" aria-label="Answers round the table">
      {passed.slice(0, step).map((id) => (
        <li key={id} className="is-no">
          <CloseIcon size={13} aria-hidden="true" /> {who(id)} can't help
        </li>
      ))}
      {step > passed.length &&
        (disprover ? (
          <li className="is-yes">
            <CheckIcon size={13} aria-hidden="true" /> {who(disprover)} {shown ? 'showed a card' : who(disprover) === 'You' ? 'have a card to show' : 'has a card to show'}
          </li>
        ) : (
          <li className="is-none">Nobody could show a card</li>
        ))}
    </ol>
  );
}

/** The case file opened at the end: its three cards come out one by one. */
function CaseReveal({ solution }: { solution: Triple }) {
  return (
    <div className="cl-reveal" role="status" aria-label={`The case file: ${solution.suspect}, the ${solution.weapon}, the ${solution.room}`}>
      <p className="cl-reveal-title">The case file</p>
      <div className="cl-reveal-cards">
        {[solution.suspect, solution.weapon, solution.room].map((c, i) => (
          <span key={c} className="cl-reveal-card" style={{ animationDelay: `${0.5 + i * 0.8}s` }}>
            <CardFace card={c} />
          </span>
        ))}
      </div>
    </div>
  );
}

function eventLine(e: ClEvent, who: (id: string) => string, meId: string): string | null {
  switch (e.kind) {
    case 'suggest': {
      const sg = e.s;
      const base = `${who(sg.player)} suggested ${tripleText(sg.triple)}`;
      if (!sg.disprover) return `${base}: nobody could show a card`;
      return `${base}: ${who(sg.disprover)} showed ${sg.card ? (sg.player === meId ? `you the ${sg.card}` : `the ${sg.card}`) : 'a card'}`;
    }
    case 'accuse':
      return `${who(e.player)} accused ${tripleText(e.triple)}: ${e.correct ? 'right!' : 'wrong'}`;
    case 'left':
      return `${who(e.player)} left; their cards are face up`;
    case 'move':
      return e.passage ? `${who(e.player)} took the secret passage to the ${e.to}` : null;
    default:
      return null;
  }
}

/** Pick one card from a category, as a row of chips. */
function Chooser<T extends string>({ label, items, value, onPick, colored }: { label: string; items: readonly T[]; value: T | null; onPick: (v: T) => void; colored?: boolean }) {
  return (
    <div className="cl-chooser" role="radiogroup" aria-label={label}>
      {items.map((it) => (
        <button
          key={it}
          type="button"
          role="radio"
          aria-checked={value === it}
          className={`cl-chip${value === it ? ' is-on' : ''}`}
          onClick={() => onPick(it)}
          style={colored ? ({ '--tc': SUSPECT_COLOR[it as unknown as Suspect] } as CSSProperties) : undefined}
        >
          {colored && <span className="cl-chip-dot" aria-hidden="true" />}
          {it}
        </button>
      ))}
    </div>
  );
}

function AccuseDialog({ onAccuse, onClose }: { onAccuse: (t: Triple) => void; onClose: () => void }) {
  const [suspect, setSuspect] = useState<Suspect | null>(null);
  const [weapon, setWeapon] = useState<Weapon | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  return (
    <div className="cl-modal" role="dialog" aria-label="Make an accusation">
      <div className="cl-modal-head">
        <h3>Make an accusation</h3>
        <button type="button" className="g-icon-btn" aria-label="Close" onClick={onClose}>
          <CloseIcon size={16} />
        </button>
      </div>
      <p className="kit-muted">Name the suspect, the weapon and the room. Right, and you win. Wrong, and you are out: you stop taking turns, but still show cards.</p>
      <Chooser label="Suspect" items={SUSPECTS} value={suspect} onPick={setSuspect} colored />
      <Chooser label="Weapon" items={WEAPONS} value={weapon} onPick={setWeapon} />
      <Chooser label="Room" items={ROOMS} value={room} onPick={setRoom} />
      <div className="cl-modal-actions">
        <button type="button" className="g-btn" onClick={onClose}>
          Not yet
        </button>
        <button type="button" className="primary is-danger" disabled={!suspect || !weapon || !room} onClick={() => onAccuse({ suspect: suspect!, weapon: weapon!, room: room! })}>
          Accuse
        </button>
      </div>
    </div>
  );
}

type Mark = '' | 'yes' | 'no' | 'maybe';
const NEXT_MARK: Record<Mark, Mark> = { '': 'yes', yes: 'no', no: 'maybe', maybe: '' };

/** The detective's notebook: who holds what. Your hand, cards shown to you and who
 *  passed fill in by themselves; tap any other cell to mark it yourself. */
function Notebook({ s, meId }: { s: ClState; meId: string }) {
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const k = know(s, meId, 'seen');
  const passes = new Set<string>();
  for (const e of s.log) {
    if (e.kind !== 'suggest') continue;
    for (const p of e.s.passed) for (const c of [e.s.triple.suspect, e.s.triple.weapon, e.s.triple.room]) passes.add(`${p}|${c}`);
  }
  const auto = (card: Card, id: string): Mark => {
    const h = k.possible.get(card)!;
    if (h.size === 1 && h.has(id)) return 'yes';
    if (passes.has(`${id}|${card}`) || (h.size === 1 && !h.has(id))) return 'no';
    return '';
  };
  const section = (title: string, cards: readonly Card[]) => {
    const left = cards.filter((c) => k.possible.get(c)!.size > 1 || k.possible.get(c)!.has('envelope')).length;
    return (
      <tbody key={title}>
        <tr className="cl-nb-section">
          <th colSpan={s.players.length + 1}>
            {title} <span>{left} left</span>
          </th>
        </tr>
        {cards.map((card) => {
          const ruled = k.possible.get(card)!.size === 1 && !k.possible.get(card)!.has('envelope');
          return (
            <tr key={card} className={ruled ? 'is-ruled' : undefined}>
              <th scope="row">{card}</th>
              {s.players.map((p) => {
                const a = auto(card, p.id);
                const m = a || marks[`${p.id}|${card}`] || '';
                return (
                  <td key={p.id}>
                    <button
                      type="button"
                      className={`cl-nb-cell is-${m || 'blank'}${a ? ' is-auto' : ''}`}
                      disabled={!!a}
                      aria-label={`${card}, ${p.name}: ${m || 'unmarked'}`}
                      onClick={() => setMarks((x) => ({ ...x, [`${p.id}|${card}`]: NEXT_MARK[x[`${p.id}|${card}`] ?? ''] }))}
                    >
                      {m === 'yes' ? <CheckIcon size={13} /> : m === 'no' ? <CloseIcon size={12} /> : m === 'maybe' ? '?' : null}
                    </button>
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    );
  };
  return (
    <table className="cl-notebook">
      <thead>
        <tr>
          <th />
          {s.players.map((p) => (
            <th key={p.id} title={p.name}>
              <span className="cl-nb-token" style={{ background: SUSPECT_COLOR[p.suspect], color: inkOn(p.suspect) }}>
                {suspectInitial(p.suspect)}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      {section('Suspects', SUSPECTS)}
      {section('Weapons', WEAPONS)}
      {section('Rooms', ROOMS)}
    </table>
  );
}

export function CluedoGame({ view: s, meId, nameFor, onAction, onExit, exitLabel, online }: KitScreenProps<ClState, ClAction>) {
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const [accusing, setAccusing] = useState(false);
  const [suspect, setSuspect] = useState<Suspect | null>(null);
  const [weapon, setWeapon] = useState<Weapon | null>(null);
  useCues(s, (a, b) => clCues(a, b, meId, cluedoActor), CL_SOUNDS);
  // A suggestion's answer and an accusation are what everyone is waiting to hear.
  const moment = useTableMoments(s, (a, b): TableMoment[] =>
    freshEvents(a.log, b.log).flatMap((e): TableMoment[] => {
      const name = (id: string) => (id === meId ? 'You' : nameFor(id));
      const colorOf = (id: string) => SUSPECT_COLOR[b.players.find((p) => p.id === id)?.suspect ?? SUSPECTS[0]];
      if (e.kind === 'suggest') {
        return [
          {
            kicker: `${name(e.s.player)} suggested ${tripleText(e.s.triple)}`,
            title: e.s.disprover ? `${name(e.s.disprover)} showed a card` : 'Nobody could show a card!',
            color: e.s.disprover ? colorOf(e.s.disprover) : '#f2c548',
            afterMs: e.s.disprover ? 0 : (e.s.passed.length + 1) * PASS_MS,
          },
        ];
      }
      if (e.kind === 'accuse') {
        return [{ kicker: `${name(e.player)} accused ${tripleText(e.triple)}`, title: e.correct ? 'Case solved!' : 'Wrong - out of the hunt', color: e.correct ? '#3fbf6f' : '#e2483b', feels: { [e.player]: e.correct ? 'good' : 'bad' } }];
      }
      return [];
    }),
  );
  useEffect(() => {
    setSuspect(null);
    setWeapon(null);
    setAccusing(false);
  }, [s.turn]);

  const who = (id: string) => (id === meId ? 'You' : nameFor(id));
  const actorId = cluedoActor(s);
  const cur = s.players[s.current];
  const me = s.players.find((p) => p.id === meId);
  const myTurn = !s.over && cur.id === meId && s.phase !== 'disprove';
  const here = me ? s.pos[me.suspect] : null;
  const rolls = s.log.filter((e) => e.kind === 'roll').length;
  const lastSuggest = [...s.log].reverse().find((e) => e.kind === 'suggest');
  const thisTurnSuggest = s.suggested && lastSuggest?.kind === 'suggest' && lastSuggest.s.player === cur.id ? lastSuggest.s : null;

  let dock;
  if (s.phase === 'disprove' && s.pending) {
    const asker = who(cur.id);
    const t = s.pending.triple;
    dock =
      s.pending.disprover === meId ? (
        <div className="cl-dock-block">
          <p className="cl-dock-title">
            {asker} suggested {tripleText(t)}. Show one card:
          </p>
          <div className="cl-show">
            {matching(me!.hand, t).map((c) => (
              <CardFace key={c} card={c} onClick={() => onAction({ type: 'SHOW', card: c })} />
            ))}
          </div>
        </div>
      ) : (
        <p className="cl-dock-line">
          <b>{asker}</b> suggested {tripleText(t)}. Waiting for <b>{who(s.pending.disprover)}</b> to show a card
          <span className="cl-dots" />
        </p>
      );
  } else if (myTurn && s.phase === 'turn') {
    const passage = here && inRoom(here) ? passageFrom(here) : undefined;
    dock = (
      <div className="cl-dock-block">
        <p className="cl-dock-title">Your turn{here && inRoom(here) ? `, in the ${here}` : ''}</p>
        <div className="cl-actions">
          <button type="button" className="primary" onClick={() => onAction({ type: 'ROLL' })}>
            Roll the dice
          </button>
          {passage && (
            <button type="button" className="g-btn" onClick={() => onAction({ type: 'PASSAGE' })}>
              Secret passage to the {passage}
            </button>
          )}
          {s.summoned.includes(meId) && here && inRoom(here) && (
            <button type="button" className="g-btn" onClick={() => onAction({ type: 'STAY' })}>
              Stay and suggest here
            </button>
          )}
          <button type="button" className="g-btn is-danger" onClick={() => setAccusing(true)}>
            Accuse
          </button>
        </div>
      </div>
    );
  } else if (myTurn && s.phase === 'move' && s.dice) {
    dock = (
      <p className="cl-dock-line">
        <b>You rolled {s.dice[0] + s.dice[1]}.</b> Walk up to {s.dice[0] + s.dice[1]} squares: pick a lit square, or a lit room to step into it.
      </p>
    );
  } else if (myTurn && s.phase === 'suggest' && here && inRoom(here)) {
    dock = thisTurnSuggest ? (
      <div className="cl-dock-block">
        <p className="cl-dock-title">{suggestionLine(thisTurnSuggest, who, meId)}</p>
        <div className="cl-actions">
          <button type="button" className="primary" onClick={() => onAction({ type: 'END' })}>
            End turn
          </button>
          <button type="button" className="g-btn is-danger" onClick={() => setAccusing(true)}>
            Accuse
          </button>
        </div>
      </div>
    ) : (
      <div className="cl-dock-block">
        <p className="cl-dock-title">Suggest who did it in the {here}, and with what</p>
        <Chooser label="Suspect" items={SUSPECTS} value={suspect} onPick={setSuspect} colored />
        <Chooser label="Weapon" items={WEAPONS} value={weapon} onPick={setWeapon} />
        <div className="cl-actions">
          <button type="button" className="primary" disabled={!suspect || !weapon} onClick={() => onAction({ type: 'SUGGEST', suspect: suspect!, weapon: weapon! })}>
            Suggest
          </button>
          <button type="button" className="g-btn" onClick={() => onAction({ type: 'END' })}>
            End turn
          </button>
          <button type="button" className="g-btn is-danger" onClick={() => setAccusing(true)}>
            Accuse
          </button>
        </div>
      </div>
    );
  } else if (!s.over) {
    const latest = lastSuggest?.kind === 'suggest' ? lastSuggest.s : null;
    dock = (
      <p className="cl-dock-line">
        <b>{who(cur.id)}</b> {s.phase === 'move' ? 'is on the move' : s.phase === 'suggest' ? 'is in the ' + String(s.pos[cur.suspect]) : 'is taking a turn'}
        <span className="cl-dots" />
        {latest && <span className="cl-dock-sub">{suggestionLine(latest, who, meId)}</span>}
      </p>
    );
  }

  const board = (
    <div className="cl-stage">
      <div className="kit-board cl-board">
        <Mansion s={s} meId={meId} spotlight={spotlight} canMove={myTurn && s.phase === 'move'} onMove={(to) => onAction({ type: 'MOVE', to })} />
        {accusing && (
          <AccuseDialog
            onClose={() => setAccusing(false)}
            onAccuse={(t) => {
              setAccusing(false);
              onAction({ type: 'ACCUSE', ...t });
            }}
          />
        )}
      </div>
    </div>
  );
  // What is happening now, and what you can do about it: beside the board, so
  // the board keeps the whole height.
  const now = dock && (
    <SideSection title="Now" className="cl-now">
      <div className="cl-dock">
        {s.dice && (
          <div className="cl-dice">
            <Die value={s.dice[0]} rollKey={rolls} size={38} label="First die" />
            <Die value={s.dice[1]} rollKey={rolls} size={38} label="Second die" />
          </div>
        )}
        {dock}
        {s.pending ? (
          <PassAround key={`${cur.id}|${tripleText(s.pending.triple)}`} passed={s.pending.passed} disprover={s.pending.disprover} shown={false} who={who} />
        ) : (
          s.suggested && lastSuggest?.kind === 'suggest' && (
            <PassAround key={`${lastSuggest.s.player}|${tripleText(lastSuggest.s.triple)}`} passed={lastSuggest.s.passed} disprover={lastSuggest.s.disprover} shown who={who} />
          )
        )}
      </div>
    </SideSection>
  );

  const winner = s.winner;
  const overlay = s.over ? (
    <ResultCard
      kicker="Case closed"
      title={winner ? (winner === meId ? 'You solved the case' : `${nameFor(winner)} solved the case`) : 'The case went unsolved'}
      won={winner === meId}
      onRematch={() => onAction({ type: 'REMATCH' })}
      rematchLabel="New case"
      onExit={onExit}
      exitLabel={exitLabel}
      delayMs={4200}
    >
      <p>
        It was <b>{s.solution.suspect}</b>, with the <b>{s.solution.weapon}</b>, in the <b>{s.solution.room}</b>.
      </p>
    </ResultCard>
  ) : null;

  const events = s.log
    .map((e) => ({ e, text: eventLine(e, who, meId) }))
    .filter((x) => x.text)
    .reverse()
    .slice(0, 40);

  const left = (
    <>
      <KitVideos
        online={online}
        meId={meId}
        nameFor={nameFor}
        onSeatHover={setSpotlight}
        seats={s.players
          .filter((p) => !p.isAI && !p.left)
          .map((p) => ({
            id: p.id,
            accent: SUSPECT_COLOR[p.suspect],
            active: actorId === p.id,
            badge: (
              <span className="kit-badge" style={{ '--tc': SUSPECT_COLOR[p.suspect] } as CSSProperties}>
                {suspectInitial(p.suspect)}
              </span>
            ),
          }))}
      />
      {now}
      <PlayersPanel
        title="Detectives"
        spotlight={spotlight}
        onSpotlight={setSpotlight}
        players={s.players.map((p) => {
          const at = s.pos[p.suspect];
          return {
            id: p.id,
            name: nameFor(p.id),
            you: p.id === meId,
            color: SUSPECT_COLOR[p.suspect],
            badge: suspectInitial(p.suspect),
            detail: `${p.suspect} · ${p.left ? 'Left' : p.out ? 'Out' : inRoom(at) ? at : 'Corridor'}`,
            trailing: `${p.cards} cards`,
            active: actorId === p.id,
            out: p.out || p.left,
          };
        })}
      />
      {me && me.hand.length > 0 && (
        <SideSection title="Your cards">
          <CluedoHand hand={me.hand} dealing={s.log.length === 0 && !s.over} />
        </SideSection>
      )}
    </>
  );
  const side = me ? (
    <SideSection title="Notebook" className="cl-notes">
      <Notebook s={s} meId={meId} />
    </SideSection>
  ) : null;

  let status;
  if (s.over) status = winner ? <><strong>{who(winner)}</strong> solved the case</> : <>The case went unsolved</>;
  else if (s.phase === 'disprove' && s.pending) status = s.pending.disprover === meId ? <><strong>Show a card</strong> to {who(cur.id)}</> : <><strong>{who(s.pending.disprover)}</strong> is choosing a card</>;
  else if (myTurn) status = <><strong>Your turn</strong> · {s.phase === 'move' ? 'move' : s.phase === 'suggest' ? 'suggest or end' : 'roll or accuse'}</>;
  else status = <><strong>{nameFor(cur.id)}</strong>&apos;s turn</>;

  return (
    <GameShell
      className="cl-game"
      title="Cluedo"
      exitLabel={exitLabel}
      onExit={onExit}
      status={status}
      headerExtra={online?.clock}
      banner={online?.banner}
      board={board}
      overlay={
        <>
          <TableMomentBanner moment={moment} place="top" />
          {s.over && <CaseReveal solution={s.solution} />}
          {overlay}
        </>
      }
      side={side}
      log={
        <>
          {left}
        <SideSection title="Case log">
          {events.length === 0 ? (
            <p className="kit-muted">Suggestions and accusations land here.</p>
          ) : (
            <ul className="kit-log">
              {events.map(({ e, text }) => (
                <li key={e.seq} className={e.kind === 'accuse' ? 'is-win' : undefined}>
                  {text}
                </li>
              ))}
            </ul>
          )}
        </SideSection>
        </>
      }
    />
  );
}
