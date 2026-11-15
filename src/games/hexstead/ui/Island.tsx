import type { CSSProperties } from 'react';
import { PIPS, geoOf, type Terrain } from '../board';
import type { HxState } from '../engine';

/** Board units (a hex's radius is 1) to SVG units. */
const U = 60;
const pt = (x: number, y: number) => `${(x * U).toFixed(1)},${(y * U).toFixed(1)}`;

export const TERRAIN_COLOR: Record<Terrain, string> = {
  forest: '#2f7d4f',
  hills: '#c4673c',
  pasture: '#8fc25b',
  fields: '#e3b23c',
  mountains: '#8a93a6',
  badlands: '#d6c08c',
  gold: '#b8860b',
  sea: '#1a557b',
};

/** A small white mark for each terrain, drawn in a 1-unit box. */
export const GLYPH: Record<Terrain, string> = {
  forest: 'M-0.32 0.2L-0.18 -0.18L-0.04 0.2ZM-0.08 0.2L0.1 -0.28L0.28 0.2ZM0.18 0.2L0.3 -0.08L0.42 0.2Z',
  hills: 'M-0.36 0.18H0.36M-0.36 0.02H0.36M-0.36 -0.14H0.36M-0.12 0.18V0.02M0.12 0.02V-0.14M0.2 0.18V0.02M-0.2 0.02V-0.14',
  pasture: 'M-0.26 0.06A0.14 0.12 0 0 1 -0.02 -0.06A0.14 0.12 0 0 1 0.24 0.02A0.12 0.12 0 0 1 0.2 0.2H-0.22A0.1 0.1 0 0 1 -0.26 0.06ZM-0.14 0.2V0.3M0.12 0.2V0.3',
  fields: 'M-0.2 0.3V-0.2M0 0.3V-0.3M0.2 0.3V-0.2M-0.2 -0.1L-0.3 -0.2M0 -0.2L-0.1 -0.3M0.2 -0.1L0.3 -0.2M-0.2 0.05L-0.1 -0.05M0 -0.05L0.1 -0.15M0.2 0.05L0.1 -0.05',
  mountains: 'M-0.42 0.24L-0.14 -0.24L0.06 0.08L0.16 -0.06L0.42 0.24ZM-0.22 -0.1L-0.14 -0.24L-0.06 -0.1',
  badlands: 'M-0.4 0.22C-0.2 0.04 0 0.04 0.12 0.16C0.22 0.06 0.32 0.06 0.4 0.12M0.18 -0.18A0.1 0.1 0 1 1 0.18 -0.181',
  gold: 'M-0.34 0.2L-0.22 -0.04H0.08L0.2 0.2ZM-0.06 0.2L0.06 -0.04H0.3L0.42 0.2ZM-0.2 -0.04L-0.1 -0.24H0.16L0.26 -0.04',
  sea: 'M-0.36 0C-0.24 -0.1 -0.12 -0.1 0 0S0.24 0.1 0.36 0M-0.28 0.2C-0.16 0.1 -0.04 0.1 0.08 0.2',
};

export interface IslandProps {
  s: HxState;
  colorOf: (playerId: string) => string;
  /** Corners, edges and tiles that can be clicked right now. */
  vertices?: number[];
  edges?: number[];
  tiles?: number[];
  /** Open Sea: sea edges a ship can go on, and your ships that can be picked up to move. */
  shipEdges?: number[];
  movable?: number[];
  onVertex?: (v: number) => void;
  onEdge?: (e: number) => void;
  onShipEdge?: (e: number) => void;
  onShip?: (e: number) => void;
  onTile?: (t: number) => void;
  /** What clicking a highlighted corner, edge or tile does (read out to screen readers). */
  vertexLabel?: string;
  edgeLabel?: string;
  tileLabel?: string;
  /** Tiles already picked (the Inventor's first token). */
  marked?: number[];
  /** Tiles that just paid out (glow briefly). */
  producing?: number[];
  /** A player's pieces to bring forward (hovering their row). */
  spotlight?: string | null;
}

export function House({ x, y, color, town, dim }: { x: number; y: number; color: string; town: boolean; dim: boolean }) {
  const s = town ? 0.3 : 0.22;
  const d = town
    ? `M${-s} ${s * 0.75}V${-s * 0.1}L${-s * 0.35} ${-s * 0.55}L${s * 0.1} ${-s * 0.1}V${-s * 0.4}H${s}V${s * 0.75}Z`
    : `M${-s} ${s * 0.7}V${-s * 0.15}L0 ${-s}L${s} ${-s * 0.15}V${s * 0.7}Z`;
  return (
    <g className={`hx-house${town ? ' is-town' : ''}${dim ? ' is-dim' : ''}`} transform={`translate(${x * U} ${y * U}) scale(${U})`}>
      <path d={d} fill={color} stroke="#10131a" strokeWidth={0.06} strokeLinejoin="round" />
    </g>
  );
}

