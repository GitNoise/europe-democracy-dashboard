// Placing the notes on the chart (pipeline/RULES.md §5).
// Every note is placed against a list of obstacles ("boxes": the line, labels, other notes) and must not overlap
// any of them. Brackets go first; then arrow notes are chosen from scored candidates and repaired.
import { max, min } from 'd3';
import { boxesOverlap, polylineInBox, polylinesCross, swoopyArrow } from './geometry.js';
import { FONTS, textWidth, wrapText } from './text.js';

export const LINE_HEIGHT = 14.4;
const PAD = 3;

const measureLines = (lines) => ({ w: max(lines, (l) => textWidth(l, FONTS.note)), h: lines.length * LINE_HEIGHT });

/** Which detected moves carry a note: rises, falls and jumps with a reason, and dips/spikes promoted to an arrow. */
export const notedMoves = (country) =>
  country.episodes.filter((e) => e.reason && e.kind !== 'trend' && e.kind !== 'slow'
    && ((e.kind !== 'dip' && e.kind !== 'spike') || e.mark === 'arrow'));

/**
 * Brackets: over a period set in the data, or over the move itself (high to low, or low to high).
 * They step away from the line until clear; dips go below the V first, everything else above.
 */
export function placeBrackets(country, plot, boxes) {
  const { series } = country, { x, y } = plot;
  const placed = [];
  const moves = notedMoves(country).filter((e) => e.mark === 'bracket').sort((p, q) => Math.abs(q.change) - Math.abs(p.change));
  for (const move of moves) {
    let [from, to] = [move.noteFrom, move.noteTo];
    if (!Number.isFinite(from) || !Number.isFinite(to)) [from, to] = highToLow(series, move);
    const span = series.filter((r) => r.year >= from && r.year <= to);
    if (span.length < 2) continue;
    const xa = x(span[0].date), xb = x(span[span.length - 1].date), mid = (xa + xb) / 2;
    const lines = wrapText(move.reason, 28), { w, h } = measureLines(lines);
    const top = y(max(span, (r) => r.val)), bottom = y(min(span, (r) => r.val));
    const ups = [14, 22, 32, 46, 64, 90, 120, 160, 200, 250].map((gap) => [true, gap]);
    const downs = [14, 22, 32, 46, 64, 90, 120].map((gap) => [false, gap]);
    const isDip = Number.isFinite(move.noteFrom) && move.change < 0;
    for (const [above, gap] of isDip ? [...downs, ...ups] : [...ups, ...downs]) {
      const barY = above ? top - gap : bottom + gap;
      const textTop = above ? barY - 6 - h : barY + 6;
      const cx = Math.min(Math.max(mid, plot.left + w / 2 + 2), plot.right - w / 2 - 2);
      const text = { l: cx - w / 2, r: cx + w / 2, t: textTop, b: textTop + h };
      const bar = { l: xa, r: xb, t: barY - 5, b: barY + 5 };
      if (!plot.contains(text) || boxes.some((o) => boxesOverlap(text, o, PAD) || boxesOverlap(bar, o, PAD))) continue;
      boxes.push(text, bar);
      const tick = above ? 4 : -4;
      placed.push({ path: `M ${xa},${barY + tick} V ${barY} H ${xb} V ${barY + tick}`, lines, x: cx, top: textTop, anchor: 'middle' });
      break;
    }
  }
  return placed;
}

/** For a move without a set period: from the last time it reaches its high (fall) or low (rise) to its extreme after that. */
function highToLow(series, move) {
  const years = series.filter((r) => r.year >= move.from && r.year <= move.to), fall = move.change < 0;
  let i0 = 0;
  years.forEach((r, i) => { if (fall ? r.val >= years[i0].val : r.val <= years[i0].val) i0 = i; });
  const after = years.slice(i0);
  let i1 = 0;
  after.forEach((r, i) => { if (fall ? r.val < after[i1].val : r.val > after[i1].val) i1 = i; });
  return [years[i0]?.year ?? move.from, after[i1]?.year ?? move.to];
}

// distances (sideways, up/down) from the point to the text's nearest corner, closest first
const GAPS = [[10, 18], [18, 26], [28, 36], [8, 48], [40, 48], [16, 62], [50, 60], [30, 78], [64, 80], [20, 96], [80, 100]];

