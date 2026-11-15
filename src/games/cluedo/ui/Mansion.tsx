import type { CSSProperties } from 'react';
import { CORRIDOR, DOORS, ROOM_BOX, SIZE, START, colOf, inRoom, passageFrom, rowOf, type Spot } from '../board';
import type { ClState } from '../engine';
import { ROOMS, SUSPECTS, WEAPONS, type Room, type Suspect, type Weapon } from '../engine/cards';
import { SUSPECT_COLOR, inkOn, suspectInitial } from './palette';

const ROOM_FILL: Record<Room, string> = {
  Study: '#2d2a24',
  Hall: '#2a2f3b',
  Lounge: '#35283b',
  Library: '#2f2b20',
  'Billiard Room': '#1f3531',
  'Dining Room': '#3b2a2a',
  Conservatory: '#243829',
  Ballroom: '#30293f',
  Kitchen: '#3a3226',
};

const CASE = { r: 9, c: 9, w: 6, h: 6 };

/** Where a token sits: the centre of its square, or a slot in its room. */
function tokenSpot(s: ClState, x: Suspect): { x: number; y: number } {
  const at = s.pos[x];
  if (!inRoom(at)) return { x: colOf(at) + 0.5, y: rowOf(at) + 0.5 };
  const box = ROOM_BOX[at];
  const here = SUSPECTS.filter((y) => s.pos[y] === at);
  const i = here.indexOf(x);
  const perRow = Math.max(1, Math.floor((box.w - 0.6) / 0.9));
  const row = Math.floor(i / perRow);
  const inRow = Math.min(perRow, here.length - row * perRow);
  return { x: box.c + box.w / 2 + ((i % perRow) - (inRow - 1) / 2) * 0.9, y: box.r + box.h / 2 - 0.1 + row * 0.9 };
}

/** The weapons in a room, as chips flowing along its floor from the bottom-left. */
function WeaponChips({ room, weapons }: { room: Room; weapons: Weapon[] }) {
  const box = ROOM_BOX[room];
  let x = box.c + 0.3;
  let y = box.r + box.h - 0.75;
  return (
    <>
      {weapons.map((w) => {
        const width = 0.5 + w.length * 0.27;
        if (x + width > box.c + box.w - 0.3) {
          x = box.c + 0.3;
          y -= 0.62;
        }
        const chip = (
          <g key={w} className="cl-weapon">
            <rect x={x} y={y} width={width} height={0.5} rx={0.25} />
            <text x={x + width / 2} y={y + 0.355}>
              {w}
            </text>
          </g>
        );
        x += width + 0.15;
        return chip;
      })}
    </>
  );
}

function PassageMark({ room }: { room: Room }) {
  const to = passageFrom(room);
  if (!to) return null;
  const box = ROOM_BOX[room];
  return (
    <g className="cl-passage">
      <text x={box.c + 0.4} y={box.r + 1.35}>
        Passage: {to}
      </text>
    </g>
  );
}

