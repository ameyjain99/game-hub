// @vitest-environment node
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, test } from 'vitest';
import { io as ioClient, type Socket } from 'socket.io-client';
import { createServer } from '../../server/index';
import { EVT } from '../../src/net/protocol';
import type { GameState, Hand } from '../../src/games/ticket-to-ride/engine/types';
import type { Joined } from '../../src/net/protocol';

const sum = (h: Hand): number => Object.values(h).reduce((a, b) => a + b, 0);
const connect = (url: string): Socket => ioClient(url, { transports: ['websocket'], forceNew: true });
const waitFor = <T>(sock: Socket, evt: string): Promise<T> =>
  new Promise((resolve) => sock.once(evt, resolve as (v: T) => void));
const connected = (sock: Socket): Promise<void> =>
  new Promise((resolve) => sock.on('connect', () => resolve()));

test('create → join → start flows redacted state to both clients', async () => {
  const srv = createServer({ port: 0 });
  await once(srv.httpServer, 'listening');
  const { port } = srv.httpServer.address() as AddressInfo;
  const url = `http://localhost:${port}`;

  const host = connect(url);
  const guest = connect(url);
  await Promise.all([connected(host), connected(guest)]);

  host.emit(EVT.createRoom, { seatCount: 2, name: 'Host', avatar: '', mapId: 'usa' });
  const hostJoined = await waitFor<Joined>(host, EVT.joined);
  expect(hostJoined.playerId).toBe('p0');
  const code = hostJoined.code;

  guest.emit(EVT.joinRoom, { code, name: 'Guest', avatar: '' });
  const guestJoined = await waitFor<Joined>(guest, EVT.joined);
  expect(guestJoined.playerId).toBe('p1');

  const hostState = waitFor<GameState>(host, EVT.state);
  const guestState = waitFor<GameState>(guest, EVT.state);
  host.emit(EVT.startGame, { code });
  const hs = await hostState;
  await guestState;

  const own = hs.players.find((p) => p.id === 'p0')!;
  const opp = hs.players.find((p) => p.id === 'p1')!;
  expect(sum(own.hand)).toBe(4); // host sees its own starting hand
  expect(sum(opp.hand)).toBe(4); // opponent total only
  expect(hs.rngState).toBe(0); // seed never leaves the server

  host.close();
  guest.close();
  await srv.close();
});

// Voice and video run browser to browser: a blip on the game socket must not
// hang up the call, only a player who stays gone.
test('a dropped socket hangs up the call only if the player stays gone', async () => {
  const srv = createServer({ port: 0, byeGraceMs: 150 });
  await once(srv.httpServer, 'listening');
  const url = `http://localhost:${(srv.httpServer.address() as AddressInfo).port}`;
  const open = () => ioClient(url, { transports: ['websocket'], forceNew: true });
  const got = <T>(s: Socket, evt: string) => new Promise<T>((r) => s.once(evt, r as (v: T) => void));

  const host = open();
  host.emit(EVT.createRoom, { seatCount: 2, name: 'Ann', avatar: '', gameId: 'chess' });
  const { code } = await got<Joined>(host, EVT.joined);
  let guest = open();
  guest.emit(EVT.joinRoom, { code, name: 'Bob', avatar: '' });
  const seat = await got<Joined>(guest, EVT.joined);

  const byes: string[] = [];
  host.on(EVT.voice, (m: { kind: string; from: string }) => m.kind === 'bye' && byes.push(m.from));

  // A blip: gone and back inside the grace period.
  guest.close();
  guest = open();
  guest.emit(EVT.reconnect, { code, token: seat.token });
  await got(guest, EVT.joined);
  await new Promise((r) => setTimeout(r, 300));
  expect(byes).toEqual([]);

  // Gone for good.
  guest.close();
  await new Promise((r) => setTimeout(r, 400));
  expect(byes).toEqual(['p1']);

  host.close();
  await srv.close();
});
