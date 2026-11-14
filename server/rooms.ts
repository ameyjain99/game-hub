import { randomUUID } from 'node:crypto';
import type { GameAdapter, SeatConfig } from './gameAdapter';
import { adapterFor } from './adapters';
import { AVATARS } from '../src/games/ticket-to-ride/ui/avatars';
import { type LobbyView, playerIdForSeat } from '../src/net/protocol';
import type { Difficulty } from '../src/games/ticket-to-ride/engine/types';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 4;
/** 4-letter client routes a room code must never shadow. */
const RESERVED_CODES = new Set(['PLAY']);

const DEFAULT_GAME_ID = 'ticket-to-ride';

interface Seat {
  index: number;
  name: string | null;
  avatar: string;
  isAI: boolean;
  difficulty?: Difficulty;
  /** Reclaim handle for a human seat; null for empty or AI seats. */
  token: string | null;
  socketId: string | null;
  connected: boolean;
}

interface Room {
  code: string;
  hostToken: string;
  seatCount: number;
  /** Which game this room hosts, and the adapter + options that drive it. */
  gameId: string;
  adapter: GameAdapter;
  options: unknown;
  seats: Seat[];
  /** Opaque game state (shape owned by the adapter); null until started. */
  game: unknown;
  started: boolean;
  /** Epoch ms the current player's turn must end by, or null when no clock runs. */
  turnDeadline: number | null;
}

/** How long a player's turn is before it times out and gets skipped. */
const TURN_MS = 45_000;

type Ok = { ok: true };
type Err = { error: string };

function emptySeat(index: number): Seat {
  return { index, name: null, avatar: '', isAI: false, difficulty: undefined, token: null, socketId: null, connected: false };
}

/** Avatars already held by occupied seats (optionally ignoring one seat). */
function takenAvatars(room: Room, exceptIndex = -1): Set<string> {
  return new Set(
    room.seats
      .filter((s) => s.index !== exceptIndex && (s.isAI || s.name !== null) && s.avatar)
      .map((s) => s.avatar),
  );
}

/** The preferred avatar if still free, else the first unused one – never a clash. */
function freeAvatar(room: Room, preferred?: string): string {
  const taken = takenAvatars(room);
  if (preferred && !taken.has(preferred)) return preferred;
  return AVATARS.find((a) => !taken.has(a)) ?? preferred ?? AVATARS[0];
}

/** The authoritative, in-memory store of all live rooms. No I/O, no persistence.
 * Game-agnostic: all game-specific logic is delegated to a per-room adapter. */
export class RoomStore {
  private rooms = new Map<string, Room>();

  createRoom(
    seatCount: number,
    hostName: string,
    avatar: string,
    options: unknown = {},
    gameId: string = DEFAULT_GAME_ID,
  ): { code: string; token: string; playerId: string } {
    const adapter = adapterFor(gameId);
    const err = adapter.validateSeatCount(seatCount, options); // may throw on invalid options
    if (err) throw new Error(err);

    const code = this.freshCode();
    const hostToken = randomUUID();
    const seats = Array.from({ length: seatCount }, (_, i) => emptySeat(i));
    seats[0] = { ...emptySeat(0), name: hostName, avatar, token: hostToken, connected: true };
    this.rooms.set(code, {
      code,
      hostToken,
      seatCount,
      gameId,
      adapter,
      options,
      seats,
      game: null,
      started: false,
      turnDeadline: null,
    });
    return { code, token: hostToken, playerId: playerIdForSeat(0) };
  }

  join(code: string, name: string, avatar: string): { token: string; playerId: string } | Err {
    const room = this.rooms.get(code);
    if (!room) return { error: 'no such room' };
    if (room.started) return { error: 'game already started' };
    const seat = room.seats.find((s) => s.name === null && !s.isAI);
    if (!seat) return { error: 'room is full' };
    seat.name = name;
    seat.avatar = freeAvatar(room, avatar); // resolve clashes server-side
    seat.token = randomUUID();
    seat.connected = true;
    return { token: seat.token, playerId: playerIdForSeat(seat.index) };
  }

