/** A map's editable board layout, stored as `src/engine/data/<mapId>.layout.json`. */
export interface BoardLayout {
  /** City id -> [x, y] on the 0-1000 x 0-700 board. */
  cities: Record<string, [number, number]>;
  /** Route id (or double-route group) -> [dx, dy] bow; see `ROUTE_BENDS`. */
  bends: Record<string, [number, number]>;
}

/** Repo-relative layout file for a map, or null for an unsafe/invalid map id. */
export function layoutPath(mapId: unknown): string | null {
  return typeof mapId === 'string' && /^[a-z0-9-]+$/.test(mapId)
    ? `src/games/ticket-to-ride/engine/data/${mapId}/layout.json`
    : null;
}

function isPairMap(v: unknown): boolean {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    Object.values(v).every((p) => Array.isArray(p) && p.length === 2 && p.every((n) => Number.isFinite(n)))
  );
}

export function isBoardLayout(v: unknown): v is BoardLayout {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return isPairMap(o.cities) && isPairMap(o.bends);
}

/** Validate a map's imported layout JSON, failing loudly on a malformed file. */
export function asLayout(json: unknown): BoardLayout {
  if (!isBoardLayout(json)) {
    throw new Error('Malformed board layout: expected { cities, bends } of [number, number] pairs');
  }
  return json;
}

/** One entry per line, so saves produce small, readable diffs. */
export function formatLayout(layout: BoardLayout): string {
  const block = (name: string, entries: Record<string, [number, number]>) => {
    const rows = Object.entries(entries).map(([k, [a, b]]) => `    ${JSON.stringify(k)}: [${a}, ${b}]`);
    return `  ${JSON.stringify(name)}: ${rows.length ? `{\n${rows.join(',\n')}\n  }` : '{}'}`;
  };
  return `{\n${block('cities', layout.cities)},\n${block('bends', layout.bends)}\n}\n`;
}
