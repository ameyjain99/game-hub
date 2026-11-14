import { describe, expect, test } from 'vitest';
import { movePath, tokenAnchor } from '../../src/games/monopoly/ui/board-layout';
import { logParts } from '../../src/games/monopoly/ui/logText';

describe('token anchors', () => {
  test('every square has a point inside the board', () => {
    for (let i = 0; i < 40; i++) {
      const { x, y } = tokenAnchor(i);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(1);
    }
  });

  test('corners sit in their corners: Go bottom-right, Jail bottom-left, Free Parking top-left, Go to Jail top-right', () => {
    const go = tokenAnchor(0);
    const jail = tokenAnchor(10);
    const parking = tokenAnchor(20);
    const goToJail = tokenAnchor(30);
    expect(go.x).toBeGreaterThan(0.85);
    expect(go.y).toBeGreaterThan(0.85);
    expect(jail.x).toBeLessThan(0.15);
    expect(jail.y).toBeGreaterThan(0.85);
    expect(parking.x).toBeLessThan(0.15);
    expect(parking.y).toBeLessThan(0.15);
    expect(goToJail.x).toBeGreaterThan(0.85);
    expect(goToJail.y).toBeLessThan(0.15);
  });

  test('the bottom row runs right to left from Go, on the outer edge', () => {
    for (let i = 1; i < 10; i++) {
      expect(tokenAnchor(i).x).toBeLessThan(tokenAnchor(i - 1).x);
      expect(tokenAnchor(i).y).toBeGreaterThan(0.9);
    }
  });

  test('tokens fan out along the edge they sit on', () => {
    expect(tokenAnchor(5).axis).toBe('x'); // bottom row
    expect(tokenAnchor(15).axis).toBe('y'); // left column
    expect(tokenAnchor(25).axis).toBe('x'); // top row
    expect(tokenAnchor(35).axis).toBe('y'); // right column
  });
});

describe('move path', () => {
  test('a roll hops through every square, wrapping past Go', () => {
    expect(movePath(35, 3)).toEqual([36, 37, 38, 39, 0, 1, 2, 3]);
  });

  test('no move, no path', () => {
    expect(movePath(5, 5)).toEqual([]);
  });

  test('anything longer than a roll glides straight there (Go to Jail, card jumps)', () => {
    expect(movePath(30, 10)).toEqual([10]);
  });

  test('moving backwards glides straight there (Go back 3 spaces)', () => {
    expect(movePath(7, 4)).toEqual([4]);
  });

  test('a forced direct move glides even when it is short (three doubles to jail)', () => {
    expect(movePath(2, 10, true)).toEqual([10]);
  });
});

describe('log parts', () => {
  test('splits player tokens from the text around them', () => {
    expect(logParts('{p0} paid {p1} $50 rent')).toEqual([
      { player: 'p0' },
      { text: ' paid ' },
      { player: 'p1' },
      { text: ' $50 rent' },
    ]);
  });

  test('a line with no players is one text part', () => {
    expect(logParts('Game over')).toEqual([{ text: 'Game over' }]);
  });
});
