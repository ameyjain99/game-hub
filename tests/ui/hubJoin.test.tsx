// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { HubScreen } from '../../src/app/HubScreen';
import { codeFrom } from '../../src/app/roomCode';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Answer the room lookup with `body`, recording the URL asked for. */
function stubLookup(body: unknown) {
  const fetch = vi.fn(async () => ({ ok: true, json: async () => body }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const openJoin = () => fireEvent.click(screen.getAllByRole('button', { name: /join a room/i })[0]);
const dialog = () => screen.getByRole('dialog', { name: /join a room/i });
const codeField = () => within(dialog()).getByRole('textbox', { name: /room code/i }) as HTMLInputElement;
const paste = (text: string) => fireEvent.change(codeField(), { target: { value: text } });

test('no hub call to action picks a game for you: "Pick a game" leads to the library', () => {
  const onSelect = vi.fn();
  render(<HubScreen onSelect={onSelect} onJoin={vi.fn()} />);
  expect(screen.queryByRole('button', { name: /create a room/i })).toBeNull();
  const picks = screen.getAllByRole('link', { name: /pick a game/i });
  expect(picks.length).toBeGreaterThan(0);
  for (const a of picks) expect(a.getAttribute('href')).toBe('#library');
  expect(onSelect).not.toHaveBeenCalled();
});

test('"Join a room" opens a small dialog with the code field ready', () => {
  render(<HubScreen onSelect={vi.fn()} onJoin={vi.fn()} />);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByRole('textbox', { name: /room code/i })).toBeNull();
  openJoin();
  expect(document.activeElement).toBe(codeField());
});

test('a pasted code finds its game, and Join takes you to that game', async () => {
  const fetch = stubLookup({ exists: true, gameId: 'chess' });
  const onJoin = vi.fn();
  render(<HubScreen onSelect={vi.fn()} onJoin={onJoin} />);
  openJoin();
  paste('kq2z');
  expect(codeField().value).toBe('KQ2Z');
  const go = await within(dialog()).findByRole('button', { name: /join chess/i });
  expect(fetch).toHaveBeenCalledWith('/api/room-exists?code=KQ2Z');
  fireEvent.click(go);
  expect(onJoin).toHaveBeenCalledWith('chess', 'KQ2Z');
});

test('a pasted invite link works the same way', async () => {
  stubLookup({ exists: true, gameId: 'ludo' });
  render(<HubScreen onSelect={vi.fn()} onJoin={vi.fn()} />);
  openJoin();
  paste('https://gamehub.example/ludo/join?room=mv67');
  expect(codeField().value).toBe('MV67');
  expect(await within(dialog()).findByRole('button', { name: /join ludo/i })).toBeTruthy();
});

test("a code that isn't open says so, and Join stays off", async () => {
  stubLookup({ exists: false });
  const onJoin = vi.fn();
  render(<HubScreen onSelect={vi.fn()} onJoin={onJoin} />);
  openJoin();
  paste('ZZZZ');
  expect(await within(dialog()).findByText(/no open room with that code/i)).toBeTruthy();
  const join = within(dialog()).getByRole('button', { name: /^join$/i }) as HTMLButtonElement;
  expect(join.disabled).toBe(true);
  fireEvent.click(join);
  expect(onJoin).not.toHaveBeenCalled();
});

test('Escape or Cancel closes the dialog', () => {
  render(<HubScreen onSelect={vi.fn()} onJoin={vi.fn()} />);
  openJoin();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  openJoin();
  fireEvent.click(within(dialog()).getByRole('button', { name: /cancel/i }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('the code is read from a bare code or from either kind of room link', () => {
  expect(codeFrom(' mv67 ')).toBe('MV67');
  expect(codeFrom('MV67-and-more')).toBe('MV67');
  expect(codeFrom('https://gamehub.example/chess/join?room=mv67')).toBe('MV67');
  expect(codeFrom('https://gamehub.example/chess/MV67')).toBe('MV67');
  expect(codeFrom('gamehub.example/ludo/MV67/')).toBe('MV67');
  // A link without a room in it has no code (never "HTTP" or "PLAY").
  expect(codeFrom('https://gamehub.example/chess/play')).toBe('');
  expect(codeFrom('https://gamehub.example/chess')).toBe('');
});
