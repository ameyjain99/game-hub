import type { GameAdapter, SeatConfig, ApplyCtx } from './gameAdapter';
import { DEFAULT_MAP_ID, getMap } from '../src/games/ticket-to-ride/engine/maps';
import { createGame as createTtrGame, type PlayerConfig } from '../src/games/ticket-to-ride/engine/setup';
import { applyAction, removePlayer, finishIfAbandoned, endGame } from '../src/games/ticket-to-ride/engine/reducer';
import { IllegalActionError, type Action } from '../src/games/ticket-to-ride/engine/actions';
import { redactStateFor } from '../src/games/ticket-to-ride/engine/redact';
import { advanceAi } from '../src/games/ticket-to-ride/ai/driver';
import type { GameState, Difficulty } from '../src/games/ticket-to-ride/engine/types';
import {
  createMonopolyGame,
  type MonopolyState,
  type MonopolyDifficulty,
  type Settings as MonopolySettings,
} from '../src/games/monopoly/engine/state';
import {
  applyAction as applyMonopolyAction,
  finishIfAbandoned as finishMonopolyIfAbandoned,
  removePlayer as removeMonopolyPlayer,
  endGame as endMonopolyGame,
} from '../src/games/monopoly/engine/reducer';
import { IllegalActionError as MonopolyIllegalError, type Action as MonopolyActionType } from '../src/games/monopoly/engine/actions';
import { monopolyActor, advanceMonopolyAi, timeoutAction as monopolyTimeoutAction } from '../src/games/monopoly/engine/bot';
import { redactFor as redactMonopolyFor } from '../src/games/monopoly/engine/redact';
import { kitAdapter } from './kitAdapter';
import { ticTacToeKit } from '../src/games/tic-tac-toe/engine';
import { checkersKit } from '../src/games/checkers/engine';
import { chessKit } from '../src/games/chess/engine';
import { snlKit } from '../src/games/snakes-and-ladders/engine';
import { ludoKit } from '../src/games/ludo/engine';
import { lineupKit } from '../src/games/lineup/engine';
import { blockyardKit } from '../src/games/blockyard/engine';
import { lastCardKit } from '../src/games/last-card/engine';
import { pokerKit } from '../src/games/poker/engine';
import { cluedoKit } from '../src/games/cluedo/engine';
import { imposterKit } from '../src/games/imposter/engine';
import { hexKit } from '../src/games/hexstead/engine';
import { wordgridKit } from '../src/games/wordgrid/engine';
import { ensureDictionary } from './wordlist';

interface TtrOptions {
  mapId?: string;
  modeId?: string;
}

function toPlayerConfigs(configs: SeatConfig[]): PlayerConfig[] {
  return configs.map((c) =>
    c.isAI
      ? { name: c.name, isAI: true, difficulty: (c.difficulty ?? 'normal') as Difficulty, avatar: c.avatar }
      : { name: c.name, isAI: false, avatar: c.avatar },
  );
}

const ticketToRideAdapter: GameAdapter = {
  validateSeatCount(seatCount, options) {
    const o = (options ?? {}) as TtrOptions;
    const map = getMap(o.mapId ?? DEFAULT_MAP_ID); // throws on unknown map
    if (seatCount < map.minPlayers || seatCount > map.maxPlayers) {
      return `${map.name} supports ${map.minPlayers}-${map.maxPlayers} players`;
    }
    return null;
  },

  createGame(configs, seed, options) {
    const o = (options ?? {}) as TtrOptions;
    return advanceAi(createTtrGame(toPlayerConfigs(configs), seed, o.mapId ?? DEFAULT_MAP_ID, o.modeId));
  },

  applyAction(game, action, ctx: ApplyCtx) {
    const state = game as GameState;
    const act = action as Action;
    const expected =
      act.type === 'CONFIRM_SETUP_TICKETS' ? act.playerId : state.players[state.current]?.id;
    if (expected !== ctx.actorId) return { error: 'not your turn' };

    try {
      // Drawing destination tickets buys 30s of extra thinking time.
      const grantMs = act.type === 'DRAW_TICKETS' ? 30_000 : undefined;
      return { game: advanceAi(applyAction(state, act)), grantMs };
    } catch (err) {
      if (err instanceof IllegalActionError) return { error: err.message };
      throw err;
    }
  },

  replaceWithAi(game, seatIndex, difficulty) {
    const state = game as GameState;
    const player = state.players[seatIndex];
    player.isAI = true;
    player.difficulty = (difficulty ?? 'normal') as Difficulty;
    // If that was the last human, end the game rather than let bots loop forever.
    return advanceAi(finishIfAbandoned(state));
  },

  removeSeat(game, seatIndex) {
    return advanceAi(finishIfAbandoned(removePlayer(game as GameState, seatIndex)));
  },

  endGame(game) {
    return endGame(game as GameState);
  },

  turnActorId(game) {
    const s = game as GameState;
    // A clock runs only during an active turn (not the simultaneous setup pick).
    if (s.phase === 'turn' || s.phase === 'draw-tickets' || s.phase === 'tunnel-decision') {
      return s.players[s.current]?.id ?? null;
    }
    return null;
  },

  redactFor(game, playerId) {
    return redactStateFor(game as GameState, playerId);
  },
};

