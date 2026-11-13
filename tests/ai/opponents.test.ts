import { describe, it, expect } from 'vitest';
import { threatMap } from '../../src/games/ticket-to-ride/ai/opponents';
import { makeState } from './helpers';

describe('threatMap', () => {
  it('puts pressure on routes touching an opponent network, not on distant ones', () => {
    const s = makeState({ owned: { p1: ['denver-omaha'] } });
    const t = threatMap(s, 'p0');
    expect(t.get('omaha-chicago')).toBe(1);
    expect(t.has('boston-new-york')).toBe(false);
  });

  it('omits claimed routes and ignores the player’s own network', () => {
    const s = makeState({ owned: { p0: ['boston-new-york'], p1: ['denver-omaha'] } });
    const t = threatMap(s, 'p0');
    expect(t.has('denver-omaha')).toBe(false);
    expect(t.has('new-york-washington')).toBe(false);
  });

  it('halves pressure on a double route when 4+ players leave a spare rail', () => {
    const two = makeState({ players: 2, owned: { p1: ['duluth-chicago'] } });
    const four = makeState({ players: 4, owned: { p1: ['duluth-chicago'] } });
    expect(threatMap(two, 'p0').get('saint-louis-chicago')).toBe(1);
    expect(threatMap(four, 'p0').get('saint-louis-chicago')).toBe(0.5);
  });
});
