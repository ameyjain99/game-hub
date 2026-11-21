// The short names shown at the seats on a narrow screen.
import { expect, test } from 'vitest';
import { shortNames } from '../../../src/games/poker/shortNames';

test('a name of several words becomes its initials', () => {
  expect(shortNames(['Triple-Word Ted', 'Old Man Gambit', 'Checkmate Kate'])).toEqual(['TWT', 'OMG', 'CK']);
});

test('a single word stays as it is', () => {
  expect(shortNames(['You', 'Amey'])).toEqual(['You', 'Amey']);
});

test('players whose initials match keep their first word, so they can be told apart', () => {
  expect(shortNames(['Doc Doubles', 'Dr. Dicey', 'Ace McFace'])).toEqual(['Doc D', 'Dr. D', 'AM']);
});

test('a number at the end is kept', () => {
  expect(shortNames(['Sam (2)', 'Sam'])).toEqual(['S2', 'Sam']);
});
