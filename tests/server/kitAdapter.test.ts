import { describe, expect, test } from 'vitest';
import { adapterFor } from '../../server/adapters';
import { RoomStore } from '../../server/rooms';
import type { TttState } from '../../src/games/tic-tac-toe/engine';
import type { WgState } from '../../src/games/wordgrid/engine';

const adapter = adapterFor('tic-tac-toe');
const configs = (botSecond: boolean) => [
  { name: 'Ann', isAI: false, avatar: '' },
  { name: 'Bot', isAI: botSecond, avatar: '', difficulty: 'hard' },
];

describe('kitAdapter (Tic-Tac-Toe)', () => {
  test('validates seats and starts on the first human', () => {
    expect(adapter.validateSeatCount(2, {})).toBeNull();
    expect(adapter.validateSeatCount(3, {})).not.toBeNull();
    const g = adapter.createGame(configs(true), 1, {}) as TttState;
    expect(adapter.turnActorId(g)).toBe('p0');
    expect(adapter.botDelay!(g)).toBeNull(); // a human is to move
  });

  test('applies a legal move, rejects one out of turn, and leaves the bot to step', () => {
    const g = adapter.createGame(configs(true), 1, {});
    expect(adapter.applyAction(g, { type: 'PLACE', cell: 4 }, { actorId: 'p1' })).toHaveProperty('error');
    const res = adapter.applyAction(g, { type: 'PLACE', cell: 4 }, { actorId: 'p0' });
    if (!('game' in res)) throw new Error(res.error);
    const after = res.game as TttState;
    // The bot hasn't moved yet: it acts one step later, after its delay.
    expect(after.moves).toEqual([4]);
    expect(adapter.turnActorId(after)).toBeNull();
    expect(adapter.botDelay!(after)).toBeGreaterThan(0);
    const stepped = adapter.stepBot!(after) as TttState;
    expect(stepped.moves).toHaveLength(2);
    expect(stepped.turn).toBe('p0');
  });

  test("a timed-out player's move is made for them", () => {
    const g = adapter.createGame(configs(false), 1, {});
    const res = adapter.applyAction(g, { type: 'SKIP_TURN' }, { actorId: 'p0' });
    if (!('game' in res)) throw new Error(res.error);
    expect((res.game as TttState).moves).toHaveLength(1);
  });

  test('a malformed action is an error, not a crash', () => {
    const g = adapter.createGame(configs(false), 1, {});
    expect(adapter.applyAction(g, null, { actorId: 'p0' })).toHaveProperty('error');
    expect(adapter.applyAction(g, { type: 'PLACE', cell: 99 }, { actorId: 'p0' })).toHaveProperty('error');
  });
});

describe('RoomStore stepped bots', () => {
  test('a bot moves one step at a time while a human is connected', () => {
    const store = new RoomStore();
    const { code, token } = store.createRoom(2, 'Ann', '', {}, 'tic-tac-toe');
    store.setSeatAi(code, token, 1, true, 'normal');
    expect(store.start(code, token)).toEqual({ ok: true });
    expect(store.botDelay(code)).toBeNull(); // Ann moves first
    store.submitAction(code, token, { type: 'PLACE', cell: 0 });
    expect(store.botDelay(code)).toBeGreaterThan(0);
    expect(store.stepBot(code)).toBe(true);
    const view = store.stateForViewer(code, 'p0') as TttState;
    expect(view.moves).toHaveLength(2);
    expect(store.stepBot(code)).toBe(false); // Ann's move again
  });

  test('bots stop when no human is connected', () => {
    const store = new RoomStore();
    const { code, token } = store.createRoom(2, 'Ann', '', {}, 'tic-tac-toe');
    store.setSeatAi(code, token, 1, true, 'normal');
    store.start(code, token);
    store.submitAction(code, token, { type: 'PLACE', cell: 0 });
    store.leaveRoom(code, token);
    expect(store.botDelay(code)).toBeNull();
  });
});

describe('Wordgrid adapter', () => {
  test('loads the word list itself and refuses words that are not in it', () => {
    const a = adapterFor('wordgrid');
    const g = a.createGame(configs(false), 1, {}) as WgState;
    const rack = ['Q', 'X', 'A', 'T', 'E', 'E', 'E'].map((letter, i) => ({ id: 900 + i, letter }));
    const s = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, rack, rackCount: 7 } : p)) };
    const centre = 112;
    const bad = a.applyAction(s, { type: 'PLAY', tiles: [{ id: 900, cell: centre }, { id: 901, cell: centre + 1 }] }, { actorId: 'p0' });
    expect(bad).toEqual({ error: "QX isn't in the dictionary." });
    const good = a.applyAction(s, { type: 'PLAY', tiles: [{ id: 902, cell: centre }, { id: 903, cell: centre + 1 }] }, { actorId: 'p0' });
    expect(good).toHaveProperty('game');
  });
});
