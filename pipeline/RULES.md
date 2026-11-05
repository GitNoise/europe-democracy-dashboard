# Rules for the European democracy dashboard

Every rule that turns V-Dem data into a chart. Rules marked **[build]** are applied by the pipeline (`pipeline/democracy_pipeline/`); rules marked **[page]** by the site when it draws (`web/src/lib/`). Numbers in `code` are set in `config.json`.

## 1. Data [build]

- Source: V-Dem country-year dataset. Countries: `countries` in `config.json` (European countries with a national election 2022–2027, incl. Türkiye, Cyprus and the South Caucasus; Ukraine left out). Years from `first_year` (1945) to the last year in the release.
- Per country-year: Liberal Democracy Index (`v2x_libdem`) with its low and high estimates (`_codelow`, `_codehigh`, ±1 standard deviation), Regimes of the World class (`v2x_regime`: 0 closed autocracy, 1 electoral autocracy, 2 electoral democracy, 3 liberal democracy), national election year (`v2xel_elecparl` or `v2xel_elecpres` = 1).
- Governments (`web/public/data/governments.csv`) are maintained by hand: party code, full name, colour, headline name, start and end date. They only need to cover years inside shaded moves.

## 2. Detection [build]

All on the Liberal Democracy Index, one series per country.

| Kind | Rule |
|---|---|
| **rise / fall** (episode) | V-Dem's Episodes of Regime Transformation thresholds: starts with a yearly move of `ep_start` (0.01) in one direction; continues while the score keeps moving that way; ends at the peak/trough when it reverses by `ep_turn` (0.03) in a year, gives back `ep_cum` (0.10) in total, or stalls for `ep_stasis` (5) years. Counts if the total change is at least `ep_cum` (0.10). |
| **swing** | Any `swing_window` (3) years whose yearly changes add up (both directions) to `swing_sum` (0.15) or more. |
| **jump** | Any single year that moves `jump` (0.05) or more. |
| **dip / spike** | A turning point where the move in plus the move out (each leg to the neighbouring turning point, at most `leg_years` (5) years) adds up to `dip_total` (0.05) or more; not inside a rise, fall, swing or jump, and not within one year of a rise or fall. Stored as research leads; not drawn. |
| **trend** (trend change) | PELT change-point detection with a continuous piecewise-linear cost; penalty `trend_penalty` (6) × noise² × ln(years), noise = robust spread of second differences (floor `trend_noise_floor`); segments at least `trend_min_years` (4); kept if the slope changes by `trend_min_slope_change` (0.005/year). Stored; not drawn. |
| **slow** (slow trend) | A stretch between two trend changes that moves `slow_min` (0.08) or more, clears V-Dem's uncertainty (start and end ranges don't overlap), is less than half shaded, and contains no jump. Used in headline and subtitle only. Exceptions in `exceptions.csv` (today: Serbia 1951–99). |

