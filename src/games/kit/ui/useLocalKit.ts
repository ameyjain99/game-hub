import { useCallback, useEffect, useRef, useState } from 'react';
import { BOT_DELAY_MS, IllegalMove, type GameKit, type KitCommonAction } from '../engine';

/** The human's seat in a local game. */
export const LOCAL_ME = 'p0';

/**
 * A local game against bots: owns the state, applies the human's actions and
 * plays each bot's move after a short pause so it can be followed. A game may
 * supply `asyncBot` (Chess asks Stockfish in a worker) instead of `kit.bot`.
 */
export function useLocalKit<S, A extends { type: string }>(
  kit: GameKit<S, A>,
  init: () => S,
  opts: { asyncBot?: (state: S) => Promise<A> } = {},
) {
  const [state, setState] = useState(init);
  const asyncBot = useRef(opts.asyncBot);
  asyncBot.current = opts.asyncBot;

  const actor = kit.actor(state);
  const botUp = !kit.isOver(state) && !!actor && !!kit.players(state).find((p) => p.id === actor)?.isAI;

  useEffect(() => {
    if (!botUp || !actor) return;
    let live = true;
    const timer = setTimeout(async () => {
      const action = asyncBot.current ? await asyncBot.current(state) : kit.bot(state);
      // Only if nothing else changed the game while the bot was thinking.
      if (live) setState((s) => (s === state ? kit.apply(s, action, actor) : s));
    }, kit.botDelay?.(state) ?? BOT_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [state, botUp, actor, kit]);

  /** The human's action; an illegal one (a stale click) is ignored. */
  const dispatch = useCallback(
    (action: A | KitCommonAction) =>
      setState((s) => {
        try {
          return kit.apply(s, action, LOCAL_ME);
        } catch (err) {
          if (err instanceof IllegalMove) return s;
          throw err;
        }
      }),
    [kit],
  );

  return { state, dispatch, setState };
}
