// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { linkIsWeak, useMediaChat } from '../../../src/online/useMediaChat';
import { EVT, type MediaState, type VoiceSignal } from '../../../src/net/protocol';

test('a link is weak on heavy loss, a long round trip or almost no spare bitrate', () => {
  expect(linkIsWeak([{ type: 'remote-inbound-rtp', fractionLost: 0.02, roundTripTime: 0.08 }])).toBe(false);
  expect(linkIsWeak([{ type: 'remote-inbound-rtp', fractionLost: 0.3 }])).toBe(true);
  expect(linkIsWeak([{ type: 'remote-inbound-rtp', roundTripTime: 1.4 }])).toBe(true);
  expect(linkIsWeak([{ type: 'candidate-pair', nominated: true, state: 'succeeded', availableOutgoingBitrate: 40_000 }])).toBe(true);
  // A pair that isn't the one in use says nothing about the link.
  expect(linkIsWeak([{ type: 'candidate-pair', nominated: false, state: 'failed', availableOutgoingBitrate: 0 }])).toBe(false);
});

/** A peer connection whose video link quality the test controls. */
class FakePc {
  static last: FakePc;
  static stats: Record<string, unknown>[] = [];
  connectionState: RTCPeerConnectionState = 'new';
  remoteDescription: unknown = null;
  onconnectionstatechange: (() => void) | null = null;
  ontrack: unknown = null;
  onicecandidate: unknown = null;
  video = { replaceTrack: vi.fn(async (_track: unknown) => {}), getParameters: () => ({ encodings: [] }), setParameters: async () => {} };
  audio = { replaceTrack: vi.fn(async (_track: unknown) => {}) };
  private txs: unknown[] = [];
  constructor() {
    FakePc.last = this;
  }
  addTransceiver(kind: string) {
    this.txs.push({ receiver: { track: { kind } }, sender: kind === 'video' ? this.video : this.audio, direction: 'sendrecv' });
  }
  getTransceivers() {
    return this.txs;
  }
  async getStats() {
    return { forEach: (fn: (r: Record<string, unknown>) => void) => FakePc.stats.forEach(fn) };
  }
  async createOffer() {
    return { type: 'offer', sdp: 'o' };
  }
  async setLocalDescription() {}
  async setRemoteDescription(d: unknown) {
    this.remoteDescription = d;
  }
  async addIceCandidate() {}
  close() {}
}

const WEAK = [{ type: 'remote-inbound-rtp', fractionLost: 0.4 }];
const FINE = [{ type: 'remote-inbound-rtp', fractionLost: 0.01, roundTripTime: 0.05 }];

beforeEach(() => {
  vi.useFakeTimers();
  FakePc.stats = FINE;
  vi.stubGlobal('RTCPeerConnection', FakePc);
  vi.stubGlobal('MediaStream', class {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  const track = { kind: 'video', stop: vi.fn(), onended: null } as unknown as MediaStreamTrack;
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn(async () => ({ getVideoTracks: () => [track], getAudioTracks: () => [] })) },
    configurable: true,
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('on a weak link the camera pauses towards that peer and says so, then comes back when the link is healthy', async () => {
  const handlers = new Map<string, (arg?: unknown) => void>();
  const socket = { connected: true, on: vi.fn((e: string, fn: (arg?: unknown) => void) => void handlers.set(e, fn)), off: vi.fn(), emit: vi.fn() };
  const { result } = renderHook(() => useMediaChat({ socket: socket as never, code: 'ABCD', myId: 'p0', enabled: true, video: true }));
  await act(async () => {
    handlers.get(EVT.voice)!({ code: 'ABCD', from: 'p1', to: null, kind: 'hello' });
    await Promise.resolve();
  });
  const pc = FakePc.last;
  act(() => {
    pc.connectionState = 'connected';
    pc.onconnectionstatechange?.();
  });
  await act(async () => void (await result.current.toggleCam()));
  expect(result.current.camOff).toBe(false);
  const heldSignals = () =>
    socket.emit.mock.calls.map((c) => c[1] as VoiceSignal).filter((m) => m.kind === 'media' && m.to === 'p1' && (m.data as MediaState).videoHeld);

  // Two weak checks in a row: video stops going to p1, the mic is untouched.
  FakePc.stats = WEAK;
  pc.video.replaceTrack.mockClear();
  await act(async () => void (await vi.advanceTimersByTimeAsync(6_100)));
  expect(pc.video.replaceTrack).toHaveBeenLastCalledWith(null);
  expect(pc.audio.replaceTrack).not.toHaveBeenCalledWith(null);
  expect(result.current.heldPeers).toEqual(['p1']);
  expect(heldSignals().length).toBeGreaterThan(0);

  // Healthy again for long enough: the camera comes back.
  FakePc.stats = FINE;
  await act(async () => void (await vi.advanceTimersByTimeAsync(24_000)));
  expect(pc.video.replaceTrack.mock.lastCall![0]).not.toBeNull();
  expect(result.current.heldPeers).toEqual([]);
});
