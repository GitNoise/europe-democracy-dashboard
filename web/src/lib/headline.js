// Headline and subtitle, in plain words (pipeline/RULES.md §6–7).
import { format } from 'd3';
import { HEADLINE_PARTY_SHARE, RECENT_YEARS, REGIME, REGIME_EXPLAINED } from './constants.js';
import { regimeAt, yearEnd } from './data.js';

const fmt = format('.2f');
const capitalise = (s) => s[0].toUpperCase() + s.slice(1);

/** Some country names take "the". */
const withThe = (name) => (/^(United|Netherlands)/.test(name) ? `the ${name}` : name);

/**
 * The move a headline is about: the most recent rise or fall of 0.10+ ending in `minEnd` or later that still holds
 * today, measured from its high to its low (or low to high), with the party that held power for most of it.
 */
function headlineMove(country, minEnd, holding = true) {
  return country.episodes
    .filter((e) => (e.kind === 'rise' || e.kind === 'fall') && e.to >= minEnd && Math.abs(e.change) >= 0.1)
    .sort((p, q) => q.to - p.to || Math.abs(q.change) - Math.abs(p.change))
    .map((e) => measureMove(country, e))
    .find((m) => m && (!holding || stillHolds(country, m))) ?? null;
}

/**
 * A move still holds when less than half of it has been undone since, and today's regime class hasn't gone back
 * past the one it ended in (lower after a rise, higher after a fall).
 */
function stillHolds(country, move) {
  const undone = (move.b.val - country.last.val) / (move.b.val - move.a.val);
  const end = regimeAt(country, move.b.year), now = regimeAt(country, country.last.year);
  const classHolds = end === null || now === null || (move.fall ? now <= end : now >= end);
  return undone < 0.5 && classHolds;
}

function measureMove(country, move) {
  const fall = move.change < 0;
  const years = country.series.filter((r) => r.year >= move.from && r.year <= move.to);
  if (years.length < 2) return null;
  // start at the last time the move reaches its high (fall) or low (rise); end at its extreme after that
  let i0 = 0;
  years.forEach((r, i) => { if (fall ? r.val >= years[i0].val : r.val <= years[i0].val) i0 = i; });
  const after = years.slice(i0);
  let i1 = 0;
  after.forEach((r, i) => { if (fall ? r.val < after[i1].val : r.val > after[i1].val) i1 = i; });
  const a = years[i0], b = after[i1];
  return { fall, a, b, party: majorityParty(country, yearEnd(a.year), yearEnd(b.year)) };
}

/** The headline name of the coloured party that held power for most of [wa, wb], if any. */
function majorityParty(country, wa, wb) {
  const held = new Map(), names = new Map();
  for (const g of country.governments) {
    const overlap = Math.min(g.e, wb) - Math.max(g.s, wa);
    if (overlap > 0 && g.colour) {
      held.set(g.party, (held.get(g.party) ?? 0) + overlap);
      if (g.headline) names.set(g.party, g.headline);
    }
  }
  let best = null;
  for (const [party, ms] of held) if (ms >= HEADLINE_PARTY_SHARE * (wb - wa) && (!best || ms > held.get(best))) best = party;
  return best ? names.get(best) ?? best : null;
}

/** What a move did, in words: a change of regime class, a share of the score, a recovery, or a plain verb (`plain`). */
function describeMove(country, move, recent) {
  const r1 = regimeAt(country, move.a.year), r2 = regimeAt(country, move.b.year);
  if (r1 !== null && r2 !== null && r1 !== r2) {
    const heldBefore = (k) => country.rows.some((q) => q.year < move.a.year && q.reg >= k);
    const again = (k) => (heldBefore(k) ? ' again' : '');
    if (r2 > r1) {
      if (r2 === 3) return { verb: `became a full democracy${again(3)}` };
      if (r2 === 2) return { verb: `became a democracy${again(2)}` };
      return { verb: 'began holding elections, but remained an autocracy' };
    }
    if (r2 === 0) return { verb: 'became a dictatorship' };
    if (r2 === 1) return { verb: 'slid from democracy into autocracy' };
    return { verb: 'lost its status as a full democracy' };
  }
  const f = Math.abs(move.b.val - move.a.val) / move.a.val;
  if (move.fall) {
    const share = sizeWords(f);
    return share ? { possessive: `democracy score fell by ${share}`, sized: true } : { possessive: 'democracy eroded', plain: true };
  }
  if (recent) {
    const previousFall = country.episodes
      .filter((e) => e.kind === 'fall' && e.to <= move.a.year + 1 && e.to >= move.a.year - 3)
      .sort((x, y) => y.to - x.to)[0];
    if (previousFall) {
      const r = (move.b.val - move.a.val) / Math.abs(previousFall.change);
      const share = r >= 0.9 ? 'all' : r >= 0.6 ? 'most' : r >= 0.4 ? 'much' : 'some';
      return { recovery: `has won back ${share} of the democratic ground it lost` };
    }
  }
  if (f >= 1) return { possessive: `democracy score ${f >= 1.9 ? 'more than doubled' : 'nearly doubled'}`, sized: true };
  const share = sizeWords(f);
  return share ? { possessive: `democracy score rose by ${share}`, sized: true } : { verb: 'became more democratic', plain: true };
}

