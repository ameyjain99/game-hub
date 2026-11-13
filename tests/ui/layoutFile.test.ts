import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { formatLayout, isBoardLayout, layoutPath } from '../../src/games/ticket-to-ride/engine/data/layout';
import { EDITABLE_MAPS } from '../../src/games/ticket-to-ride/ui/editor/maps';

describe('layout files', () => {
  it('formatLayout round-trips through JSON', () => {
    const layout = { cities: { a: [1, 2] as [number, number] }, bends: {} };
    const parsed = JSON.parse(formatLayout(layout));
    expect(parsed).toEqual(layout);
    expect(isBoardLayout(parsed)).toBe(true);
  });

  it('isBoardLayout rejects malformed layouts', () => {
    expect(isBoardLayout(null)).toBe(false);
    expect(isBoardLayout({ cities: {} })).toBe(false);
    expect(isBoardLayout({ cities: { a: [1] }, bends: {} })).toBe(false);
    expect(isBoardLayout({ cities: { a: [1, 'x'] }, bends: {} })).toBe(false);
    expect(isBoardLayout({ cities: [], bends: {} })).toBe(false);
  });

  it('layoutPath only accepts plain map ids', () => {
    expect(layoutPath('usa')).toBe('src/games/ticket-to-ride/engine/data/usa/layout.json');
    expect(layoutPath('../secrets')).toBeNull();
    expect(layoutPath('usa/../../x')).toBeNull();
    expect(layoutPath(42)).toBeNull();
  });

  for (const [id, map] of Object.entries(EDITABLE_MAPS)) {
    it(`${id}: layout file exists in canonical Save format`, () => {
      const text = readFileSync(layoutPath(id)!, 'utf8');
      expect(formatLayout(JSON.parse(text))).toBe(text);
    });

    it(`${id}: layout positions exactly the map's cities`, () => {
      expect(Object.keys(map.layout.cities).sort()).toEqual(map.cities.map((c) => c.id).sort());
    });
  }
});
