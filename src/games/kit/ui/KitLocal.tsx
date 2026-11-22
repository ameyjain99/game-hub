import type { ReactNode } from 'react';
import type { GameKit } from '../engine';
import type { KitScreenProps } from './KitOnline';
import { LOCAL_ME, useLocalKit } from './useLocalKit';
import { TableProvider, useTableState } from '../../../online/TableContext';
import { pickBotNames } from '../../../shared/botNames';
import { ActionToast } from '../../../online/ui/ActionToast';
import { OpeningCall, useGameStart } from '../../../shared/ui/OpeningCall';

/** A local game against bots, rendered with the game's shared screen. */
export function KitLocal<S, A extends { type: string }>({
  kit,
  init,
  onExit,
  render,
  asyncBot,
}: {
  kit: GameKit<S, A>;
  init: () => S;
  onExit: () => void;
  render: (props: KitScreenProps<S, A>) => ReactNode;
  asyncBot?: (state: S) => Promise<A>;
}) {
  const { state, dispatch, refused, clearRefused } = useLocalKit(kit, init, { asyncBot });
  const nameFor = (id: string) => kit.players(state).find((p) => p.id === id)?.name ?? id;
  const table = useTableState({ meId: LOCAL_ME, nameFor, players: kit.players(state) });
  // Who goes first, said once as the game (or a rematch) starts. Not for a game of one.
  const start = useGameStart(true, kit.isOver(state), true);
  const first = kit.players(state).length > 1 ? kit.players(state).find((p) => p.id === kit.actor(state)) : undefined;
  return (
    <TableProvider value={table}>
      {render({
        view: kit.redact(state, LOCAL_ME),
        meId: LOCAL_ME,
        nameFor,
        onAction: dispatch,
        onExit,
        exitLabel: 'Back to games',
      })}
      <ActionToast message={refused} onDone={clearRefused} />
      <OpeningCall start={start} name={first ? nameFor(first.id) : null} isMe={first?.id === LOCAL_ME} />
    </TableProvider>
  );
}

/** Seats for a local game: you, then bots (each under its own name) at one level. */
export function localSeats(count: number, difficulty: string) {
  const bots = pickBotNames(count - 1);
  return Array.from({ length: count }, (_, i) => ({
    name: i === 0 ? 'You' : bots[i - 1],
    isAI: i > 0,
    difficulty,
  }));
}

/** A fresh random seed. */
export const freshSeed = () => Math.floor(Math.random() * 2 ** 31);