/** A change as a share of where it started, in words; none under 15%. */
const sizeWords = (f) =>
  f >= 0.5 ? 'more than half' : f >= 0.4 ? 'nearly half' : f >= 0.3 ? 'about a third' : f >= 0.25 ? 'a quarter'
  : f >= 0.2 ? 'a fifth' : f >= 0.15 ? 'a sixth' : null;

/** A sentence about a move: "Under Fidesz, Hungary slid …", "Spain's democracy eroded between 2022 and 2025". */
function moveSentence(country, move, recent) {
  const name = withThe(country.name);
  const words = describeMove(country, move, recent);
  if (words.recovery) return `${capitalise(name)} ${words.recovery}`;
  // years are given unless the move is recent and a party is named
  const when = move.party && move.b.year >= recentFrom(country) ? '' : ` between ${move.a.year} and ${move.b.year}`;
  const subject = words.possessive ? `${name}’s ${words.possessive}` : `${name} ${words.verb}`;
  // a move told by its size takes the record it led to, when there is one in the same direction
  const r = newsworthyRecord(country), toRecord = !words.verb && recent && r?.since && (r.kind === 'low') === move.fall;
  const level = `${r?.kind === 'low' ? 'lowest' : 'highest'} level since ${r?.since}`;
  const record = !toRecord ? '' : move.b.year === country.last.year ? `, to its ${level}` : `, and is now at its ${level}`;
  return move.party ? `Under ${move.party}, ${subject}${when}${record}` : `${capitalise(subject)}${when}${record}`;
}

/** The slow trend still told in the text, if any (never drawn on the chart). */
const slowTrend = (country) => country.episodes.filter((e) => e.kind === 'slow').sort((p, q) => q.to - p.to)[0] ?? null;

/**
 * A record worth a headline: today at least RECORD_MIN_GAP below (low) or above (high) the country's highest or
 * lowest score since RECORD_WINDOW_FROM, so that a small dip at the top of the scale isn't told as news.
 */
const RECORD_MIN_GAP = 0.05, RECORD_WINDOW_FROM = 2010;
function newsworthyRecord(country) {
  const r = country.record;
  if (!r) return null;
  const recentVals = country.series.filter((q) => q.year >= RECORD_WINDOW_FROM).map((q) => q.val);
  const gap = r.kind === 'low' ? Math.max(...recentVals) - country.last.val : country.last.val - Math.min(...recentVals);
  return gap >= RECORD_MIN_GAP ? r : null;
}

/** The first year that counts as recent: RECENT_YEARS before the latest data. */
const recentFrom = (country) => country.last.year - RECENT_YEARS;

/**
 * Headline and subtitle lines. Order of preference:
 * 1. a big move in the last RECENT_YEARS years that still holds (one told by its size adds its record);
 * 2. a newsworthy record (lowest/highest since …, never higher); 3. among Europe's three most or least democratic;
 * 4. a slow trend still running; 5. among Europe's ten most democratic; 6. the most recent big move at any time
 * that still holds; 7. else the latest big move, turned back since; 8. stability (no big move at all).
 */
export function headlineFor(country) {
  const name = withThe(country.name);
  const lastRegime = regimeAt(country, country.last.year);
  const slow = slowTrend(country);
  let title, move = headlineMove(country, recentFrom(country)), recent = true;
  const record = newsworthyRecord(country), rank = country.rank;
  if (move) title = moveSentence(country, move, true);
  else if (record?.kind === 'low') title = `${capitalise(name)} is less democratic today than at any time since ${record.since}`;
  else if (record?.kind === 'high') title = `${capitalise(name)} is more democratic today than at any time since ${record.since}`;
  else if (record?.kind === 'highest-ever') title = `${capitalise(name)} has never been more democratic`;
  else if (rank && (rank.position <= 3 || rank.position > rank.of - 3)) {
    title = `${capitalise(name)} is among Europe’s three ${rank.position <= 3 ? 'most' : 'least'} democratic countries`;
  }
  else if (slow && slow.to >= recentFrom(country)) {
    title = slow.change >= 0
      ? `${capitalise(name)} has quietly grown more democratic since ${slow.from}`
      : `${capitalise(name)}’s democracy has been slowly eroding since ${slow.from}`;
  }
  else if (rank && rank.position <= 10) title = `${capitalise(name)} is among Europe’s ten most democratic countries`;
  else if ((move = headlineMove(country, 0))) { recent = false; title = moveSentence(country, move, false); }
  // no move holds today: the latest one, and that it has been turned back since
  else if ((move = headlineMove(country, 0, false))) {
    recent = false;
    title = `${moveSentence(country, move, false)}, but has since ${move.fall ? 'recovered' : 'slipped back'}`;
  }
  else title = `${capitalise(name)} has been a stable ${lastRegime !== null && lastRegime < 2 ? 'autocracy' : 'democracy'} since ${country.series[0].year}`;

  const mainDriver = slow?.drivers ? slow.drivers.split('; ')[0].replace(/ \d+%$/, '').toLowerCase() : '';
  return {
    title,
    numbers: move ? { from: fmt(move.a.val), fromYear: move.a.year, to: fmt(move.b.val), toYear: move.b.year } : null,
    slow: slow ? { from: slow.from, to: slow.to, change: fmt(Math.abs(slow.change)), rising: slow.change >= 0, driver: mainDriver } : null,
    regime: lastRegime !== null ? { index: lastRegime, name: REGIME[lastRegime], explained: REGIME_EXPLAINED[lastRegime] } : null,
    recent,
  };
}