- `anchor` (the year a note's arrow points at) defaults to the year with the largest one-year move.
- **Drivers**: for every move, the share of the change carried by each of V-Dem's eight components. The change is split between the electoral and liberal components with Shapley values on V-Dem's formula (0.25·E^1.585 + 0.25·L + 0.5·E^1.585·L), the electoral part among its five components with Shapley values on the polyarchy formula, and the liberal part among its three components in proportion to their change; rescaled to the real change. Spans used: rises and falls their core years (§3), jumps and slow trends their years, dips and spikes their larger leg, trend changes the next four years.

## 3. Shading (bands) [page]

1. Bands only for moves of `band_min` (0.10) or more: rises, falls, swings and jumps of 0.10+.
2. A rise or fall is shaded over its **core**: the shortest run of years carrying `core_share` (80%) of its change. A swing is trimmed of flat years (change under 0.01) at either edge.
3. Long governments are cut into terms at each election year (at mid-year).
4. A government is shaded if **at least 25% of the move happened while it was in power**: each year's change is spread over that year and shared among governments by their time in office.
5. A shaded party keeps its band for following terms it governs without a break while the move is still running.
6. Each shaded government is shown for its **full term**; bands are clipped to the years the country has data.
7. Colour: the party's colour; grey for coalitions, caretakers, juntas and parties without a confirmed colour.

## 4. Party labels [page]

- One label per band; a party's separate terms get separate labels, touching terms are one band and one label.
- Two lines: party code (bold, in party colour) over its **real unbroken time in power** ("since 2002", "1965–71"), even when the band is shorter.
- Centred on the band when the label fits inside it; otherwise starts at the band's left edge.
- Placed left to right in as few rows as possible; a label may slide right while it still sits over its band before moving up a row.

## 5. Notes (annotations) [content in `notes.csv`; arrow/bracket by rule [build]; placement [page]]

- A note is content: `reason` (short, one topic, no years, neutral verbs), an optional `event_year` (the year of the event it names), `source` and `checked`. Nothing else about a note is set by hand.
- Shown for rises, falls and jumps with a note, and for dips/spikes with a note that clear V-Dem's uncertainty against the shoulder of their larger leg.
- **Arrow or bracket, by rule [build]**, for a rise or fall with a note, in this order:
  1. it has an `event_year` → **arrow** pointing at that year;
  2. it is a sharp dip or spike (bottoms or peaks within three years, the sharp part at least `sharp_min` (0.08), recovers half within four years) and isn't inside an earlier bracket → **bracket** over that period (e.g. Türkiye's military interventions);
  3. it lasts more than five years and no single year carries half of it → **bracket** (drawn from the move's high to its low, or low to high);
  4. otherwise → **arrow** on the year of the sharpest move.
  Jumps: arrow on the event year (or the jump's year). Dips/spikes: arrow on their year.
- On the page an arrow points at the middle of its year's segment, landing square to the line. Dip brackets go below the V first, everything else above; brackets may sit far from the line.
- Placement: about 130 candidate spots per note (11 distances × 4 sides × 3 wrap widths), open side of the move first (above-left / below-right of a rise, above-right / below-left of a fall); cost = distance + side + narrower wrap + arrow length. Biggest moves pick first; then up to four repair passes (move to a cheaper spot; a missing note may move the one note blocking it). Never overlapping text, arrows crossing each other or any text, or notes on the same side out of their points' left-to-right order. A note that can't be placed is left out (smallest moves first).

## 6. Headline [page]

Order of preference:
1. Most recent rise or fall ending 2018 or later (from its high to its low).
2. "less / more democratic today than at any time since Y" (today's level last seen at least ten years earlier), or "has never been more democratic".
3. A slow trend still running in 2018 or later.
4. The most recent rise or fall at any time.
5. "has been a stable democracy / autocracy since Y".

For a move (1 and 4): regime class changed → said in plain words with its direction, no V-Dem class names: up to liberal democracy "became a full democracy (again)", up to electoral democracy "became a democracy (again)", up from closed autocracy "began holding elections, but remained an autocracy"; down from liberal to electoral democracy "lost its status as a full democracy", down to electoral autocracy "slid from democracy into autocracy", down to closed autocracy "became a dictatorship" ("again" when the country held that class before); else a fall of 25%+ of the score → "democracy score fell by a quarter / about a third / nearly half / more than half"; else a rise after a fall in the previous three years → "has won back all / most / much / some of the democratic ground it lost"; else "democracy eroded" / "became more democratic". "Under <party>" only when one coloured party held power for 60%+ of the move (its `headline` name). Years ("between Y1 and Y2") are added unless the move is recent and a party is named. Countries that take "the": United Kingdom, Netherlands.

## 7. Subtitle, footer, axis [page]

- Subtitle: what the shading shows; for move headlines the numbers ("the score went from A in Y1 to B in Y2"); a slow-trend sentence when one exists ("From Y1 to Y2, the score rose slowly by X, mainly through <driver>"); V-Dem's regime class with a one-phrase explanation (liberal democracy: free elections, plus courts, parliament and civil liberties that check the government; electoral democracy: free and fair elections, but weaker checks on the government; electoral autocracy: elections are held, but they are not free and fair; closed autocracy: no meaningful multiparty elections).
- Each year's score is plotted at 31 December; year labels sit under the middle of each year's segment. Top gridline "1.0 / most / democratic".
- "Lowest/highest since" dotted line starts where the series last crossed today's level.
- Tooltip: year, party in power, score, range, regime class, "Driven by" for the move the year belongs to.
- Small multiples: same scales and shading, sorted by the latest score; no labels or notes.
