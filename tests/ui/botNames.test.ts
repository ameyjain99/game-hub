import { expect, test } from 'vitest';
import { BOTS, botLine, isBotName, nameKey, pickBotNames } from '../../src/shared/botNames';

test('the cast is large, distinct, and short enough for a seat label', () => {
  expect(BOTS.length).toBeGreaterThanOrEqual(40);
  expect(new Set(BOTS.map((b) => nameKey(b.name))).size).toBe(BOTS.length);
  for (const b of BOTS) expect(b.name.length).toBeLessThanOrEqual(15);
});

test('picked names are distinct and avoid the names already at the table', () => {
  const taken = ['sir rollsalot', 'BARON BLUFF'];
  const picked = pickBotNames(9, taken, () => 0);
  expect(new Set(picked).size).toBe(9);
  expect(picked).not.toContain('Sir Rollsalot');
  expect(picked).not.toContain('Baron Bluff');
});

test('only a bot of the cast has something to say', () => {
  expect(isBotName('  dr.dicey ')).toBe(true);
  expect(botLine('Dr. Dicey', 'good', () => 0)).toBe('Woohoo!');
  expect(botLine('Amey', 'good')).toBeNull();
});
