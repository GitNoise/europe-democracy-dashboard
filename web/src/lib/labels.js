// Party labels above the chart (pipeline/RULES.md §4).
// Two lines (party, then years). Centred on the band when it fits inside it, else starting at the band's left edge.
// Placed left to right in as few rows as possible: a label may slide right while it still sits over its band,
// and only moves up a row when there's no room.
import { FONTS, textWidth } from './text.js';

export const LABEL_ROW_HEIGHT = 27;
const GAP = 8;

/**
 * @param bands     [{ party, xa, xb, years }] in pixels, left to right
 * @param width     chart width
 * @param firstRowStart  row 0 keeps clear of the '1.0' axis label
 * @returns { labels: [{ party, years, colour, x, anchor, row }], rows }
 */
export function layoutPartyLabels(bands, width, firstRowStart) {
  const rowEnd = [];
  const labels = bands
    .filter((b) => b.party)
    .map((b) => {
      const w = Math.max(textWidth(b.party, FONTS.partyName), textWidth(b.years, FONTS.partyYears));
      return { band: b, w, fits: w <= b.xb - b.xa - 4 };
    })
    .sort((p, q) => p.band.xa - q.band.xa)
    .map(({ band, w, fits }) => {
      const want = fits ? (band.xa + band.xb) / 2 - w / 2 : band.xa;
      const preferred = Math.min(Math.max(want, 0), width - w);
      const latest = Math.max(preferred, Math.min(fits ? band.xb - w - 2 : band.xb - 10, width - w)); // still over its band
      let row = 0, left;
      for (;; row++) {
        const free = row < rowEnd.length ? rowEnd[row] : row === 0 ? firstRowStart : 0;
        left = Math.max(preferred, free);
        if (left <= latest) break;
      }
      rowEnd[row] = left + w + GAP;
      return { party: band.party, years: band.years, colour: band.colour, row,
               x: fits ? left + w / 2 : left, anchor: fits ? 'middle' : 'start' };
    });
  return { labels, rows: rowEnd.length };
}
