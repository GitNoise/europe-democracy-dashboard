"""Checks after a build, and the report listing what needs a person."""
import pandas as pd

from .config import T
from .detect import core_span


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


def steps_without_note(moves, series, scores, exceptions):
    """Jumps under band_min that stand out as steps: outside every band, flat for step_window years on each side
    (range at most step_flat; a side with no data counts as flat), and with no note or `no_note` exception."""
    change = moves.change.astype(float)
    shaded = {}
    for m in moves.itertuples():
        c = abs(float(m.change))
        if m.kind in ("rise", "fall"):
            a, b = core_span(series[m.id], int(m.start), int(m.end), float(m.change))
        elif m.kind == "swing" or (m.kind == "jump" and c >= T["band_min"]):
            a, b = int(m.start), int(m.end)
        else:
            continue
        shaded.setdefault(m.id, set()).update(range(a + 1, b + 1))
    skip = {(o.id, int(o.start), int(o.end)) for o in exceptions.itertuples() if o.kind == "jump" and o.action == "no_note"}
    w, flat = T["step_window"], T["step_flat"]
    out = []
    for m in moves[(moves.kind == "jump") & (change.abs() < T["band_min"]) & (moves.reason == "")].itertuples():
        a, b, s = int(m.start), int(m.end), series[m.id]
        if b in shaded.get(m.id, ()) or (m.id, a, b) in skip:
            continue
        before, after = s[(s.index >= a - w) & (s.index <= a)], s[(s.index >= b) & (s.index <= b + w)]
        if before.max() - before.min() > flat or after.max() - after.min() > flat:
            continue
        lo, hi = scores.loc[(m.id, a)], scores.loc[(m.id, b)]
        clears = hi.libdem_low > lo.libdem_high if float(m.change) > 0 else hi.libdem_high < lo.libdem_low
        out.append(f"{m.id} jump {a}–{b} ({float(m.change):+.2f}; driven by {m.drivers or '—'}; "
                   f"{'clears' if clears else 'within'} V-Dem's uncertainty)")
    return out


def parties_without_headline_name(governments):
    missing = governments[(governments.colour != "") & (governments.headline == "")].drop_duplicates(["id", "party"])
    return [f"{r.id} {r.party}" for r in missing.itertuples()]


def write(path, *, vdem_file, scores, moves, log, gaps, unnamed, steps, previous=None):
    rises_falls = moves[moves.kind.isin(["rise", "fall"])]
    unexplained = rises_falls[rises_falls.reason == ""]
    section = lambda title, items: [f"## {title} ({len(items)})", "", *[f"- {i}" for i in items], ""]
    lines = [
        "# Build report", "",
        f"V-Dem file: `{vdem_file}` · {scores.id.nunique()} countries · {scores.year.min()}–{scores.year.max()}", "",
        "## Detected", "", ", ".join(f"{k}: {v}" for k, v in moves.kind.value_counts().items()), "",
        *section("Rises and falls without a note — research them, add to notes.csv",
                 [f"{m.id} {m.kind} {m.start}–{m.end} ({float(m.change):+.2f}; driven by {m.drivers or '—'})" for m in unexplained.itertuples()]),
        *section("Steps between flat years without a note — research them, add to notes.csv "
                 "(or a `no_note` exception in exceptions.csv)", steps),
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
