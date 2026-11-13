import type { GameState } from '../engine/types';
import { applyAction } from '../engine/reducer';
import { aiActor, legalActions } from '../engine/selectors';
import { chooseAction } from './bot';

/**
 * Drive AI seats forward: repeatedly apply the AI's chosen action while
 * `aiActor` names one, returning the state at which a human must act or the
 * game is over. Stops if the actor has no legal actions (mirrors the UI store).
 */
export function advanceAi(state: GameState): GameState {
  let s = state;
  for (;;) {
    const id = aiActor(s);
    if (!id) return s;
    const player = s.players.find((p) => p.id === id)!;
    if (legalActions(s, id).length === 0) return s;
    s = applyAction(s, chooseAction(s, id, player.difficulty ?? 'normal'));
  }
}
