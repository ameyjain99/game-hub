/** A seat as the lobby exposes it to clients (never a human's reconnect token). */
export interface SeatView {
  index: number;
  name: string | null;
  avatar: string;
  isAI: boolean;
  difficulty?: string;
  connected: boolean;
  /** A bot is playing this seat for a player who dropped; they take it back when they return. */
  covering?: boolean;
}

export interface LobbyView {
  code: string;
  seatCount: number;
  seats: SeatView[];
  hostIndex: number;
  started: boolean;
  /** Epoch ms the current player's turn must end by, or null when no turn timer
   *  is running (setup, an AI's turn, or game over). */
  turnDeadline: number | null;
  /** A chess clock: the ms each seat has left as this was sent (the seat to
   *  move runs down to `turnDeadline`). Null or absent when there is none. */
  clocks?: number[] | null;
  /** The game's options as the host set them (shape owned by the game). */
  options?: unknown;
  /** Set while someone has paused the game for the table: who, and since when. */
  paused?: { by: string; at: number } | null;
  /** The players who have asked for a rematch since the game ended. */
  rematch?: string[];
}

// Client → server payloads.
export interface CreateRoom {
  seatCount: number;
  name: string;
  avatar: string;
  /** Which game to host; defaults to Ticket to Ride on the server if omitted. */
  gameId?: string;
  /** Game-specific options, opaque to the server (passed to the game adapter). */
  options?: unknown;
  /** Ticket to Ride board (kept for back-compat; folded into `options` server-side). */
  mapId?: string;
  /** Optional play mode (e.g. USA '1910' or 'mega'); default mode if omitted. */
  modeId?: string;
}
export interface JoinRoom {
  code: string;
  name: string;
  avatar: string;
  /** Rejoining a game under way: the dropped seat to take back. */
  seat?: number;
}

/** What `/api/room-exists` says about a room code. */
export interface RoomInfo {
  exists: boolean;
  gameId?: string;
  started?: boolean;
  /** In a started game: seats whose player dropped, which they can take back. */
  openSeats?: { index: number; name: string }[];
}
export interface Reconnect {
  code: string;
  token: string;
}
export interface SetSeatAi {
  code: string;
  index: number;
  isAI: boolean;
  difficulty?: string;
}
export interface StartGame {
  code: string;
}
export interface SubmitAction {
  code: string;
  action: unknown;
}
export interface ReplaceWithAi {
  code: string;
  index: number;
  difficulty?: string;
}
export interface RemoveSeat {
  code: string;
  index: number;
}
export interface LeaveRoom {
  code: string;
}
/** Grant the current player +20s (anyone but the current player may send this). */
export interface ExtendTime {
  code: string;
}
export interface SetAvatar {
  code: string;
  avatar: string;
}
/** Pause the game for the whole table, or carry on. Anyone seated may send it. */
export interface SetPaused {
  code: string;
  paused: boolean;
}
/** The host changes the game's options in the lobby. */
export interface SetOptions {
  code: string;
  options: unknown;
}
/** The host adds a seat, or takes the last (empty or bot) seat away, in the lobby. */
export interface SetSeatCount {
  code: string;
  seatCount: number;
}

/**
 * WebRTC voice-chat signaling. Relayed verbatim by the server to the rest of the
 * room; `to` null means broadcast (a "hello"/"bye" announcement), otherwise it
 * targets one peer. Audio itself is peer-to-peer and never touches the server.
 */
export interface VoiceSignal {
  code: string;
  from: string;
  to: string | null;
  /** 'media' announces the sender's mic/cam on/off state (data: MediaState).
   *  'restart' asks the peer that made the offer to restart ICE on a stalled
   *  connection; 'sync' (after the sender's socket reconnected) lists the peers
   *  it still holds, so each side can tell whether the pair must start over. */
  kind: 'hello' | 'bye' | 'offer' | 'answer' | 'ice' | 'media' | 'restart' | 'sync';
  data?: unknown;
}

/**
 * Fast-changing, throwaway updates for real-time games (a builder's position in
 * Blockyard), relayed to the rest of the room without touching game state.
 */
export interface Presence {
  code: string;
  from: string;
  data: unknown;
}

/** A peer's current mic/cam state, broadcast via a 'media' VoiceSignal. */
export interface MediaState {
  micOn: boolean;
  camOn: boolean;
  /** The sender's camera is on but paused towards this peer: the link between
   *  the two is too weak for video, and voices come first. */
  videoHeld?: boolean;
}

// Server → client payloads.
export interface Joined {
  code: string;
  token: string;
  playerId: string;
  hostIndex: number;
}
export interface ErrorMsg {
  message: string;
}

/** Socket.IO event names shared by server and client. */
export const EVT = {
  createRoom: 'createRoom',
  joinRoom: 'joinRoom',
  reconnect: 'reconnect',
  setSeatAi: 'setSeatAi',
  startGame: 'startGame',
  action: 'action',
  replaceWithAi: 'replaceWithAi',
  removeSeat: 'removeSeat',
  extendTime: 'extendTime',
  leaveRoom: 'leaveRoom',
  setAvatar: 'setAvatar',
  setPaused: 'setPaused',
  setOptions: 'setOptions',
  setSeatCount: 'setSeatCount',
  voice: 'voice',
  presence: 'presence',
  lobby: 'lobby',
  state: 'state',
  joined: 'joined',
  errorMsg: 'errorMsg',
} as const;

/** Engine player id for a seat index (matches createGame's `p${i}` assignment). */
export const playerIdForSeat = (index: number): string => `p${index}`;
