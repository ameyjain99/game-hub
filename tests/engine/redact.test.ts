import { expect, test } from 'vitest';
import { redactStateFor } from '../../src/games/ticket-to-ride/engine/redact';
import { createGame } from '../../src/games/ticket-to-ride/engine/setup';
import { makeState, ticket } from '../ai/helpers';
import type { GameState, Hand } from '../../src/games/ticket-to-ride/engine/types';

const sum = (h: Hand): number => Object.values(h).reduce((a, b) => a + b, 0);

const s: GameState = makeState({
  players: 2,
  hands: { p0: { blue: 3 }, p1: { red: 2, locomotive: 1 } },
  tickets: { p0: [ticket('A', 'B', 5)], p1: [ticket('C', 'D', 7), ticket('E', 'F', 3)] },
});

test('hides opponents hand colors but preserves the total', () => {
  const view = redactStateFor(s, 'p0');
  const opp = view.players.find((p) => p.id === 'p1')!;
  expect(sum(opp.hand)).toBe(3);
  expect(opp.hand.red).not.toBe(2); // color breakdown not leaked
});

test('viewer sees their own hand in full', () => {
  const view = redactStateFor(s, 'p0');
  expect(view.players.find((p) => p.id === 'p0')!.hand).toEqual(s.players[0].hand);
});

test('hides draw/ticket pile contents but keeps counts, zeroes rngState', () => {
  const view = redactStateFor(s, 'p0');
  expect(view.drawPile.length).toBe(s.drawPile.length);
  expect(view.ticketPile.length).toBe(s.ticketPile.length);
  expect(view.rngState).toBe(0);
});

test('hides opponent tickets contents but keeps count', () => {
  const view = redactStateFor(s, 'p0');
  const opp = view.players.find((p) => p.id === 'p1')!;
  expect(opp.tickets.length).toBe(s.players[1].tickets.length);
  expect(opp.tickets).not.toEqual(s.players[1].tickets);
});

test('hides opponent pending tickets but keeps count', () => {
  const setup = createGame(
    [
      { name: 'H', isAI: false },
      { name: 'B', isAI: true, difficulty: 'normal' },
    ],
    7,
  );
  const view = redactStateFor(setup, 'p0');
  const opp = view.players.find((p) => p.id === 'p1')!;
  expect(opp.pendingTickets.length).toBe(setup.players[1].pendingTickets.length);
  expect(opp.pendingTickets).not.toEqual(setup.players[1].pendingTickets);
  expect(view.players.find((p) => p.id === 'p0')!.pendingTickets).toEqual(
    setup.players[0].pendingTickets,
  );
});

test('reveals everything at game-over', () => {
  const over: GameState = { ...s, phase: 'game-over' };
  expect(redactStateFor(over, 'p0')).toBe(over);
});

test('the draw pile becomes same-length placeholders', () => {
  const view = redactStateFor(s, 'p0');
  expect(view.drawPile.length).toBe(s.drawPile.length);
  expect(view.drawPile.every((c) => c === 'locomotive')).toBe(true);
});

test('redacted state round-trips through JSON and stays GameState-shaped', () => {
  const view = redactStateFor(s, 'p0');
  const round = JSON.parse(JSON.stringify(view));
  expect(round.players.length).toBe(s.players.length);
  expect(Array.isArray(round.market)).toBe(true);
});