  reconnect(code: string, token: string): { playerId: string } | Err {
    const room = this.rooms.get(code);
    if (!room) return { error: 'no such room' };
    const seat = room.seats.find((s) => s.token === token);
    if (!seat) return { error: 'unknown token' };
    seat.connected = true;
    return { playerId: playerIdForSeat(seat.index) };
  }

  setSeatAi(
    code: string,
    hostToken: string,
    index: number,
    isAI: boolean,
    difficulty?: Difficulty,
  ): LobbyView | Err {
    const room = this.rooms.get(code);
    if (!room) return { error: 'no such room' };
    if (room.hostToken !== hostToken) return { error: 'only the host can edit seats' };
    if (room.started) return { error: 'game already started' };
    const seat = room.seats[index];
    if (!seat) return { error: 'no such seat' };
    if (seat.token !== null) return { error: 'seat is taken by a player' };
    room.seats[index] = isAI
      ? { ...emptySeat(index), isAI: true, difficulty: difficulty ?? 'normal', avatar: freeAvatar(room) }
      : emptySeat(index);
    return this.lobbyView(code);
  }

  /** A seated player switches avatar; rejected if another seat already holds it. */
  setAvatar(code: string, token: string, avatar: string): LobbyView | Err {
    const room = this.rooms.get(code);
    if (!room) return { error: 'no such room' };
    if (room.started) return { error: 'game already started' };
    const seat = room.seats.find((s) => s.token === token);
    if (!seat) return { error: 'unknown token' };
    if (!(AVATARS as readonly string[]).includes(avatar)) return { error: 'invalid avatar' };
    if (takenAvatars(room, seat.index).has(avatar)) return { error: 'avatar already taken' };
    seat.avatar = avatar;
    return this.lobbyView(code);
  }

  start(code: string, hostToken: string): Ok | Err {
    const room = this.rooms.get(code);
    if (!room) return { error: 'no such room' };
    if (room.hostToken !== hostToken) return { error: 'only the host can start' };
    if (room.started) return { error: 'game already started' };
    const unfilled = room.seats.some((s) => !s.isAI && s.name === null);
    if (unfilled) return { error: 'every seat must be filled (add AI to empties)' };

    const configs: SeatConfig[] = room.seats.map((s) =>
      s.isAI
        ? { name: s.name ?? 'AI', isAI: true, difficulty: s.difficulty ?? 'normal', avatar: s.avatar }
        : { name: s.name!, isAI: false, avatar: s.avatar },
    );
    room.game = room.adapter.createGame(configs, Math.floor(Math.random() * 2 ** 31), room.options);
    room.started = true;
    this.armTurnTimer(room);
    return { ok: true };
  }

  submitAction(code: string, token: string, action: unknown): Ok | Err {
    const room = this.rooms.get(code);
    if (!room || !room.game) return { error: 'no active game' };
    const seat = room.seats.find((s) => s.token === token);
    if (!seat) return { error: 'unknown token' };

    const actorId = playerIdForSeat(seat.index);
    const prevActor = room.adapter.turnActorId(room.game);
    const res = room.adapter.applyAction(room.game, action, { actorId });
    if ('error' in res) return { error: res.error };
    room.game = res.game;

    const nextActor = room.adapter.turnActorId(room.game);
    if (nextActor !== prevActor || room.adapter.refreshClockOnAction) {
      this.armTurnTimer(room); // the turn passed on (or the player is active) → fresh clock
    } else if (res.grantMs && room.turnDeadline !== null) {
      room.turnDeadline += res.grantMs; // same turn, bonus time (drew tickets)
    }
    return { ok: true };
  }

