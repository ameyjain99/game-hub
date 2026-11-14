// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { VideoTiles } from '../../src/online/ui/VideoTiles';
import { PlayerPanel } from '../../src/games/ticket-to-ride/ui/components/PlayerPanel';
import { emptyHand } from '../../src/games/ticket-to-ride/engine/deck';
import type { PlayerState } from '../../src/games/ticket-to-ride/engine/types';
import type { MediaChat } from '../../src/online/useMediaChat';

afterEach(cleanup);

const stream = {} as MediaStream; // jsdom has no MediaStream; the tile only binds it

function media(over: Partial<MediaChat> = {}): MediaChat {
  return {
    ready: true,
    error: null,
    connectedPeers: [],
    micMuted: true,
    camOff: true,
    toggleMic: vi.fn(async () => {}),
    toggleCam: vi.fn(async () => {}),
    localStream: null,
    remoteStreams: new Map(),
    peerMedia: new Map(),
    ...over,
  };
}

function ttrPlayer(id: string, over: Partial<PlayerState> = {}): PlayerState {
  return {
    id,
    name: id === 'p0' ? 'Amey' : 'Riya',
    avatar: '🦊',
    isAI: false,
    hand: emptyHand(),
    trainsLeft: 45,
    claimedRouteIds: [],
    tickets: [],
    pendingTickets: [],
    stationsLeft: 0,
    stations: [],
    score: 0,
    ...over,
  };
}

const panel = (id: string, m?: MediaChat) => (
  <PlayerPanel player={ttrPlayer(id)} color="#d33" isCurrent={false} cardCount={4} media={m} viewerId="p0" />
);

test('Ticket to Ride: your own panel carries the mic and camera controls', () => {
  const m = media();
  render(panel('p0', m));
  fireEvent.click(screen.getByRole('button', { name: /turn microphone on/i }));
  fireEvent.click(screen.getByRole('button', { name: /turn camera on/i }));
  expect(m.toggleMic).toHaveBeenCalled();
  expect(m.toggleCam).toHaveBeenCalled();
});

test('Ticket to Ride: a local seat (no media) shows its avatar and no controls', () => {
  render(panel('p1'));
  expect(screen.getByLabelText('camera off').textContent).toContain('🦊');
  expect(screen.queryByRole('button', { name: /turn microphone/i })).toBeNull();
});

test('a peer whose camera is not announced on shows the fallback, not a blank video', () => {
  const m = media({ remoteStreams: new Map([['p1', stream]]) });
  const { container } = render(<VideoTiles seats={[{ id: 'p1' }]} meId="p0" nameFor={(id) => id} media={m} />);
  expect(screen.getByLabelText('camera off')).toBeTruthy();
  expect(container.querySelector('video')).toBeNull();
  cleanup();
  render(panel('p1', m));
  expect(screen.getByLabelText('camera off')).toBeTruthy();
});

test('only your own camera is mirrored', () => {
  const m = media({
    camOff: false,
    localStream: stream,
    remoteStreams: new Map([['p1', stream]]),
    peerMedia: new Map([['p1', { micOn: true, camOn: true }]]),
  });
  const { container } = render(
    <VideoTiles seats={[{ id: 'p0' }, { id: 'p1' }]} meId="p0" nameFor={(id) => id} media={m} />,
  );
  const videos = container.querySelectorAll('video');
  expect(videos).toHaveLength(2);
  expect(videos[0].className).toContain('is-self');
  expect(videos[1].className).not.toContain('is-self');
});
