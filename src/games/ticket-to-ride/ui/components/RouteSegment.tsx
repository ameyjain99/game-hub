import type { City, Route } from '../../engine/types';
import { COLOR_HEX, COLOR_BORDER, lighten } from '../colors';
import { makeCurve, type Bend } from '../geometry';

interface Props {
  route: Route;
  from: City;
  to: City;
  /** How far the route bows away from the straight line (see `ROUTE_BENDS`). */
  bend?: Bend;
  ownerColor: string | null;
  /** Owner's avatar emoji, shown as a badge at the route's midpoint when claimed. */
  ownerAvatar?: string;
  claimable: boolean;
  onClick?: () => void;
  /** Part of the hovered longest-path chain: draw brighter and larger. */
  highlighted?: boolean;
  /** Tooltip text shown above this route (the chain's anchor only). */
  label?: string | null;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}

const MAX_CAR_LEN = 30;
const MIN_CAR_LEN = 9;
const CAR_GAP = 5; // gap between consecutive car slots on a route
const SLOT_WIDTH = 11;
const TRAIN_WIDTH = 13; // claimed cars sit slightly proud of empty slots
const PARALLEL_OFFSET = 11;
const HIT_STEPS = 12; // polyline resolution for the hit area / affordable glow
const STRAIGHT: Bend = [0, 0];

/** Sideways offset of a route's rail: the two rails of a double route sit either side of the curve. */
export function railSide(route: Route): number {
  return route.id.endsWith('-2') ? PARALLEL_OFFSET : route.parallelGroup ? -PARALLEL_OFFSET : 0;
}

/** Render one route: empty colored slots when open, solid train cars when claimed. */
export function RouteSegment({
  route,
  from,
  to,
  bend = STRAIGHT,
  ownerColor,
  ownerAvatar,
  claimable,
  onClick,
  highlighted = false,
  label = null,
  onHoverStart,
  onHoverEnd,
}: Props) {
  const curve = makeCurve(from, to, bend);
  const len = curve.length;

  // Offset the whole segment sideways for the second rail of a double route.
  const side = railSide(route);
  // Point on this rail at arc-length `s`, pushed sideways along the curve's normal.
  const railAt = (s: number) => {
    const p = curve.at(s);
    return {
      x: p.x - p.uy * side,
      y: p.y + p.ux * side,
      angle: (Math.atan2(p.uy, p.ux) * 180) / Math.PI,
    };
  };

  const owned = ownerColor !== null;
  const slotColor = COLOR_HEX[route.color];
  const slotBorder = COLOR_BORDER[route.color];

  // Inset the cars from both cities so routes don't converge onto the node and
  // merge with their neighbours — leaving a clear gap at every junction.
  const pad = Math.min(19, len * 0.16);
  const span = Math.max(len - 2 * pad, route.length * 6);
  const slot = span / route.length;
  const carLen = Math.max(MIN_CAR_LEN, Math.min(MAX_CAR_LEN, slot - CAR_GAP));
  const start = (len - span) / 2; // distance from A to the first slot's leading edge

  // Inset rail for the hit area / affordable glow (so they don't reach the city).
  const railPoints = Array.from({ length: HIT_STEPS + 1 }, (_, i) => {
    const p = railAt(start + (span * i) / HIT_STEPS);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');

  const cars = Array.from({ length: route.length }, (_, i) => {
    const { x: cx, y: cy, angle } = railAt(start + (i + 0.5) * slot);
    const rot = `rotate(${angle} ${cx} ${cy})`;

    if (!owned) {
      // Open route: a colored slot with a darker edge (like the printed board).
      // Full colour when affordable, muted-but-coloured otherwise.
      const w = SLOT_WIDTH;
      // Tunnels render as pills (rounded ends) so they read as distinct on the board.
      return (
        <rect
          key={i}
          x={cx - carLen / 2}
          y={cy - w / 2}
          width={carLen}
          height={w}
          rx={route.isTunnel ? w / 2 : 2.5}
          transform={rot}
          fill={slotColor}
          fillOpacity={claimable ? 1 : 0.5}
          stroke={slotBorder}
          strokeOpacity={claimable ? 1 : 0.6}
          strokeWidth={claimable ? 2.2 : 1.5}
        />
      );
    }

    // Claimed route: a solid train car in the owner's color, raised with a shadow
    // and a top highlight so it reads as a piece placed on the board. The inner
    // group drops in on mount (staggered per car) so a claim animates for everyone.
    // When part of a hovered chain, cars grow and brighten to trace the path.
    const w = highlighted ? TRAIN_WIDTH + 5 : TRAIN_WIDTH;
    const drawLen = highlighted ? carLen + 4 : carLen;
    const carFill = highlighted ? lighten(ownerColor!, 0.4) : ownerColor!;
    return (
      <g key={i} transform={rot} filter="url(#trainShadow)">
        <g className="train-car" style={{ animationDelay: `${i * 70}ms` }}>
          <rect
            className="train-car-body"
            x={cx - drawLen / 2}
            y={cy - w / 2}
            width={drawLen}
            height={w}
            rx={route.isTunnel ? w / 2 : 3}
            fill={carFill}
            stroke={highlighted ? '#ffffff' : '#00000066'}
            strokeWidth={highlighted ? 1.8 : 1.4}
          />
          <rect
            x={cx - drawLen / 2 + 3}
            y={cy - w / 2 + 2}
            width={Math.max(drawLen - 6, 2)}
            height={2.4}
            rx={1.2}
            fill="#ffffff"
            fillOpacity={0.35}
          />
        </g>
      </g>
    );
  });

  return (
    <g
      data-route-id={route.id}
      className={`route${claimable ? ' claimable' : ''}${owned ? ' owned' : ''}${highlighted ? ' chain' : ''}`}
      onClick={onClick}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      style={{ cursor: claimable ? 'pointer' : 'default' }}
    >
      {/* wide invisible hit area along the rail (inset from the cities) */}
      <polyline points={railPoints} fill="none" stroke="transparent" strokeWidth={SLOT_WIDTH + 8} />
      {claimable && (
        <polyline
          points={railPoints}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.22}
          strokeWidth={SLOT_WIDTH + 7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {cars}
      {owned && ownerAvatar && (() => {
        const mid = railAt(start + span / 2);
        return (
          <g transform={`translate(${mid.x} ${mid.y})`} style={{ pointerEvents: 'none' }}>
            <g className="route-badge-pop">
              <circle r={8.5} fill="#ffffff" stroke={ownerColor ?? '#000'} strokeWidth={2} filter="url(#trainShadow)" />
              <text textAnchor="middle" dominantBaseline="central" fontSize={10}>
                {ownerAvatar}
              </text>
            </g>
          </g>
        );
      })()}
      {label && (() => {
        const mid = railAt(start + span / 2);
        const boxW = 18 + label.length * 6.2;
        return (
          <g
            className="route-tooltip"
            transform={`translate(${mid.x} ${mid.y - 22})`}
            style={{ pointerEvents: 'none' }}
          >
            <rect
              x={-boxW / 2}
              y={-11}
              width={boxW}
              height={22}
              rx={6}
              fill="#141b24"
              stroke={ownerColor ? lighten(ownerColor, 0.4) : '#fff'}
              strokeWidth={1.5}
              filter="url(#trainShadow)"
            />
            <text textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill="#fff">
              {label}
            </text>
          </g>
        );
      })()}
    </g>
  );
}
