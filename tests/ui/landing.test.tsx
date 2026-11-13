// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TicketToRideLanding } from '../../src/games/ticket-to-ride/ui/TicketToRideLanding';

afterEach(cleanup);

test('Start opens the create page (board/mode/players are picked there)', () => {
  const onStart = vi.fn();
  render(<TicketToRideLanding onStart={onStart} onJoin={vi.fn()} onLocal={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /start game/i }));
  expect(onStart).toHaveBeenCalledWith();
});

test('board, mode and player selection are not on the landing screen', () => {
  render(<TicketToRideLanding onStart={vi.fn()} onJoin={vi.fn()} onLocal={vi.fn()} />);
  expect(screen.queryByLabelText('Board')).toBeNull();
  expect(screen.queryByLabelText('Mode')).toBeNull();
  expect(screen.queryByLabelText('Number of players')).toBeNull();
});

test('Join is disabled until a 4-letter code is entered, then calls onJoin', () => {
  const onJoin = vi.fn();
  render(<TicketToRideLanding onStart={vi.fn()} onJoin={onJoin} onLocal={vi.fn()} />);
  const joinBtn = () => screen.getByRole('button', { name: /join game/i }) as HTMLButtonElement;
  expect(joinBtn().disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Room code'), { target: { value: 'ab23' } });
  expect(joinBtn().disabled).toBe(false);
  fireEvent.click(joinBtn());
  expect(onJoin).toHaveBeenCalledWith('AB23');
});

test('Play on this device calls onLocal', () => {
  const onLocal = vi.fn();
  render(<TicketToRideLanding onStart={vi.fn()} onJoin={vi.fn()} onLocal={onLocal} />);
  fireEvent.click(screen.getByRole('button', { name: /play on this device/i }));
  expect(onLocal).toHaveBeenCalled();
});
