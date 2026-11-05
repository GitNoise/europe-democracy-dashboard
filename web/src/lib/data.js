// Loading the data files and turning their rows into the shapes the charts use.
import { csv, json, group } from 'd3';
import { FIRST_YEAR } from './constants.js';

/** Load every data file once. Files live in public/data and are written by the pipeline. */
export async function loadData(base = import.meta.env.BASE_URL) {
  const [scores, governments, episodes, flags] = await Promise.all([
    csv(`${base}data/scores.csv`),
    csv(`${base}data/governments.csv`),
    csv(`${base}data/episodes.csv`),
    json(`${base}data/flags.json`),
  ]);
  return {
    scoresById: group(scores, (r) => r.id),
    governmentsById: group(governments, (r) => r.id),
    episodesById: group(episodes, (r) => r.id),
    flagsById: new Map(flags.map((f) => [f.id, f.svg])),
  };
}

const num = (v) => (v === '' || v == null ? NaN : Number(v));

/** Each year's score is plotted at 31 December, the date V-Dem's scores refer to. */
export const yearEnd = (year) => Date.UTC(year, 11, 31);

/** One country's yearly scores, plus the facts the headline needs. */
export function countryView(db, id) {
  const raw = db.scoresById.get(id) ?? [];
  const rows = raw
    .map((r) => ({
      year: Number(r.year),
      date: new Date(yearEnd(Number(r.year))),
      val: num(r.libdem),
      lo: num(r.libdem_low),
      hi: num(r.libdem_high),
      reg: num(r.regime),
      election: r.election === '1',
    }))
    .filter((r) => r.year >= FIRST_YEAR)
    .sort((a, b) => a.year - b.year);
  const series = rows.filter((r) => Number.isFinite(r.val));
  if (!series.length) return null;
  const last = series[series.length - 1];

  // "Less / more democratic today than at any time since …": the last earlier year at or beyond today's level
  const lower = series.filter((r) => r.year < last.year && r.val <= last.val);
  const higher = series.filter((r) => r.year < last.year && r.val >= last.val);
  const lowSince = lower.length ? lower[lower.length - 1].year : null;
  const highSince = higher.length ? higher[higher.length - 1].year : null;
  let record = null;
  if (lowSince !== null && last.year - lowSince >= 10) record = { kind: 'low', since: lowSince };
  else if (!higher.length) record = { kind: 'highest-ever' };
  else if (highSince !== null && last.year - highSince >= 10) record = { kind: 'high', since: highSince };

  return {
    id,
    name: raw[0]?.country ?? id,
    rows,
    series,
    last,
    record,
    elections: rows.filter((r) => r.election).map((r) => r.year),
    governments: governmentsFor(db, id),
    episodes: episodesFor(db, id),
    flag: db.flagsById.get(id) ?? null,
  };
}

/** The governments table for one country, oldest first. */
function governmentsFor(db, id) {
  return (db.governmentsById.get(id) ?? [])
    .map((r) => ({ party: r.party, name: r.name, colour: r.colour || '', headline: r.headline || '', s: +new Date(r.start), e: +new Date(r.end) }))
    .filter((g) => Number.isFinite(g.s) && Number.isFinite(g.e))
    .sort((a, b) => a.s - b.s);
}

/** Every detected move for one country (rises, falls, swings, jumps, dips, spikes, trend changes, slow trends). */
function episodesFor(db, id) {
  return (db.episodesById.get(id) ?? []).map((r) => ({
    kind: r.kind,
    from: Number(r.start),
    to: Number(r.end),
    change: Number(r.change),
    anchor: num(r.anchor),
    mark: r.mark || '',
    noteFrom: num(r.note_from),
    noteTo: num(r.note_to),
    reason: r.reason || '',
    drivers: r.drivers || '',
  }));
}

/** The value of `year`, or undefined. */
export const valueAt = (country, year) => country.series.find((r) => r.year === year);

/** V-Dem regime class (0–3) in a year, or null. */
export function regimeAt(country, year) {
  const r = country.rows.find((q) => q.year === year);
  return r && Number.isFinite(r.reg) ? r.reg : null;
}
