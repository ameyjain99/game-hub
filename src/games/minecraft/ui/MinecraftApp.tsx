import { useCallback, useEffect, useState } from 'react';
import { KitApp, type KitAppConfig } from '../../kit/ui/KitApp';
import { KitOnline } from '../../kit/ui/KitOnline';
import { freshSeed } from '../../kit/ui/KitLocal';
import { IllegalMove, type KitCommonAction } from '../../kit/engine';
import { BUILDER_COLORS, applyMinecraft, minecraftKit, createMinecraft, type MinecraftAction, type MinecraftState } from '../engine';
import { MinecraftGame } from './MinecraftGame';
import { MINECRAFT_RULES } from '../rules';

const CONFIG: KitAppConfig = {
  gameId: 'minecraft',
  title: 'Minecraft',
  meta: '1-8 builders · open-ended',
  localSeats: [1],
  onlineSeats: [2, 3, 4, 5, 6, 8],
  defaultSeats: 2,
  difficulties: [],
};

const SAVE_KEY = 'gamehub-minecraft-world';

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
function MinecraftLocal({ onExit }: { onExit: () => void }) {
  const make = (seed: number, saved?: SavedWorld) =>
    createMinecraft([{ name: 'You', isAI: false }], seed, saved ? { edits: saved.edits, tally: { placed: saved.placed, broken: saved.broken } } : {});
  const [state, setState] = useState<MinecraftState>(() => {
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
    (a: MinecraftAction | KitCommonAction) =>
      setState((s) => {
        try {
          return applyMinecraft(s, a, 'p0');
        } catch (err) {
          if (err instanceof IllegalMove) return s;
          throw err;
        }
      }),
    [],
  );

  return (
    <MinecraftGame
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

export function MinecraftApp({ onBackToHub }: { onBackToHub: () => void }) {
  return (
    <KitApp
      rules={MINECRAFT_RULES}
      config={CONFIG}
      onBackToHub={onBackToHub}
      localExtra={<p className="g-hint">Your own world, saved on this device as you build.</p>}
      renderLocal={(_, onExit) => <MinecraftLocal onExit={onExit} />}
      renderOnline={(intent, onExit, onCode) => (
        <KitOnline
          kit={minecraftKit}
          gameId="minecraft"
          title="Minecraft"
          intent={intent}
          onExit={onExit}
          onCode={onCode}
          difficulties={[]}
          colorFor={(i) => BUILDER_COLORS[i % BUILDER_COLORS.length]}
          render={(p) => <MinecraftGame {...p} />}
        />
      )}
    />
  );
}
