"""Checks after a build, and the report listing what needs a person."""
import re
from datetime import date
from urllib.parse import urlparse

import pandas as pd

from .config import CONFIG, T
from .detect import core_span


def banded(moves):
    """Moves that get a band: rises, falls, swings, and jumps of band_min or more."""
    big = moves.change.astype(float).abs() >= T["band_min"]
    return moves[moves.kind.isin(["rise", "fall", "swing"]) | ((moves.kind == "jump") & big)]


def move_line(m):
    return f"{m.id} {m.kind} {m.start}–{m.end} ({float(m.change):+.2f}; driven by {m.drivers or '—'}"


def government_gaps(moves, governments):
    """Years inside a shaded move that no government covers (a new data year inside a move shows up here)."""
    g = governments.assign(s=pd.to_datetime(governments.start), e=pd.to_datetime(governments.end))
    gaps = []
    for m in banded(moves).itertuples():
        for year in range(int(m.start) + 1, int(m.end) + 1):
            mid = pd.Timestamp(year, 7, 1)
            if g[(g.id == m.id) & (g.s <= mid) & (g.e > mid)].empty:
                gaps.append(f"{m.id} {year} ({m.kind} {m.start}–{m.end})")
    return gaps


def steps_without_note(moves, series, scores, exceptions):
    """Jumps under band_min that stand out as steps: outside every band, flat for step_window years on each side
    (range at most step_flat; a side with no data counts as flat), and with no note or `no_note` exception."""
    bands = banded(moves)
    shaded = {}
    for m in bands.itertuples():
        a, b, chg = int(m.start), int(m.end), float(m.change)
        if m.kind in ("rise", "fall"):
            a, b = core_span(series[m.id], a, b, chg)
        shaded.setdefault(m.id, set()).update(range(a + 1, b + 1))
    skip = {(o.id, int(o.start), int(o.end)) for o in exceptions.itertuples() if o.kind == "jump" and o.action == "no_note"}
    w, flat = T["step_window"], T["step_flat"]
    out = []
    jumps = moves[(moves.kind == "jump") & (moves.reason == "")].drop(index=bands.index, errors="ignore")
    for m in jumps.itertuples():
        a, b, chg, s = int(m.start), int(m.end), float(m.change), series[m.id]
        if b in shaded.get(m.id, ()) or (m.id, a, b) in skip:
            continue
        if any(x.max() - x.min() > flat for x in (s.loc[a - w:a], s.loc[b:b + w])):
            continue
        lo, hi = scores.loc[(m.id, a)], scores.loc[(m.id, b)]
        clears = hi.libdem_low > lo.libdem_high if chg > 0 else hi.libdem_high < lo.libdem_low
        out.append(f"{move_line(m)}; {'clears' if clears else 'within'} V-Dem's uncertainty)")
    return out


def parties_without_headline_name(governments):
    missing = governments[(governments.colour != "") & (governments.headline == "")].drop_duplicates(["id", "party"])
    return [f"{r.id} {r.party}" for r in missing.itertuples()]


def source_problems(notes, today):
    """Notes that break the source rules (RULES.md §5, Sources): every note needs a source from a listed domain, a
    permanent link when it is Wikipedia, a short title, a well-formed Wikidata id when it has one, and a `checked`
    date no older than `recheck_days`."""
    rules = CONFIG["sources"]
    out = []
    for n in notes.itertuples():
        what = f"{n.id} {n.kind} {n.start}–{n.end} “{n.reason}”"
        host = urlparse(n.source).hostname or ""
        if not n.source:
            out.append(f"{what}: no source"); continue
        if not n.source.startswith("https://"):
            out.append(f"{what}: source is not an https link")
        elif not any(host == d or host.endswith("." + d) for d in rules["domains"]):
            out.append(f"{what}: {host} is not on the list of source domains in config.json")
        if host.endswith("wikipedia.org") and "oldid=" not in n.source:
            out.append(f"{what}: Wikipedia link is not a fixed revision (oldid)")
        if not n.source_title:
            out.append(f"{what}: no source_title")
        if n.wikidata and not re.fullmatch(r"Q\d+", n.wikidata):
            out.append(f"{what}: wikidata “{n.wikidata}” is not a Q-id")
        try:
            age = (today - date.fromisoformat(n.checked)).days
            if age > rules["recheck_days"]:
                out.append(f"{what}: checked {n.checked}, more than {rules['recheck_days']} days ago — read the source again")
        except ValueError:
            out.append(f"{what}: `checked` is not a date (YYYY-MM-DD)")
    return out


def write(path, *, vdem_file, scores, moves, log, gaps, unnamed, steps, sources, previous=None):
    rises_falls = moves[moves.kind.isin(["rise", "fall"])]
    unexplained = rises_falls[rises_falls.reason == ""]
    section = lambda title, items: [f"## {title} ({len(items)})", "", *[f"- {i}" for i in items], ""]
    lines = [
        "# Build report", "",
        f"V-Dem file: `{vdem_file}` · {scores.id.nunique()} countries · {scores.year.min()}–{scores.year.max()}", "",
        "## Detected", "", ", ".join(f"{k}: {v}" for k, v in moves.kind.value_counts().items()), "",
        *section("Rises and falls without a note — research them, add to notes.csv",
                 [move_line(m) + ")" for m in unexplained.itertuples()]),
        *section("Steps between flat years without a note — research them, add to notes.csv "
                 "(or a `no_note` exception in exceptions.csv)", steps),
        *section("Notes whose move shifted with the new data — check they still fit", log["moved"]),
        *section("Notes or exceptions that no longer match any move — edit notes.csv / exceptions.csv", log["unmatched"]),
        *section("Years in a shaded move with no government — add to governments.csv", gaps),
        *section("Coloured parties without a headline name — fill `headline` in governments.csv", unnamed),
        *section("Notes whose source breaks the rules — fix notes.csv", sources),
    ]
    if previous is not None:
        key = lambda df: set(zip(df.id, df.kind, df.start.astype(str), df.end.astype(str)))
        before = key(previous[previous.kind.isin(["rise", "fall"])])
        now = key(rises_falls.astype(str))
        lines += [*section("New rises and falls since the previous data", [" ".join(k) for k in sorted(now - before)]),
                  *section("Rises and falls gone since the previous data", [" ".join(k) for k in sorted(before - now)])]
    path.write_text("\n".join(lines))
    return lines
