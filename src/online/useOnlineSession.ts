import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  EVT,
  type ErrorMsg,
  type Joined,
  type LobbyView,
} from '../net/protocol';
import { clearSession, loadSession, saveSession } from './session-storage';

export type OnlineIntent =
  | {
      kind: 'start';
      seatCount: number;
      name: string;
      avatar: string;
      /** Which game to host; defaults to Ticket to Ride server-side if omitted. */
      gameId?: string;
      /** Game-specific options (e.g. Cluedo difficulty). */
      options?: unknown;
      mapId?: string;
      modeId?: string;
    }
  | { kind: 'join'; code: string; name: string; avatar: string; gameId?: string }
  // Reclaim an existing seat from a stored session (e.g. after a page reload).
  | { kind: 'resume' };

export interface OnlineSession<S = unknown, A = unknown> {
  lobby: LobbyView | null;
  state: S | null;
  myPlayerId: string | null;
  /** The room code once joined – the signaling address for voice chat. */
  code: string | null;
  /** The live socket, exposed for voice-chat signaling. Null until connected. */
  socket: Socket | null;
  error: string | null;
  setSeatAi(index: number, isAI: boolean, difficulty?: string): void;
  /** Switch the viewer's avatar (server rejects if another seat holds it). */
  setAvatar(avatar: string): void;
  start(): void;
  dispatch(action: A): void;
  replaceWithAi(index: number, difficulty?: string): void;
  /** Remove a dropped player's seat from the game entirely. */
  removeSeat(index: number): void;
  /** Grant the current player +20s (the server ignores it from the current player). */
  extendTime(): void;
  /** Leave the room (cancels the lobby if host) and clear the stored session. */
  leave(): void;
}

/** Connects to the game server, fires the intent, and exposes online state.
 * Generic over the game's redacted state `S` and action `A` (Ticket to Ride by
 * default, so existing callers are unchanged). */
export function useOnlineSession<S = unknown, A = unknown>(
  intent: OnlineIntent,
  opts: { persist?: boolean } = {},
): OnlineSession<S, A> {
  const persist = opts.persist ?? true;
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [lobby, setLobby] = useState<LobbyView | null>(null);
  const [state, setState] = useState<S | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;
    setSocket(socket);

    // Which game this session belongs to (preserved across a resume/reconnect).
    const sessionGameId = intent.kind === 'resume' ? loadSession()?.gameId : intent.gameId;

    socket.on(EVT.joined, (j: Joined) => {
      setMyPlayerId(j.playerId);
      setCode(j.code);
      setError(null);
      if (persist) {
        saveSession({ code: j.code, token: j.token, playerId: j.playerId, gameId: sessionGameId });
      }
    });
    socket.on(EVT.lobby, (l: LobbyView) => setLobby(l));
    socket.on(EVT.state, (s: S) => setState(s));
    socket.on(EVT.errorMsg, (e: ErrorMsg) => {
      setError(e.message);
      // A failed reclaim means the stored session is stale; drop it.
      if (e.message === 'unknown token' || e.message === 'no such room') clearSession();
    });

    // Fire the intent on the socket's first connect; later (re)connects re-attach
    // via the stored session. Tying this to the socket lifecycle makes it robust
    // to React StrictMode's mount/teardown/mount (which otherwise lost the room).
    const reclaim = () => {
      const s = loadSession();
      if (!s) return;
      setCode(s.code);
      setMyPlayerId(s.playerId);
      socket.emit(EVT.reconnect, { code: s.code, token: s.token });
    };
    let firstConnect = true;
    socket.on('connect', () => {
      if (!firstConnect) {
        if (persist) reclaim();
        return;
      }
      firstConnect = false;
      if (intent.kind === 'start') {
        socket.emit(EVT.createRoom, {
          seatCount: intent.seatCount,
          name: intent.name,
          avatar: intent.avatar,
          gameId: intent.gameId,
          options: intent.options,
          mapId: intent.mapId,
          modeId: intent.modeId,
        });
      } else if (intent.kind === 'join') {
        socket.emit(EVT.joinRoom, { code: intent.code, name: intent.name, avatar: intent.avatar });
      } else {
        reclaim();
      }
    });

    return () => {
      socket.close();
      setSocket(null);
    };
  }, [intent]);

  const emit = (evt: string, payload: unknown) => socketRef.current?.emit(evt, payload);

  const setSeatAi = useCallback(
    (index: number, isAI: boolean, difficulty?: string) => {
      if (code) emit(EVT.setSeatAi, { code, index, isAI, difficulty });
    },
    [code],
  );
  const setAvatar = useCallback(
    (avatar: string) => {
      if (code) emit(EVT.setAvatar, { code, avatar });
    },
    [code],
  );
  const start = useCallback(() => {
    if (code) emit(EVT.startGame, { code });
  }, [code]);
  const dispatch = useCallback(
    (action: A) => {
      setError(null);
      if (code) emit(EVT.action, { code, action });
    },
    [code],
  );
  const replaceWithAi = useCallback(
    (index: number, difficulty?: string) => {
      if (code) emit(EVT.replaceWithAi, { code, index, difficulty });
    },
    [code],
  );
  const removeSeat = useCallback(
    (index: number) => {
      if (code) emit(EVT.removeSeat, { code, index });
    },
    [code],
  );
  const extendTime = useCallback(() => {
    if (code) emit(EVT.extendTime, { code });
  }, [code]);
  const leave = useCallback(() => {
    if (code) emit(EVT.leaveRoom, { code });
    clearSession();
  }, [code]);

  return { lobby, state, myPlayerId, code, socket, error, setSeatAi, setAvatar, start, dispatch, replaceWithAi, removeSeat, extendTime, leave };
}
