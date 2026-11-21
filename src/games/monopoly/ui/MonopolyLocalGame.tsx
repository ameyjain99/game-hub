import { useEffect, useMemo, useState } from 'react';
import { pickBotNames } from '../../../shared/botNames';
import { TOKEN_IDS } from '../../../shared/pieceIds';
import { TableProvider, useTableState } from '../../../online/TableContext';
import { createMonopolyGame, type MonopolyDifficulty, type SeatConfig, type Settings } from '../engine/state';
import { applyAction } from '../engine/reducer';
import { chooseMonopolyAction, monopolyActor } from '../engine/bot';
import { redactFor } from '../engine/redact';
import { MonopolyGame } from './MonopolyGame';

/** Bots act on a short timer so their moves are visible; auctions move faster. */
const BOT_DELAY_MS = 650;
const BOT_BID_DELAY_MS = 350;
const HUMAN_ID = 'p0';

/** Local Monopoly vs bots: owns the reducer. */
export function MonopolyLocalGame({
  playerCount,
  difficulty,
  seed,
  settings,
  onBackToHub,
}: {
  playerCount: number;
  difficulty: MonopolyDifficulty;
  seed?: number;
  /** Starting cash and house rules chosen on the landing page. */
  settings?: Partial<Settings>;
  onBackToHub: () => void;
}) {
  const configs = useMemo<SeatConfig[]>(() => {
    const bots = pickBotNames(playerCount - 1);
    return Array.from({ length: playerCount }, (_, i) => ({
        name: i === 0 ? 'You' : bots[i - 1],
        // Everyone gets a playing piece, as at a real board.
        avatar: TOKEN_IDS[i % TOKEN_IDS.length],
        isAI: i > 0,
        difficulty,
      }));
  }, [playerCount, difficulty]);
  const [state, setState] = useState(() =>
    // You always go first on your own device.
    createMonopolyGame(configs, seed ?? Math.floor(Math.random() * 2 ** 31), { ...settings, randomizeOrder: false }),
  );

  const actor = monopolyActor(state);
  const actorIsBot = state.players.find((p) => p.id === actor)?.isAI ?? false;

  useEffect(() => {
    if (state.phase === 'over' || !actorIsBot) return;
    const delay = state.pendingAuction ? BOT_BID_DELAY_MS : BOT_DELAY_MS;
    const t = setTimeout(() => setState((s) => applyAction(s, chooseMonopolyAction(s))), delay);
    return () => clearTimeout(t);
  }, [state, actorIsBot]);

  const nameFor = (id: string) => state.players.find((p) => p.id === id)?.name ?? id;
  const table = useTableState({ meId: HUMAN_ID, nameFor, players: state.players });

  return (
    <TableProvider value={table}>
    <MonopolyGame
      view={redactFor(state, HUMAN_ID)}
      meId={HUMAN_ID}
      nameFor={nameFor}
      onAction={(a) => setState((s) => applyAction(s, a))}
      onExit={onBackToHub}
      exitLabel="Back to games"
    />
    </TableProvider>
  );
}
