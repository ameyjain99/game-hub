import { useEffect, useState } from 'react';
import type { GameState } from '../engine/types';
import { useGame, aiActor } from './store';
import { TicketToRideSetup } from './TicketToRideSetup';
import { GameScreen } from './GameScreen';
import { PassScreen } from './PassScreen';
import { playerColor } from './colors';
import { cleanName } from './displayName';

export const AI_DELAY_MS = 750;

/** The human, if any, who must act right now (for the hotseat pass gate). */
function humanActor(state: GameState): string | null {
  if (state.phase === 'setup-tickets') {
    const p = state.players.find((x) => !x.isAI && x.pendingTickets.length > 0);
    return p?.id ?? null;
  }
  if (state.phase === 'turn' || state.phase === 'draw-tickets') {
    const cur = state.players[state.current];
    return cur && !cur.isAI ? cur.id : null;
  }
  return null;
}

export function LocalGame({
  onBackToHub,
  onPlayOnline,
  onPhase,
}: {
  onBackToHub?: () => void;
  onPlayOnline?: () => void;
  /** Reports whether a game is in progress (true) or at the setup screen (false). */
  onPhase?: (inGame: boolean) => void;
} = {}) {
  const { state, lastError, startGame, dispatch, runAiTurnIfNeeded, reset } = useGame();
  const [readyForId, setReadyForId] = useState<string | null>(null);

  // Let the URL reflect setup (/setup) vs an in-progress local game (/play).
  const inGame = state != null;
  useEffect(() => {
    onPhase?.(inGame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inGame]);

  // Drive AI moves on a timer so they animate visibly.
  useEffect(() => {
    if (!state) return;
    if (!aiActor(state)) return;
    const t = setTimeout(() => runAiTurnIfNeeded(), AI_DELAY_MS);
    return () => clearTimeout(t);
  }, [state, runAiTurnIfNeeded]);

  if (!state) {
    return (
      <TicketToRideSetup
        onStart={(configs, mapId, modeId) => startGame(configs, undefined, mapId, modeId)}
        onBackToHub={onBackToHub}
        onPlayOnline={onPlayOnline}
      />
    );
  }

  // Hotseat pass gate: only when 2+ humans share the device.
  const humanCount = state.players.filter((p) => !p.isAI).length;
  const actor = humanActor(state);
  if (humanCount >= 2 && actor && readyForId !== actor) {
    const seat = state.players.findIndex((p) => p.id === actor);
    return (
      <PassScreen
        playerName={cleanName(state.players[seat].name)}
        color={playerColor(seat)}
        onReady={() => setReadyForId(actor)}
      />
    );
  }

  // At game over the board stays up and the final results fill the side pane.
  return (
    <GameScreen
      state={state}
      lastError={lastError}
      dispatch={dispatch}
      onPlayAgain={() => {
        reset();
        setReadyForId(null);
      }}
      onExit={
        onBackToHub
          ? () => {
              reset();
              setReadyForId(null);
              onBackToHub();
            }
          : undefined
      }
    />
  );
}
