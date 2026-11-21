import { TOKENS, TokenGlyph } from '../../shared/pieces';
import type { LobbyPiece } from './OnlineLobby';

/** The shared playing pieces as the lobby offers them (Monopoly, Snakes & Ladders). */
export const TOKEN_PIECES: LobbyPiece[] = TOKENS.map((t) => ({
  id: t.id,
  label: t.label,
  node: (
    <span className="g-piece-token">
      <TokenGlyph id={t.id} size={16} />
    </span>
  ),
}));
