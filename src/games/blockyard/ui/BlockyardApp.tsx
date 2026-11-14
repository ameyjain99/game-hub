import { useCallback, useEffect, useState } from 'react';
import { KitApp, type KitAppConfig } from '../../kit/ui/KitApp';
import { KitOnline } from '../../kit/ui/KitOnline';
import { freshSeed } from '../../kit/ui/KitLocal';
import { IllegalMove, type KitCommonAction } from '../../kit/engine';
import { BUILDER_COLORS, applyBlockyard, blockyardKit, createBlockyard, type BlockyardAction, type BlockyardState } from '../engine';
import { BlockyardGame } from './BlockyardGame';

const CONFIG: KitAppConfig = {
  gameId: 'blockyard',
  title: 'Blockyard',
  meta: '1–8 builders · open-ended',
  localSeats: [1],
  onlineSeats: [2, 3, 4, 5, 6, 8],
  defaultSeats: 2,
  difficulties: [],
};

const SAVE_KEY = 'gamehub-blockyard-world';

function loadWorld(): { seed: number; edits: Record<number, number> } | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const w = JSON.parse(raw);
    return typeof w?.seed === 'number' && w.edits && typeof w.edits === 'object' ? w : null;
  } catch {
    return null;
  }
}

/** Your own world on this device, saved in the browser as you build. */
function BlockyardLocal({ onExit }: { onExit: () => void }) {
  const make = (seed: number, edits?: Record<number, number>) => createBlockyard([{ name: 'You', isAI: false }], seed, { edits });
  const [state, setState] = useState<BlockyardState>(() => {
    const saved = loadWorld();
    return saved ? make(saved.seed, saved.edits) : make(freshSeed());
  });

  // Save a moment after building stops.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({ seed: state.seed, edits: state.edits }));
      } catch {
        /* storage full or blocked: the world just isn't kept */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [state.seed, state.edits]);

  const dispatch = useCallback(
    (a: BlockyardAction | KitCommonAction) =>
      setState((s) => {
        try {
          return applyBlockyard(s, a, 'p0');
        } catch (err) {
          if (err instanceof IllegalMove) return s;
          throw err;
        }
      }),
    [],
  );

  return (
    <BlockyardGame
      view={state}
      meId="p0"
      nameFor={() => 'You'}
      onAction={dispatch}
      onExit={onExit}
      exitLabel="Back to games"
      onNewWorld={() => setState(make(freshSeed()))}
    />
  );
}

export function BlockyardApp({ onBackToHub }: { onBackToHub: () => void }) {
  return (
    <KitApp
      config={CONFIG}
      onBackToHub={onBackToHub}
      renderLocal={(_, onExit) => <BlockyardLocal onExit={onExit} />}
      renderOnline={(intent, onExit, onCode) => (
        <KitOnline
          kit={blockyardKit}
          gameId="blockyard"
          title="Blockyard"
          intent={intent}
          onExit={onExit}
          onCode={onCode}
          difficulties={[]}
          colorFor={(i) => BUILDER_COLORS[i % BUILDER_COLORS.length]}
          render={(p) => <BlockyardGame {...p} />}
        />
      )}
    />
  );
}
