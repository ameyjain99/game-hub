// @vitest-environment node
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, test } from 'vitest';
import { io as ioClient, type Socket } from 'socket.io-client';
import { createServer } from '../../server/index';
import { EVT, type Joined } from '../../src/net/protocol';
import type { SnlState } from '../../src/games/snakes-and-ladders/engine';
import type { SeqState } from '../../src/games/lineup/engine';

const connect = (url: string): Socket => ioClient(url, { transports: ['websocket'], forceNew: true });
const waitFor = <T>(sock: Socket, evt: string): Promise<T> => new Promise((resolve) => sock.once(evt, resolve as (v: T) => void));
const connected = (sock: Socket): Promise<void> => new Promise((resolve) => sock.on('connect', () => resolve()));

async function serve() {
  const srv = createServer({ port: 0 });
  await once(srv.httpServer, 'listening');
  const { port } = srv.httpServer.address() as AddressInfo;
  return { srv, url: `http://localhost:${port}` };
}

test('online Snakes & Ladders: the bot rolls on its own, one broadcast per move', async () => {
  const { srv, url } = await serve();
  const host = connect(url);
  await connected(host);
  host.emit(EVT.createRoom, { seatCount: 2, name: 'Ann', avatar: '', gameId: 'snakes-and-ladders' });
  const { code } = await waitFor<Joined>(host, EVT.joined);
  host.emit(EVT.setSeatAi, { code, index: 1, isAI: true, difficulty: 'normal' });
  await waitFor(host, EVT.lobby);

  const states: SnlState[] = [];
  host.on(EVT.state, (s: SnlState) => states.push(s));
  host.emit(EVT.startGame, { code });
  await new Promise((r) => setTimeout(r, 150));
  expect(states.at(-1)!.players[0].pos).toBe(0);

  // Roll until the turn passes (a 6 rolls again), then wait for the bot's roll after its delay.
  const deadline = Date.now() + 8000;
  let rolled = 0;
  while (Date.now() < deadline && !states.some((s) => s.history.some((m) => m.player === 'p1'))) {
    const now = states.at(-1)!;
    if (now.turn === 0 && (now.last?.seq ?? 0) === rolled && !now.over) {
      rolled++;
      host.emit(EVT.action, { code, action: { type: 'ROLL' } });
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  const botMoves = states.filter((s) => s.last?.player === 'p1');
  expect(botMoves.length).toBeGreaterThan(0);
  // Each broadcast carries at most one new move.
  for (let i = 1; i < states.length; i++) expect((states[i].last?.seq ?? 0) - (states[i - 1].last?.seq ?? 0)).toBeLessThanOrEqual(1);

  host.close();
  await srv.close();
}, 10_000);

test('online Lineup: each player sees only their own hand', async () => {
  const { srv, url } = await serve();
  const host = connect(url);
  const guest = connect(url);
  await Promise.all([connected(host), connected(guest)]);
  host.emit(EVT.createRoom, { seatCount: 2, name: 'Ann', avatar: '', gameId: 'lineup' });
  const { code } = await waitFor<Joined>(host, EVT.joined);
  guest.emit(EVT.joinRoom, { code, name: 'Ben', avatar: '' });
  await waitFor<Joined>(guest, EVT.joined);

  const hostState = waitFor<SeqState>(host, EVT.state);
  const guestState = waitFor<SeqState>(guest, EVT.state);
  host.emit(EVT.startGame, { code });
  const [hs, gs] = await Promise.all([hostState, guestState]);
  expect(hs.players[0].hand).toHaveLength(7);
  expect(hs.players[1].hand).toEqual([]);
  expect(gs.players[1].hand).toHaveLength(7);
  expect(gs.players[0].hand).toEqual([]);
  expect(hs.deck).toEqual([]);

  host.close();
  guest.close();
  await srv.close();
});

test('online Chess offers no bot seats but plays between two people', async () => {
  const { srv, url } = await serve();
  const host = connect(url);
  const guest = connect(url);
  await Promise.all([connected(host), connected(guest)]);
  host.emit(EVT.createRoom, { seatCount: 2, name: 'Ann', avatar: '', gameId: 'chess' });
  const { code } = await waitFor<Joined>(host, EVT.joined);
  guest.emit(EVT.joinRoom, { code, name: 'Ben', avatar: '' });
  await waitFor<Joined>(guest, EVT.joined);
  host.emit(EVT.startGame, { code });
  await waitFor(guest, EVT.state);
  const next = waitFor<{ moves: { san: string }[] }>(guest, EVT.state);
  host.emit(EVT.action, { code, action: { type: 'MOVE', from: 'e2', to: 'e4' } });
  expect((await next).moves.map((m) => m.san)).toEqual(['e4']);
  // Untimed: no turn clock runs.
  const lobby = await new Promise<{ turnDeadline: number | null }>((resolve) => {
    guest.once(EVT.lobby, resolve);
    guest.emit(EVT.action, { code, action: { type: 'MOVE', from: 'e7', to: 'e5' } });
  });
  expect(lobby.turnDeadline).toBeNull();

  host.close();
  guest.close();
  await srv.close();
});

/** Two people in a fresh room of `gameId`, started. */
async function pair(url: string, gameId: string, options?: unknown) {
  const host = connect(url);
  const guest = connect(url);
  await Promise.all([connected(host), connected(guest)]);
  host.emit(EVT.createRoom, { seatCount: 2, name: 'Ann', avatar: '', gameId, options });
  const { code } = await waitFor<Joined>(host, EVT.joined);
  guest.emit(EVT.joinRoom, { code, name: 'Ben', avatar: '' });
  await waitFor<Joined>(guest, EVT.joined);
  const hs = waitFor<any>(host, EVT.state); // eslint-disable-line @typescript-eslint/no-explicit-any
  const gs = waitFor<any>(guest, EVT.state); // eslint-disable-line @typescript-eslint/no-explicit-any
  host.emit(EVT.startGame, { code });
  const [hostState, guestState] = await Promise.all([hs, gs]);
  return { host, guest, code, hostState, guestState };
}

test('online Blockyard: a block one builder sets reaches the other; positions relay', async () => {
  const { srv, url } = await serve();
  const { host, guest, code } = await pair(url, 'blockyard');
  const next = waitFor<{ edits: Record<string, number> }>(guest, EVT.state);
  host.emit(EVT.action, { code, action: { type: 'SET', i: 12345, b: 10 } });
  expect((await next).edits).toEqual({ 12345: 10 });
  const pose = waitFor<{ from: string; data: unknown }>(guest, EVT.presence);
  host.emit(EVT.presence, { code, from: 'p0', data: { x: 1, y: 2, z: 3, yaw: 0, pitch: 0 } });
  expect(await pose).toMatchObject({ from: 'p0', data: { x: 1 } });
  host.close();
  guest.close();
  await srv.close();
});

test("online Last Card (Flip): each player sees the face in play of their own cards and the back of the other's", async () => {
  const { srv, url } = await serve();
  const { host, guest, hostState } = await pair(url, 'last-card', { variant: 'flip' });
  expect(hostState.variant).toBe('flip');
  expect(hostState.players[0].hand.every((c: { light: unknown; dark: unknown }) => c.light && !c.dark)).toBe(true);
  expect(hostState.players[1].hand.every((c: { light: unknown; dark: unknown }) => !c.light && c.dark)).toBe(true);
  host.close();
  guest.close();
  await srv.close();
});
