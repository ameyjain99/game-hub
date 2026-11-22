import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useSpaceName } from './boardNames';
import { layoutOf } from '../engine/board';
import type { MonopolyPlayer, MonopolyState } from '../engine/state';
import { useMediaQuery } from '../../../shared/useMediaQuery';
import { movePath, tokenAnchor, tokenColor, tokenLabel } from './board-layout';
import { playStep } from './sound';
import { TokenGlyph } from '../../../shared/pieces';

/** One square per hop; a direct move (jail, a card jump) glides in CSS instead. */
const HOP_MS = 110;
/** How far apart tokens sharing a square sit, as a fraction of the board; a
 *  crowd closes up (overlapping like stacked pieces) to stay on its square. */
const FAN = 0.03;
const FAN_SPAN = 0.062;

interface Shown {
  /** The square the token is drawn on (it trails the real one while walking). */
  sq: number;
  /** Whether it arrived by a direct glide rather than a walk. */
  glide: boolean;
  /** The jail flag that went with this square, to spot a fresh trip to jail. */
  jailed: boolean;
}

/** Each player's drawn square, walking a square at a time toward the real one. */
function useShownSquares(players: MonopolyPlayer[], instant: boolean, side: number): Record<string, Shown> {
  const [shown, setShown] = useState<Record<string, Shown>>(() =>
    Object.fromEntries(players.map((p) => [p.id, { sq: p.position, glide: false, jailed: p.inJail }])),
  );
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const signature = players.map((p) => `${p.id}:${p.position}:${p.inJail ? 1 : 0}`).join('|');

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const p of players) {
      const was = shownRef.current[p.id] ?? { sq: p.position, glide: false, jailed: p.inJail };
      const toJail = p.inJail && !was.jailed;
      const path = movePath(was.sq, p.position, toJail || instant, side);
      const steps = (p.position - was.sq + side * 4) % (side * 4);
      const glide = !instant && path.length === 1 && (toJail || steps > (side > 10 ? 15 : 12));
      const walking = !glide && !instant;
      path.forEach((sq, k) =>
        timers.push(
          setTimeout(() => {
            setShown((s) => ({ ...s, [p.id]: { sq, glide, jailed: p.inJail } }));
            if (walking) playStep(); // a faint tick per square walked
          }, HOP_MS * k),
        ),
      );
      if (path.length === 0 && was.jailed !== p.inJail) {
        // Left jail without moving (paid the fine): only the flag changes.
        timers.push(setTimeout(() => setShown((s) => ({ ...s, [p.id]: { ...was, jailed: p.inJail } })), 0));
      }
    }
    // A newer move cancels pending hops; the next run resumes from the drawn square.
    return () => timers.forEach(clearTimeout);
  }, [signature, instant]); // eslint-disable-line react-hooks/exhaustive-deps

  return shown;
}

/**
 * Player tokens, drawn over the board on their own layer so they can travel:
 * a roll walks the token through every square it passes, a trip to jail or a
 * long card jump glides straight there. 
 */
export function MonopolyTokens({
  view,
  nameFor,
  actorId,
  spotlight = null,
}: {
  view: MonopolyState;
  nameFor: (id: string) => string;
  actorId: string | undefined;
  /** A spotlit player's token stays bright while the rest of the board dims. */
  spotlight?: string | null;
}) {
  const nameOf = useSpaceName();
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const players = view.players.filter((p) => !p.bankrupt);
  const side = layoutOf(view.settings.board).side;
  const shown = useShownSquares(players, reduced, side);
  const sqOf = (p: MonopolyPlayer) => shown[p.id]?.sq ?? p.position;

  const bySquare = new Map<number, string[]>();
  for (const p of players) bySquare.set(sqOf(p), [...(bySquare.get(sqOf(p)) ?? []), p.id]);

  return (
    <div className="mono-token-layer">
      {players.map((p) => {
        const sq = sqOf(p);
        const group = bySquare.get(sq)!;
        const step = Math.min(FAN, FAN_SPAN / Math.max(1, group.length - 1));
        const spread = (group.indexOf(p.id) - (group.length - 1) / 2) * step;
        const a = tokenAnchor(sq, side);
        const x = a.x + (a.axis === 'x' ? spread : 0);
        const y = a.y + (a.axis === 'y' ? spread : 0);
        const jailed = p.inJail && sq === p.position;
        const style = {
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          '--tc': tokenColor(view.players.indexOf(p)),
        } as CSSProperties;
        return (
          <span
            key={p.id}
            data-token={p.id}
            role="img"
            aria-label={`${nameFor(p.id)} on ${nameOf(sq)}${jailed ? ', in jail' : ''}`}
            title={`${nameFor(p.id)}${jailed ? ' (in jail)' : ''}`}
            className={`mono-token is-placed${p.id === actorId ? ' is-active' : ''}${jailed ? ' is-jailed' : ''}${
              shown[p.id]?.glide ? ' is-gliding' : ''
            }${sq !== p.position ? ' is-moving' : ''}${spotlight && spotlight !== p.id ? ' is-dim' : ''}`}
            style={style}
          >
            {TokenGlyph({ id: p.avatar, size: 16 }) ?? tokenLabel(nameFor(p.id))}
          </span>
        );
      })}
    </div>
  );
}
