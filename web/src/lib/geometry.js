// Small geometry helpers for annotation layout.

/** Axis-aligned boxes {l, r, t, b}: do they overlap (with optional padding)? */
export const boxesOverlap = (a, b, pad = 0) => a.l < b.r + pad && a.r > b.l - pad && a.t < b.b + pad && a.b > b.t - pad;

/** Does any point of a polyline fall inside a box? */
export const polylineInBox = (points, box) =>
  points.some(([x, y]) => x > box.l - 1.5 && x < box.r + 1.5 && y > box.t - 1.5 && y < box.b + 1.5);

/** Do two line segments cross? */
function segmentsCross(p1, p2, p3, p4) {
  const side = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  return (side(p3, p4, p1) > 0) !== (side(p3, p4, p2) > 0) && (side(p1, p2, p3) > 0) !== (side(p1, p2, p4) > 0);
}

/** Do two polylines cross anywhere? */
export function polylinesCross(a, b) {
  for (let i = 1; i < a.length; i++) for (let j = 1; j < b.length; j++) if (segmentsCross(a[i - 1], a[i], b[j - 1], b[j])) return true;
  return false;
}

/**
 * A curved arrow from `from` to `to`: a circular arc bending by `angle` radians, after Bloomberg Businessweek's
 * swoopyArrow (bizweekgraphics/swoopyarrows, public domain). Returns the SVG path and points sampled every ~4px.
 */
export function swoopyArrow(from, to, angle, clockwise) {
  const [ax, ay] = from, [bx, by] = to;
  const chord = Math.hypot(bx - ax, by - ay);
  const toCentre = chord / (2 * Math.tan(angle / 2));
  const radius = Math.hypot(toCentre, chord / 2);
  const path = `M ${ax},${ay} a ${radius},${radius} 0 0,${clockwise ? 1 : 0} ${bx - ax},${by - ay}`;

  // the arc's centre sits on the chord's perpendicular bisector, on the side that makes the sweep go the right way
  const mx = (ax + bx) / 2, my = (ay + by) / 2, nx = -(by - ay) / chord, ny = (bx - ax) / chord;
  const sweep = (cx, cy) => {
    let d = Math.atan2(by - cy, bx - cx) - Math.atan2(ay - cy, ax - cx);
    return Math.atan2(Math.sin(d), Math.cos(d));
  };
  let [cx, cy] = [mx + nx * toCentre, my + ny * toCentre];
  if ((sweep(cx, cy) > 0) !== clockwise) [cx, cy] = [mx - nx * toCentre, my - ny * toCentre];
  const start = Math.atan2(ay - cy, ax - cx), delta = sweep(cx, cy);
  const steps = Math.max(1, Math.floor((radius * Math.abs(delta)) / 4));
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const t = start + (delta * i) / steps;
    return [cx + radius * Math.cos(t), cy + radius * Math.sin(t)];
  });
  return { path, points, length: radius * Math.abs(delta) };
}
