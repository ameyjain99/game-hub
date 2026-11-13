import { useEffect, useMemo, useState } from 'react';
import { createCluedoGame, type CluedoDifficulty } from '../engine/state';
import { reduce, type CluedoAction } from '../engine/reducer';
import { chooseCluedoAction } from '../engine/bot';
import { redactFor } from '../engine/redact';
import { CluedoGame } from './CluedoGame';

const BOT_DELAY_MS = 700;
const HUMAN_ID = 'you';

function makeIds(playerCount: number): string[] {
  return [HUMAN_ID, ...Array.from({ length: playerCount - 1 }, (_, i) => `bot${i + 1}`)];
}

function displayName(id: string): string {
  return id === HUMAN_ID ? 'You' : `Bot ${id.replace('bot', '')}`;
}

/** Local Cluedo vs bots: owns the reducer and drives bot turns on a timer. */
export function CluedoLocalGame({
  playerCount,
  difficulty,
  onBackToHub,
}: {
  playerCount: number;
  difficulty: CluedoDifficulty;
  onBackToHub: () => void;
}) {
  const ids = useMemo(() => makeIds(playerCount), [playerCount]);
  const [state, setState] = useState(() =>
    createCluedoGame(ids, {
      seed: Math.floor(Math.random() * 2 ** 31),
      ai: ids.map((id) => id !== HUMAN_ID),
      difficulty: ids.map(() => difficulty),
    }),
  );

  const actorId = state.phase === 'disprove' ? state.pendingDisprover : state.players[state.current]?.id;
  const actorIsBot = state.players.find((p) => p.id === actorId)?.isAI ?? false;

  // Drive bot actions one at a time, with a small delay so they're visible.
  useEffect(() => {
    if (state.phase === 'over' || !actorIsBot) return;
    const t = setTimeout(() => setState((s) => reduce(s, chooseCluedoAction(s))), BOT_DELAY_MS);
    return () => clearTimeout(t);
  }, [state, actorIsBot]);

  return (
    <CluedoGame
      view={redactFor(state, HUMAN_ID)}
      meId={HUMAN_ID}
      nameFor={displayName}
      onAction={(a: CluedoAction) => setState((s) => reduce(s, a))}
      onExit={onBackToHub}
      exitLabel="Back to games"
    />
  );
}
