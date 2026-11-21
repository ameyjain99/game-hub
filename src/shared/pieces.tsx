import { Anchor, Bell, Bike, Compass, Crown, Feather, Flame, Ghost, Key, Rocket, Umbrella, Zap } from './icons';

/**
 * The playing pieces a player can pick in the lobby for games played with a
 * token on a board (Monopoly, Snakes & Ladders). GameHub's own set: everyday
 * shapes, none of them a published game's token.
 */
export const TOKENS = [
  { id: 'rocket', label: 'Rocket', Icon: Rocket },
  { id: 'anchor', label: 'Anchor', Icon: Anchor },
  { id: 'crown', label: 'Crown', Icon: Crown },
  { id: 'bike', label: 'Bicycle', Icon: Bike },
  { id: 'umbrella', label: 'Umbrella', Icon: Umbrella },
  { id: 'compass', label: 'Compass', Icon: Compass },
  { id: 'bell', label: 'Bell', Icon: Bell },
  { id: 'feather', label: 'Feather', Icon: Feather },
  { id: 'flame', label: 'Flame', Icon: Flame },
  { id: 'ghost', label: 'Ghost', Icon: Ghost },
  { id: 'key', label: 'Key', Icon: Key },
  { id: 'bolt', label: 'Lightning', Icon: Zap },
] as const;

export { TOKEN_IDS } from './pieceIds';

/** The picture for a token id, or null for an id that isn't one (then a seat shows its letter). */
export function TokenGlyph({ id, size = 16 }: { id: string | undefined; size?: number }) {
  const token = TOKENS.find((t) => t.id === id);
  if (!token) return null;
  const { Icon } = token;
  return <Icon size={size} strokeWidth={2.4} aria-hidden="true" />;
}

export const tokenName = (id: string | undefined): string | null => TOKENS.find((t) => t.id === id)?.label ?? null;