/** The island: sea, harbours, tiles and tokens, then roads, buildings and the raider on top. */
/** A ship on an edge: a hull and a sail in the owner's colour, turned along the edge. */
function Ship({ s, e, color, dim, pirate }: { s: HxState; e: number; color: string; dim?: boolean; pirate?: boolean }) {
  const GEO = geoOf(s.board);
  const [a, b] = GEO.edges[e].v.map((v) => GEO.vertices[v]);
  const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const flip = angle > 90 || angle < -90 ? angle + 180 : angle;
  return (
    <g className={`hx-ship${dim ? ' is-dim' : ''}`} transform={`translate(${GEO.edges[e].x * U} ${GEO.edges[e].y * U}) rotate(${pirate ? 0 : flip}) scale(${U})`}>
      <path d="M-0.3 0.02H0.3L0.2 0.15H-0.2Z" fill={color} />
      <path d="M-0.03 0V-0.3L0.17 -0.02Z" fill={pirate ? '#1a1c22' : '#f3ead3'} />
    </g>
  );
}

/** The island: sea, harbours, tiles and tokens, then roads, ships, buildings, the raider and the corsair on top. */
/** A warden: a shield in its owner's colour with a pip per point of strength; a resting one is hollow. */
function WardenPiece({ x, y, color, level, active, dim }: { x: number; y: number; color: string; level: number; active: boolean; dim: boolean }) {
  return (
    <g className={`hx-warden${active ? ' is-active' : ''}${dim ? ' is-dim' : ''}`} transform={`translate(${x * U} ${y * U}) scale(${U})`}>
      <path d="M-0.2 -0.22H0.2V0.02C0.2 0.16 0.08 0.24 0 0.28C-0.08 0.24 -0.2 0.16 -0.2 0.02Z" fill={active ? color : '#1a1c22'} stroke={color} />
      {Array.from({ length: level }, (_, k) => (
        <circle key={k} cx={(k - (level - 1) / 2) * 0.11} cy={-0.04} r={0.035} className="hx-warden-pip" />
      ))}
    </g>
  );
}

/** The merchant: a trader's pawn in its holder's colour, standing beside the tile's token. */
export function MerchantPiece({ x, y, color, dim }: { x: number; y: number; color: string; dim: boolean }) {
  return (
    <g className={`hx-merchant${dim ? ' is-dim' : ''}`} transform={`translate(${(x + 0.5) * U} ${(y + 0.02) * U}) scale(${U * 1.5})`}>
      <ellipse cx={0} cy={0.17} rx={0.13} ry={0.04} className="hx-raider-shadow" />
      <path d="M-0.11 0.16L-0.05 -0.04A0.07 0.07 0 1 1 0.05 -0.04L0.11 0.16Z" fill={color} stroke="#10131a" strokeWidth={0.035} strokeLinejoin="round" />
      <path d="M-0.06 0.06H0.06" stroke="#ffffffd9" strokeWidth={0.03} strokeLinecap="round" />
    </g>
  );
}

