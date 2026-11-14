// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { VideoTiles } from '../../src/online/ui/VideoTiles';
import { TurnClock } from '../../src/online/ui/TurnClock';
import { MonopolyLocalGame } from '../../src/games/monopoly/ui/MonopolyLocalGame';
import { App } from '../../src/app/App';
import type { MediaChat } from '../../src/online/useMediaChat';

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.pushState({}, '', '/');
});

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

const nameFor = (id: string) => (id === 'p0' ? 'Amey' : 'Riya');

test('the video table gives each seat a tile, with mic and camera controls on your own', () => {
  const m = media();
  render(
    <VideoTiles
      seats={[
        { id: 'p0', accent: '#D93A3F', active: true },
        { id: 'p1', accent: '#2651C9' },
      ]}
      meId="p0"
      nameFor={nameFor}
      media={m}
    />,
  );
  expect(screen.getByRole('group', { name: /amey/i }).className).toContain('is-turn');
  expect(screen.getByRole('group', { name: /riya/i })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /turn microphone on/i }));
  fireEvent.click(screen.getByRole('button', { name: /turn camera on/i }));
  expect(m.toggleMic).toHaveBeenCalled();
  expect(m.toggleCam).toHaveBeenCalled();
  // Only your own tile has controls.
  expect(screen.getAllByRole('button', { name: /turn microphone/i })).toHaveLength(1);
});

test('a camera that is off shows the seat badge instead of video', () => {
  render(
    <VideoTiles seats={[{ id: 'p1', badge: <span>R</span> }]} meId="p0" nameFor={nameFor} media={media()} />,
  );
  expect(screen.getByLabelText('camera off').textContent).toBe('R');
});

test('others can gift a player on a low clock 20 more seconds', () => {
  const onGift = vi.fn();
  render(<TurnClock deadline={Date.now() + 8_000} label="Riya" onGift={onGift} />);
  fireEvent.click(screen.getByRole('button', { name: 'Give Riya 20 more seconds' }));
  expect(onGift).toHaveBeenCalled();
});

test('a clock in its last five seconds warns once per turn', () => {
  const onUrgent = vi.fn();
  const deadline = Date.now() + 4_000;
  const { rerender } = render(<TurnClock deadline={deadline} label="Your turn" onUrgent={onUrgent} />);
  rerender(<TurnClock deadline={deadline} label="Your turn" onUrgent={onUrgent} />);
  expect(onUrgent).toHaveBeenCalledTimes(1);
  rerender(<TurnClock deadline={Date.now() + 30_000} label="Your turn" onUrgent={onUrgent} />);
  expect(onUrgent).toHaveBeenCalledTimes(1);
});

test('no gift while there is plenty of time, or without a way to give it', () => {
  const { rerender } = render(<TurnClock deadline={Date.now() + 30_000} label="Riya" onGift={() => {}} />);
  expect(screen.queryByRole('button', { name: /20 more seconds/i })).toBeNull();
  rerender(<TurnClock deadline={Date.now() + 8_000} label="Riya" />);
  expect(screen.queryByRole('button', { name: /20 more seconds/i })).toBeNull();
});

test('a local game starts with the chosen starting cash', () => {
  render(<MonopolyLocalGame playerCount={2} difficulty="normal" seed={5} settings={{ startingCash: 2000 }} onBackToHub={() => {}} />);
  expect(screen.getAllByText('$2,000')).toHaveLength(2);
});

test('the local setup offers starting cash and house rules, and uses them', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /play monopoly/i }));
  fireEvent.click(screen.getByText(/house rules/i));
  expect(screen.getByLabelText(/free parking jackpot/i)).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox', { name: /starting cash/i }), { target: { value: '2000' } });
  fireEvent.click(screen.getByRole('button', { name: /start local game/i }));
  expect(screen.getAllByText('$2,000').length).toBeGreaterThan(0);
});
