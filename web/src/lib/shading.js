// Which governments are shaded, and for how long (pipeline/RULES.md §3).
import { sum } from 'd3';
import { BAND_MIN, CORE_SHARE, GOVERNMENT_SHARE } from './constants.js';
import { yearEnd } from './data.js';

const yearOf = (ms) => new Date(ms).getUTCFullYear();

/** Moves that get a band: rises, falls, swings, and jumps of BAND_MIN or more. */
function bandedMoves(country) {
  return country.episodes
    .filter((e) => ['rise', 'fall', 'swing', 'jump'].includes(e.kind))
    .filter((e) => e.kind !== 'jump' || Math.abs(e.change) >= BAND_MIN)
    .sort((a, b) => a.from - b.from);
}

/**
 * The years of a move that get shaded.
 * Rise/fall: the shortest run of years carrying CORE_SHARE of its change.
 * Swing: its years, minus flat years (change under 0.01) at either edge.
 */
export function coreYears(country, move) {
  const { series } = country;
  if (move.kind === 'swing') {
    const prev = (r) => series.find((q) => q.year === r.year - 1);
    const moving = series.filter((r) => r.year > move.from && r.year <= move.to && prev(r) && Math.abs(r.val - prev(r).val) >= 0.01);
    return moving.length ? [moving[0].year - 1, moving[moving.length - 1].year] : [move.from, move.to];
  }
  if (move.kind !== 'rise' && move.kind !== 'fall') return [move.from, move.to];
  const dir = Math.sign(move.change);
  const need = CORE_SHARE * Math.abs(move.change);
  const years = series.filter((r) => r.year >= move.from && r.year <= move.to);
  let best = [move.from, move.to];
  for (let i = 0; i < years.length; i++) {
    for (let j = i + 1; j < years.length; j++) {
      const carries = dir * (years[j].val - years[i].val) >= need;
      if (carries && years[j].year - years[i].year < best[1] - best[0]) best = [years[i].year, years[j].year];
    }
  }
  return best;
}

/** Long governments are cut into terms at each election year (mid-year; the exact date isn't in the data). */
function governmentTerms(country) {
  const cuts = country.elections.map((y) => Date.UTC(y, 6, 1));
  return country.governments.flatMap((g) => {
    const terms = [];
    let from = g.s;
    for (const t of cuts.filter((t) => t > g.s && t < g.e)) { terms.push({ ...g, s: from, e: t }); from = t; }
    terms.push({ ...g, s: from, e: g.e });
    return terms;
  });
}

/** How much of the movement in `run` happened while `terms` (one party's consecutive terms) were in power. */
function shareOfMove(country, run, terms) {
  const steps = [];
  for (let y = yearOf(run.a) + 1; y <= yearOf(run.b); y++) {
    const p = country.series.find((r) => r.year === y - 1), q = country.series.find((r) => r.year === y);
    if (p && q) steps.push({ s: yearEnd(y - 1), e: yearEnd(y), d: Math.abs(q.val - p.val) });
  }
  const total = sum(steps, (st) => st.d);
  if (!total) return 0;
  // each year's change is spread over that year and shared by time in office
  const part = sum(terms, (g) => sum(steps, (st) => st.d * Math.max(0, Math.min(g.e, st.e) - Math.max(g.s, st.s)) / (st.e - st.s)));
  return part / total;
}

/**
 * The shaded bands for a country: one per government in power during a big move, for its full term.
 * Returns [{ party, name, colour, a, b }] in time order (a, b in ms); a band with no party is a move no government covers.
 */
export function shadedBands(country) {
  const runs = [], whole = [];
  for (const move of bandedMoves(country)) {
    const [from, to] = coreYears(country, move);
    whole.push({ a: yearEnd(move.from), b: yearEnd(move.to) });
    const a = yearEnd(from), b = yearEnd(to), last = runs[runs.length - 1];
    if (last && a <= last.b) last.b = Math.max(last.b, b); else runs.push({ a, b });
  }

  const terms = governmentTerms(country);
  const picked = new Set();
  for (const run of runs) {
    const inRun = terms.map((g, i) => ({ g, i })).filter(({ g }) => g.s < run.b && g.e > run.a);
    // group consecutive terms of the same party, then keep the party if a quarter of the move happened on its watch
    for (let k = 0; k < inRun.length;) {
      let m = k + 1;
      while (m < inRun.length && inRun[m].g.party === inRun[k].g.party && inRun[m].g.s === inRun[m - 1].g.e) m++;
      const group = inRun.slice(k, m);
      if (shareOfMove(country, run, group.map((h) => h.g)) >= GOVERNMENT_SHARE) group.forEach((h) => picked.add(h.i));
      k = m;
    }
  }
  // a shaded party keeps its band for following terms it governs without a break while the move is still running
  for (const i of [...picked].sort((a, b) => a - b)) {
    let j = i;
    while (terms[j + 1] && terms[j + 1].party === terms[i].party && terms[j + 1].s === terms[j].e
           && whole.some((w) => terms[j + 1].s < w.b && terms[j + 1].e > w.a)) picked.add(++j);
  }

  const bands = [];
  for (const i of [...picked].sort((a, b) => a - b)) {
    const g = terms[i], prev = bands[bands.length - 1];
    if (prev && prev.party === g.party && prev.b === g.s) prev.b = g.e;
    else bands.push({ party: g.party, name: g.name, colour: g.colour, a: g.s, b: g.e });
  }
  for (const run of runs) {
    if (!terms.some((g) => g.s < run.b && g.e > run.a)) bands.push({ party: '', name: '', colour: '', a: run.a, b: run.b });
  }
  return bands.sort((p, q) => p.a - q.a);
}

/** A party's real, unbroken time in power around a band (labels show this, not just the shaded part). */
export function tenure(country, band) {
  const gs = country.governments;
  let i = gs.findIndex((g) => g.party === band.party && g.s <= band.a && g.e >= band.a);
  if (i < 0) return band;
  let j = i;
  while (i > 0 && gs[i - 1].party === band.party && gs[i - 1].e === gs[i].s) i--;
  while (j < gs.length - 1 && gs[j + 1].party === band.party && gs[j + 1].s === gs[j].e) j++;
  return { a: gs[i].s, b: gs[j].e };
}

/** A term as a short label: "2015–23", "1997–2001", or "since 2010" when it runs to the end of the data. */
export function termText({ a, b }, lastYear) {
  const sy = yearOf(a), ey = yearOf(b);
  if (b >= yearEnd(lastYear)) return `since ${sy}`;
  if (ey <= sy) return String(sy);
  return `${sy}–${Math.floor(sy / 100) === Math.floor(ey / 100) ? String(ey).slice(-2) : ey}`;
}
