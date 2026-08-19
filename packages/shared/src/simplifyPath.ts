/**
 * Ramer–Douglas–Peucker path simplification.
 *
 * A finger drag emits a point every few milliseconds, which would push hundreds
 * of near-identical coordinates into every scouting entry. Since entries sync
 * over flaky venue wifi, we thin each stroke down to the points that actually
 * define its shape before storing it.
 */

/** Minimum shape a point needs. The generic below carries any extra fields (e.g. `t`) through. */
export interface SimplifiablePoint {
  x: number;
  y: number;
}

/** Perpendicular distance from `point` to the line through `start` and `end`. */
function perpendicularDistance(
  point: SimplifiablePoint,
  start: SimplifiablePoint,
  end: SimplifiablePoint
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  // Degenerate segment (start === end): fall back to plain distance.
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const numerator = Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x);
  return numerator / Math.hypot(dx, dy);
}

/**
 * Returns a subset of `points` preserving the path's shape within `tolerance`.
 * The first and last points are always kept. Extra properties on each point
 * (such as a timestamp) are preserved.
 */
export function simplifyPath<T extends SimplifiablePoint>(points: T[], tolerance: number): T[] {
  if (points.length <= 2 || tolerance <= 0) return [...points];

  const first = points[0];
  const last = points[points.length - 1];

  let maxDistance = 0;
  let maxIndex = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  if (maxDistance <= tolerance) return [first, last];

  // The furthest point matters — recurse on both halves around it.
  const left = simplifyPath(points.slice(0, maxIndex + 1), tolerance);
  const right = simplifyPath(points.slice(maxIndex), tolerance);
  return [...left.slice(0, -1), ...right];
}
