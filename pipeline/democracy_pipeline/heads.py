"""Heads of state with power over the cabinet or a strong veto, for the lanes under each chart (RULES.md §1, §7).

    python -m democracy_pipeline.heads --vdem V-Dem-CY-Full+Others-v16.csv

Needs v2exnamhos, v2ex_hosw and v2exdfvths_ord from the full V-Dem release. Writes web/public/data/heads_of_state.csv.
Two independent kinds of year, a year can be both: `cabinet` when V-Dem scores the head of state's power over the
cabinet at 0.5 or more (shared or more; a head of state who is also head of government scores 1), and `veto` when their
veto over laws can only be overridden by a supermajority or not at all (v2exdfvths_ord 3 or more). Whoever they are and
whatever their party. Parties come from pipeline/head_of_state_parties.csv.
"""
import argparse
import sys
from pathlib import Path

import pandas as pd

from .config import CONFIG, DATA_DIR, PIPELINE_DIR

COLUMNS = ["country_text_id", "year", "v2exnamhos", "v2ex_hosw", "v2exdfvths_ord"]
PARTIES_FILE = PIPELINE_DIR / "head_of_state_parties.csv"
OUT_FILE = DATA_DIR / "heads_of_state.csv"
MIN_POWER, MIN_VETO = 0.5, 3


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--vdem", required=True, type=Path)
    args = parser.parse_args()
    missing = [c for c in COLUMNS if c not in pd.read_csv(args.vdem, nrows=0).columns]
    if missing:
        sys.exit(f"The V-Dem file is missing columns: {missing}")
    d = pd.read_csv(args.vdem, usecols=COLUMNS, low_memory=False)
    d = d[d.country_text_id.isin(CONFIG["countries"]) & (d.year >= CONFIG["first_year"])].sort_values(["country_text_id", "year"])
    parties = pd.read_csv(PARTIES_FILE, keep_default_na=False).set_index(["id", "name"])

    rows, unknown = [], set()
    for c, g in d.groupby("country_text_id"):
        g = g.assign(year=g.year.astype(int))
        years = [(r, power) for r in g.itertuples()
                 for power, held in (("cabinet", r.v2ex_hosw >= MIN_POWER), ("veto", r.v2exdfvths_ord >= MIN_VETO)) if held]
        for r, power in years:
            name = r.v2exnamhos
            if not isinstance(name, str):
                continue
            if (c, name) not in parties.index:
                unknown.add((c, name))
                continue
            p = parties.loc[(c, name)]
            rows.append({"id": c, "year": r.year, "name": name, "short": p.short, "party": p.party, "role": p.role, "power": power})
    if unknown:
        sys.exit("No party in head_of_state_parties.csv for: " + "; ".join(f"{c} {n}" for c, n in sorted(unknown)))

    # one row per unbroken spell: same person, same kind of power, consecutive years
    y = pd.DataFrame(rows).sort_values(["id", "power", "year"], kind="stable")
    spell = ((y.id != y.id.shift()) | (y.name != y.name.shift()) | (y.power != y.power.shift())
             | (y.year != y.year.shift() + 1)).cumsum()
    out = y.groupby(spell).agg(id=("id", "first"), start=("year", "min"), end=("year", "max"),
                               name=("short", "first"), party=("party", "first"), role=("role", "first"), power=("power", "first"))
    out.to_csv(OUT_FILE, index=False)
    print(f"{len(out)} spells in {out.id.nunique()} countries → {OUT_FILE}")


if __name__ == "__main__":
    main()
