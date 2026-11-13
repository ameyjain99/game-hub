// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GameScreen } from '../../src/games/ticket-to-ride/ui/GameScreen';
import { makeState } from '../ai/helpers';
import type { GameState } from '../../src/games/ticket-to-ride/engine/types';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

// p0 owns a triangle Montreal–Boston(2), Boston–NY(2), Montreal–NY(3): the longest
// path through any of its edges is all three = 7 trains.
const TRIANGLE = ['montreal-boston', 'boston-new-york', 'montreal-new-york'];

function stateWithTriangle(): GameState {
  const base = makeState({ players: 2, owned: { p0: TRIANGLE } });
  return { ...base, players: base.players.map((p) => ({ ...p, isAI: false })) };
}

const routeEl = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-route-id="${id}"]`) as SVGGElement;

test('hovering a claimed route for ≥200ms highlights its longest path and shows the length', () => {
  const { container } = render(
    <GameScreen state={stateWithTriangle()} lastError={null} dispatch={vi.fn()} viewerId="p0" />,
  );

  // Nothing before the dwell completes.
  fireEvent.mouseEnter(routeEl(container, 'boston-new-york'));
  act(() => vi.advanceTimersByTime(150));
  expect(screen.queryByText('7 trains')).toBeNull();

  // After 200ms: the chain's length tooltip appears and every chain route is marked.
  act(() => vi.advanceTimersByTime(100));
  expect(screen.getByText('7 trains')).toBeTruthy();
  for (const id of TRIANGLE) {
    expect(routeEl(container, id).classList.contains('chain')).toBe(true);
  }

  // Leaving clears the highlight.
  fireEvent.mouseLeave(routeEl(container, 'boston-new-york'));
  expect(screen.queryByText('7 trains')).toBeNull();
});

test('hovering an unclaimed route shows no chain', () => {
  const { container } = render(
    <GameScreen state={stateWithTriangle()} lastError={null} dispatch={vi.fn()} viewerId="p0" />,
  );
  // pittsburgh-washington is not owned by anyone here.
  fireEvent.mouseEnter(routeEl(container, 'pittsburgh-washington'));
  act(() => vi.advanceTimersByTime(300));
  expect(container.querySelector('.route-tooltip')).toBeNull();
  expect(routeEl(container, 'pittsburgh-washington').classList.contains('chain')).toBe(false);
});
