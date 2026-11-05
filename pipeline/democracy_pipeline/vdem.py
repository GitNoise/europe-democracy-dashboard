"""Reading V-Dem's country-year CSV and building the scores table the site uses."""
import sys

import pandas as pd

from .config import CONFIG

# V-Dem's eight components of the Liberal Democracy Index, used to explain what drove each move
COMPONENTS = {
    "v2x_elecoff": "Elected officials",
    "v2xel_frefair": "Clean elections",
    "v2x_frassoc_thick": "Freedom of association",
    "v2x_suffr": "Suffrage",
    "v2x_freexp_altinf": "Freedom of expression",
    "v2xcl_rol": "Rule of law and civil liberties",
    "v2x_jucon": "Judicial constraints",
    "v2xlg_legcon": "Legislative constraints",
}
NEEDED = ["country_text_id", "country_name", "year", "v2x_libdem", "v2x_libdem_codelow", "v2x_libdem_codehigh",
          "v2x_regime", "v2xel_elecparl", "v2xel_elecpres", "v2x_polyarchy", "v2x_liberal", *COMPONENTS]


def load(path):
    """The rows of the V-Dem file for the configured countries and years, with only the columns we use."""
    missing = [c for c in NEEDED if c not in pd.read_csv(path, nrows=0).columns]
    if missing:
        sys.exit(f"The V-Dem file is missing columns: {missing}")
    d = pd.read_csv(path, usecols=NEEDED, low_memory=False)
    d = d[d.country_text_id.isin(CONFIG["countries"]) & (d.year >= CONFIG["first_year"])].copy()
    d["year"] = d.year.astype(int)
    return d


def scores_table(d):
    """One row per country-year: score with its low/high estimate, regime class (0–3), national election year."""
    return pd.DataFrame({
        "id": d.country_text_id,
        "country": d.country_name,
        "year": d.year,
        "libdem": d.v2x_libdem.round(4),
        "regime": d.v2x_regime,
        "election": ((d.v2xel_elecparl == 1) | (d.v2xel_elecpres == 1)).astype(int),
        "libdem_low": d.v2x_libdem_codelow.round(4),
        "libdem_high": d.v2x_libdem_codehigh.round(4),
    }).sort_values(["id", "year"])


def components_table(d):
    """The index, its two halves and its eight components, indexed by (country, year)."""
    cols = ["v2x_libdem", "v2x_polyarchy", "v2x_liberal", *COMPONENTS]
    return d.rename(columns={"country_text_id": "id"}).set_index(["id", "year"])[cols]
