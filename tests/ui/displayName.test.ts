import { expect, test } from 'vitest';
import { cleanName } from '../../src/games/ticket-to-ride/ui/displayName';

test('trims surrounding whitespace and keeps the rest of a name as typed', () => {
  expect(cleanName('  Amey  ')).toBe('Amey');
  expect(cleanName('Ana-María O’Neil')).toBe('Ana-María O’Neil');
});