export function Island({
  s,
  colorOf,
  vertices = [],
  edges = [],
  tiles = [],
  shipEdges = [],
  movable = [],
  onVertex,
  onEdge,
  onShipEdge,
  onShip,
  onTile,
  producing = [],
  spotlight,
  vertexLabel = 'Build here',
  edgeLabel = 'Build a road here',
  tileLabel,
  marked = [],
}: IslandProps) {
  const pickTiles = new Set(tiles);
  const GEO = geoOf(s.board);
  const scenario = s.board.layout === 'newShores';
  // The sea reaches a little past the island's widest and tallest points.
  const big = s.board.layout === 'large';
  const xs = GEO.vertices.map((v) => v.x);
  const ys = GEO.vertices.map((v) => v.y);
  const [w, h] = scenario ? [Math.max(...xs.map(Math.abs)) + 0.4, Math.max(...ys.map(Math.abs)) + 0.4] : big ? [6.9, 6.35] : [5.7, 5.2];
  const [sx, sy] = big ? [6.6, 6.05] : [5.4, 4.95];
  const pirate = s.board.pirate;
  return (
    <svg className="hx-island" viewBox={`${-w * U} ${-h * U} ${2 * w * U} ${2 * h * U}`} role="img" aria-label="The island">
      <defs>
        <radialGradient id="hx-sea" cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor="#1f5e86" />
          <stop offset="70%" stopColor="#123f61" />
          <stop offset="100%" stopColor="#0b2a44" />
        </radialGradient>
      </defs>
      {!scenario && (
        <>
          <ellipse cx={0} cy={0} rx={sx * U} ry={sy * U} fill="url(#hx-sea)" />
          <g className="hx-waves">
            {(big ? [4.6, 5.2, 5.8] : [3.5, 4.1, 4.7]).map((r) => (
              <ellipse key={r} cx={0} cy={0} rx={r * 1.08 * U} ry={r * U} fill="none" />
            ))}
          </g>
        </>
      )}

      {GEO.tiles.map((t, i) => {
        const terrain = s.board.terrain[i];
        const n = s.board.numbers[i];
        const hot = n === 6 || n === 8;
        const sea = terrain === 'sea';
        return (
          <g
            key={i}
            className={`hx-tile${sea ? ' is-sea' : ''}${pickTiles.has(i) ? ' is-pick' : ''}${marked.includes(i) ? ' is-marked' : ''}${producing.includes(i) ? ' is-producing' : ''}`}
            onClick={pickTiles.has(i) ? () => onTile?.(i) : undefined}
            role={pickTiles.has(i) ? 'button' : undefined}
            aria-label={
              pickTiles.has(i)
                ? tileLabel
                  ? `${tileLabel}: the ${terrain === 'gold' ? 'goldfield' : terrain} ${n ?? ''}`.trim()
                  : sea
                    ? 'Move the corsair here'
                    : `Move the raider to the ${terrain === 'gold' ? 'goldfield' : terrain} ${n ?? ''}`.trim()
                : undefined
            }
          >
            <polygon points={t.corners.map((c) => pt(GEO.vertices[c].x * 0.985 + t.x * 0.015, GEO.vertices[c].y * 0.985 + t.y * 0.015)).join(' ')} fill={TERRAIN_COLOR[terrain]} className="hx-hex" />
            <path d={GLYPH[terrain]} transform={`translate(${t.x * U} ${(t.y - 0.42) * U}) scale(${U * 0.9})`} className="hx-glyph" />
            {n !== null && (
              <g className={`hx-token${hot ? ' is-hot' : ''}`}>
                <circle cx={t.x * U} cy={(t.y + 0.16) * U} r={0.31 * U} />
                <text x={t.x * U} y={(t.y + 0.21) * U}>
                  {n}
                </text>
                {Array.from({ length: PIPS[n] }, (_, k) => (
                  <circle key={k} className="hx-pip" cx={(t.x + (k - (PIPS[n] - 1) / 2) * 0.075) * U} cy={(t.y + 0.33) * U} r={0.028 * U} />
                ))}
              </g>
            )}
          </g>
        );
      })}

      {GEO.harborEdges.map((e, k) => {
        const edge = GEO.edges[e];
        const kind = s.board.harbors[k];
        const len = Math.hypot(edge.x, edge.y);
        const hx = edge.x + (edge.x / len) * 0.62;
        const hy = edge.y + (edge.y / len) * 0.62;
        return (
          <g key={e} className="hx-harbor">
            {edge.v.map((v) => (
              <line key={v} x1={GEO.vertices[v].x * U} y1={GEO.vertices[v].y * U} x2={hx * U} y2={hy * U} />
            ))}
            <circle cx={hx * U} cy={hy * U} r={0.3 * U} className={`hx-dock is-${kind}`} style={kind === 'any' ? undefined : ({ '--dock': TERRAIN_COLOR[({ timber: 'forest', clay: 'hills', wool: 'pasture', grain: 'fields', stone: 'mountains' } as const)[kind]] } as CSSProperties)} />
            <text x={hx * U} y={hy * U + 0.11 * U} className="hx-dock-label">
              {kind === 'any' ? '3:1' : '2:1'}
            </text>
          </g>
        );
      })}

      {s.roads.map((owner, e) => {
        if (!owner) return null;
        const [a, b] = GEO.edges[e].v.map((v) => GEO.vertices[v]);
        const dim = !!spotlight && spotlight !== owner;
        return (
          <g key={e} className={`hx-road${dim ? ' is-dim' : ''}`}>
            <line x1={(a.x * 0.82 + b.x * 0.18) * U} y1={(a.y * 0.82 + b.y * 0.18) * U} x2={(b.x * 0.82 + a.x * 0.18) * U} y2={(b.y * 0.82 + a.y * 0.18) * U} className="hx-road-edge" />
            <line x1={(a.x * 0.82 + b.x * 0.18) * U} y1={(a.y * 0.82 + b.y * 0.18) * U} x2={(b.x * 0.82 + a.x * 0.18) * U} y2={(b.y * 0.82 + a.y * 0.18) * U} stroke={colorOf(owner)} className="hx-road-fill" />
          </g>
        );
      })}

      {(s.ships ?? []).map((owner, e) => (owner ? <Ship key={`ship${e}`} s={s} e={e} color={colorOf(owner)} dim={!!spotlight && spotlight !== owner} /> : null))}

      {(s.walls ?? []).map((w, v) =>
        w && s.buildings[v] ? <circle key={`wall${v}`} className="hx-wall" cx={GEO.vertices[v].x * U} cy={GEO.vertices[v].y * U} r={0.36 * U} stroke={colorOf(s.buildings[v]!.player)} /> : null,
      )}

      {s.buildings.map((b, v) => (b ? <House key={v} x={GEO.vertices[v].x} y={GEO.vertices[v].y} color={colorOf(b.player)} town={b.town} dim={!!spotlight && spotlight !== b.player} /> : null))}

      {s.mode === 'wardens' &&
        Object.values(s.capitals ?? {}).map((c) =>
          c ? (
            <path
              key={`cap${c.vertex}`}
              className="hx-capital"
              transform={`translate(${GEO.vertices[c.vertex].x * U} ${(GEO.vertices[c.vertex].y - 0.36) * U}) scale(${U})`}
              d="M-0.14 0.05L-0.16 -0.09L-0.07 -0.02L0 -0.12L0.07 -0.02L0.16 -0.09L0.14 0.05Z"
            />
          ) : null,
        )}

      {(s.wardens ?? []).map((w, v) =>
        w ? <WardenPiece key={`w${v}`} x={GEO.vertices[v].x} y={GEO.vertices[v].y} color={colorOf(w.player)} level={w.level} active={w.active} dim={!!spotlight && spotlight !== w.player} /> : null,
      )}

      {s.merchant && <MerchantPiece x={GEO.tiles[s.merchant.tile].x} y={GEO.tiles[s.merchant.tile].y} color={colorOf(s.merchant.player)} dim={!!spotlight && spotlight !== s.merchant.player} />}

      <g className="hx-raider" style={{ transform: `translate(${GEO.tiles[s.board.raider].x * U}px, ${(GEO.tiles[s.board.raider].y - 0.08) * U}px)` }}>
        <ellipse cx={0} cy={0.5 * U * 0.42} rx={0.2 * U} ry={0.06 * U} className="hx-raider-shadow" />
        <path d={`M${-0.15 * U} ${0.2 * U}Q${-0.17 * U} ${-0.02 * U} ${-0.07 * U} ${-0.08 * U}A${0.1 * U} ${0.1 * U} 0 1 1 ${0.07 * U} ${-0.08 * U}Q${0.17 * U} ${-0.02 * U} ${0.15 * U} ${0.2 * U}Z`} />
      </g>

      {pirate !== undefined && (
        <g className="hx-pirate" style={{ transform: `translate(${GEO.tiles[pirate].x * U}px, ${GEO.tiles[pirate].y * U}px)` }}>
          <g transform={`scale(${U * 1.6})`}>
            <path d="M-0.3 0.02H0.3L0.2 0.15H-0.2Z" fill="#1a1c22" stroke="#ffffffb3" strokeWidth={0.02} />
            <path d="M-0.03 0V-0.3L0.17 -0.02Z" fill="#1a1c22" stroke="#ffffffb3" strokeWidth={0.02} />
          </g>
        </g>
      )}

      {shipEdges.map((e) => (
        <line
          key={`pick-s${e}`}
          className="hx-pick-edge is-sea"
          x1={GEO.vertices[GEO.edges[e].v[0]].x * U}
          y1={GEO.vertices[GEO.edges[e].v[0]].y * U}
          x2={GEO.vertices[GEO.edges[e].v[1]].x * U}
          y2={GEO.vertices[GEO.edges[e].v[1]].y * U}
          onClick={() => onShipEdge?.(e)}
          role="button"
          aria-label="Put a ship here"
        />
      ))}
      {movable.map((e) => (
        <circle key={`move-s${e}`} className="hx-pick-vertex is-ship" cx={GEO.edges[e].x * U} cy={GEO.edges[e].y * U} r={0.16 * U} onClick={() => onShip?.(e)} role="button" aria-label="Move this ship" />
      ))}
      {edges.map((e) => (
        <line
          key={`pick-e${e}`}
          className="hx-pick-edge"
          x1={GEO.vertices[GEO.edges[e].v[0]].x * U}
          y1={GEO.vertices[GEO.edges[e].v[0]].y * U}
          x2={GEO.vertices[GEO.edges[e].v[1]].x * U}
          y2={GEO.vertices[GEO.edges[e].v[1]].y * U}
          onClick={() => onEdge?.(e)}
          role="button"
          aria-label={edgeLabel}
        />
      ))}
      {vertices.map((v) => (
        <circle key={`pick-v${v}`} className="hx-pick-vertex" cx={GEO.vertices[v].x * U} cy={GEO.vertices[v].y * U} r={0.12 * U} onClick={() => onVertex?.(v)} role="button" aria-label={vertexLabel} />
      ))}
    </svg>
  );
}
