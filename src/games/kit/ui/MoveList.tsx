import { useEffect, useRef } from 'react';

/** Moves in numbered pairs (White/Black or Black/White), kept scrolled to the latest. */
export function MoveList({ moves, empty }: { moves: string[]; empty: string }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [moves.length]);
  if (moves.length === 0) return <p className="kit-muted">{empty}</p>;
  const pairs: string[][] = [];
  moves.forEach((m, i) => (i % 2 === 0 ? pairs.push([m]) : pairs[pairs.length - 1].push(m)));
  return (
    <ol className="kit-moves" ref={ref} aria-label="Moves">
      {pairs.map((pr, i) => (
        <li key={i} className={i === pairs.length - 1 ? 'is-latest' : undefined}>
          <span className="kit-move-no">{i + 1}.</span>
          <span>{pr[0]}</span>
          <span>{pr[1] ?? ''}</span>
        </li>
      ))}
    </ol>
  );
}
