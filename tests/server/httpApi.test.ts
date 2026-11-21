import { afterEach, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createServer } from '../../server/index';

let srv: ReturnType<typeof createServer> | null = null;

afterEach(async () => {
  if (srv) await srv.close();
  srv = null;
});

async function startOnEphemeralPort(opts: Parameters<typeof createServer>[0] = {}): Promise<number> {
  srv = createServer({ port: 0, ...opts });
  const http = srv.httpServer;
  await new Promise<void>((r) => (http.listening ? r() : http.once('listening', () => r())));
  return (http.address() as AddressInfo).port;
}

test('the room-exists endpoint reports a code that is not open', async () => {
  const port = await startOnEphemeralPort();
  const res = await (await fetch(`http://127.0.0.1:${port}/api/room-exists?code=ZZZZ`)).json();
  expect(res).toEqual({ exists: false });
});

test('the room-exists endpoint names the game of an open room', async () => {
  const port = await startOnEphemeralPort();
  const { code } = srv!.store.createRoom(2, 'Ana', '🦊', {}, 'chess');
  const res = await (await fetch(`http://127.0.0.1:${port}/api/room-exists?code=${code.toLowerCase()}`)).json();
  expect(res).toEqual({ exists: true, gameId: 'chess', started: false, openSeats: [] });
});

test('the contributors endpoint answers with the list for the home page', async () => {
  const ana = { login: 'ana', avatar: 'https://avatars.example/ana', url: 'https://github.com/ana', contributions: 3 };
  const port = await startOnEphemeralPort({ contributors: async () => [ana] });
  const res = await fetch(`http://127.0.0.1:${port}/api/contributors`);
  expect(res.headers.get('content-type')).toBe('application/json');
  expect(await res.json()).toEqual([ana]);
});
