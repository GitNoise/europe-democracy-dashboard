"""Paths and settings. Thresholds are in pipeline/config.json and described in pipeline/RULES.md."""
import json
from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = PIPELINE_DIR.parent / "web" / "public" / "data"   # where the site reads its data

CONFIG = json.loads((PIPELINE_DIR / "config.json").read_text())
T = CONFIG["thresholds"]

NOTES_FILE = PIPELINE_DIR / "notes.csv"
EXCEPTIONS_FILE = PIPELINE_DIR / "exceptions.csv"
GOVERNMENTS_FILE = DATA_DIR / "governments.csv"   # maintained by hand
SCORES_FILE = DATA_DIR / "scores.csv"             # written by the pipeline
EPISODES_FILE = DATA_DIR / "episodes.csv"         # written by the pipeline
