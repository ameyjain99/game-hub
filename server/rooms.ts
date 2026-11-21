import { randomUUID } from 'node:crypto';
import type { GameAdapter, SeatConfig } from './gameAdapter';
import { adapterFor } from './adapters';
import { type LobbyView, playerIdForSeat } from '../src/net/protocol';
import type { Difficulty } from '../src/games/ticket-to-ride/engine/types';
import { nameKey, pickBotNames } from '../src/shared/botNames';

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
  /** A chess clock: what each seat has left (as of its last move), and the
   *  seat whose time is running. Null when the game has no clock. */
  clocks: number[] | null;
  clockSeat: number | null;
  /** Tokens of seats taken out of the game, so their return gets a clear answer. */
  removed: Set<string>;
  /** Set while someone has paused the game: who, since when, and how much of
   *  the turn on the clock was left (it resumes with that much). */
  paused: { by: string; at: number; remaining: number | null } | null;
  /** Players who have asked for a rematch since the game ended. */
  rematch: Set<string>;
}

/** How long a player's turn is before it times out and gets skipped. */
const TURN_MS = 45_000;

type Ok = { ok: true };
type Err = { error: string };

function emptySeat(index: number): Seat {
  return { index, name: null, avatar: '', isAI: false, difficulty: undefined, token: null, socketId: null, connected: false };
}

const MAX_NAME = 20;

/** A name as typed, tidied: trimmed, single spaces, at most 20 characters. */
function tidyName(name: string): string {
  return String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) || 'Player';
}

/** The names seated at this table, people and bots. */
const seatedNames = (room: Room): string[] => room.seats.flatMap((s) => (s.name !== null ? [s.name] : []));

/**
 * `wanted`, or `wanted (2)`, `(3)`... when someone at the table already goes
 * by it. Names are compared without case or spaces, so "Amey", "amey" and
 * "A mey" are one name: no two seats can be mistaken for each other.
 */
function freeName(room: Room, wanted: string): string {
  const taken = new Set(seatedNames(room).map(nameKey));
  const base = tidyName(wanted);
  if (!taken.has(nameKey(base))) return base;
  for (let n = 2; ; n++) {
    const tag = ` (${n})`;
    const name = base.slice(0, MAX_NAME - tag.length).trimEnd() + tag;
    if (!taken.has(nameKey(name))) return name;
  }
}

/** Avatars already held by occupied seats (optionally ignoring one seat). */
function takenAvatars(room: Room, exceptIndex = -1): Set<string> {
  return new Set(
    room.seats
      .filter((s) => s.index !== exceptIndex && (s.isAI || s.name !== null) && s.avatar)
      .map((s) => s.avatar),
  );
}

/** The preferred piece (avatar) if the game has it and it is still free, else
 *  the first unused one - never a clash. A game without pieces gives none. */
