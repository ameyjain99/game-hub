import { describe, it, expect } from 'vitest';
import { createGame } from '../../src/games/ticket-to-ride/engine/setup';

describe('createGame', () => {
  it('rejects <2 or >5 players', () => {
    expect(() => createGame([{ name: 'a', isAI: false }], 1)).toThrow();
    expect(() => createGame(Array(6).fill({ name: 'x', isAI: true }), 1)).toThrow();
  });

  it('deals 4 cards and 45 trains to each of N players', () => {
    const g = createGame(
      [
        { name: 'A', isAI: false },
        { name: 'B', isAI: true, difficulty: 'normal' },
      ],
      7,
    );
    expect(g.players.length).toBe(2);
    for (const p of g.players) {
      const cards = Object.values(p.hand).reduce((a, b) => a + b, 0);
      expect(cards).toBe(4);
      expect(p.trainsLeft).toBe(45);
      expect(p.pendingTickets.length).toBe(3);
      expect(p.tickets.length).toBe(0);
    }
  });

  it('fills the market to 5, starts in setup-tickets, is seed-deterministic', () => {
    const configs = [
      { name: 'A', isAI: false },
      { name: 'B', isAI: true },
    ];
    const a = createGame(configs, 7);
    const b = createGame(configs, 7);
    expect(a.market.length).toBe(5);
    expect(a.phase).toBe('setup-tickets');
    expect(a).toEqual(b);
  });

  it('conserves cards: hands + draw + market + discard = 110', () => {
    const g = createGame(
      [
        { name: 'A', isAI: false },
        { name: 'B', isAI: true },
        { name: 'C', isAI: true },
      ],
      3,
    );
    const inHands = g.players.reduce(
      (sum, p) => sum + Object.values(p.hand).reduce((a, b) => a + b, 0),
      0,
    );
    const total = inHands + g.drawPile.length + g.market.length + g.discardPile.length;
    expect(total).toBe(110);
  });
});
