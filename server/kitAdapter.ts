import type { GameAdapter } from './gameAdapter';
import { BOT_DELAY_MS, IllegalMove, type GameKit } from '../src/games/kit/engine';

/**
 * The server adapter for any kit game. Bots here act one move at a time
 * (`botDelay` / `stepBot`), so everyone at the table watches each bot roll,
 * move or play instead of the result of a whole round arriving at once.
 */
export function kitAdapter<S, A extends { type: string }>(kit: GameKit<S, A>): GameAdapter {
  const botToAct = (s: S): string | null => {
    if (kit.isOver(s)) return null;
    const id = kit.actor(s);
    const p = id ? kit.players(s).find((pl) => pl.id === id) : undefined;
    return p?.isAI ? p.id : null;
  };

  return {
    turnMs: kit.turnMs,

    validateSeatCount: (count, options) => kit.seatError(count, options),

    createGame(configs, seed, options) {
      return kit.create(
        configs.map((c) => ({ name: c.name, isAI: c.isAI, difficulty: c.difficulty })),
        seed,
        options,
      );
    },

    applyAction(game, action, ctx) {
      const s = game as S;
      const type = (action as { type?: string } | null)?.type;
      if (typeof type !== 'string') return { error: 'malformed action' };
      try {
        if (type === 'SKIP_TURN') {
          // The clock ran out: make a cautious move for the idle player.
          if (kit.actor(s) !== ctx.actorId) return { error: 'not your turn' };
          return { game: kit.apply(s, kit.timeout(s), ctx.actorId) };
        }
        return { game: kit.apply(s, action as A, ctx.actorId) };
      } catch (err) {
        if (err instanceof IllegalMove) return { error: err.message };
        throw err;
      }
    },

    replaceWithAi(game, seatIndex, difficulty) {
      const s = game as S;
      const p = kit.players(s)[seatIndex];
      return p ? kit.setBot(s, p.id, difficulty ?? 'normal') : s;
    },

    removeSeat(game, seatIndex) {
      const s = game as S;
      const p = kit.players(s)[seatIndex];
      return p ? kit.forfeit(s, p.id) : s;
    },

    endGame: (game) => kit.end(game as S),

    turnActorId(game) {
      const s = game as S;
      if (kit.untimed || kit.isOver(s)) return null;
      const id = kit.actor(s);
      const p = id ? kit.players(s).find((pl) => pl.id === id) : undefined;
      return p && !p.isAI ? p.id : null;
    },

    redactFor: (game, playerId) => kit.redact(game as S, playerId),

    botDelay(game) {
      const s = game as S;
      return botToAct(s) ? kit.botDelay?.(s) ?? BOT_DELAY_MS : null;
    },

    stepBot(game) {
      const s = game as S;
      const id = botToAct(s);
      return id ? kit.apply(s, kit.bot(s), id) : s;
    },
  };
}
