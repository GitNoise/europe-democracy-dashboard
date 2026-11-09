// Loading the data files and turning their rows into the shapes the charts use.
import { csv, json, group } from 'd3';
import { FIRST_YEAR } from './constants.js';

const RECORD_TOLERANCE = 0.01;

/** Load every data file once. Files live in public/data and are written by the pipeline. */
export async function loadData(base = import.meta.env.BASE_URL) {
  const [scores, governments, partyColours, episodes, flags, heads] = await Promise.all([
    csv(`${base}data/scores.csv`),
    csv(`${base}data/governments.csv`),
    csv(`${base}data/party_colours.csv`),
    csv(`${base}data/episodes.csv`),
    json(`${base}data/flags.json`),
    csv(`${base}data/heads_of_state.csv`),
  ]);
  return {
    scoresById: group(scores, (r) => r.id),
    governmentsById: group(governments, (r) => r.id),
    headsById: group(heads, (r) => r.id),
    partyColoursById: group(partyColours, (r) => r.id),
    episodesById: group(episodes, (r) => r.id),
    flagsById: new Map(flags.map((f) => [f.id, f.svg])),
  };
}

const num = (v) => (v === '' || v == null ? NaN : Number(v));

/** Each year's score is plotted at 31 December, the date V-Dem's scores refer to. */
export const yearEnd = (year) => Date.UTC(year, 11, 31);

/** Where a country's latest score ranks among all countries: { position, of }, 1 = most democratic. */
const ranks = new WeakMap();
function rankOf(db, id) {
  if (!ranks.has(db)) {
    const latest = [...db.scoresById].map(([k, rs]) => {
      const r = rs.filter((q) => q.libdem !== '').at(-1);
      return { k, val: r ? Number(r.libdem) : -1 };
    }).sort((p, q) => q.val - p.val);
    ranks.set(db, new Map(latest.map((d, i) => [d.k, { position: i + 1, of: latest.length }])));
  }
  return ranks.get(db).get(id) ?? null;
}

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

  // "Less / more democratic today than at any time since …": the last earlier year clearly at or beyond today's level,
  // or the first year when none is (a country at its lowest ever). Scores within RECORD_TOLERANCE of today count as
  // the same level (V-Dem's year-to-year noise), so a slightly lower score last year doesn't hide a long-run low.
  const lower = series.filter((r) => r.year < last.year && r.val <= last.val - RECORD_TOLERANCE);
  const higher = series.filter((r) => r.year < last.year && r.val >= last.val + RECORD_TOLERANCE);
  const lowSince = lower.length ? lower[lower.length - 1].year : series[0].year;
  const highSince = higher.length ? higher[higher.length - 1].year : null;
  let record = null;
  if (lowSince !== null && last.year - lowSince >= 10) record = { kind: 'low', since: lowSince };
  else if (!series.some((r) => r.year < last.year && r.val >= last.val)) record = { kind: 'highest-ever' }; // strict: a true record
  else if (highSince !== null && last.year - highSince >= 10) record = { kind: 'high', since: highSince };

  return {
    id,
    name: raw[0]?.country ?? id,
    rows,
    series,
    last,
    record,
    rank: rankOf(db, id),
    elections: rows.filter((r) => r.election).map((r) => r.year),
    governments: governmentsFor(db, id),
    heads: headsFor(db, id),
    episodes: episodesFor(db, id),
    flag: db.flagsById.get(id) ?? null,
  };
}

/**
 * The governments table for one country, oldest first. Each government also lists its parties, leading party first:
 * from an optional `parties` column ("ÖVP+SPÖ"), else from a coalition name joined with an en dash ("ÖVP–SPÖ").
 * A party takes the colour it has elsewhere in the country's table, else the one in party_colours.csv, or none.
 * `shade` is the colour its band takes: its own, else a coalition's leading party's; none for governments marked
 * with a `kind` (provisional, caretaker, technocratic, all-party unity, collegial, power-sharing).
 */
function governmentsFor(db, id) {
  const rows = db.governmentsById.get(id) ?? [];
  const colourOf = new Map([
    ...(db.partyColoursById?.get(id) ?? []).map((r) => [r.party, r.colour]),
    ...rows.filter((r) => r.colour).map((r) => [r.party, r.colour]),
  ]);
  return rows
    .map((r) => {
      const names = (r.parties ? r.parties.split('+') : r.party.split('–')).map((p) => p.trim()).filter(Boolean);
      const parties = names.length > 1 ? names.map((p) => ({ party: p, colour: colourOf.get(p) || '' })) : [{ party: r.party, colour: r.colour || colourOf.get(r.party) || '' }];
      const shade = r.colour || (!r.kind && parties.length > 1 ? parties[0].colour : '');
      return { party: r.party, name: r.name, colour: r.colour || '', shade, headline: r.headline || '', parties, s: +new Date(r.start), e: +new Date(r.end) };
    })
    .filter((g) => Number.isFinite(g.s) && Number.isFinite(g.e))
    .sort((a, b) => a.s - b.s);
}

/** Every detected move for one country (rises, falls, swings, jumps, dips, spikes, trend changes, slow trends). */
/**
 * Heads of state in the years they share or hold power over the cabinet, or have a strong veto over laws
 * (pipeline/democracy_pipeline/heads.py). Years are as V-Dem records them, on 31 December; a spell is drawn over
 * its whole years. A party takes the colour it has in the governments table, else party_colours.csv, else grey.
 */
function headsFor(db, id) {
  const colourOf = new Map([
    ...(db.partyColoursById?.get(id) ?? []).map((r) => [r.party, r.colour]),
    ...(db.governmentsById.get(id) ?? []).filter((r) => r.colour).map((r) => [r.party, r.colour]),
  ]);
  return (db.headsById?.get(id) ?? []).map((r) => ({
    s: Date.UTC(Number(r.start), 0, 1),
    e: Date.UTC(Number(r.end) + 1, 0, 1),
    name: r.name,
    party: r.party,
    role: r.role,
    power: r.power,   // 'cabinet': shares or holds power over ministers; 'veto': only a strong veto over laws
    colour: colourOf.get(r.party) || '',
  }));
}

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
