import type { City } from '../../engine/types';

interface Props {
  city: City;
  /** Strong highlight (e.g. endpoints of a hovered ticket). */
  highlighted?: boolean;
  /** Subtle, persistent highlight (endpoints of the player's kept tickets). */
  subtle?: boolean;
  /** Owner color of a train station placed here (Europe), if any. */
  stationColor?: string;
  /** The station was only just built: it drops in under rings of its colour. */
  stationFresh?: boolean;
  /** When placing a station, clickable cities pulse. */
  placeable?: boolean;
  onClick?: () => void;
}

/**
 * A train station: a little station house in its owner's colour, standing
 * beside the city so the city's dot and name stay readable.
 */
export function StationMark({ x, y, color, scale = 1 }: { x: number; y: number; color: string; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M-9 -2 L0 -10 L9 -2 Z" fill={color} stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
      <rect x={-7.5} y={-2.5} width={15} height={10.5} rx={1.6} fill={color} stroke="#fff" strokeWidth={1.6} />
      <rect x={-2.2} y={1.2} width={4.4} height={6.8} rx={0.8} fill="#fff" />
    </g>
  );
}

export function CityDot({ city, highlighted, subtle, stationColor, stationFresh, placeable, onClick }: Props) {
  const cls = `${highlighted ? ' highlighted' : subtle ? ' subtle' : ''}${placeable ? ' placeable' : ''}`;
  // Keep labels inside the frame for cities near the board's left/right edge.
  const halfLabel = city.name.length * 3.2;
  const anchor = city.x - halfLabel < 12 ? 'start' : city.x + halfLabel > 988 ? 'end' : 'middle';
  const labelX = anchor === 'start' ? city.x - 6 : anchor === 'end' ? city.x + 6 : city.x;
  return (
    <g
      data-city-id={city.id}
      className={`city${cls}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      {placeable && (
        <circle cx={city.x} cy={city.y} r={12} fill="#f2c31d" fillOpacity={0.18} stroke="#f2c31d" strokeWidth={2} />
      )}
      {highlighted && (
        <circle
          cx={city.x}
          cy={city.y}
          r={13}
          fill="none"
          stroke="#f2c31d"
          strokeWidth={3}
          className="city-halo"
        />
      )}
      {!highlighted && subtle && (
        <circle
          cx={city.x}
          cy={city.y}
          r={10}
          fill="#f2c31d"
          fillOpacity={0.16}
          stroke="#f2c31d"
          strokeOpacity={0.95}
          strokeWidth={2.6}
        />
      )}
      <circle
        cx={city.x}
        cy={city.y}
        r={highlighted ? 7 : 5.5}
        fill={highlighted ? '#f2c31d' : subtle ? '#7a5c00' : '#1b1b1f'}
        stroke="#fff"
        strokeWidth={2}
      />
      {stationColor && (
        <g className={`city-station${stationFresh ? ' is-fresh' : ''}`} style={{ color: stationColor }}>
          {stationFresh && (
            <>
              <circle className="city-station-ring" cx={city.x + 15} cy={city.y + 13} r={14} fill="none" stroke="currentColor" strokeWidth={4} />
              <circle className="city-station-ring is-second" cx={city.x + 15} cy={city.y + 13} r={14} fill="none" stroke="currentColor" strokeWidth={4} />
            </>
          )}
          <g className="city-station-house">
            <StationMark x={city.x + 15} y={city.y + 13} color={stationColor} scale={1.45} />
          </g>
        </g>
      )}
      <text
        x={labelX}
        y={city.y - 9}
        textAnchor={anchor}
        fontSize={highlighted ? 13 : 11}
        fontWeight={highlighted ? 800 : 600}
        fill="#1b1b1f"
        stroke="#fff"
        strokeWidth={2.6}
        paintOrder="stroke"
        style={{ pointerEvents: 'none' }}
      >
        {city.name}
      </text>
    </g>
  );
}
