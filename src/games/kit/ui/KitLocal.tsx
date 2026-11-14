import type { ReactNode } from 'react';
import type { GameKit } from '../engine';
import type { KitScreenProps } from './KitOnline';
import { LOCAL_ME, useLocalKit } from './useLocalKit';

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
  const { state, dispatch } = useLocalKit(kit, init, { asyncBot });
  const nameFor = (id: string) => kit.players(state).find((p) => p.id === id)?.name ?? id;
  return (
    <>
      {render({
        view: kit.redact(state, LOCAL_ME),
        meId: LOCAL_ME,
        nameFor,
        onAction: dispatch,
        onExit,
        exitLabel: 'Back to games',
      })}
    </>
  );
}

/** Seats for a local game: you, then numbered bots at one level. */
export function localSeats(count: number, difficulty: string) {
  return Array.from({ length: count }, (_, i) => ({
    name: i === 0 ? 'You' : count === 2 ? 'Bot' : `Bot ${i}`,
    isAI: i > 0,
    difficulty,
  }));
}

/** A fresh random seed. */
export const freshSeed = () => Math.floor(Math.random() * 2 ** 31);
