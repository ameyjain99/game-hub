// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMediaChat } from '../../../src/online/useMediaChat';

/** A fake MediaStreamTrack good enough for the hook's bookkeeping. */
function fakeTrack(kind: 'audio' | 'video') {
  return { kind, enabled: true, readyState: 'live', stop: vi.fn() } as unknown as MediaStreamTrack;
}

function fakeStream(track: MediaStreamTrack) {
  return {
    getTracks: () => [track],
    getAudioTracks: () => (track.kind === 'audio' ? [track] : []),
    getVideoTracks: () => (track.kind === 'video' ? [track] : []),
  } as unknown as MediaStream;
}

function mockSocket() {
  return { on: vi.fn(), off: vi.fn(), emit: vi.fn() };
}

let getUserMedia: ReturnType<typeof vi.fn>;

beforeEach(() => {
  getUserMedia = vi.fn((c: MediaStreamConstraints) =>
    Promise.resolve(fakeStream(fakeTrack(c.video ? 'video' : 'audio'))),
  );
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  // refreshLocal() builds `new MediaStream(tracks)` – jsdom has no such constructor.
  vi.stubGlobal(
    'MediaStream',
    class {
      _t: MediaStreamTrack[];
      constructor(t: MediaStreamTrack[] = []) {
        this._t = t;
      }
      getTracks() {
        return this._t;
      }
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('joining a room acquires no media; mic/cam are acquired only when toggled on', async () => {
  const socket = mockSocket();
  const { result } = renderHook(() =>
    useMediaChat({ socket: socket as never, code: 'ABCD', myId: 'p0', enabled: true, video: true }),
  );

  // Nothing is captured on join – no permission prompt, mic and camera both off.
  expect(getUserMedia).not.toHaveBeenCalled();
  expect(result.current.micMuted).toBe(true);
  expect(result.current.camOff).toBe(true);

  // Turning the mic on requests exactly the microphone.
  await act(async () => {
    await result.current.toggleMic();
  });
  expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
  expect(getUserMedia).not.toHaveBeenCalledWith({ video: true });
  expect(result.current.micMuted).toBe(false);

  // Turning the camera on requests exactly the camera.
  await act(async () => {
    await result.current.toggleCam();
  });
  expect(getUserMedia).toHaveBeenCalledWith({ video: true });
  expect(result.current.camOff).toBe(false);
});