  /** Give the current player extra time. Anyone in the room may grant it, except
   *  the current player (no extending your own clock). */
  extendTime(code: string, callerToken: string, ms: number): Ok | Err {
    const room = this.rooms.get(code);
    if (!room || !room.game) return { error: 'no active game' };
    if (room.turnDeadline === null) return { error: 'no turn timer running' };
    const caller = room.seats.find((s) => s.token === callerToken);
    if (!caller) return { error: 'not in this room' };
    if (playerIdForSeat(caller.index) === room.adapter.turnActorId(room.game)) {
      return { error: 'cannot extend your own turn' };
    }
    room.turnDeadline += ms;
    return { ok: true };
  }

  /** Skip any room whose turn clock has run out, returning the codes to rebroadcast. */
  expireTurns(now: number): string[] {
    const expired: string[] = [];
    for (const [code, room] of this.rooms) {
      if (room.turnDeadline === null || now < room.turnDeadline) continue;
      const actor = room.adapter.turnActorId(room.game);
      if (actor === null) {
        room.turnDeadline = null;
        continue;
      }
      const res = room.adapter.applyAction(room.game, { type: 'SKIP_TURN' }, { actorId: actor });
      if ('game' in res) {
        room.game = res.game;
        // If no human is connected any more, end the game rather than skip
        // turns forever (an all-bot board can stall). The turn clock that just
        // expired gives a departing human time to reconnect first.
        if (!this.hasConnectedHuman(room)) {
          room.game = room.adapter.endGame(room.game);
          room.turnDeadline = null;
        } else {
          this.armTurnTimer(room);
        }
      } else {
        room.turnDeadline = null; // couldn't skip – clear so we don't spin
      }
      expired.push(code);
    }
    return expired;
  }

  /** For games whose bots act one move at a time: the pause before this room's
   *  next bot move, or null when no bot is to act (or nobody is left to watch). */
  botDelay(code: string): number | null {
    const room = this.rooms.get(code);
    if (!room?.game || !room.adapter.botDelay || !room.adapter.stepBot) return null;
    if (!this.hasConnectedHuman(room)) return null;
    return room.adapter.botDelay(room.game);
  }

  /** Let the next bot make one move; whether one did. */
  stepBot(code: string): boolean {
    const room = this.rooms.get(code);
    if (!room?.game || this.botDelay(code) === null) return false;
    room.game = room.adapter.stepBot!(room.game);
    this.armTurnTimer(room); // a human may be up next: give them a fresh clock
    return true;
  }

  /** Whether any human seat is still connected (so the game has a live driver). */
  private hasConnectedHuman(room: Room): boolean {
    return room.seats.some((s) => !s.isAI && s.connected && s.name !== null);
  }

  /** Start (or clear) the current player's turn clock based on whose turn it is. */
  private armTurnTimer(room: Room): void {
    const actor = room.adapter.turnActorId(room.game);
    const seat = actor ? room.seats[Number(actor.slice(1))] : undefined;
    room.turnDeadline = seat && !seat.isAI ? Date.now() + (room.adapter.turnMs ?? TURN_MS) : null;
  }

  replaceWithAi(code: string, callerToken: string, index: number, difficulty?: Difficulty): Ok | Err {
    const room = this.rooms.get(code);
    if (!room || !room.game) return { error: 'no active game' };
    // Any member of the room may replace a seat that has DROPPED – not just the
    // host. Restricting to the host means a dropped host can never be replaced and
    // the game stalls. You can still only replace someone who's already gone.
    if (!room.seats.some((s) => s.token === callerToken)) return { error: 'not in this room' };
    const seat = room.seats[index];
    if (!seat) return { error: 'no such seat' };
    if (seat.isAI) return { error: 'seat is already an AI' };
    if (seat.connected) return { error: 'that player is still connected' };
    seat.isAI = true;
    seat.difficulty = difficulty ?? 'normal';
    room.game = room.adapter.replaceWithAi(room.game, index, difficulty);
    this.armTurnTimer(room); // the replaced bot may have moved play on
    return { ok: true };
  }

