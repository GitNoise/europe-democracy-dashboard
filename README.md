# Democracy in Europe, 1945–2025

Who governed during the biggest rises and falls in V-Dem's Liberal Democracy Index, for 44 European countries with a national election between 2022 and 2027.

**Live site:** https://gitnoise.github.io/europe-democracy-dashboard/ (link to a country with `#HUN`, `#TUR`, …)

Each chart shows one country's score since 1945. Shaded bands mark the governing parties during big moves, and short notes explain what happened. Headlines are written by rule from the data. Below the chart, every country is shown on the same scales.

## How it is organised

```
web/                 the site (Svelte + Vite + d3)
  public/data/       the data the site reads
    scores.csv         V-Dem scores, uncertainty, regime class, election years      ← pipeline
    episodes.csv       every detected move, its drivers, notes, arrows and brackets   ← pipeline
    governments.csv    governing parties, colours, headline names                    ← maintained by hand
    flags.json         country flags (flag-icons)
  src/lib/           the drawing rules: shading, labels, notes, headlines (plain JavaScript)
  src/components/    the page: header, chart, small multiples (Svelte)
pipeline/            rebuilds the data from a new V-Dem release (Python)
  democracy_pipeline/  vdem.py · detect.py · drivers.py · notes.py · report.py
  config.json          countries and every threshold
  notes.csv            the notes: text, optional event year, source, checked
  exceptions.csv       explicit exceptions to the rules, each with a reason
  RULES.md             every rule, in the pipeline and in the site
```

The site only draws; every rule is documented in [`pipeline/RULES.md`](pipeline/RULES.md).

## Run the site locally

```sh
cd web
npm install
npm run dev
```

## Publish on GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and publishes the site on every push to `main`.
Once, in the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Update for a new V-Dem release

1. Download V-Dem's country-year CSV from https://www.v-dem.net/data/.
2. Install and run the pipeline:
   ```sh
   cd pipeline
   pip install -r requirements.txt
   python -m democracy_pipeline --vdem path/to/V-Dem-CY-Full+Others-v17.csv
   ```
   This rewrites `web/public/data/scores.csv` and `episodes.csv` and writes `pipeline/report.md`.
3. Work through `report.md`:
   - **Rises and falls without a note.** Research them, then add a row to `notes.csv` with `reason`, an `event_year` if the note names an event, and a `source`.
   - **Notes whose move shifted.** Check the note still fits.
   - **Years with no government.** Add the governments to `web/public/data/governments.csv`.
4. Run the pipeline again until the report is clean, then commit. The site redeploys itself.

On V-Dem v16, the pipeline reproduces the published data exactly.

## Sources and credits

- **Scores:** V-Dem Institute, *Varieties of Democracy* dataset v16 (Coppedge et al.). Please cite V-Dem when reusing the data; see https://www.v-dem.net for its terms.
- **Episodes method:** after V-Dem's *Episodes of Regime Transformation* (Maerz et al.).
- **Governments, notes and headline names:** compiled from public records. Each note has a `source` column; notes marked `checked = yes` have been verified.
- **Party colours:** party Wikipedia infoboxes, partly via the [partycoloR](https://github.com/lwarode/partycoloR) dataset.
- **Flags:** [flag-icons](https://github.com/lipis/flag-icons) (MIT).
- **Arrows:** after Bloomberg Businessweek's [swoopyarrows](https://github.com/bizweekgraphics/swoopyarrows) (public domain).
- **Trend changes:** [ruptures](https://github.com/deepcharles/ruptures) (PELT).

Code: MIT licence (see `LICENSE`).
