import { describe, it, expect } from 'vitest';
import { CITIES } from '../../src/games/ticket-to-ride/engine/data/usa/cities';
import { ROUTES } from '../../src/games/ticket-to-ride/engine/data/usa/routes';
import { TICKETS } from '../../src/games/ticket-to-ride/engine/data/usa/tickets';
import { DECK_COMPOSITION } from '../../src/games/ticket-to-ride/engine/data/deck';
import { CARD_COLORS } from '../../src/games/ticket-to-ride/engine/types';

const cityIds = new Set(CITIES.map((c) => c.id));

describe('cities', () => {
  it('has 36 unique cities', () => {
    expect(CITIES.length).toBe(36);
    expect(cityIds.size).toBe(36);
  });
});

describe('routes', () => {
  it('every route connects two known, distinct cities', () => {
    for (const r of ROUTES) {
      expect(cityIds.has(r.a)).toBe(true);
      expect(cityIds.has(r.b)).toBe(true);
      expect(r.a).not.toBe(r.b);
    }
  });

  it('has valid lengths and unique ids', () => {
    const ids = new Set<string>();
    for (const r of ROUTES) {
      expect(r.length).toBeGreaterThanOrEqual(1);
      expect(r.length).toBeLessThanOrEqual(6);
      expect(ids.has(r.id)).toBe(false);
      ids.add(r.id);
    }
  });

  it('parallel routes come in groups of exactly two between the same pair', () => {
    const groups = new Map<string, typeof ROUTES>();
    for (const r of ROUTES)
      if (r.parallelGroup) {
        const g = groups.get(r.parallelGroup) ?? [];
        g.push(r);
        groups.set(r.parallelGroup, g);
      }
    for (const g of groups.values()) {
      expect(g.length).toBe(2);
      const pair = new Set([g[0].a, g[0].b]);
      expect(new Set([g[1].a, g[1].b])).toEqual(pair);
    }
  });
});

describe('tickets', () => {
  it('has 30 tickets referencing known cities with positive points', () => {
    expect(TICKETS.length).toBe(30);
    for (const t of TICKETS) {
      expect(cityIds.has(t.a)).toBe(true);
      expect(cityIds.has(t.b)).toBe(true);
      expect(t.points).toBeGreaterThan(0);
    }
  });
});

describe('deck', () => {
  it('totals 110 cards: 12 per color, 14 locomotives', () => {
    const total = Object.values(DECK_COMPOSITION).reduce((a, b) => a + b, 0);
    expect(total).toBe(110);
    expect(DECK_COMPOSITION.locomotive).toBe(14);
    for (const c of CARD_COLORS) {
      expect(DECK_COMPOSITION[c]).toBe(12);
    }
  });
});