function toMonopolyConfigs(configs: SeatConfig[]) {
  return configs.map((c) => ({
    name: c.name,
    avatar: c.avatar,
    isAI: c.isAI,
    difficulty: (c.difficulty ?? 'normal') as MonopolyDifficulty,
  }));
}

const monopolyAdapter: GameAdapter = {
  // A Monopoly turn (buy, build, trade) runs long; activity keeps the clock alive.
  turnMs: 90_000,
  refreshClockOnAction: true,

  validateSeatCount(seatCount) {
    if (seatCount < 2 || seatCount > 6) return 'Monopoly supports 2-6 players';
    return null;
  },

  createGame(configs, seed, options) {
    const settings = (options ?? {}) as Partial<MonopolySettings>;
    return advanceMonopolyAi(createMonopolyGame(toMonopolyConfigs(configs), seed, settings));
  },

  applyAction(game, action, ctx: ApplyCtx) {
    const state = game as MonopolyState;
    if (monopolyActor(state) !== ctx.actorId) return { error: 'not your turn' };
    if ((action as { type?: string }).type === 'SKIP_TURN') {
      // The clock ran out: make the idle player's cautious default choices until
      // someone else has the floor (an auction/trade answer passes it at once).
      let s = state;
      for (let guard = 0; guard < 50 && s.phase !== 'over' && monopolyActor(s) === ctx.actorId; guard++) {
        s = applyMonopolyAction(s, monopolyTimeoutAction(s));
      }
      return { game: advanceMonopolyAi(s) };
    }
    try {
      return { game: advanceMonopolyAi(applyMonopolyAction(state, action as MonopolyActionType)) };
    } catch (err) {
      if (err instanceof MonopolyIllegalError) return { error: err.message };
      throw err;
    }
  },

  replaceWithAi(game, seatIndex, difficulty) {
    const state = game as MonopolyState;
    const player = state.players[seatIndex];
    player.isAI = true;
    player.difficulty = (difficulty ?? 'normal') as MonopolyDifficulty;
    return advanceMonopolyAi(finishMonopolyIfAbandoned(state));
  },

  removeSeat(game, seatIndex) {
    return advanceMonopolyAi(finishMonopolyIfAbandoned(removeMonopolyPlayer(game as MonopolyState, seatIndex)));
  },

  endGame(game) {
    return endMonopolyGame(game as MonopolyState);
  },

  turnActorId(game) {
    const s = game as MonopolyState;
    if (s.phase === 'over') return null;
    const id = monopolyActor(s);
    const p = s.players.find((pl) => pl.id === id);
    // The clock runs only on a connected human's turn/sub-phase.
    return p && !p.isAI ? id ?? null : null;
  },

  redactFor(game, playerId) {
    return redactMonopolyFor(game as MonopolyState, playerId);
  },
};

/** Wordgrid checks words against the dictionary, loaded when the first room starts. */
const wordgridBase = kitAdapter(wordgridKit);
const wordgridAdapter: GameAdapter = {
  ...wordgridBase,
  createGame(configs, seed, options) {
    ensureDictionary();
    return wordgridBase.createGame(configs, seed, options);
  },
};

const ADAPTERS: Record<string, GameAdapter> = {
  'ticket-to-ride': ticketToRideAdapter,
  cluedo: kitAdapter(cluedoKit),
  monopoly: monopolyAdapter,
  'tic-tac-toe': kitAdapter(ticTacToeKit),
  checkers: kitAdapter(checkersKit),
  chess: kitAdapter(chessKit),
  'snakes-and-ladders': kitAdapter(snlKit),
  ludo: kitAdapter(ludoKit),
  lineup: kitAdapter(lineupKit),
  blockyard: kitAdapter(blockyardKit),
  'last-card': kitAdapter(lastCardKit),
  poker: kitAdapter(pokerKit),
  imposter: kitAdapter(imposterKit),
  hexstead: kitAdapter(hexKit),
  wordgrid: wordgridAdapter,
};

/** The adapter for a game id; throws for an unknown game. */
export function adapterFor(gameId: string): GameAdapter {
  const adapter = ADAPTERS[gameId];
  if (!adapter) throw new Error(`unknown game: ${gameId}`);
  return adapter;
}