export function Mansion({
  s,
  meId,
  spotlight,
  canMove,
  onMove,
}: {
  s: ClState;
  meId: string;
  spotlight: string | null;
  canMove: boolean;
  onMove: (to: Spot) => void;
}) {
  const actor = s.phase === 'disprove' ? null : s.players[s.current];
  const reach = canMove ? s.reach : null;
  const spotSuspect = s.players.find((p) => p.id === spotlight)?.suspect ?? null;
  const starts = new Map(SUSPECTS.map((x) => [START[x], x]));
  return (
    <svg className="cl-mansion" viewBox={`-0.4 -0.4 ${SIZE + 0.8} ${SIZE + 0.8}`} role="img" aria-label="The mansion">
      <rect className="cl-floor" x={-0.4} y={-0.4} width={SIZE + 0.8} height={SIZE + 0.8} rx={0.6} />
      {CORRIDOR.map((i) => {
        const x = starts.get(i);
        return (
          <rect
            key={i}
            className={`cl-tile${x ? ' is-start' : ''}`}
            x={colOf(i) + 0.04}
            y={rowOf(i) + 0.04}
            width={0.92}
            height={0.92}
            rx={0.12}
            style={x ? ({ '--tc': SUSPECT_COLOR[x] } as CSSProperties) : undefined}
          />
        );
      })}
      {ROOMS.map((room) => {
        const b = ROOM_BOX[room];
        return (
          <g key={room} className="cl-room">
            <rect x={b.c + 0.06} y={b.r + 0.06} width={b.w - 0.12} height={b.h - 0.12} rx={0.35} fill={ROOM_FILL[room]} />
            <text className="cl-room-name" x={b.c + 0.4} y={b.r + 0.8}>
              {room}
            </text>
            <PassageMark room={room} />
            <WeaponChips room={room} weapons={WEAPONS.filter((w) => s.weapons[w] === room)} />
          </g>
        );
      })}
      {DOORS.map((d) => {
        const [r1, c1, r2, c2] = [rowOf(d.inside), colOf(d.inside), rowOf(d.outside), colOf(d.outside)];
        const vertical = r1 === r2;
        const x = vertical ? Math.max(c1, c2) : c1 + 0.18;
        const y = vertical ? r1 + 0.18 : Math.max(r1, r2);
        return <line key={`${d.inside}-${d.outside}`} className="cl-door" x1={x} y1={y} x2={vertical ? x : x + 0.64} y2={vertical ? y + 0.64 : y} />;
      })}
      <g className="cl-case">
        <rect x={CASE.c + 0.2} y={CASE.r + 0.2} width={CASE.w - 0.4} height={CASE.h - 0.4} rx={0.5} />
        {s.over ? (
          <>
            <text className="cl-case-title" x={CASE.c + CASE.w / 2} y={CASE.r + 1.5}>
              Case solved
            </text>
            {[s.solution.suspect, s.solution.weapon, s.solution.room].map((t, i) => (
              <text key={t} className="cl-case-line" x={CASE.c + CASE.w / 2} y={CASE.r + 2.6 + i * 0.9}>
                {t}
              </text>
            ))}
          </>
        ) : (
          <>
            <path className="cl-envelope" d={`M${CASE.c + 1.6} ${CASE.r + 2}h2.8v2h-2.8zM${CASE.c + 1.6} ${CASE.r + 2}l1.4 1.1l1.4 -1.1`} />
            <text className="cl-case-title" x={CASE.c + CASE.w / 2} y={CASE.r + 5.1}>
              Case file
            </text>
          </>
        )}
      </g>
      {reach &&
        reach.rooms.map((room) => {
          const b = ROOM_BOX[room];
          return (
            <rect
              key={room}
              className="cl-room-pick"
              role="button"
              tabIndex={0}
              aria-label={`Enter the ${room}`}
              x={b.c + 0.06}
              y={b.r + 0.06}
              width={b.w - 0.12}
              height={b.h - 0.12}
              rx={0.35}
              onClick={() => onMove(room)}
              onKeyDown={(e) => e.key === 'Enter' && onMove(room)}
            />
          );
        })}
      {reach &&
        Object.keys(reach.squares).map((k) => {
          const i = Number(k);
          return (
            <g key={i} className="cl-step" role="button" tabIndex={0} aria-label="Move here" onClick={() => onMove(i)} onKeyDown={(e) => e.key === 'Enter' && onMove(i)}>
              <rect x={colOf(i)} y={rowOf(i)} width={1} height={1} />
              <circle cx={colOf(i) + 0.5} cy={rowOf(i) + 0.5} r={0.2} />
            </g>
          );
        })}
      {SUSPECTS.map((x) => {
        const { x: tx, y: ty } = tokenSpot(s, x);
        const player = s.players.find((p) => p.suspect === x);
        const cls = [
          'cl-token',
          !player && 'is-extra',
          actor?.suspect === x && 'is-turn',
          spotSuspect === x && 'is-spot',
          player?.id === meId && 'is-you',
          (player?.out || player?.left) && 'is-out',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <g key={x} className={cls} style={{ transform: `translate(${tx}px, ${ty}px)`, '--tc': SUSPECT_COLOR[x] } as CSSProperties}>
            <title>{player ? `${x} (${player.name})` : x}</title>
            <circle className="cl-token-ring" r={0.5} />
            <circle r={0.36} fill={SUSPECT_COLOR[x]} />
            <text y={0.13} fill={inkOn(x)}>
              {suspectInitial(x)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