function freeAvatar(room: Pick<Room, 'seats' | 'adapter'>, preferred?: string): string {
  const pieces = room.adapter.pieces;
  if (!pieces?.length) return '';
  const taken = takenAvatars(room as Room);
  if (preferred && pieces.includes(preferred) && !taken.has(preferred)) return preferred;
  return pieces.find((a) => !taken.has(a)) ?? pieces[0];
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
    seats[0] = { ...emptySeat(0), name: tidyName(hostName), avatar: freeAvatar({ seats, adapter }, avatar), token: hostToken, connected: true };
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
      clocks: null,
      clockSeat: null,
      removed: new Set(),
      paused: null,
      rematch: new Set(),
    });
    return { code, token: hostToken, playerId: playerIdForSeat(0) };
  }

  /**
   * Take a seat. Before the game starts that is any empty seat. Once it has
   * started, only a seat whose player has dropped can be taken back: the one
   * asked for (`seatIndex`), else the one with this name, else the only one
   * open. That is how a player who lost their saved session (a new device, a
   * cleared browser) gets back in; a seat someone is still connected to is
   * never handed over.
   */
  join(code: string, name: string, avatar: string, seatIndex?: number): { token: string; playerId: string } | Err {
    const room = this.rooms.get(code);
    if (!room) return { error: 'no such room' };
    if (room.started) {
      const open = this.openSeats(room);
      const wanted = name.trim().toLowerCase();
      const back =
        open.find((s) => s.index === seatIndex) ??
        open.find((s) => s.name?.trim().toLowerCase() === wanted) ??
        (seatIndex === undefined && open.length === 1 ? open[0] : undefined);
      if (!back) return { error: 'game already started' };
      back.token = randomUUID(); // the lost session's token stops working
      back.connected = true;
      this.handBack(room, back);
      return { token: back.token, playerId: playerIdForSeat(back.index) };
    }
    const seat = room.seats.find((s) => s.name === null && !s.isAI);
    if (!seat) return { error: 'room is full' };
    seat.name = freeName(room, name);
    seat.avatar = freeAvatar(room, avatar); // resolve clashes server-side
    seat.token = randomUUID();
    seat.connected = true;
    return { token: seat.token, playerId: playerIdForSeat(seat.index) };
  }

  reconnect(code: string, token: string): { playerId: string } | Err {
    const room = this.rooms.get(code);
    if (!room) return { error: 'no such room' };
    if (room.removed.has(token)) return { error: 'removed from game' };
    const seat = room.seats.find((s) => s.token === token);
    if (!seat) return { error: 'unknown token' };
    seat.connected = true;
    this.handBack(room, seat); // a bot was covering for them: they play again
    return { playerId: playerIdForSeat(seat.index) };
  }

  /** Seats of a started game whose player has dropped (a bot may be covering). */
  private openSeats(room: Room): Seat[] {
    return room.started ? room.seats.filter((s) => s.token !== null && !s.connected) : [];
  }

  /** A returning player takes their seat back from the bot that covered it. */
  private handBack(room: Room, seat: Seat): void {
    if (!seat.isAI) return;
    seat.isAI = false;
    seat.difficulty = undefined;
    if (room.game) {
      room.game = room.adapter.returnSeat(room.game, seat.index);
      this.armTurnTimer(room);
    }
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
    // A bot sits down under a name of its own, one nobody at the table holds.
    room.seats[index] = isAI
      ? { ...emptySeat(index), isAI: true, name: pickBotNames(1, seatedNames(room))[0], difficulty: difficulty ?? 'normal', avatar: freeAvatar(room) }
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
    if (!room.adapter.pieces?.includes(avatar)) return { error: 'invalid avatar' };
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
    this.resetClocks(room);
    this.armTurnTimer(room);
    return { ok: true };
  }

  submitAction(code: string, token: string, action: unknown): Ok | Err {
    const room = this.rooms.get(code);
    if (!room || !room.game) return { error: 'no active game' };
    const seat = room.seats.find((s) => s.token === token);
    if (!seat) return { error: 'unknown token' };

    const actorId = playerIdForSeat(seat.index);
    if (room.paused) return { error: 'the game is paused' };
    if (room.adapter.rematchByVote && (action as { type?: string } | null)?.type === 'REMATCH') {
      // Checked now (the game must be over), applied once everyone has asked.
      const dry = room.adapter.applyAction(room.game, action, { actorId });
      if ('error' in dry) return { error: dry.error };
      room.rematch.add(actorId);
      this.settleRematch(room);
      return { ok: true };
    }
    const prevActor = this.onClock(room);
    const res = room.adapter.applyAction(room.game, action, { actorId });
    if ('error' in res) return { error: res.error };
    room.game = res.game;
    room.rematch.clear();

    const nextActor = this.onClock(room);
    if (nextActor !== prevActor || room.adapter.refreshClockOnAction) {
      this.armTurnTimer(room); // the turn passed on (or the player is active) → fresh clock
    } else if (res.grantMs && room.turnDeadline !== null) {
      room.turnDeadline += res.grantMs; // same turn, bonus time (drew tickets)
    }
    return { ok: true };
  }

  /** Start the rematch once every connected player has asked for it. */
  private settleRematch(room: Room): void {
    if (room.rematch.size === 0 || !room.game) return;
    const needed = room.seats.filter((s) => !s.isAI && s.name !== null && s.connected).map((s) => playerIdForSeat(s.index));
    const asked = needed.filter((id) => room.rematch.has(id));
    if (asked.length === 0 || asked.length < needed.length) return;
    const res = room.adapter.applyAction(room.game, { type: 'REMATCH' }, { actorId: asked[0] });
    room.rematch.clear();
    if ('error' in res) return;
    room.game = res.game;
    this.resetClocks(room);
    this.armTurnTimer(room);
  }

  /**
   * Pause the game for the whole table, or carry on. Anyone seated may do
   * either. A pause stops the turn clock where it is, holds the bots and
   * refuses moves; carrying on gives the turn the time it had left.
   */
  setPaused(code: string, token: string, paused: boolean): Ok | Err {
    const room = this.rooms.get(code);
    if (!room || !room.game) return { error: 'no active game' };
    const seat = room.seats.find((s) => s.token === token);
    if (!seat) return { error: 'not in this room' };
    if (paused === !!room.paused) return { ok: true };
    if (paused) {
      const now = Date.now();
      room.paused = { by: playerIdForSeat(seat.index), at: now, remaining: room.turnDeadline === null ? null : Math.max(0, room.turnDeadline - now) };
      room.turnDeadline = null;
    } else {
      this.unpause(room);
    }
    return { ok: true };
  }

  private unpause(room: Room): void {
    if (!room.paused) return;
    const left = room.paused.remaining;
    room.paused = null;
    room.turnDeadline = left === null ? null : Date.now() + left;
  }

  /** The host changes the game's options in the lobby (they must suit the seats). */
  setOptions(code: string, hostToken: string, options: unknown): Ok | Err {
    const room = this.rooms.get(code);
    if (!room) return { error: 'no such room' };
    if (room.hostToken !== hostToken) return { error: 'only the host can change the rules' };
    if (room.started) return { error: 'game already started' };
    try {
      const err = room.adapter.validateSeatCount(room.seatCount, options);
      if (err) return { error: err };
    } catch (e) {
      return { error: (e as Error).message };
    }
    room.options = options;
    return { ok: true };
  }

  /** The host adds a seat at the end of the table, or takes the last one away
   *  (only an empty seat or a bot: nobody is ever removed this way). */
  setSeatCount(code: string, hostToken: string, seatCount: number): Ok | Err {
    const room = this.rooms.get(code);
    if (!room) return { error: 'no such room' };
    if (room.hostToken !== hostToken) return { error: 'only the host can change the seats' };
    if (room.started) return { error: 'game already started' };
    if (!Number.isInteger(seatCount) || seatCount < 1) return { error: 'invalid seat count' };
    if (room.seats.slice(seatCount).some((s) => s.token !== null)) return { error: 'a player is sitting there' };
    try {
      const err = room.adapter.validateSeatCount(seatCount, room.options);
      if (err) return { error: err };
    } catch (e) {
      return { error: (e as Error).message };
    }
    room.seats = Array.from({ length: seatCount }, (_, i) => room.seats[i] ?? emptySeat(i));
    room.seatCount = seatCount;
    return { ok: true };
  }

  /** Give the current player extra time. Anyone in the room may grant it, except
   *  the current player (no extending your own clock). */
  extendTime(code: string, callerToken: string, ms: number): Ok | Err {
    const room = this.rooms.get(code);
    if (!room || !room.game) return { error: 'no active game' };
    if (room.turnDeadline === null) return { error: 'no turn timer running' };
    if (room.clocks) return { error: 'a chess clock takes no extra time' };
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
      // Nobody is left to carry on a paused game: let it run out (and end) by itself.
      if (room.paused && !this.hasConnectedHuman(room)) this.unpause(room);
      if (room.turnDeadline === null || now < room.turnDeadline) continue;
      const actor = this.onClock(room);
      if (actor === null) {
        room.turnDeadline = null;
        continue;
      }
      if (room.clocks) {
        // The flag fell: out of time is out of the game.
        room.game = room.adapter.flag!(room.game, actor);
        if (room.clockSeat !== null) room.clocks[room.clockSeat] = 0;
        room.clockSeat = null;
        room.turnDeadline = null;
        expired.push(code);
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
        room.turnDeadline = null; // couldn't skip - clear so we don't spin
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
    if (room.paused || !this.hasConnectedHuman(room)) return null;
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
  /** Whoever the running clock belongs to: the player to move under a chess
   *  clock, otherwise the human whose turn can time out. */
  private onClock(room: Room): string | null {
    return room.clocks ? room.adapter.clockActorId!(room.game) : room.adapter.turnActorId(room.game);
  }

  /** Fresh chess clocks for a new game (or none, when the options ask for none). */
  private resetClocks(room: Room): void {
    const bank = room.adapter.clockActorId && room.adapter.flag ? (room.adapter.bankMs?.(room.options) ?? null) : null;
    room.clocks = bank ? room.seats.map(() => bank) : null;
    room.clockSeat = null;
    room.turnDeadline = null;
    if (room.paused) room.paused.remaining = null;
  }

  /** What the seat on the chess clock has left right now. */
  private clockLeft(room: Room, now: number): number | null {
    if (room.paused) return room.paused.remaining;
    return room.turnDeadline === null ? null : Math.max(0, room.turnDeadline - now);
  }

  private armTurnTimer(room: Room): void {
    if (room.clocks) {
      // Stop the clock of whoever just moved, start the next player's.
      const now = Date.now();
      const left = this.clockLeft(room, now);
      if (room.clockSeat !== null && left !== null) room.clocks[room.clockSeat] = left;
      const next = room.adapter.clockActorId!(room.game);
      room.clockSeat = next ? Number(next.slice(1)) : null;
      const bank = room.clockSeat === null ? null : room.clocks[room.clockSeat];
      if (room.paused) room.paused.remaining = bank;
      else room.turnDeadline = bank === null ? null : now + bank;
      return;
    }
    const actor = room.adapter.turnActorId(room.game);
    const seat = actor ? room.seats[Number(actor.slice(1))] : undefined;
    const due = seat && !seat.isAI ? (room.adapter.turnMs ?? TURN_MS) : null;
    if (room.paused) room.paused.remaining = due; // the clock starts when the game carries on
    else room.turnDeadline = due === null ? null : Date.now() + due;
  }

  replaceWithAi(code: string, callerToken: string, index: number, difficulty?: Difficulty): Ok | Err {
    const room = this.rooms.get(code);
    if (!room || !room.game) return { error: 'no active game' };
    // Any member of the room may replace a seat that has DROPPED - not just the
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
    if (seat.token) room.removed.add(seat.token);
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

    // Mid-game: leave gracefully - the seat pauses and the host can replace it.
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
        this.settleRematch(room); // those still here may all have asked already
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

  /** What a join screen needs to know about a code (case-insensitive): the
   *  game, whether it has started and, if so, the seats a dropped player can
   *  take back. Null if there's no such room. */
  roomInfo(code: string): { gameId: string; started: boolean; openSeats: { index: number; name: string }[] } | null {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return null;
    return {
      gameId: room.gameId,
      started: room.started,
      openSeats: this.openSeats(room).map((s) => ({ index: s.index, name: s.name ?? `Player ${s.index + 1}` })),
    };
  }

  /** Whether this player's seat currently has a live connection. */
  isConnected(code: string, playerId: string): boolean {
    const seat = this.rooms.get(code)?.seats.find((s) => playerIdForSeat(s.index) === playerId);
    return !!seat?.connected;
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
      clocks: room.clocks ? room.clocks.map((ms, i) => (i === room.clockSeat ? (this.clockLeft(room, Date.now()) ?? ms) : ms)) : null,
      options: room.options,
      paused: room.paused ? { by: room.paused.by, at: room.paused.at } : null,
      rematch: [...room.rematch],
      seats: room.seats.map((s) => ({
        index: s.index,
        name: s.name,
        avatar: s.avatar,
        isAI: s.isAI,
        difficulty: s.difficulty,
        connected: s.connected,
        // A bot playing a dropped player's seat until they come back.
        covering: (s.isAI && s.token !== null) || undefined,
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
