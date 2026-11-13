import { expect, test } from 'vitest';
import { describeReveal } from '../../../src/games/cluedo/ui/revealText';
import type { RedactedReveal } from '../../../src/games/cluedo/engine/redact';

const names: Record<string, string> = { a: 'Amey', b: 'Bot 1', c: 'Bot 2' };
const nameFor = (id: string) => names[id];
const base: RedactedReveal = {
  suggester: 'a',
  suggestion: { suspect: 'Mr Green', weapon: 'Rope', room: 'Hall' },
  disprover: 'b',
  card: 'Rope',
};

test('the suggester is told which card they were shown', () => {
  expect(describeReveal(base, 'a', nameFor).outcome).toBe('Bot 1 showed you Rope.');
});

test('the disprover reads that they showed the card (not that they were shown it)', () => {
  expect(describeReveal({ ...base, suggester: 'c', disprover: 'a' }, 'a', nameFor).outcome).toBe('You showed Bot 2 Rope.');
});

test('everyone else only learns that a card changed hands', () => {
  expect(describeReveal({ ...base, card: null }, 'c', nameFor).outcome).toBe('Bot 1 showed Amey a card.');
});

test('an undisproved suggestion says so', () => {
  const r = describeReveal({ ...base, disprover: null, card: null }, 'b', nameFor);
  expect(r.suggestion).toBe('Amey suggested Mr Green with the Rope in the Hall.');
  expect(r.outcome).toBe('Nobody could disprove it.');
});
