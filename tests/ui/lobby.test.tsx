// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LobbyScreen } from '../../src/games/ticket-to-ride/ui/LobbyScreen';
import { AVATARS } from '../../src/games/ticket-to-ride/ui/avatars';
import type { LobbyView, SeatView } from '../../src/net/protocol';

afterEach(cleanup);

const lobby = (seats: Partial<SeatView>[]): LobbyView => ({
  code: 'AB23',
  seatCount: seats.length,
  hostIndex: 0,
  started: false,
  turnDeadline: null,
  seats: seats.map((s, i) => ({ index: i, name: null, avatar: '', isAI: false, connected: true, ...s })),
});

const full = lobby([{ name: 'Host' }, { name: 'Guest' }]);
const withEmpty = lobby([{ name: 'Host' }, { name: null }]);

test('host sees an enabled Start when all seats are filled', () => {
  render(<LobbyScreen lobby={full} isHost onSetSeatAi={vi.fn()} onStart={vi.fn()} />);
  expect((screen.getByRole('button', { name: /start/i }) as HTMLButtonElement).disabled).toBe(false);
});

test('host Start is disabled while a seat is empty', () => {
  render(<LobbyScreen lobby={withEmpty} isHost onSetSeatAi={vi.fn()} onStart={vi.fn()} />);
  expect((screen.getByRole('button', { name: /start/i }) as HTMLButtonElement).disabled).toBe(true);
});

test('non-host does not see Start', () => {
  render(<LobbyScreen lobby={full} isHost={false} onSetSeatAi={vi.fn()} onStart={vi.fn()} />);
  expect(screen.queryByRole('button', { name: /start/i })).toBeNull();
});

test('Add AI on an empty seat calls onSetSeatAi', () => {
  const onSetSeatAi = vi.fn();
  render(<LobbyScreen lobby={withEmpty} isHost onSetSeatAi={onSetSeatAi} onStart={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /add ai/i }));
  expect(onSetSeatAi).toHaveBeenCalledWith(1, true, 'normal');
});

test('shows the room code to share', () => {
  render(<LobbyScreen lobby={full} isHost onSetSeatAi={vi.fn()} onStart={vi.fn()} />);
  expect(screen.getByText('AB23')).toBeTruthy();
});

test('copy button writes the code to the clipboard and flips to a copied state', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  render(<LobbyScreen lobby={full} isHost onSetSeatAi={vi.fn()} onStart={vi.fn()} />);

  const copy = screen.getByRole('button', { name: /copy room code/i });
  fireEvent.click(copy);
  expect(writeText).toHaveBeenCalledWith('AB23');
  // The button announces the copied state (icon swaps to the green tick).
  expect(await screen.findByRole('button', { name: /copied/i })).toBeTruthy();

  vi.unstubAllGlobals();
});

test('avatar picker greys out avatars taken by others and picks a free one', () => {
  const onSetAvatar = vi.fn();
  const l = lobby([
    { name: 'Host', avatar: AVATARS[0] },
    { name: 'Me', avatar: AVATARS[1] },
  ]);
  render(
    <LobbyScreen
      lobby={l}
      isHost={false}
      mySeatIndex={1}
      onSetSeatAi={vi.fn()}
      onSetAvatar={onSetAvatar}
      onStart={vi.fn()}
    />,
  );
  // another seat holds AVATARS[0] → disabled; my own AVATARS[1] stays enabled.
  expect((screen.getByRole('button', { name: `avatar ${AVATARS[0]}` }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: `avatar ${AVATARS[1]}` }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: `avatar ${AVATARS[2]}` }));
  expect(onSetAvatar).toHaveBeenCalledWith(AVATARS[2]);
});
