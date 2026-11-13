import { describe, it, expect } from 'vitest';
import { areConnected, longestPath, longestPathRoutes, longestPathThrough } from '../../src/games/ticket-to-ride/engine/graph';
import { ROUTES } from '../../src/games/ticket-to-ride/engine/data/usa/routes';

const ROUTE = new Map(ROUTES.map((r) => [r.id, r]));
const totalLength = (ids: string[]) => ids.reduce((sum, id) => sum + ROUTE.get(id)!.length, 0);

// Real route ids from data/usa/routes.ts:
//   'boston-new-york'          Boston–New York, len 2
//   'montreal-boston'          Montreal–Boston, len 2
//   'montreal-new-york'        Montreal–New York, len 3
//   'new-york-washington'      New York–Washington, len 2
//   'pittsburgh-washington'    Pittsburgh–Washington, len 2

describe('areConnected', () => {
  it('true when a chain of claimed routes links the two cities', () => {
    // Boston-NY + NY-Washington connects Boston to Washington
    expect(areConnected(['boston-new-york', 'new-york-washington'], 'boston', 'washington')).toBe(
      true,
    );
  });

  it('true for the same city trivially', () => {
    expect(areConnected([], 'boston', 'boston')).toBe(true);
  });

  it('false when no claimed path links them', () => {
    expect(areConnected(['boston-new-york'], 'boston', 'washington')).toBe(false);
  });
});

describe('longestPath', () => {
  it('returns 0 for no routes', () => {
    expect(longestPath([])).toBe(0);
  });

  it('sums segment lengths along the longest chain', () => {
    // Boston-NY (2) + NY-Washington (2) chained = 4
    expect(longestPath(['boston-new-york', 'new-york-washington'])).toBe(4);
  });

  it('does not reuse an edge, and finds the best path through a cycle', () => {
    // Triangle Montreal-Boston(2), Boston-NY(2), Montreal-NY(3).
    // Longest simple trail uses all three edges: 2+2+3 = 7.
    expect(longestPath(['montreal-boston', 'boston-new-york', 'montreal-new-york'])).toBe(7);
  });
});

describe('longestPathRoutes', () => {
  it('returns no routes when none are claimed', () => {
    expect(longestPathRoutes([])).toEqual([]);
  });

  it('returns the routes of a longest trail, summing to longestPath', () => {
    // Triangle (7) beats the disconnected Pittsburgh-Washington (2).
    const owned = ['montreal-boston', 'boston-new-york', 'montreal-new-york', 'pittsburgh-washington'];
    const path = longestPathRoutes(owned);
    expect(new Set(path)).toEqual(new Set(['montreal-boston', 'boston-new-york', 'montreal-new-york']));
    expect(totalLength(path)).toBe(longestPath(owned));
  });

  it('returns one continuous trail with no route used twice', () => {
    const owned = ['montreal-boston', 'boston-new-york', 'new-york-washington', 'pittsburgh-washington'];
    const path = longestPathRoutes(owned);
    expect(new Set(path).size).toBe(path.length);
    for (let i = 1; i < path.length; i++) {
      const prev = ROUTE.get(path[i - 1])!;
      const cur = ROUTE.get(path[i])!;
      expect([prev.a, prev.b].some((c) => c === cur.a || c === cur.b)).toBe(true);
    }
    expect(totalLength(path)).toBe(8);
  });
});

describe('longestPathThrough', () => {
  it('returns [] when the edge is not among the claimed routes', () => {
    expect(longestPathThrough(['montreal-boston'], 'boston-new-york')).toEqual([]);
  });

  it('returns a trail that passes through the given edge', () => {
    // Line montreal-boston(2)-new-york(2)-washington(2): through the middle edge
    // the longest trail is the whole line (6), which includes it.
    const owned = ['montreal-boston', 'boston-new-york', 'new-york-washington'];
    const path = longestPathThrough(owned, 'boston-new-york');
    expect(path).toContain('boston-new-york');
    expect(totalLength(path)).toBe(6);
  });

  it('stays within the edge\'s own component, not the globally longest trail', () => {
    // Big triangle (7) is disconnected from the short Pittsburgh-Washington (2).
    // Hovering the short edge must report its component, not the triangle.
    const owned = ['montreal-boston', 'boston-new-york', 'montreal-new-york', 'pittsburgh-washington'];
    const path = longestPathThrough(owned, 'pittsburgh-washington');
    expect(new Set(path)).toEqual(new Set(['pittsburgh-washington']));
    expect(totalLength(path)).toBe(2);
  });

  it('includes the edge even when a longer trail in the component avoids it', () => {
    // Triangle Montreal-Boston(2), Boston-NY(2), Montreal-NY(3): the longest trail
    // uses all three, so forcing any single edge still yields the full triangle (7).
    const owned = ['montreal-boston', 'boston-new-york', 'montreal-new-york'];
    const path = longestPathThrough(owned, 'montreal-boston');
    expect(path).toContain('montreal-boston');
    expect(totalLength(path)).toBe(7);
  });
});
