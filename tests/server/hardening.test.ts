// @vitest-environment node
// What the server refuses: messages that would crash it, signals from outside
// a room, oversized options, and rooms nobody is coming back to.
import { once } from 'node:events';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, test } from 'vitest';
import { io as ioClient, type Socket } from 'socket.io-client';
import { createServer } from '../../server/index';
import { RoomStore } from '../../server/rooms';
import { EVT, type Joined } from '../../src/net/protocol';
import { createMonopolyGame } from '../../src/games/monopoly/engine/state';

let srv: ReturnType<typeof createServer> | null = null;
const socks: Socket[] = [];

afterEach(async () => {
  for (const s of socks.splice(0)) s.close();
  if (srv) await srv.close();
  srv = null;
});

async function start(): Promise<number> {
  srv = createServer({ port: 0 });
  await once(srv.httpServer, 'listening');
  return (srv.httpServer.address() as AddressInfo).port;
}

async function client(port: number): Promise<Socket> {
  const s = ioClient(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true });
  socks.push(s);
  await new Promise<void>((r) => s.on('connect', () => r()));
  return s;
}
const next = <T>(s: Socket, evt: string): Promise<T> => new Promise((r) => s.once(evt, r as (v: T) => void));

async function room(port: number): Promise<{ host: Socket; code: string }> {
  const host = await client(port);
  host.emit(EVT.createRoom, { seatCount: 2, name: 'Host', avatar: '', gameId: 'monopoly', options: {} });
  const joined = await next<Joined>(host, EVT.joined);
  return { host, code: joined.code };
}

test('messages with no payload, or the wrong shape, are refused and the server keeps serving', async () => {
  const port = await start();
  const bad = await client(port);
  for (const evt of [EVT.createRoom, EVT.joinRoom, EVT.reconnect, EVT.action, EVT.startGame, EVT.voice, EVT.setOptions]) {
    bad.emit(evt);
    bad.emit(evt, null);
    bad.emit(evt, 'text');
    bad.emit(evt, 7);
  }
  const { code } = await room(port);
  const failed = next<{ message: string }>(bad, EVT.errorMsg);
  bad.emit(EVT.joinRoom, { code, name: { not: 'a string' }, avatar: 5 });
  bad.emit(EVT.createRoom, { seatCount: 'many', name: 'x', avatar: '', gameId: 'monopoly' });
  expect((await failed).message).toBeTruthy();
  // Still alive: a new room opens.
  expect((await room(port)).code).toMatch(/^[A-Z2-9]{4}$/);
});

test('an action that is not an action is refused without ending the game', async () => {
  const port = await start();
  const { host, code } = await room(port);
  const guest = await client(port);
  guest.emit(EVT.joinRoom, { code, name: 'Guest', avatar: '' });
  await next<Joined>(guest, EVT.joined);
  const started = next(host, EVT.state);
  host.emit(EVT.startGame, { code });
  await started;
  for (const action of [undefined, null, 4, 'ROLL', { type: 'NOPE' }, { type: 'BID', amount: 'lots' }, { type: 'CHOOSE', space: {} }]) {
    const refused = next<{ message: string }>(host, EVT.errorMsg);
    host.emit(EVT.action, { code, action });
    expect((await refused).message).toBeTruthy();
  }
  expect(srv!.store.roomInfo(code)).toMatchObject({ started: true });
});

test('a voice signal is relayed only inside the sender\'s own room and under their own id', async () => {
  const port = await start();
  const { host, code } = await room(port);
  const outsider = await client(port);
  const heard: string[] = [];
  host.on(EVT.voice, (m: { from: string }) => heard.push(m.from));
  outsider.emit(EVT.voice, { code, from: 'p1', to: null, kind: 'hello' });

  const guest = await client(port);
  guest.emit(EVT.joinRoom, { code, name: 'Guest', avatar: '' });
  await next<Joined>(guest, EVT.joined);
  guest.emit(EVT.voice, { code, from: 'p0', to: null, kind: 'hello' }); // someone else's id
  const arrived = next(host, EVT.voice);
  guest.emit(EVT.voice, { code, from: 'p1', to: null, kind: 'hello' });
  await arrived;
  expect(heard).toEqual(['p1']);
});

