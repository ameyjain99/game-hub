import { useState } from 'react';
import { ArrowDownAZ } from '../../../shared/icons';

/**
 * How a player likes their hand arranged: one of a game's sort modes, cycled
 * with a button and remembered on this device for next time.
 */
export function useSortMode<M extends string>(storageKey: string, modes: readonly M[]): [M, () => void] {
  const [mode, setMode] = useState<M>(() => {
    try {
      const saved = localStorage.getItem(storageKey) as M | null;
      return saved && modes.includes(saved) ? saved : modes[0];
    } catch {
      return modes[0];
    }
  });
  const next = () => {
    const to = modes[(modes.indexOf(mode) + 1) % modes.length];
    setMode(to);
    try {
      localStorage.setItem(storageKey, to);
    } catch {
      // private mode: the choice lasts for this game only
    }
  };
  return [mode, next];
}

/** The button that cycles the sort mode; its label says how the hand is sorted now. */
export function SortButton({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" className={`kit-sort${className ? ` ${className}` : ''}`} onClick={onClick} aria-label={`Hand sorted ${label}. Change the order`} title="Change how your hand is sorted">
      <ArrowDownAZ size={14} aria-hidden="true" />
      {label}
    </button>
  );
}
