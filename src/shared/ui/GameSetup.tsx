import { createContext, useContext, useEffect, useState } from 'react';
import { Eye } from '../icons';

/**
 * What the game on screen was set up with, a line per choice ("Expansion: Seafarers").
 * Whoever starts the game provides it: the local landing from its form, an online room from its options.
 */
export const SetupContext = createContext<string[]>([]);

/**
 * An eye in a game's header that opens the game's setup: the variation and the options it is being played with.
 * Renders nothing when the game has no choices to show. `lines` overrides the context for a game that reads its own state.
 */
export function SetupButton({ lines, className = 'g-icon-btn', size = 16 }: { lines?: string[]; className?: string; size?: number }) {
  const fromContext = useContext(SetupContext);
  const setup = lines ?? fromContext;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  if (setup.length === 0) return null;
  return (
    <>
      <button type="button" className={className} aria-label="This game's setup" title="This game's setup" onClick={() => setOpen(true)}>
        <Eye size={size} />
      </button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal-card g-setup" role="dialog" aria-label="This game's setup" onClick={(e) => e.stopPropagation()}>
            <h2>This game</h2>
            <ul className="g-setup-list">
              {setup.map((line) => {
                const cut = line.lastIndexOf(': ');
                return cut < 0 ? (
                  <li key={line}>
                    <b>{line}</b>
                  </li>
                ) : (
                  <li key={line}>
                    <span>{line.slice(0, cut)}</span>
                    <b>{line.slice(cut + 2)}</b>
                  </li>
                );
              })}
            </ul>
            <div className="modal-actions">
              <button type="button" className="primary" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
