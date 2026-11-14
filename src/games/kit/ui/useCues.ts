import { useEffect, useRef } from 'react';

/**
 * Play the sound cues one state change makes on this player's screen.
 * `cues(prev, next)` names them; `play` maps each name to its sound.
 */
export function useCues<S, C extends string>(view: S, cues: (prev: S, next: S) => C[], play: Record<C, () => void>): void {
  const prev = useRef(view);
  useEffect(() => {
    if (prev.current === view) return;
    const list = cues(prev.current, view);
    prev.current = view;
    for (const cue of list) play[cue]();
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps
}
