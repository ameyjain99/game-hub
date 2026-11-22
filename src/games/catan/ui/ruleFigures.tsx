/** Catan's rule-book pictures: the island's tiles, tokens, cards and pieces as the game draws them. */
import type { CSSProperties } from 'react';
import { PIPS, RESOURCES, YIELD, type Terrain } from '../board';
import { GLYPH, House, MerchantPiece, TERRAIN_COLOR } from './Island';
import { RES_COLOR, RES_NAME } from './cards';

const U = 60;
const HEX = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 180) * (60 * i - 90);
  return `${(Math.cos(a) * U).toFixed(1)},${(Math.sin(a) * U).toFixed(1)}`;
}).join(' ');

function Tile({ terrain, n }: { terrain: Terrain; n: number | null }) {
  const hot = n === 6 || n === 8;
  return (
    <svg className="rf-hx" viewBox="-62 -62 124 124" width={78} height={78} aria-hidden="true">
      <polygon points={HEX} fill={TERRAIN_COLOR[terrain]} className="catan-hex" />
      <path d={GLYPH[terrain]} transform={`translate(0 ${-0.42 * U}) scale(${U * 0.9})`} className="catan-glyph" />
      {n !== null && (
        <g className={`catan-token${hot ? ' is-hot' : ''}`}>
          <circle cx={0} cy={0.16 * U} r={0.31 * U} />
          <text x={0} y={0.21 * U}>
            {n}
          </text>
          {Array.from({ length: PIPS[n] }, (_, k) => (
            <circle key={k} className="catan-pip" cx={(k - (PIPS[n] - 1) / 2) * 0.075 * U} cy={0.33 * U} r={0.028 * U} />
          ))}
        </g>
      )}
    </svg>
  );
}

const NAME: Partial<Record<Terrain, string>> = { forest: 'Forest', hills: 'Hills', pasture: 'Pasture', fields: 'Fields', mountains: 'Mountains', desert: 'Desert' };

export const Terrains = () => (
  <div className="rf-row">
    {(Object.keys(NAME) as Terrain[]).map((t, i) => (
      <span key={t} className="rf-col">
        <Tile terrain={t} n={t === 'desert' ? null : [11, 4, 6, 9, 3][i]} />
        <span className="rf-label">
          {NAME[t]}
          {YIELD[t] ? ` · ${RES_NAME[YIELD[t]!]}` : ' · nothing'}
        </span>
      </span>
    ))}
  </div>
);

export const ResourceCards = () => (
  <div className="catan-hand">
    {RESOURCES.map((r) => (
      <span key={r} className="catan-card" style={{ '--rc': RES_COLOR[r] } as CSSProperties}>
        <b>1</b>
        <span>{RES_NAME[r]}</span>
      </span>
    ))}
  </div>
);

function Piece({ city, road }: { city?: boolean; road?: boolean }) {
  return (
    <svg className="rf-hx" viewBox="-30 -30 60 60" width={54} height={54} aria-hidden="true">
      {road ? (
        <>
          <line className="catan-road-edge" x1={-20} y1={12} x2={20} y2={-12} />
          <line className="catan-road-fill" x1={-20} y1={12} x2={20} y2={-12} stroke="#2F6FDB" />
        </>
      ) : (
        <House x={0} y={0} color="#2F6FDB" city={!!city} dim={false} />
      )}
    </svg>
  );
}

export const Pieces = () => (
  <div className="rf-row">
    <span className="rf-col">
      <Piece road />
      <span className="rf-label">Road (on a side)</span>
    </span>
    <span className="rf-col">
      <Piece />
      <span className="rf-label">Settlement · 1 point</span>
    </span>
    <span className="rf-col">
      <Piece city />
      <span className="rf-label">City · 2 points</span>
    </span>
  </div>
);

export const Odds = () => (
  <div className="rf-row">
    {[2, 3, 4, 5, 6, 8, 9, 10, 11, 12].map((n) => (
      <span key={n} className="rf-col">
        <svg className="rf-hx" viewBox="-22 -22 44 44" width={40} height={40} aria-hidden="true">
          <g className={`catan-token${n === 6 || n === 8 ? ' is-hot' : ''}`}>
            <circle cx={0} cy={0} r={18.6} />
            <text x={0} y={3}>
              {n}
            </text>
            {Array.from({ length: PIPS[n] }, (_, k) => (
              <circle key={k} className="catan-pip" cx={(k - (PIPS[n] - 1) / 2) * 4.5} cy={10} r={1.7} />
            ))}
          </g>
        </svg>
        <span className="rf-label">{PIPS[n]}/36</span>
      </span>
    ))}
  </div>
);

