"""Checks after a build, and the report listing what needs a person."""
import pandas as pd

from .config import T


def government_gaps(moves, governments):
    """Years inside a shaded move that no government covers (a new data year inside a move shows up here)."""
    g = governments.assign(s=pd.to_datetime(governments.start), e=pd.to_datetime(governments.end))
    change = moves.change.astype(float).abs()
    shaded = moves[moves.kind.isin(["rise", "fall", "swing"]) | ((moves.kind == "jump") & (change >= T["band_min"]))]
    gaps = []
    for m in shaded.itertuples():
        for year in range(int(m.start) + 1, int(m.end) + 1):
            mid = pd.Timestamp(year, 7, 1)
            if g[(g.id == m.id) & (g.s <= mid) & (g.e > mid)].empty:
                gaps.append(f"{m.id} {year} ({m.kind} {m.start}–{m.end})")
    return gaps


def parties_without_headline_name(governments):
    missing = governments[(governments.colour != "") & (governments.headline == "")].drop_duplicates(["id", "party"])
    return [f"{r.id} {r.party}" for r in missing.itertuples()]


def write(path, *, vdem_file, scores, moves, log, gaps, unnamed, previous=None):
    rises_falls = moves[moves.kind.isin(["rise", "fall"])]
    unexplained = rises_falls[rises_falls.reason == ""]
    section = lambda title, items: [f"## {title} ({len(items)})", "", *[f"- {i}" for i in items], ""]
    lines = [
        "# Build report", "",
        f"V-Dem file: `{vdem_file}` · {scores.id.nunique()} countries · {scores.year.min()}–{scores.year.max()}", "",
        "## Detected", "", ", ".join(f"{k}: {v}" for k, v in moves.kind.value_counts().items()), "",
        *section("Rises and falls without a note — research them, add to notes.csv",
                 [f"{m.id} {m.kind} {m.start}–{m.end} ({float(m.change):+.2f}; driven by {m.drivers or '—'})" for m in unexplained.itertuples()]),
        *section("Notes whose move shifted with the new data — check they still fit", log["moved"]),
        *section("Notes or exceptions that no longer match any move — edit notes.csv / exceptions.csv", log["unmatched"]),
        *section("Years in a shaded move with no government — add to governments.csv", gaps),
        *section("Coloured parties without a headline name — fill `headline` in governments.csv", unnamed),
    ]
    if previous is not None:
        key = lambda df: set(zip(df.id, df.kind, df.start.astype(str), df.end.astype(str)))
        before = key(previous[previous.kind.isin(["rise", "fall"])])
        now = key(rises_falls.astype(str))
        lines += [*section("New rises and falls since the previous data", [" ".join(k) for k in sorted(now - before)]),
                  *section("Rises and falls gone since the previous data", [" ".join(k) for k in sorted(before - now)])]
    path.write_text("\n".join(lines))
    return lines