  /** Remove a dropped player's seat from the game entirely (same guards as
   *  replaceWithAi: any remaining member may do it, only to a seat that's gone). */
  removeSeat(code: string, callerToken: string, index: number): Ok | Err {
    const room = this.rooms.get(code);
    if (!room || !room.game) return { error: 'no active game' };
    if (!room.seats.some((s) => s.token === callerToken)) return { error: 'not in this room' };
    const seat = room.seats[index];
    if (!seat) return { error: 'no such seat' };
    if (seat.isAI) return { error: 'seat is an AI' };
    if (seat.connected) return { error: 'that player is still connected' };
    room.game = room.adapter.removeSeat(room.game, index);
    // The seat is out of the game: free it so nothing waits on it any longer.
    room.seats[index] = emptySeat(index);
    this.armTurnTimer(room); // play may have moved on to the next seat
    return { ok: true };
  }

  /**
   * A player intentionally leaves. In the lobby: the host cancels the whole room;
   * anyone else frees their seat. Mid-game: treated as a disconnect (host can
   * replace with AI). Returns whether the room was deleted.
   */
  leaveRoom(code: string, token: string): { code: string; deleted: boolean } | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const seat = room.seats.find((s) => s.token === token);
    if (!seat) return null;

    if (!room.started) {
      if (token === room.hostToken) {
        this.rooms.delete(code); // host cancels the lobby → free the server
        return { code, deleted: true };
      }
      room.seats[seat.index] = emptySeat(seat.index); // open the seat back up
      return { code, deleted: false };
    }

    // Mid-game: leave gracefully – the seat pauses and the host can replace it.
    seat.socketId = null;
    seat.connected = false;
    return { code, deleted: false };
  }

  attachSocket(code: string, playerId: string, socketId: string): void {
    const room = this.rooms.get(code);
    const seat = room?.seats.find((s) => playerIdForSeat(s.index) === playerId);
    if (seat) {
      seat.socketId = socketId;
      seat.connected = true;
    }
  }

  markDisconnected(socketId: string): { code: string } | null {
    for (const room of this.rooms.values()) {
      const seat = room.seats.find((s) => s.socketId === socketId);
      if (seat) {
        seat.socketId = null;
        seat.connected = false;
        return { code: room.code };
      }
    }
    return null;
  }

  /** The game an open room with this code is playing, or null if there's no
   *  such room (case-insensitive). */
  gameOf(code: string): string | null {
    return this.rooms.get(code.toUpperCase())?.gameId ?? null;
  }

  lobbyView(code: string): LobbyView {
    const room = this.rooms.get(code);
    if (!room) throw new Error('no such room');
    return {
      code: room.code,
      seatCount: room.seatCount,
      hostIndex: 0,
      started: room.started,
      turnDeadline: room.turnDeadline,
      seats: room.seats.map((s) => ({
        index: s.index,
        name: s.name,
        avatar: s.avatar,
        isAI: s.isAI,
        difficulty: s.difficulty,
        connected: s.connected,
      })),
    };
  }

  /** The redacted game state a viewer may see (shape owned by the game adapter). */
  stateForViewer(code: string, playerId: string): any {
    const room = this.rooms.get(code);
    if (!room || !room.game) return null;
    return room.adapter.redactFor(room.game, playerId);
  }

  connectedSocketIds(code: string): { playerId: string; socketId: string }[] {
    const room = this.rooms.get(code);
    if (!room) return [];
    return room.seats
      .filter((s): s is Seat & { socketId: string } => s.socketId !== null)
      .map((s) => ({ playerId: playerIdForSeat(s.index), socketId: s.socketId }));
  }

  private freshCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      }
      // Avoid a code that collides with a reserved client route (e.g. `/play`).
      if (!this.rooms.has(code) && !RESERVED_CODES.has(code)) return code;
    }
  }
}
