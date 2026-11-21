import { useEffect, useRef } from 'react';

/**
 * Moves in numbered pairs (White/Black or Black/White), kept scrolled to the
 * latest. With `onPick`, a move can be clicked to look at the position after
 * it (`picked` is how many moves in; null is the live game).
 */
export function MoveList({ moves, empty, picked = null, onPick }: { moves: string[]; empty: string; picked?: number | null; onPick?: (count: number | null) => void }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && picked === null) el.scrollTop = el.scrollHeight;
  }, [moves.length, picked]);
  if (moves.length === 0) return <p className="kit-muted">{empty}</p>;
  const pairs: string[][] = [];
  moves.forEach((m, i) => (i % 2 === 0 ? pairs.push([m]) : pairs[pairs.length - 1].push(m)));
  const cell = (text: string | undefined, count: number) =>
    text === undefined ? (
      <span />
    ) : onPick ? (
      <button
        type="button"
        className={`kit-move${picked === count ? ' is-picked' : ''}`}
        aria-pressed={picked === count}
        aria-label={`Look at the position after ${text}`}
        onClick={() => onPick(count === moves.length ? null : picked === count ? null : count)}
      >
        {text}
      </button>
    ) : (
      <span>{text}</span>
    );
  return (
    <>
      <ol className="kit-moves" ref={ref} aria-label="Moves">
        {pairs.map((pr, i) => (
          <li key={i} className={i === pairs.length - 1 && picked === null ? 'is-latest' : undefined}>
            <span className="kit-move-no">{i + 1}.</span>
            {cell(pr[0], i * 2 + 1)}
            {cell(pr[1], i * 2 + 2)}
          </li>
        ))}
      </ol>
      {onPick && picked !== null && (
        <button type="button" className="g-btn g-btn-sm g-btn-light kit-move-live" onClick={() => onPick(null)}>
          Back to the game
        </button>
      )}
    </>
  );
}
