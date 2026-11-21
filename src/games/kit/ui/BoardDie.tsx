import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Die } from './Die';

/** How long the die stays in view after it settles, before stepping back. */
const LINGER_MS = 1300;
/** A roll the server never answers stops tumbling after this. */
const GIVE_UP_MS = 3000;

/**
 * The die, on the board, where everyone is looking. On your roll it is the
 * button: click it (or press Space, handled by the game) and it starts to
 * tumble at once, before the server has answered. On anyone else's roll it
 * tumbles in the same place, so the whole table watches the same throw.
 */
export function BoardDie({
  value,
  rollKey,
  canRoll,
  onRoll,
  color,
  /** Step back (fade) when there is nothing to show: for a board with no free spot. */
  shy = false,
  className,
}: {
  value: number | null;
  rollKey: number;
  canRoll: boolean;
  onRoll: () => void;
  color?: string;
  shy?: boolean;
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const [fresh, setFresh] = useState(false);
  const seen = useRef(rollKey);

  useEffect(() => {
    if (rollKey === seen.current) return;
    seen.current = rollKey;
    setPending(false);
    setFresh(true);
    const t = setTimeout(() => setFresh(false), LINGER_MS);
    return () => clearTimeout(t);
  }, [rollKey]);

  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setPending(false), GIVE_UP_MS);
    return () => clearTimeout(t);
  }, [pending]);

  const live = canRoll && !pending;
  const hidden = shy && !canRoll && !pending && !fresh;
  const roll = () => {
    if (!live) return;
    setPending(true);
    onRoll();
  };
  return (
    <button
      type="button"
      className={`kit-board-die${live ? ' is-live' : ''}${hidden ? ' is-away' : ''}${className ? ` ${className}` : ''}`}
      style={color ? ({ '--tc': color } as CSSProperties) : undefined}
      disabled={!live}
      aria-label={live ? 'Throw the die' : value === null ? 'Die' : `Rolled ${value}`}
      onClick={roll}
    >
      <Die value={value} rollKey={rollKey} rolling={pending} size={0} />
      {live && <span className="kit-board-die-hint">Roll</span>}
    </button>
  );
}
