import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Server as IOServer, type Socket } from 'socket.io';
import { RoomStore } from './rooms';
import {
  EVT,
  type CreateRoom,
  type JoinRoom,
  type Reconnect,
  type SetSeatAi,
  type StartGame,
  type SubmitAction,
  type ReplaceWithAi,
  type RemoveSeat,
  type ExtendTime,
  type LeaveRoom,
  type SetAvatar,
  type VoiceSignal,
  type Presence,
} from '../src/net/protocol';
import type { Difficulty } from '../src/games/ticket-to-ride/engine/types';

interface SocketData {
  code?: string;
  playerId?: string;
  /** The reclaim token this socket was issued at create/join/reconnect. */
  token?: string;
}

const DIST = resolve(process.cwd(), 'dist');
const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.wasm': 'application/wasm', // the Stockfish engine (streamed compilation needs this type)
  '.txt': 'text/plain',
};

/**
 * Handle plain HTTP: the small JSON API (always) and, in production, the built
 * client with SPA fallback. In dev, Vite serves the client and proxies the API
 * and socket.io here.
 */
function attachHttp(httpServer: HttpServer, prod: boolean, store: RoomStore): void {
  httpServer.on('request', async (req, res) => {
    if (req.url?.startsWith('/socket.io')) return; // handled by socket.io
    const url = new URL(req.url ?? '/', 'http://localhost');

    // Whether a room code exists, so a join link can be validated before asking
    // for a name (and a "no such room" message shown otherwise), and which game
    // it's playing, so the hub can send a code straight to the right game.
    if (url.pathname === '/api/room-exists') {
      res.setHeader('Content-Type', 'application/json');
      const gameId = store.gameOf(url.searchParams.get('code') ?? '');
      res.end(JSON.stringify(gameId ? { exists: true, gameId } : { exists: false }));
      return;
    }

    if (!prod) return; // dev: Vite serves everything else
    const candidate = resolve(DIST, '.' + url.pathname);
    const file =
      candidate.startsWith(DIST) && existsSync(candidate) && extname(candidate)
        ? candidate
        : join(DIST, 'index.html');
    try {
      const body = await readFile(file);
      res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
      res.end(body);
    } catch {
      res.statusCode = 404;
      res.end('not found');
    }
  });
}

