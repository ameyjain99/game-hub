// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MonopolyGame } from '../../src/games/monopoly/ui/MonopolyGame';
import { VideoTiles } from '../../src/online/ui/VideoTiles';
import { createMonopolyGame, type MonopolyState } from '../../src/games/monopoly/engine/state';
import { BOARD, groupIds } from '../../src/games/monopoly/engine/board';
import { tokenColor } from '../../src/games/monopoly/ui/board-layout';
import type { MediaChat } from '../../src/online/useMediaChat';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const nameFor = (id: string) => (id === 'p0' ? 'You' : `Bot ${id.slice(1)}`);
const BROWN = groupIds('brown');
const SEVILLE = 8;

/** You own Seville; Bot 1 owns the given lots. */
function board(botLots: number[]): MonopolyState {
  const g = createMonopolyGame(
    [
      { avatar: '', isAI: false },
      { avatar: '', isAI: true },
    ],
    5,
    { randomizeOrder: false },
  );
  g.ownership[SEVILLE].owner = 'p0';
  for (const id of botLots) g.ownership[id].owner = 'p1';
  return g;
}

const ui = (view: MonopolyState) => (
  <MonopolyGame view={view} meId="p0" nameFor={nameFor} onAction={vi.fn()} onExit={() => {}} exitLabel="Back" />
);
const cell = (id: number) => screen.getByRole('button', { name: new RegExp(`^${BOARD[id].name},`) });
const boardEl = () => screen.getByRole('group', { name: 'Monopoly board' });

test('an owned square is tinted in its owner’s colour', () => {
  render(ui(board([])));
  const seville = cell(SEVILLE);
  expect(seville.className).toContain('is-owned');
  expect(seville.style.getPropertyValue('--oc')).toBe(tokenColor(0));
});

test('hovering a player lights up everything they own and dims the rest', () => {
  render(ui(board(BROWN)));
  const row = screen.getByText('Bot 1').closest('li')!;
  fireEvent.mouseEnter(row);
  expect(boardEl().className).toContain('is-spotlit');
  for (const id of BROWN) expect(cell(id).className).toContain('is-lit');
  expect(cell(SEVILLE).className).not.toContain('is-lit');
  fireEvent.mouseLeave(row);
  expect(boardEl().className).not.toContain('is-spotlit');
});

test('hovering an owned square lights up all of its owner’s squares', () => {
  render(ui(board(BROWN)));
  fireEvent.mouseEnter(cell(BROWN[0]));
  for (const id of BROWN) expect(cell(id).className).toContain('is-lit');
  expect(cell(SEVILLE).className).not.toContain('is-lit');
  fireEvent.mouseLeave(cell(BROWN[0]));
  expect(boardEl().className).not.toContain('is-spotlit');
});

test('a hovered video tile names its seat, so the table can light up that player', () => {
  const onSeatHover = vi.fn();
  const media = {
    micMuted: true,
    camOff: true,
    localStream: null,
    remoteStreams: new Map(),
    peerMedia: new Map(),
    toggleMic: vi.fn(),
    toggleCam: vi.fn(),
  } as unknown as MediaChat;
  render(<VideoTiles seats={[{ id: 'p1' }]} meId="p0" nameFor={nameFor} media={media} onSeatHover={onSeatHover} />);
  fireEvent.mouseEnter(screen.getByRole('group', { name: 'Bot 1' }));
  expect(onSeatHover).toHaveBeenCalledWith('p1');
});

test('a square’s card opens on click, closes on a second click, switches to another, and closes on Escape', () => {
  render(ui(board([])));
  const deed = (id: number) => screen.queryByRole('article', { name: `Title deed: ${BOARD[id].name}` });

  fireEvent.click(cell(SEVILLE));
  expect(deed(SEVILLE)?.textContent).toContain('With a hotel');
  fireEvent.click(cell(SEVILLE));
  expect(deed(SEVILLE)).toBeNull();

  fireEvent.click(cell(SEVILLE));
  fireEvent.click(cell(BROWN[0]));
  expect(deed(SEVILLE)).toBeNull();
  expect(deed(BROWN[0])).toBeTruthy();

  fireEvent.keyDown(window, { key: 'Escape' });
  expect(deed(BROWN[0])).toBeNull();
});

test('an owned square’s card says who owns it and the rent it charges now', () => {
  render(ui(board([])));
  fireEvent.click(cell(SEVILLE));
  const card = screen.getByRole('article', { name: `Title deed: ${BOARD[SEVILLE].name}` }).parentElement!;
  expect(card.textContent).toContain('Owned by You');
  expect(card.textContent).toContain(`Rent now $${BOARD[SEVILLE].rent![0]}`);
});

test('completing a colour set is announced with what it unlocks, then fades', () => {
  const { rerender } = render(ui(board([BROWN[0]])));
  rerender(ui(board(BROWN)));
  const note = screen.getByRole('status', { name: /set complete/i });
  expect(note.textContent).toContain('Bot 1');
  expect(note.textContent).toMatch(/brown/i);
  expect(note.textContent).toMatch(/houses/i);
  for (const id of BROWN) expect(cell(id).className).toContain('is-set-flash');
  act(() => vi.advanceTimersByTime(7000));
  expect(screen.queryByRole('status', { name: /set complete/i })).toBeNull();
  for (const id of BROWN) expect(cell(id).className).not.toContain('is-set-flash');
});

test('sets already complete when the screen opens are not announced', () => {
  render(ui(board(BROWN)));
  expect(screen.queryByRole('status', { name: /set complete/i })).toBeNull();
});