/** Candidate spots for one arrow note, cheapest first. */
function candidates(move, point, segmentDir, plot, boxes) {
  const { tx, ty } = point, [gx, gy] = segmentDir;
  // open side of the move first: above-left / below-right of a rise, above-right / below-left of a fall
  const sides = move.change >= 0 ? [['up', 'left'], ['down', 'right'], ['up', 'right'], ['down', 'left']]
                                  : [['up', 'right'], ['down', 'left'], ['up', 'left'], ['down', 'right']];
  const out = [];
  [24, 20, 16].forEach((width, wi) => {
    const lines = wrapText(move.reason, width), { w, h } = measureLines(lines);
    for (const [ox, oy] of GAPS) sides.forEach(([v, side], si) => {
      const up = v === 'up', left = side === 'left';
      const text = { l: left ? tx - ox - w : tx + ox, r: left ? tx - ox : tx + ox + w, t: up ? ty - oy - h : ty + oy, b: up ? ty - oy : ty + oy + h };
      if (!plot.contains(text) || boxes.some((o) => boxesOverlap(text, o, PAD))) return;
      // the arrow leaves from the end of the text and lands square to the line, just short of the point
      const start = [left ? text.r + 3 : text.l - 3, up ? text.b - LINE_HEIGHT * 0.35 : text.t + LINE_HEIGHT * 0.45];
      let [hx, hy] = [-gy, gx];
      if (hy > 0 !== up) [hx, hy] = [-hx, -hy];
      const end = [tx - hx * 6, ty - hy * 6];
      let turn = Math.atan2(hy, hx) - Math.atan2(end[1] - start[1], end[0] - start[0]);
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      const arrow = swoopyArrow(start, end, Math.max(0.3, Math.min(1.0, 2 * Math.abs(turn))), turn > 0);
      // the arrow may not cross the line, a label, a bracket or another note (except right at its own point)
      const crosses = arrow.points.some(([px, py]) => Math.hypot(px - tx, py - ty) >= 18
        && boxes.some((o) => boxesOverlap({ l: px - 1.5, r: px + 1.5, t: py - 1.5, b: py + 1.5 }, o)));
      if (crosses) return;
      out.push({ text, lines, up, left, path: arrow.path, points: arrow.points, centre: (text.l + text.r) / 2,
                 cost: Math.hypot(ox, oy) + si * 18 + wi * 10 + arrow.length * 0.25 });
    });
  });
  return out.sort((a, b) => a.cost - b.cost);
}

/**
 * Arrow notes. Each note gets ~130 candidate spots; the biggest moves choose first, then up to four repair passes
 * move notes to cheaper spots or make room for a missing one by moving the single note in its way.
 * Notes never overlap, arrows never cross, and notes on the same side keep their points' left-to-right order.
 */
export function placeArrowNotes(country, plot, boxes) {
  const { series } = country, { x, y } = plot;
  const items = notedMoves(country).filter((e) => e.mark !== 'bracket').map((move) => {
    const k = series.findIndex((r) => r.year === move.anchor);
    if (k < 1) return null;
    const p = series[k - 1], q = series[k];
    // the arrow points at the middle of the year's segment (end of the previous year to end of this one)
    const point = { tx: (x(p.date) + x(q.date)) / 2, ty: (y(p.val) + y(q.val)) / 2 };
    const dx = x(q.date) - x(p.date), dy = y(q.val) - y(p.val), len = Math.hypot(dx, dy) || 1;
    return { move, tx: point.tx, priority: Math.abs(move.change), options: candidates(move, point, [dx / len, dy / len], plot, boxes), pick: null };
  }).filter(Boolean);

  const compatible = (A, a, B, b) => !boxesOverlap(a.text, b.text, PAD) && !polylineInBox(a.points, b.text)
    && !polylineInBox(b.points, a.text) && !polylinesCross(a.points, b.points)
    && !(a.up === b.up && (A.tx - B.tx) * (a.centre - b.centre) < 0);
  const fits = (item, option, ignore) => items.every((o) => o === item || o === ignore || !o.pick || compatible(item, option, o, o.pick));
  const byPriority = [...items].sort((p, q) => q.priority - p.priority);

  for (const item of byPriority) item.pick = item.options.find((o) => fits(item, o)) ?? null;
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const item of byPriority) {
      if (item.pick) {
        const better = item.options.find((o) => o.cost < item.pick.cost && fits(item, o));
        if (better) { item.pick = better; changed = true; }
        continue;
      }
      for (const option of item.options) {
        const blockers = items.filter((o) => o !== item && o.pick && !compatible(item, option, o, o.pick));
        if (!blockers.length) { item.pick = option; changed = true; break; }
        if (blockers.length === 1) {
          const [other] = blockers;
          const elsewhere = other.options.find((o) => o !== other.pick && compatible(item, option, other, o) && fits(other, o, item));
          if (elsewhere) { other.pick = elsewhere; item.pick = option; changed = true; break; }
        }
      }
    }
    if (!changed) break;
  }

  return items.filter((i) => i.pick).map(({ pick }) => ({
    path: pick.path, lines: pick.lines, top: pick.text.t,
    x: pick.left ? pick.text.r : pick.text.l, anchor: pick.left ? 'end' : 'start',
  }));
}
