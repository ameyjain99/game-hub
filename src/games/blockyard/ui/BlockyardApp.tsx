import { useCallback, useEffect, useState } from 'react';
import { KitApp, type KitAppConfig } from '../../kit/ui/KitApp';
import { KitOnline } from '../../kit/ui/KitOnline';
import { freshSeed } from '../../kit/ui/KitLocal';
import { IllegalMove, type KitCommonAction } from '../../kit/engine';
import { BUILDER_COLORS, applyBlockyard, blockyardKit, createBlockyard, type BlockyardAction, type BlockyardState } from '../engine';
import { BlockyardGame } from './BlockyardGame';
import { BLOCKYARD_RULES } from '../rules';

const CONFIG: KitAppConfig = {
  gameId: 'blockyard',
  title: 'Blockyard',
  meta: '1-8 builders · open-ended',
  localSeats: [1],
  onlineSeats: [2, 3, 4, 5, 6, 8],
  defaultSeats: 2,
  difficulties: [],
};

const SAVE_KEY = 'gamehub-blockyard-world';

interface SavedWorld {
  seed: number;
  edits: Record<number, number>;
  /** Your tally in this world, so it matches the world's changed blocks across visits. */
  placed: number;
  broken: number;
}

export function loadWorld(): SavedWorld | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const w = JSON.parse(raw);
    if (typeof w?.seed !== 'number' || !w.edits || typeof w.edits !== 'object') return null;
    if (typeof w.placed === 'number' && typeof w.broken === 'number') return { seed: w.seed, edits: w.edits, placed: w.placed, broken: w.broken };
    // Saved before tallies were kept: count each changed block as placed (a block) or broken (air).
    const changed = Object.values(w.edits as Record<number, number>);
    return { seed: w.seed, edits: w.edits, placed: changed.filter((b) => b !== 0).length, broken: changed.filter((b) => b === 0).length };
  } catch {
    return null;
  }
}

/** Your own world on this device, saved in the browser as you build. */
function BlockyardLocal({ onExit }: { onExit: () => void }) {
  const make = (seed: number, saved?: SavedWorld) =>
    createBlockyard([{ name: 'You', isAI: false }], seed, saved ? { edits: saved.edits, tally: { placed: saved.placed, broken: saved.broken } } : {});
  const [state, setState] = useState<BlockyardState>(() => {
    const saved = loadWorld();
    return saved ? make(saved.seed, saved) : make(freshSeed());
  });

  // Save a moment after building stops.
  const { placed, broken } = state.players[0];
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({ seed: state.seed, edits: state.edits, placed, broken }));
      } catch {
        /* storage full or blocked: the world just isn't kept */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [state.seed, state.edits, placed, broken]);

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
      rules={BLOCKYARD_RULES}
      config={CONFIG}
      onBackToHub={onBackToHub}
      localExtra={<p className="g-hint">Your own world, saved on this device as you build.</p>}
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
