import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** A piece arriving on a square, slid in from where it came from. */
export interface Arrival {
  from: number;
  to: number;
  /** Changes with every move, so the same squares can animate again. */
  key: string;
}

interface Props {
  /** Squares are 0..63, row-major from the top-left as the engine stores them. */
  flipped?: boolean;
  /** Game classes per square (light/dark, last move, selected, target...). */
  squareClass: (sq: number) => string;
  piece: (sq: number) => ReactNode;
  label: (sq: number) => string;
  onSquare: (sq: number) => void;
  onHover?: (sq: number | null) => void;
  /** Whether the piece on `sq` can be picked up and dragged. */
  canDrag?: (sq: number) => boolean;
  /** A dragged piece dropped on another square. */
  onDrop?: (from: number, to: number) => void;
  /** A piece picked up to drag (select it, to show its moves). */
  onPick?: (sq: number) => void;
  arrival?: Arrival | null;
  /** Pieces just captured, fading out where they stood. */
  ghosts?: { sq: number; node: ReactNode; key: string }[];
  /** Coordinates along the edges: files left→right and ranks top→bottom, as stored. */
  files?: string[];
  ranks?: string[];
  className?: string;
  ariaLabel: string;
}

const view = (sq: number, flipped: boolean) => (flipped ? 63 - sq : sq);

/**
 * An 8×8 board shared by Checkers and Chess: click a piece then a square, or
 * drag it; the piece that just moved slides in from its old square; captured
 * pieces fade where they stood.
 */
export function SquareBoard({
  flipped = false,
  squareClass,
  piece,
  label,
  onSquare,
  onHover,
  canDrag,
  onDrop,
  onPick,
  arrival,
  ghosts = [],
  files,
  ranks,
  className,
  ariaLabel,
}: Props) {
  const [drag, setDrag] = useState<{ from: number; x: number; y: number; moved: boolean } | null>(null);
  const press = useRef<{ from: number; x: number; y: number; moved: boolean } | null>(null);
  const size = useRef(0);
  // The latest handlers, read by the window listeners of a drag in progress.
  const handlers = useRef({ onDrop, onPick });
  handlers.current = { onDrop, onPick };
  const dragging = drag !== null;

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const p = press.current;
      if (!p) return;
      if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 4) {
        p.moved = true;
        handlers.current.onPick?.(p.from); // show where it can go while it's carried
      }
      setDrag({ from: p.from, x: e.clientX, y: e.clientY, moved: p.moved });
    };
    const up = (e: PointerEvent) => {
      const p = press.current;
      press.current = null;
      setDrag(null);
      if (!p?.moved) return; // a plain click: handled by onClick
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-sq]');
      const to = el ? Number(el.getAttribute('data-sq')) : NaN;
      if (Number.isFinite(to) && to !== p.from) handlers.current.onDrop?.(p.from, to);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [dragging]);

  const cells = Array.from({ length: 64 }, (_, i) => view(i, flipped));
  const arrivalStyle = (sq: number): CSSProperties | undefined => {
    if (!arrival || arrival.to !== sq) return undefined;
    const dx = (sq % 8) - (arrival.from % 8);
    const dy = Math.floor(sq / 8) - Math.floor(arrival.from / 8);
    const sign = flipped ? -1 : 1;
    return { '--dx': `${-dx * sign * 100}%`, '--dy': `${-dy * sign * 100}%` } as CSSProperties;
  };

  return (
    <div className={`sq-board${className ? ` ${className}` : ''}`} role="grid" aria-label={ariaLabel} onMouseLeave={() => onHover?.(null)}>
      {cells.map((sq, i) => {
        const p = piece(sq);
        const lifted = drag?.from === sq && drag.moved;
        const ghost = ghosts.find((g) => g.sq === sq);
        return (
          <button
            key={sq}
            type="button"
            role="gridcell"
            data-sq={sq}
            className={`sq ${squareClass(sq)}`}
            aria-label={label(sq)}
            onClick={() => onSquare(sq)}
            onMouseEnter={() => onHover?.(sq)}
            onFocus={() => onHover?.(sq)}
            onPointerDown={(e) => {
              if (!p || !canDrag?.(sq) || e.button !== 0) return;
              press.current = { from: sq, x: e.clientX, y: e.clientY, moved: false };
              size.current = (e.currentTarget as HTMLElement).getBoundingClientRect().width;
              setDrag({ ...press.current });
            }}
          >
            {files && i >= 56 && <span className="sq-file">{files[sq % 8]}</span>}
            {ranks && i % 8 === 0 && <span className="sq-rank">{ranks[Math.floor(sq / 8)]}</span>}
            {ghost && (
              <span key={ghost.key} className="sq-piece is-ghost" aria-hidden="true">
                {ghost.node}
              </span>
            )}
            {p && (
              <span
                key={arrival?.to === sq ? arrival.key : 'still'}
                className={`sq-piece${arrival?.to === sq ? ' is-arriving' : ''}${lifted ? ' is-lifted' : ''}`}
                style={arrivalStyle(sq)}
                aria-hidden="true"
              >
                {p}
              </span>
            )}
          </button>
        );
      })}
      {drag?.moved &&
        // Portalled: the board's size containment would otherwise anchor a fixed element to it.
        createPortal(
          <span
            className={`sq-piece is-dragging${className ? ` ${className}` : ''}`}
            style={{ left: drag.x, top: drag.y, width: size.current, height: size.current }}
            aria-hidden="true"
          >
            {piece(drag.from)}
          </span>,
          document.body,
        )}
    </div>
  );
}
