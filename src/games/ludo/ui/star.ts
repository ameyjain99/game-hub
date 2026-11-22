/**
 * The star board for 5-8 players: a regular polygon in the middle with an arm
 * on each side. An arm is 3 squares wide and 6 long, like an arm of the cross
 * board, and each player's yard is a disc in the gap between two arms.
 *
 * Distances are in squares, measured from the centre of the board; x runs
 * right and y runs down. Angles are in radians, clockwise from the right.
 */
import { YARD, homeOf, lastTrack } from '../engine';

/** A square of an arm: `row` 0 is next to the centre and 5 is the tip; `col` is -1, 0 or 1 across the arm, 1 being the clockwise side. */
export interface ArmCell {
  arm: number;
  row: number;
  col: number;
}

export interface Star {
  arms: number;
  /** From the centre to the outer edge of the drawing. */
  half: number;
  /** From the centre to the middle of a side of the polygon, where an arm begins. */
  apothem: number;
  /** From the centre to a corner of the polygon. */
  corner: number;
  /** How far out each yard's centre is, and the yard's radius. */
  yardAt: number;
  yardRadius: number;
}

export function starOf(arms: number): Star {
  const apothem = 1.5 / Math.tan(Math.PI / arms);
  const corner = 1.5 / Math.sin(Math.PI / arms);
  const tip = apothem + 6;
  // The largest disc that touches both neighbouring arms and stays inside the circle of the arm tips.
  const sin = Math.sin(Math.PI / arms);
  const out = (tip - corner) / (1 + sin);
  return { arms, half: Math.hypot(tip, 1.5) + 0.35, apothem, corner, yardAt: corner + out, yardRadius: out * sin };
}

/** The direction arm `k` points in: the first arm points left, like red's on the cross board, and the rest follow clockwise. */
export const armAngle = (star: Star, k: number) => Math.PI + (2 * Math.PI * k) / star.arms;
/** The direction of the yard that belongs to arm `k`: the gap on its clockwise side. */
export const yardAngle = (star: Star, k: number) => armAngle(star, k) + Math.PI / star.arms;

const polar = (angle: number, r: number): [number, number] => [Math.cos(angle) * r, Math.sin(angle) * r];

/** The centre of a square of an arm. */
export function cellCentre(star: Star, cell: ArmCell): [number, number] {
  const a = armAngle(star, cell.arm);
  const along = star.apothem + cell.row + 0.5;
  // The clockwise perpendicular of (cos a, sin a) is (-sin a, cos a).
  return [Math.cos(a) * along - Math.sin(a) * cell.col, Math.sin(a) * along + Math.cos(a) * cell.col];
}

/**
 * The square of the star that track index `index` is. Each arm adds 13: from a
 * start square 5 squares run in along the clockwise side of its arm, 6 run out
 * along the near side of the next arm, then come that arm's tip and the top of
 * its clockwise side.
 */
export function trackCell(star: Star, index: number): ArmCell {
  const arm = Math.floor(index / 13);
  const m = index % 13;
  const next = (arm + 1) % star.arms;
  if (m < 5) return { arm, row: 4 - m, col: 1 };
  if (m < 11) return { arm: next, row: m - 5, col: -1 };
  return m === 11 ? { arm: next, row: 5, col: 0 } : { arm: next, row: 5, col: 1 };
}

/** Where token `token` of the player on `arm` is drawn at `progress`. */
export function starSpot(star: Star, arm: number, progress: number, token: number): [number, number] {
  if (progress === YARD) {
    const [cx, cy] = polar(yardAngle(star, arm), star.yardAt);
    const d = star.yardRadius * 0.42;
    return [cx + (token % 2 ? d : -d), cy + (token < 2 ? -d : d)];
  }
  if (progress === homeOf(star.arms)) {
    const a = armAngle(star, arm);
    const [x, y] = polar(a, star.apothem * 0.6);
    const off = (token - 1.5) * 0.36;
    return [x - Math.sin(a) * off, y + Math.cos(a) * off];
  }
  const last = lastTrack(star.arms);
  if (progress > last) return cellCentre(star, { arm, row: 4 - (progress - last - 1), col: 0 });
  return cellCentre(star, trackCell(star, (13 * arm + progress) % (13 * star.arms)));
}
