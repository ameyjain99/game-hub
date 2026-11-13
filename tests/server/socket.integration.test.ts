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
