// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMediaChat } from '../../../src/online/useMediaChat';
import { EVT, type VoiceSignal } from '../../../src/net/protocol';

/** Just enough of RTCPeerConnection to drive the hook's connection handling. */
class FakePc {
  static all: FakePc[] = [];
  connectionState: RTCPeerConnectionState = 'new';
  remoteDescription: unknown = null;
  onconnectionstatechange: (() => void) | null = null;
  ontrack: unknown = null;
  onicecandidate: unknown = null;
  closed = false;
  offers: RTCOfferOptions[] = [];
  constructor() {
    FakePc.all.push(this);
  }
  addTransceiver() {}
  getTransceivers() {
    return [];
  }
  async createOffer(o: RTCOfferOptions = {}) {
    this.offers.push(o);
    return { type: 'offer', sdp: 'o' };
  }
  async createAnswer() {
    return { type: 'answer', sdp: 'a' };
  }
  async setLocalDescription() {}
  async setRemoteDescription(d: unknown) {
    this.remoteDescription = d;
  }
  async addIceCandidate() {}
  close() {
    this.closed = true;
  }
  become(state: RTCPeerConnectionState) {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
}

function fakeSocket() {
  const handlers = new Map<string, (arg?: unknown) => void>();
  return {
    connected: true,
    on: vi.fn((evt: string, fn: (arg?: unknown) => void) => void handlers.set(evt, fn)),
    off: vi.fn(),
    emit: vi.fn(),
    /** Deliver a signal from another player. */
    async receive(msg: Omit<VoiceSignal, 'code'>) {
      await act(async () => {
        handlers.get(EVT.voice)!({ code: 'ABCD', ...msg });
        await Promise.resolve();
      });
    },
    reconnect() {
      act(() => handlers.get('connect')!());
    },
    /** The signals this player sent, by kind. */
    sent(kind: VoiceSignal['kind']): VoiceSignal[] {
      return this.emit.mock.calls.map((c) => c[1] as VoiceSignal).filter((m) => m.kind === kind);
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  FakePc.all = [];
  vi.stubGlobal('RTCPeerConnection', FakePc);
  vi.stubGlobal('MediaStream', class {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(); // jsdom plays nothing
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** p0 (who makes the offers) in a call with p1, connected. */
async function inCall() {
  const socket = fakeSocket();
  const hook = renderHook(() => useMediaChat({ socket: socket as never, code: 'ABCD', myId: 'p0', enabled: true, video: true }));
  await socket.receive({ from: 'p1', to: null, kind: 'hello' });
  const pc = FakePc.all[0];
  const offer = socket.sent('offer')[0].data as { sid: string };
  await socket.receive({ from: 'p1', to: 'p0', kind: 'answer', data: { sdp: { type: 'answer', sdp: 'a' }, sid: offer.sid } });
  act(() => pc.become('connected'));
  return { socket, hook, pc, sid: offer.sid };
}

test('a brief network blip is left to heal: the connection is kept and nothing is re-sent', async () => {
  const { socket, hook, pc } = await inCall();
  act(() => pc.become('disconnected'));
  expect(hook.result.current.peerStatus.get('p1')).toBe('reconnecting');
  act(() => void vi.advanceTimersByTime(1000));
  act(() => pc.become('connected'));
  act(() => void vi.advanceTimersByTime(60_000));
  expect(hook.result.current.peerStatus.get('p1')).toBe('live');
  expect(pc.closed).toBe(false);
  expect(socket.sent('offer')).toHaveLength(1);
});

test('a connection that stays down gets an ICE restart on the same connection, then a rebuild', async () => {
  const { socket, pc, sid } = await inCall();
  act(() => pc.become('disconnected'));
  await act(async () => void (await vi.advanceTimersByTimeAsync(3_100)));
  expect(pc.offers.at(-1)).toEqual({ iceRestart: true });
  expect(socket.sent('offer').at(-1)!.data).toMatchObject({ sid, restart: true });
  expect(pc.closed).toBe(false);

  // The restart didn't bring it back: start the pair over on a new connection.
  await act(async () => void (await vi.advanceTimersByTimeAsync(15_100)));
  expect(pc.closed).toBe(true);
  expect(FakePc.all).toHaveLength(2);
  expect((socket.sent('offer').at(-1)!.data as { sid: string }).sid).not.toBe(sid);
});

test("another player's socket reconnecting does not touch a call both sides still hold", async () => {
  const { socket, pc } = await inCall();
  await socket.receive({ from: 'p1', to: null, kind: 'sync', data: { have: ['p0'] } });
  expect(pc.closed).toBe(false);
  expect(FakePc.all).toHaveLength(1);
});

test('a pair only one side lost starts over', async () => {
  const { socket, pc } = await inCall();
  await socket.receive({ from: 'p1', to: null, kind: 'sync', data: { have: [] } });
  expect(pc.closed).toBe(true);
  expect(FakePc.all).toHaveLength(2);
  expect(socket.sent('offer')).toHaveLength(2);
});

test('after our own socket reconnects we tell the room which calls we still hold', async () => {
  const { socket } = await inCall();
  socket.reconnect();
  expect(socket.sent('sync').at(-1)!.data).toEqual({ have: ['p1'] });
});

test('a reloaded player (a fresh hello) replaces the stale connection we held for them', async () => {
  const { socket, pc } = await inCall();
  await socket.receive({ from: 'p1', to: null, kind: 'hello' });
  expect(pc.closed).toBe(true);
  expect(FakePc.all).toHaveLength(2);
});
