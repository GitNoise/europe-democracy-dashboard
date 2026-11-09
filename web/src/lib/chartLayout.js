// Everything the main chart draws, worked out as plain data. Chart.svelte only renders it.
import { format, line, scaleLinear, scaleUtc } from 'd3';
import { FIRST_YEAR, GREY } from './constants.js';
import { yearEnd } from './data.js';
import { LABEL_ROW_HEIGHT, layoutPartyLabels } from './labels.js';
import { placeArrowNotes, placeBrackets } from './notes.js';
import { shadedBands, tenure, termText } from './shading.js';
import { FONTS, textWidth } from './text.js';

const fmt = format('.2f');
const TICK_YEARS = [1945, 1955, 1965, 1975, 1985, 1995, 2005, 2015, 2025];

/** Stripes for one government's parties: one party fills the strip; in a coalition the leader takes 60%. */
function stripes(parties, height) {
  if (parties.length === 1) return [{ y: 0, h: height, colour: parties[0].colour || GREY }];
  const lead = height * 0.6, rest = (height - lead) / (parties.length - 1);
  return parties.map((p, i) => ({ y: i ? lead + rest * (i - 1) : 0, h: i ? rest : lead, colour: p.colour || GREY }));
}

export function chartLayout(country, width, height) {
  const { series, last } = country;
  const W = Math.max(300, width);

  // the plot starts right of the labels on its left ('1.0', 'most', 'democratic', and the lanes' 'Government' and
  // 'Head of state', kept the same on every chart) and leaves room for the end value
  const left = Math.ceil(Math.max(...['democratic', 'Head of state'].map((t) => textWidth(t, FONTS.axis)))) + 8;
  const right = W - (Math.ceil(textWidth('0.00', FONTS.endValue)) + 16);
  // under the years: a strip with every government in its party colour, and under it a thinner lane for a head of
  // state who shares or holds power over the cabinet, where the country ever had one
  const STRIP = { gap: 26, height: 24 };
  const LANE = { gap: 6, height: 12 };
  const hasLane = country.heads.length > 0;
  const marginBottom = STRIP.gap + STRIP.height + (hasLane ? LANE.gap + LANE.height : 0) + 4;
  const x = scaleUtc([Date.UTC(FIRST_YEAR, 0, 1), yearEnd(last.year)], [left, right]);

  // bands are drawn only over the years with data; labels give the party's real time in power
  const dataStart = +series[0].date, dataEnd = +last.date;
  const bands = shadedBands(country)
    .map((b) => ({ ...b, xa: x(Math.max(b.a, dataStart)), xb: x(Math.min(b.b, dataEnd)), years: b.party ? termText(tenure(country, b), last.year) : '' }))
    .filter((b) => b.xb > b.xa);
  const { labels, rows } = layoutPartyLabels(bands, W, textWidth('1.0', FONTS.axis) + 6);

  const top = Math.max(26, rows * LABEL_ROW_HEIGHT + 10);
  const H = Math.max(top + marginBottom + 160, height);
  const bottom = H - marginBottom;
  // every chart runs the full scale, 0 to 1, so countries compare at a glance
  const y = scaleLinear([0, 1], [bottom, top]);
  const plot = { x, y, left, right, top, bottom,
    contains: (b) => b.l >= left + 2 && b.r <= right - 2 && b.t >= top + 2 && b.b <= y(0) - 12 };

  // obstacles the notes must keep clear of
  const boxes = [{ l: 0, r: textWidth('democratic', FONTS.axis) + 2, t: y(1) + 2, b: y(1) + 26 }];

  // "Lowest / highest since …": a dotted line from where the series last crossed today's level
  let reference = null;
  if (country.record?.since) {
    const i = series.findIndex((r) => r.year === country.record.since), from = series[i], next = series[i + 1];
    let x1 = x(from.date);
    if (next && next.val !== from.val) x1 += (x(next.date) - x(from.date)) * Math.min(1, Math.max(0, (last.val - from.val) / (next.val - from.val)));
    const low = country.record.kind === 'low';
    const below = low ? last.val > 0.08 : last.val > 0.92;
    const text = `${low ? 'Lowest' : 'Highest'} since ${country.record.since}`;
    const textY = y(last.val) + (below ? 15 : -7), textW = textWidth(text, FONTS.note);
    reference = { x1, x2: x(last.date), y: y(last.val), text, textX: x(last.date) - 10, textY };
    boxes.push({ l: x(last.date) - 10 - textW, r: x(last.date) - 10, t: textY - 11, b: textY + 3 },
               { l: x1, r: x(last.date), t: y(last.val) - 1, b: y(last.val) + 1 });
  }

  // the line itself, sampled every few pixels, and the end value
  for (let k = 1; k < series.length; k++) {
    const [x1, y1, x2, y2] = [x(series[k - 1].date), y(series[k - 1].val), x(series[k].date), y(series[k].val)];
    const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 4));
    for (let j = 0; j <= steps; j++) {
      const px = x1 + ((x2 - x1) * j) / steps, py = y1 + ((y2 - y1) * j) / steps;
      boxes.push({ l: px - 2, r: px + 2, t: py - 2, b: py + 2 });
    }
  }
  boxes.push({ l: x(last.date) - 4, r: W, t: y(last.val) - 9, b: y(last.val) + 9 });

  const brackets = placeBrackets(country, plot, boxes);
  const arrows = placeArrowNotes(country, plot, boxes);

  return {
    width: W, height: H, plot,
    bands: bands.map((b, k) => ({ x: b.xa, width: Math.max(1, b.xb - b.xa), colour: b.colour || GREY,
                                  divider: k > 0 && bands[k - 1].b === b.a })),
    labels: labels.map((l) => ({ ...l, baseline: top - 8 - l.row * LABEL_ROW_HEIGHT })),
    gridlines: [0.5, 1].map((v) => ({ y: y(v), label: v === 1 ? '1.0' : String(v) })),
    // a coalition is stacked stripes: the leading party on top and thicker, partners below
    governments: country.governments
      .map((g) => ({ xa: x(Math.max(g.s, +x.domain()[0])), xb: x(Math.min(g.e, dataEnd)), name: g.name,
                     stripes: stripes(g.parties, STRIP.height) }))
      .filter((g) => g.xb > g.xa),
    strip: { y: bottom + STRIP.gap, height: STRIP.height },
    // a thin rounded bar for each head of state's term with power, so a person reads apart from the government's band
    heads: country.heads
      .map((h) => ({ s: Math.max(h.s, +x.domain()[0]), e: Math.min(h.e, dataEnd + 1), h }))
      .filter((d) => d.e > d.s)
      .map(({ s, e, h }) => ({ x: x((s + e) / 2), xa: x(s), xb: x(e), name: h.name, party: h.party, colour: h.colour || GREY,
                               years: `${new Date(s).getUTCFullYear()}–${new Date(e - 1).getUTCFullYear()}` })),
    headRadius: 3,
    lane: hasLane ? { y: bottom + STRIP.gap + STRIP.height + LANE.gap, height: LANE.height } : null,
    // each year's label sits under the middle of that year's segment (its score is plotted at 31 December)
    // narrow charts (phones) label every other decade so the years don't run into each other
    ticks: TICK_YEARS.filter((_, i) => width >= 480 || i % 2 === 0).map((yr) => ({ x: x(Date.UTC(yr, 6, 1)), label: String(yr) })),
    path: line().x((d) => x(d.date)).y((d) => y(d.val))(series),
    end: { x: x(last.date), y: y(last.val), label: fmt(last.val) },
    reference, brackets, arrows,
  };
}
