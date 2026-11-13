import type { City } from '../../engine/types';

interface Props {
  city: City;
  /** Strong highlight (e.g. endpoints of a hovered ticket). */
  highlighted?: boolean;
  /** Subtle, persistent highlight (endpoints of the player's kept tickets). */
  subtle?: boolean;
  /** Owner color of a train station placed here (Europe), if any. */
  stationColor?: string;
  /** When placing a station, clickable cities pulse. */
  placeable?: boolean;
  onClick?: () => void;
}

export function CityDot({ city, highlighted, subtle, stationColor, placeable, onClick }: Props) {
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
        <rect
          x={city.x + 4}
          y={city.y + 4}
          width={9}
          height={9}
          rx={1.5}
          fill={stationColor}
          stroke="#fff"
          strokeWidth={1.5}
        />
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
