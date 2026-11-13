import { create } from 'zustand';
import type { GameState, MapId } from '../engine/types';
import type { Action } from '../engine/actions';
import { IllegalActionError } from '../engine/actions';
import { createGame, type PlayerConfig } from '../engine/setup';
import { applyAction } from '../engine/reducer';
import { aiActor, legalActions } from '../engine/selectors';
import { chooseAction } from '../ai/bot';

export { aiActor };

export interface GameStore {
  state: GameState | null;
  lastError: string | null;
  seed: number;
  startGame(configs: PlayerConfig[], seed?: number, mapId?: MapId, modeId?: string): void;
  dispatch(action: Action): void;
  /** If it's an AI's move (setup or turn), have the AI act. Returns true if it did. */
  runAiTurnIfNeeded(): boolean;
  reset(): void;
}

export const useGame = create<GameStore>((set, get) => ({
  state: null,
  lastError: null,
  seed: 0,

  startGame(configs, seed = Math.floor(Math.random() * 2 ** 31), mapId, modeId) {
    set({ state: createGame(configs, seed, mapId, modeId), lastError: null, seed });
  },

  dispatch(action) {
    const { state } = get();
    if (!state) return;
    try {
      const next = applyAction(state, action);
      set({ state: next, lastError: null });
    } catch (err) {
      if (err instanceof IllegalActionError) {
        set({ lastError: err.message });
      } else {
        throw err;
      }
    }
  },

  runAiTurnIfNeeded() {
    const { state } = get();
    if (!state) return false;
    const actorId = aiActor(state);
    if (!actorId) return false;
    const player = state.players.find((p) => p.id === actorId)!;
    const legal = legalActions(state, actorId);
    if (legal.length === 0) return false;
    const action = chooseAction(state, actorId, player.difficulty ?? 'normal');
    set({ state: applyAction(state, action), lastError: null });
    return true;
  },

  reset() {
    set({ state: null, lastError: null });
  },
}));
