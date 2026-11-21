/**
 * The game-specific operations the RoomStore delegates to. Everything else -
 * room codes, seats, tokens, host, connect/reconnect, avatars - is game-agnostic
 * and lives in the store. Each game registers one adapter.
 *
 * Game state, actions, and options are opaque (`unknown`) to the store; each
 * adapter knows its own concrete types and casts internally.
 */

export interface SeatConfig {
  name: string;
  isAI: boolean;
  avatar: string;
  difficulty?: string;
}

export interface ApplyCtx {
  /** The engine player id of the acting seat (e.g. "p0"). */
  actorId: string;
}

export interface GameAdapter {
  /** How long a human's turn lasts before the room skips it (default 45s). */
  turnMs?: number;
  /** Whether each action by the player on the clock restarts it, so only an
   *  idle player times out (games with long, many-step turns). */
  refreshClockOnAction?: boolean;

  /** The pieces a seat may hold (a character, a colour, a token, an avatar),
   *  by id. Each seat holds a different one, kept in the seat's `avatar`. */
  pieces?: readonly string[];
  /** Whether a rematch waits for every connected player to ask for it (the
   *  room counts the votes); otherwise REMATCH is an action like any other. */
  rematchByVote?: boolean;

  /** A chess clock: the time each player has for the whole game under these
   *  options (null for none). It runs only while they are to move. */
  bankMs?(options: unknown): number | null;
  /** With a chess clock: who is to move (bots and untimed games included). */
  clockActorId?(game: unknown): string | null;
  /** With a chess clock: this player's time ran out. */
  flag?(game: unknown, actorId: string): unknown;

  /** Null if the seat count is valid for these options, else an error message.
   * May also throw for a wholly invalid option (e.g. unknown map). */
  validateSeatCount(seatCount: number, options: unknown): string | null;

  /** Build a fresh, ready-to-play game (AI pre-advanced if applicable). */
  createGame(configs: SeatConfig[], seed: number, options: unknown): unknown;

  /** Apply a player's action after validating it's their turn and legal.
   *  `grantMs` asks the room to add that many ms to the turn clock (e.g. drawing
   *  destination tickets buys thinking time). */
  applyAction(
    game: unknown,
    action: unknown,
    ctx: ApplyCtx,
  ): { game: unknown; grantMs?: number } | { error: string };

  /** Replace a seat with a bot mid-game and let the game advance. */
  replaceWithAi(game: unknown, seatIndex: number, difficulty: string | undefined): unknown;

  /** Give a seat a bot was covering back to its (returned) human player. */
  returnSeat(game: unknown, seatIndex: number): unknown;

  /** Remove a seat from the game entirely (cards/routes returned to the pools,
   *  the player skipped and excluded from scoring), then let the game advance. */
  removeSeat(game: unknown, seatIndex: number): unknown;

  /** Force the game to end now (the room is abandoned - no connected humans). */
  endGame(game: unknown): unknown;

  /** The human player whose turn is on the clock, or null when no turn timer
   *  applies (setup, an AI's turn, game over). Games without a timer return null.
   *  When the clock runs out the room sends `{ type: 'SKIP_TURN' }` as that player. */
  turnActorId(game: unknown): string | null;

  /** The state a single player is allowed to see. */
  redactFor(game: unknown, playerId: string): unknown;

  /** Games whose bots act one move at a time, so the table can follow them: the
   *  pause before the next bot acts, or null when no bot is to act. Games without
   *  it play their bots out inside `applyAction`. */
  botDelay?(game: unknown): number | null;

  /** One bot action (called only after `botDelay` returned a number). */
  stepBot?(game: unknown): unknown;
}