test('a request line that is not a URL gets a 400, and files carry the no-sniff header', async () => {
  const port = await start();
  const status = await new Promise<number>((resolve, reject) => {
    const req = request({ port, host: '127.0.0.1', path: '//', method: 'GET' }, (res) => resolve(res.statusCode ?? 0));
    req.on('error', reject);
    req.end();
  });
  expect(status).toBe(400);
  const ok = await fetch(`http://127.0.0.1:${port}/api/room-exists?code=ZZZZ`);
  expect(ok.headers.get('x-content-type-options')).toBe('nosniff');
  expect(await ok.json()).toEqual({ exists: false });
});

test('options that are not a small plain object are refused', () => {
  const store = new RoomStore();
  expect(() => store.createRoom(2, 'Host', '', 'options', 'monopoly')).toThrow('invalid options');
  expect(() => store.createRoom(2, 'Host', '', { pad: 'x'.repeat(5000) }, 'monopoly')).toThrow('invalid options');
  expect(() => store.createRoom(2.5, 'Host', '', {}, 'monopoly')).toThrow('invalid seat count');
  const { code, token } = store.createRoom(2, 'Host', '', {}, 'monopoly');
  expect(store.setOptions(code, token, { pad: 'x'.repeat(5000) })).toEqual({ error: 'invalid options' });
  expect(store.setOptions(code, token, { auctions: false })).toEqual({ ok: true });
});

test('a room nobody is connected to is closed after two hours, and not before', () => {
  const store = new RoomStore();
  const { code, token } = store.createRoom(2, 'Host', '', {}, 'monopoly');
  const t0 = 1_000_000;
  expect(store.sweep(t0)).toEqual([]);
  expect(store.sweep(t0 + 3 * 60 * 60_000)).toEqual([]); // the host is connected
  store.attachSocket(code, 'p0', 'sock');
  store.markDisconnected('sock');
  expect(store.sweep(t0 + 4 * 60 * 60_000)).toEqual([]); // the idle clock starts here
  expect(store.sweep(t0 + 5 * 60 * 60_000)).toEqual([]);
  expect(store.reconnect(code, token)).toEqual({ playerId: 'p0' }); // back in time: the clock resets
  store.sweep(t0 + 5.5 * 60 * 60_000);
  store.markDisconnected('sock');
  store.attachSocket(code, 'p0', 'sock2');
  store.markDisconnected('sock2');
  expect(store.sweep(t0 + 6 * 60 * 60_000)).toEqual([]);
  expect(store.sweep(t0 + 8 * 60 * 60_000 + 1)).toEqual([code]);
  expect(store.roomInfo(code)).toBeNull();
});

test('Monopoly settings from a client fall back to the standard rule when they are not sane', () => {
  const seats = [
    { avatar: '', isAI: false },
    { avatar: '', isAI: true },
  ];
  const junk = { startingCash: 1e308, roundLimit: -3, auctions: 'yes', mortgaging: null, goSalary: 12345 } as never;
  const g = createMonopolyGame(seats, 1, junk);
  expect(g.settings).toMatchObject({ startingCash: 1500, roundLimit: 0, auctions: true, mortgaging: true, goSalary: 200 });
  expect(g.players.map((p) => p.cash)).toEqual([1500, 1500]);
  expect(createMonopolyGame(seats, 1, { board: 'megaUs', startingCash: Number.NaN }).settings.startingCash).toBe(2500);
  expect(createMonopolyGame(seats, 1, { startingCash: 2000, roundLimit: 6 }).settings).toMatchObject({ startingCash: 2000, roundLimit: 6 });
});
