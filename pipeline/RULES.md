# Rules for the European democracy dashboard

Every rule that turns V-Dem data into a chart. Rules marked **[build]** are applied by the pipeline (`pipeline/democracy_pipeline/`); rules marked **[page]** by the site when it draws (`web/src/lib/`). Numbers in `code` are set in `config.json`.

## 1. Data [build]

- Source: V-Dem country-year dataset. Countries: `countries` in `config.json` (all European countries in V-Dem, incl. Türkiye, Cyprus and the South Caucasus). Years from `first_year` (1945) to the last year in the release.
- Per country-year: Liberal Democracy Index (`v2x_libdem`) with its low and high estimates (`_codelow`, `_codehigh`, ±1 standard deviation), Regimes of the World class (`v2x_regime`: 0 closed autocracy, 1 electoral autocracy, 2 electoral democracy, 3 liberal democracy), national election year (`v2xel_elecparl` or `v2xel_elecpres` = 1).
- Governments (`web/public/data/governments.csv`): every government since 1945 (from ParlGov and Wikipedia's lists of heads of government), with party code, full name, colour, headline name, start and end date, its `parties` (leading party first, joined with `+`) and an optional `kind` for governments not led by one party (provisional, caretaker, technocratic, unity, collegial, power-sharing). Coalition partners' colours are in `party_colours.csv`.
- Heads of state (`web/public/data/heads_of_state.csv`, written by `python -m democracy_pipeline.heads --vdem <full V-Dem CSV>`): V-Dem's head of state on 31 December of each year (`v2exnamhos`), in two kinds of year. **Cabinet**: V-Dem scores their power over the appointment and dismissal of cabinet ministers at 0.5 or more (`v2ex_hosw`: 0.5 = shared equally with the head of government, 1 = more; a head of state who is also head of government scores 1, e.g. Türkiye's president since 2018). **Veto**: years where their veto over laws can only be overridden by a supermajority or not at all (`v2exdfvths_ord` 3 or more), e.g. Poland's presidents since 1992. The two are independent: a year can be both (Russia, Finland until 1986), and then shows in both lanes. Every such year is drawn, whoever holds the office (a president, a monarch, a junta leader, a colonial governor) and whatever their party, the same party as the government or not. Party (the one they belong to or ran for), display name and role are in `pipeline/head_of_state_parties.csv`, kept by hand; the step stops if a name is missing.

## 2. Detection [build]

All on the Liberal Democracy Index, one series per country.

| Kind | Rule |
|---|---|
| **rise / fall** (episode) | V-Dem's Episodes of Regime Transformation thresholds: starts with a yearly move of `ep_start` (0.01) in one direction; continues while the score keeps moving that way; ends at the peak/trough when it reverses by `ep_turn` (0.03) in a year, gives back `ep_cum` (0.10) in total, or stalls for `ep_stasis` (5) years. Counts if the total change is at least `ep_cum` (0.10). |
| **swing** | Any `swing_window` (3) years whose yearly changes add up (both directions) to `swing_sum` (0.15) or more. |
| **jump** | Any single year that moves `jump` (0.05) or more. A jump under `band_min` gets no band; if it lies outside every band and the score moves at most `step_flat` (0.02) in the `step_window` (2) years on each side, it reads as a **step** and is listed in the build report until it has a note, or an exception with action `no_note` saying why none fits. |
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
7. Colour: the party's colour; a coalition takes its leading party's colour; grey for governments with a `kind` (provisional, caretaker, technocratic, unity, collegial, power-sharing), juntas and parties without a confirmed colour.

## 4. Party labels [page]

- One label per band; a party's separate terms get separate labels, touching terms are one band and one label.
- Two lines: party code (bold, in party colour) over its **real unbroken time in power** ("since 2002", "1965–71"), even when the band is shorter.
- Centred on the band when the label fits inside it; otherwise starts at the band's left edge.
- Placed left to right in as few rows as possible; a label may slide right while it still sits over its band before moving up a row.

## 5. Notes (annotations) [content in `notes.csv`; arrow/bracket by rule [build]; placement [page]]