/** Seafarers' new pieces: sea, gold field, a ship. */
export const SeaPieces = () => (
  <div className="rf-row">
    <span className="rf-col">
      <Tile terrain="sea" n={null} />
      <span className="rf-label">Sea</span>
    </span>
    <span className="rf-col">
      <Tile terrain="gold" n={5} />
      <span className="rf-label">Gold field · any resource</span>
    </span>
    <span className="rf-col">
      <svg className="rf-hx" viewBox="-30 -30 60 60" width={54} height={54} aria-hidden="true">
        <g transform="scale(60)">
          <path d="M-0.3 0.02H0.3L0.2 0.15H-0.2Z" fill="#2F6FDB" stroke="#10131a" strokeWidth={0.025} />
          <path d="M-0.03 0V-0.3L0.17 -0.02Z" fill="#f3ead3" stroke="#10131a" strokeWidth={0.025} />
        </g>
      </svg>
      <span className="rf-label">Ship (on a sea side)</span>
    </span>
    <span className="rf-col">
      <svg className="rf-hx" viewBox="-30 -30 60 60" width={54} height={54} aria-hidden="true">
        <g transform="scale(80)">
          <path d="M-0.3 0.02H0.3L0.2 0.15H-0.2Z" fill="#1a1c22" stroke="#ffffffb3" strokeWidth={0.02} />
          <path d="M-0.03 0V-0.3L0.17 -0.02Z" fill="#1a1c22" stroke="#ffffffb3" strokeWidth={0.02} />
        </g>
      </svg>
      <span className="rf-label">The pirate</span>
    </span>
  </div>
);

/** Cities & Knights' new pieces: commodity cards, knights of each strength, a wall and a Metropolis. */
export const CitiesKnightsPieces = () => (
  <>
    <div className="catan-hand">
      {(
        [
          ['Paper', '#c9a66b', 'forest cities'],
          ['Cloth', '#7fa7c9', 'pasture cities'],
          ['Coin', '#9aa3b5', 'mountain cities'],
        ] as const
      ).map(([name, color]) => (
        <span key={name} className="catan-card is-good" style={{ '--rc': color } as CSSProperties}>
          <b>1</b>
          <span>{name}</span>
        </span>
      ))}
    </div>
    <div className="rf-row">
      {[1, 2, 3].map((level) => (
        <span key={level} className="rf-col">
          <svg className="rf-hx" viewBox="-20 -20 40 40" width={44} height={44} aria-hidden="true">
            <g transform="scale(60)">
              <path d="M-0.2 -0.22H0.2V0.02C0.2 0.16 0.08 0.24 0 0.28C-0.08 0.24 -0.2 0.16 -0.2 0.02Z" fill="#2F6FDB" stroke="#10131a" strokeWidth={0.05} />
              {Array.from({ length: level }, (_, k) => (
                <circle key={k} cx={(k - (level - 1) / 2) * 0.11} cy={-0.04} r={0.035} fill="#fff" />
              ))}
            </g>
          </svg>
          <span className="rf-label">Strength {level}</span>
        </span>
      ))}
      <span className="rf-col">
        <svg className="rf-hx" viewBox="-30 -30 60 60" width={50} height={50} aria-hidden="true">
          <circle cx={0} cy={0} r={21} fill="none" stroke="#2F6FDB" strokeWidth={5} strokeDasharray="6 4" />
          <House x={0} y={0} color="#2F6FDB" city dim={false} />
        </svg>
        <span className="rf-label">City with a wall</span>
      </span>
      <span className="rf-col">
        <svg className="rf-hx" viewBox="-30 -36 60 66" width={50} height={55} aria-hidden="true">
          <path transform="translate(0 -22) scale(60)" d="M-0.14 0.05L-0.16 -0.09L-0.07 -0.02L0 -0.12L0.07 -0.02L0.16 -0.09L0.14 0.05Z" fill="#ffd166" stroke="#10131a" strokeWidth={0.025} />
          <House x={0} y={0} color="#2F6FDB" city dim={false} />
        </svg>
        <span className="rf-label">A Metropolis (+2)</span>
      </span>
      <span className="rf-col">
        <svg className="rf-hx" viewBox="-20 -20 40 40" width={44} height={44} aria-hidden="true">
          <MerchantPiece x={-0.5} y={-0.02} color="#2F6FDB" dim={false} />
        </svg>
        <span className="rf-label">The merchant (+1)</span>
      </span>
    </div>
  </>
);
