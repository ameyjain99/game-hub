// @vitest-environment node
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, test } from 'vitest';
import { io as ioClient, type Socket } from 'socket.io-client';
import { createServer } from '../../server/index';
import { EVT, type Joined } from '../../src/net/protocol';
import type { SnlState } from '../../src/games/snakes-and-ladders/engine';
import type { SeqState } from '../../src/games/sequence/engine';

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

test('online Sequence: each player sees only their own hand', async () => {
  const { srv, url } = await serve();
  const host = connect(url);
  const guest = connect(url);
  await Promise.all([connected(host), connected(guest)]);
  host.emit(EVT.createRoom, { seatCount: 2, name: 'Ann', avatar: '', gameId: 'sequence' });
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

test('online Minecraft: a block one builder sets reaches the other; positions relay', async () => {
  const { srv, url } = await serve();
  const { host, guest, code } = await pair(url, 'minecraft');
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

test("online Uno (Flip): each player sees the face in play of their own cards and the back of the other's", async () => {
  const { srv, url } = await serve();
  const { host, guest, hostState } = await pair(url, 'uno', { variant: 'flip' });
  expect(hostState.variant).toBe('flip');
  expect(hostState.players[0].hand.every((c: { light: unknown; dark: unknown }) => c.light && !c.dark)).toBe(true);
  expect(hostState.players[1].hand.every((c: { light: unknown; dark: unknown }) => !c.light && c.dark)).toBe(true);
  host.close();
  guest.close();
  await srv.close();
});

test('online Exploding Kittens: hands and the draw pile stay hidden, and a draw passes the turn', async () => {
  const { srv, url } = await serve();
  const { host, guest, code, hostState } = await pair(url, 'exploding-kittens', { handSize: 5 });
  expect(hostState.players.map((p: { hand: unknown[] }) => p.hand.length)).toEqual([6, 0]);
  expect(hostState.players.map((p: { handCount: number }) => p.handCount)).toEqual([6, 6]);
  expect([hostState.deck.length, hostState.deckCount > 0, hostState.seed]).toEqual([0, true, 0]);
  const mover = hostState.turn === 0 ? host : guest;
  const next = waitFor<{ turn: number; defusing: string | null; deckCount: number }>(host, EVT.state);
  mover.emit(EVT.action, { code, action: { type: 'DRAW' } });
  const after = await next;
  expect(after.deckCount).toBe(hostState.deckCount - 1);
  expect(after.defusing !== null || after.turn !== hostState.turn).toBe(true);
  host.close();
  guest.close();
  await srv.close();
});

test('online Monopoly Deal: hands stay hidden, and a card banked is seen by both', async () => {
  const { srv, url } = await serve();
  const { host, guest, code, hostState } = await pair(url, 'monopoly-deal', { setsToWin: 2 });
  expect(hostState.players.map((p: { hand: unknown[] }) => p.hand.length)).toEqual([5, 0]);
  expect([hostState.deck.length, hostState.deckCount, hostState.setsToWin]).toEqual([0, 96, 2]);
  const mover = hostState.turn === 0 ? host : guest;
  const watcher = hostState.turn === 0 ? guest : host;
  const drew = waitFor<{ players: { hand: { id: number; kind: string }[]; handCount: number }[]; turn: number }>(mover, EVT.state);
  const watched = waitFor(watcher, EVT.state);
  mover.emit(EVT.action, { code, action: { type: 'DRAW' } });
  const mine = (await drew).players[hostState.turn];
  await watched;
  expect(mine.hand).toHaveLength(7);
  const card = mine.hand.find((c) => c.kind !== 'property' && c.kind !== 'wild');
  if (card) {
    const seen = waitFor<{ players: { bank: { id: number }[]; hand: unknown[] }[] }>(watcher, EVT.state);
    mover.emit(EVT.action, { code, action: { type: 'BANK', card: card.id } });
    const theirs = (await seen).players[hostState.turn];
    expect([theirs.bank.map((c) => c.id), theirs.hand]).toEqual([[card.id], []]);
  }
  host.close();
  guest.close();
  await srv.close();
});

test('online Poker (Omaha): hole cards stay hidden, and the dealer deals the flop by itself', async () => {
  const { srv, url } = await serve();
  const { host, guest, code, hostState } = await pair(url, 'poker', { variant: 'omaha' });
  expect(hostState.variant).toBe('omaha');
  expect(hostState.players[0].hole.every((c: string | null) => c !== null)).toBe(true);
  expect(hostState.players[1].hole.every((c: string | null) => c === null)).toBe(true);
  // Heads-up: the button (small blind) calls, the big blind checks; no one acts again until the flop.
  const states: { board: string[]; toAct: number | null; players: { id: string }[] }[] = [];
  host.on(EVT.state, (s) => states.push(s));
  let s = hostState;
  for (const step of ['CALL', 'CHECK']) {
    const actor = s.players[s.toAct].id === 'p0' ? host : guest;
    const next = waitFor<typeof hostState>(host, EVT.state);
    actor.emit(EVT.action, { code, action: { type: step } });
    s = await next;
  }
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline && !states.some((x) => x.board.length === 3)) await new Promise((r) => setTimeout(r, 50));
  expect(states.some((x) => x.board.length === 3)).toBe(true);
  host.close();
  guest.close();
  await srv.close();
}, 10_000);

test('online Catan: the bots take their setup placements on the server, one at a time', async () => {
  const { srv, url } = await serve();
  const { legalSettlementSpots, legalRoadSpots } = await import('../../src/games/catan/engine');
  const host = connect(url);
  await connected(host);
  host.emit(EVT.createRoom, { seatCount: 3, name: 'Ann', avatar: '', gameId: 'catan' });
  const { code } = await waitFor<Joined>(host, EVT.joined);
  for (const index of [1, 2]) {
    host.emit(EVT.setSeatAi, { code, index, isAI: true, difficulty: 'normal' });
    await waitFor(host, EVT.lobby);
  }
  let latest: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  host.on(EVT.state, (s) => (latest = s));
  host.emit(EVT.startGame, { code });
  while (!latest) await new Promise((r) => setTimeout(r, 20));
  host.emit(EVT.action, { code, action: { type: 'BUILD_SETTLEMENT', vertex: legalSettlementSpots(latest, 'p0')[0] } });
  await new Promise((r) => setTimeout(r, 100));
  host.emit(EVT.action, { code, action: { type: 'BUILD_ROAD', edge: legalRoadSpots(latest, 'p0')[0] } });
  // Both bots place twice (snake order), then it's the host's second placement.
  const deadline = Date.now() + 9000;
  while (Date.now() < deadline && latest.setup?.step !== 5) await new Promise((r) => setTimeout(r, 50));
  expect(latest.setup.step).toBe(5);
  expect(latest.buildings.filter((b: { player: string } | null) => b && b.player !== 'p0')).toHaveLength(4);
  host.close();
  await srv.close();
}, 12_000);

test('online Imposter: the word reaches only the crew, and the bots give their clues on the server', async () => {
  const { srv, url } = await serve();
  const host = connect(url);
  await connected(host);
  host.emit(EVT.createRoom, { seatCount: 3, name: 'Ann', avatar: '', gameId: 'imposter', options: { mode: 'classic', clues: 1 } });
  const { code } = await waitFor<Joined>(host, EVT.joined);
  for (const index of [1, 2]) {
    host.emit(EVT.setSeatAi, { code, index, isAI: true, difficulty: 'normal' });
    await waitFor(host, EVT.lobby);
  }
  let latest: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  host.on(EVT.state, (s) => (latest = s));
  host.emit(EVT.startGame, { code });
  while (!latest) await new Promise((r) => setTimeout(r, 20));
  // The state the host receives names no word but their own, and no seed.
  expect(latest.round.word).toBe('');
  expect(latest.seed).toBe(0);
  if (latest.round.imposter === 'p0') expect(latest.round.yours).toBeNull();
  else expect(typeof latest.round.yours).toBe('string');
  // One clue each: the host clues on their turn; the bots clue by themselves.
  let gave = false;
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline && latest.phase === 'clues') {
    const r = latest.round;
    if (!gave && r.order[r.turn % r.order.length] === 'p0') {
      gave = true;
      host.emit(EVT.action, { code, action: { type: 'CLUE', text: 'qzzq' } });
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  expect(latest.phase).toBe('discuss');
  expect(latest.round.clues.map((c: { player: string }) => c.player).sort()).toEqual(['p0', 'p1', 'p2']);
  host.close();
  await srv.close();
}, 14_000);

test('online Cluedo: the envelope and the other hands stay hidden, and bots take their turns on the server', async () => {
  const { srv, url } = await serve();
  const host = connect(url);
  await connected(host);
  host.emit(EVT.createRoom, { seatCount: 3, name: 'Ann', avatar: '', gameId: 'cluedo' });
  const { code } = await waitFor<Joined>(host, EVT.joined);
  for (const index of [1, 2]) {
    host.emit(EVT.setSeatAi, { code, index, isAI: true, difficulty: 'normal' });
    await waitFor(host, EVT.lobby);
  }
  let latest: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  host.on(EVT.state, (s) => (latest = s));
  host.emit(EVT.startGame, { code });
  while (!latest) await new Promise((r) => setTimeout(r, 20));
  expect(latest.solution.suspect).toBe('');
  expect(latest.players[0].hand).toHaveLength(6);
  expect(latest.players[1].hand).toEqual([]);
  expect(latest.players[1].cards).toBe(6);
  // The host rolls and stops on the first square in reach; then the bots play.
  host.emit(EVT.action, { code, action: { type: 'ROLL' } });
  while (latest.phase !== 'move') await new Promise((r) => setTimeout(r, 20));
  host.emit(EVT.action, { code, action: { type: 'MOVE', to: Number(Object.keys(latest.reach.squares)[0]) } });
  const rolled = (id: string) => latest.log.some((e: { kind: string; player?: string }) => e.kind === 'roll' && e.player === id);
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline && !rolled('p1')) await new Promise((r) => setTimeout(r, 50));
  expect(rolled('p1')).toBe(true);
  expect(latest.current).toBe(1);
  host.close();
  await srv.close();
}, 12_000);