- A note is content: `reason` (short, one topic, no years, neutral verbs), an optional `event_year` (the year of the event it names), `source`, `source_title`, `wikidata` and `checked`. Nothing else about a note is set by hand.
- Shown for rises, falls and jumps with a note, and for dips/spikes with a note that clear V-Dem's uncertainty against the shoulder of their larger leg.
- **Arrow or bracket, by rule [build]**, for a rise or fall with a note, in this order:
  1. it has an `event_year` → **arrow** pointing at that year;
  2. it is a sharp dip or spike (bottoms or peaks within three years, the sharp part at least `sharp_min` (0.08), recovers half within four years) and isn't inside an earlier bracket → **bracket** over that period (e.g. Türkiye's military interventions);
  3. it lasts more than five years and no single year carries half of it → **bracket** (drawn from the move's high to its low, or low to high);
  4. otherwise → **arrow** on the year of the sharpest move.
  Jumps: arrow on the event year (or the jump's year). Dips/spikes: arrow on their year.
- On the page an arrow points at the middle of its year's segment, landing square to the line. Dip brackets go below the V first, everything else above; brackets may sit far from the line.
- Placement: about 130 candidate spots per note (11 distances × 4 sides × 3 wrap widths), open side of the move first (above-left / below-right of a rise, above-right / below-left of a fall); cost = distance + side + narrower wrap + arrow length. Biggest moves pick first; then up to four repair passes (move to a cheaper spot; a missing note may move the one note blocking it). Never overlapping text, arrows crossing each other or any text, or notes on the same side out of their points' left-to-right order. A note that can't be placed is left out (smallest moves first).

### Sources (every note has one)

1. **Event notes** (a coup, election, revolution, new constitution or law, end of communist rule, independence, EU accession, referendum): `source` is the English Wikipedia article as a permanent revision link (`https://en.wikipedia.org/w/index.php?title=…&oldid=…`), `wikidata` the event's Wikidata QID when one exists. The `event_year` must match the date on Wikidata or Wikipedia; a liberation or other event that happened before the year the arrow would point at gets no `event_year`.
2. **Interpretive notes** (a judgment on how a country was governed, e.g. "Erdoğan consolidates power", "Disputed elections and crackdowns"): a primary or expert source first, covering the years of the move — V-Dem Democracy Report, Freedom House (Freedom in the World or Nations in Transit), OSCE/ODIHR election observation reports, Venice Commission opinions, the European Commission's Rule of Law or enlargement reports, or Bertelsmann BTI. Wikipedia (rule 1 form) only when none of these covers it.
3. A note says no more than its source. If no source supports a note as written, it is reworded to what the source says, or listed for review; an unsupported claim is not kept.
4. `source_title` is a short label for the source ("Wikipedia: Velvet Revolution", "Freedom House, Nations in Transit 2018: Moldova"). `checked` is the date (YYYY-MM-DD) the source was last opened and read against the note.
5. Sources live in the data, not on the chart: the page shows no note numbers or source list, and the "How this works" section links to `notes.csv`.
6. **Checked by the pipeline** (`report.source_problems`, listed in `report.md` under "Notes whose source breaks the rules"): every note has a source; it is an https link on a domain listed in `config.json` → `sources.domains` (a domain matches its subdomains); a Wikipedia link is a fixed revision (`oldid=`); `source_title` is filled; `wikidata`, when given, is a Q-id; `checked` is a date no older than `sources.recheck_days` (730). Rules 1–3 (which kind of source, and that the note says no more than it) need a person.

## 6. Headline [page]

Order of preference: a big move in the last ten years if there is one, else what is true today, else history.
1. Most recent rise or fall ending in the last ten years (2015 or later for 2025 data) that still holds, from its high to its low. A move still holds when less than half of it has been undone since and today's regime class hasn't gone back past the one it ended in. A move told by its size takes its record (3) in the same direction: "…, to its lowest level since Y" (or "…, and is now at its lowest level since Y" when the move ended before the latest year).
2. "less / more democratic today than at any time since Y" (today's level last seen at least ten years earlier; scores within 0.01 of today count as the same level; with no earlier year clearly lower, Y is the first year of data), or "has never been more democratic" (strict). Only when it is news: today at least 0.05 below (or above) the country's highest (or lowest) score since 2010.
3. "is among Europe's three most / least democratic countries" (rank by latest score; not an exact rank, as V-Dem's uncertainty ranges overlap).
4. A slow trend still running in the last ten years.
5. "is among Europe's ten most democratic countries" (old history is not news for a country near the top today).
6. The most recent rise or fall at any time that still holds.
7. Else the latest rise or fall, with "but has since slipped back" (or "recovered").
8. "has been a stable democracy / autocracy since Y" (no big move at all).

For a move (1, 6 and 7): regime class changed → said in plain words with its direction, no V-Dem class names: up to liberal democracy "became a full democracy (again)", up to electoral democracy "became a democracy (again)", up from closed autocracy "began holding elections, but remained an autocracy"; down from liberal to electoral democracy "lost its status as a full democracy", down to electoral autocracy "slid from democracy into autocracy", down to closed autocracy "became a dictatorship" ("again" when the country held that class before); else a recent rise after a fall in the previous three years → "has won back all / most / much / some of the democratic ground it lost"; else a change of 15%+ of the score → "democracy score fell / rose by a sixth / a fifth / a quarter / about a third / nearly half / more than half" (a rise of 100%+ "nearly / more than doubled"); else "democracy eroded" / "became more democratic". "Under <party>" only when one coloured party held power for 60%+ of the move (its `headline` name). Years ("between Y1 and Y2") are added unless the move ended in the last ten years and a party is named. Countries that take "the": United Kingdom, Netherlands.

## 7. Subtitle, footer, axis [page]

- Subtitle: what the shading shows; for move headlines the numbers ("the score went from A in Y1 to B in Y2"); a slow-trend sentence when one exists ("From Y1 to Y2, the score rose slowly by X, mainly through <driver>"); V-Dem's regime class with a one-phrase explanation (liberal democracy: free elections, plus courts, parliament and civil liberties that check the government; electoral democracy: free and fair elections, but weaker checks on the government; electoral autocracy: elections are held, but they are not free and fair; closed autocracy: no meaningful multiparty elections).
- Each year's score is plotted at 31 December; year labels sit under the middle of each year's segment. Top gridline "1.0 / most / democratic". Every chart runs the full scale, 0 to 1.
- "Government" strip under the years: every government in its party colour; a coalition is stacked stripes, the leading party on top (60% of the height) and partners sharing the rest; grey where a colour is unknown.
- End of the line: the latest score, with V-Dem's regime class for that year in two short lines under it (over it when the score is under 0.15). The class is coloured the same here and in the subtitle: blues for democracies, reds for autocracies, as in V-Dem's Democracy Report (`--regime-0` to `--regime-3` in app.css, text contrast 4.5:1 or more in light and dark). The classes are not bands of the index (Italy 0.64 is a liberal democracy, Portugal 0.72 an electoral democracy), so they are never drawn as ranges on the score axis.
- Head-of-state lanes under the strip, each only for countries that have it, under one "Head of state" label on the left; each lane names its kind at its right end with a footnote number ("cabinet¹", "veto²", numbered in that order among the lanes the country has); the footnotes, under the source line, explain each lane in plain words and that in other years the role is ceremonial. A thin bar with rounded ends for each term (so a person reads apart from the government's band), in the party colour, with a small gap between terms; nothing in the years the role is ceremonial. The cabinet lane can repeat the strip where the president is the ruler (Putin, Lukashenko); that is kept so the lane always means the same thing. The tooltip adds "Head of state: <name> (<party>)", with ", veto over laws" (or ", plus a veto over laws" when they hold both powers).
- Note under each chart: source and a one-line key to the shading, the strip and (only where the lane is drawn) why the head of state shows in some years and not others, linking to the "How this works" section, which explains the method in plain words.
- "Lowest/highest since" dotted line starts where the series last crossed today's level.
- Tooltip (on hover anywhere from the plot down through the government strip and head-of-state lane): year, score and its change, regime class, the government in power (a coalition lists its parties with their colours, leading party first), and the move the year belongs to.
- Small multiples: same scales and shading, sorted by the latest score; no labels or notes.