export function createServer(opts: { port?: number } = {}): {
  io: IOServer;
  httpServer: HttpServer;
  store: RoomStore;
  close(): Promise<void>;
} {
  const httpServer = createHttpServer();
  const store = new RoomStore();
  attachHttp(httpServer, process.env.NODE_ENV === 'production', store);
  const io = new IOServer(httpServer, { cors: { origin: '*' } });

  const fail = (socket: Socket, message: string) => socket.emit(EVT.errorMsg, { message });

  // Games whose bots move one step at a time get a timer per room for the next
  // bot move; each move is broadcast, which schedules the one after it.
  const botTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const scheduleBot = (code: string) => {
    if (botTimers.has(code)) return;
    const delay = store.botDelay(code);
    if (delay === null) return;
    const timer = setTimeout(() => {
      botTimers.delete(code);
      if (store.stepBot(code)) broadcast(code);
    }, delay);
    timer.unref?.();
    botTimers.set(code, timer);
  };

  /** Push the lobby to everyone and, once started, a per-socket redacted state. */
  const broadcast = (code: string) => {
    let lobby;
    try {
      lobby = store.lobbyView(code);
    } catch {
      return; // room gone
    }
    io.to(code).emit(EVT.lobby, lobby);
    for (const { playerId, socketId } of store.connectedSocketIds(code)) {
      const state = store.stateForViewer(code, playerId);
      if (state) io.to(socketId).emit(EVT.state, state);
    }
    scheduleBot(code);
  };

  io.on('connection', (socket: Socket) => {
    const data = socket.data as SocketData;

    socket.on(EVT.createRoom, (p: CreateRoom) => {
      let res;
      try {
        res = store.createRoom(
          p.seatCount,
          p.name,
          p.avatar,
          p.options ?? { mapId: p.mapId, modeId: p.modeId },
          p.gameId ?? 'ticket-to-ride',
        );
      } catch (err) {
        return fail(socket, (err as Error).message);
      }
      data.code = res.code;
      data.playerId = res.playerId;
      data.token = res.token;
      socket.join(res.code);
      store.attachSocket(res.code, res.playerId, socket.id);
      socket.emit(EVT.joined, { code: res.code, token: res.token, playerId: res.playerId, hostIndex: 0 });
      broadcast(res.code);
    });

    socket.on(EVT.joinRoom, (p: JoinRoom) => {
      const res = store.join(p.code, p.name, p.avatar);
      if ('error' in res) return fail(socket, res.error);
      data.code = p.code;
      data.playerId = res.playerId;
      data.token = res.token;
      socket.join(p.code);
      store.attachSocket(p.code, res.playerId, socket.id);
      socket.emit(EVT.joined, { code: p.code, token: res.token, playerId: res.playerId, hostIndex: 0 });
      broadcast(p.code);
    });

    socket.on(EVT.reconnect, (p: Reconnect) => {
      const res = store.reconnect(p.code, p.token);
      if ('error' in res) return fail(socket, res.error);
      data.code = p.code;
      data.playerId = res.playerId;
      data.token = p.token;
      socket.join(p.code);
      store.attachSocket(p.code, res.playerId, socket.id);
      socket.emit(EVT.joined, { code: p.code, token: p.token, playerId: res.playerId, hostIndex: 0 });
      broadcast(p.code);
    });

    socket.on(EVT.setSeatAi, (p: SetSeatAi) => {
      const res = store.setSeatAi(p.code, data.token ?? '', p.index, p.isAI, p.difficulty as Difficulty | undefined);
      if ('error' in res) return fail(socket, res.error);
      broadcast(p.code);
    });

    socket.on(EVT.startGame, (p: StartGame) => {
      const res = store.start(p.code, data.token ?? '');
      if ('error' in res) return fail(socket, res.error);
      broadcast(p.code);
    });

    socket.on(EVT.action, (p: SubmitAction) => {
      const res = store.submitAction(p.code, data.token ?? '', p.action);
      if ('error' in res) return fail(socket, res.error);
      broadcast(p.code);
    });

    socket.on(EVT.replaceWithAi, (p: ReplaceWithAi) => {
      const res = store.replaceWithAi(p.code, data.token ?? '', p.index, p.difficulty as Difficulty | undefined);
      if ('error' in res) return fail(socket, res.error);
      broadcast(p.code);
    });

    socket.on(EVT.removeSeat, (p: RemoveSeat) => {
      const res = store.removeSeat(p.code, data.token ?? '', p.index);
      if ('error' in res) return fail(socket, res.error);
      broadcast(p.code);
    });

    socket.on(EVT.extendTime, (p: ExtendTime) => {
      const res = store.extendTime(p.code, data.token ?? '', 20_000);
      if ('error' in res) return; // a stale/forbidden grant is harmless – ignore
      broadcast(p.code);
    });

    socket.on(EVT.setAvatar, (p: SetAvatar) => {
      const res = store.setAvatar(p.code, data.token ?? '', p.avatar);
      if ('error' in res) return fail(socket, res.error);
      broadcast(p.code);
    });

    socket.on(EVT.leaveRoom, (p: LeaveRoom) => {
      const res = store.leaveRoom(p.code, data.token ?? '');
      socket.leave(p.code);
      if (res && !res.deleted) broadcast(res.code);
    });

    // Voice signaling: relay to the rest of the room. Audio is peer-to-peer; the
    // server only brokers the WebRTC handshake. `socket.to(code)` excludes the sender.
    socket.on(EVT.voice, (p: VoiceSignal) => {
      if (p && typeof p.code === 'string') socket.to(p.code).emit(EVT.voice, p);
    });

    // Presence (a builder's position): relayed to the room, dropped under load.
    socket.on(EVT.presence, (p: Presence) => {
      if (p && typeof p.code === 'string' && p.code === data.code && p.from === data.playerId) socket.to(p.code).volatile.emit(EVT.presence, p);
    });

    socket.on('disconnect', () => {
      // Let voice peers tear down their connection to this socket's player.
      if (data.code && data.playerId) {
        socket.to(data.code).emit(EVT.voice, {
          code: data.code,
          from: data.playerId,
          to: null,
          kind: 'bye',
        } satisfies VoiceSignal);
      }
      const res = store.markDisconnected(socket.id);
      if (res) broadcast(res.code);
    });
  });

  // Enforce turn clocks: once a second, skip any room whose timer ran out.
  const turnTick = setInterval(() => {
    for (const code of store.expireTurns(Date.now())) broadcast(code);
  }, 1000);
  turnTick.unref?.(); // don't keep the process alive on its own

  const port = opts.port ?? Number(process.env.PORT ?? 3001);
  httpServer.listen(port, '0.0.0.0');

  return {
    io,
    httpServer,
    store,
    close: () =>
      new Promise<void>((done) => {
        clearInterval(turnTick);
        for (const timer of botTimers.values()) clearTimeout(timer);
        botTimers.clear();
        io.close(() => httpServer.close(() => done()));
      }),
  };
}

// Start the server when this file is run directly (dev via tsx, or the built
// bundle in production) – but not when imported, e.g. by tests that spin up
// their own instance. Static file serving stays gated on NODE_ENV=production
// inside createServer, since in dev Vite serves the client.
const runDirectly = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (runDirectly) {
  createServer();
}
