"""Rebuild the site's data from a V-Dem country-year release.

    python -m democracy_pipeline --vdem V-Dem-CY-Full+Others-v17.csv

Writes web/public/data/scores.csv and episodes.csv, and pipeline/report.md listing what needs a person.
"""
import argparse
from pathlib import Path

import pandas as pd

from . import detect, drivers, notes, report, vdem
from .config import EPISODES_FILE, GOVERNMENTS_FILE, PIPELINE_DIR, SCORES_FILE

COLUMNS = ["id", "kind", "start", "end", "change", "anchor", "mark", "note_from", "note_to", "reason", "event_year",
           "slope_before", "slope_after", "driver", "driver_share", "drivers", "source", "checked"]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--vdem", required=True, type=Path, help="V-Dem country-year CSV (the full release works)")
    args = parser.parse_args()
    previous = pd.read_csv(EPISODES_FILE, keep_default_na=False, dtype=str) if EPISODES_FILE.exists() else None

    # 1. scores
    raw = vdem.load(args.vdem)
    scores = vdem.scores_table(raw)
    scores.to_csv(SCORES_FILE, index=False)
    series = {c: g.dropna(subset=["libdem"]).set_index("year").libdem for c, g in scores.groupby("id")}
    scores_by_year = scores.set_index(["id", "year"])

    # 2. moves and what drove them
    moves = detect.detect_all(series, scores_by_year)
    moves = drivers.add_drivers(moves, series, vdem.components_table(raw))

    # 3. notes and exceptions; arrows, brackets and periods follow by rule
    log = {"moved": [], "unmatched": []}
    moves = notes.attach_notes(moves, notes.load_notes(), log)
    moves = notes.apply_exceptions(moves, notes.load_exceptions(), log)
    moves = notes.derive_presentation(moves, series, scores_by_year)

    for c in COLUMNS:
        if c not in moves:
            moves[c] = ""
    moves = moves[COLUMNS].fillna("")
    moves = moves.assign(_s=moves.start.astype(int)).sort_values(["id", "_s", "kind", "end"]).drop(columns="_s")
    moves.to_csv(EPISODES_FILE, index=False)

    # 4. checks and report
    governments = pd.read_csv(GOVERNMENTS_FILE, keep_default_na=False)
    lines = report.write(PIPELINE_DIR / "report.md", vdem_file=args.vdem.name, scores=scores, moves=moves, log=log,
                         gaps=report.government_gaps(moves, governments),
                         unnamed=report.parties_without_headline_name(governments), previous=previous)
    print("\n".join(lines[:7]))
    print(f"Wrote {SCORES_FILE.name}, {EPISODES_FILE.name} and report.md")


if __name__ == "__main__":
    main()
