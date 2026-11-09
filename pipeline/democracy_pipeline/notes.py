"""Notes (the only hand-written content) and the rules that turn them into arrows and brackets (RULES.md §5)."""
import pandas as pd

from .config import EXCEPTIONS_FILE, NOTES_FILE, T
from .detect import sharpest_year


def load_notes():
    return pd.read_csv(NOTES_FILE, keep_default_na=False, dtype=str)


def load_exceptions():
    return pd.read_csv(EXCEPTIONS_FILE, keep_default_na=False, dtype=str)


NOTE_COLS = ['reason', 'event_year', 'source', 'source_title', 'wikidata', 'checked']


def attach_notes(ep, notes, log):
    """Attach each note to its move. If a new release shifted the move's years, attach it to the overlapping move
    of the same kind (containing the event year, when there is one) and report it."""
    ep = ep.copy()
    for c in NOTE_COLS: ep[c] = ''
    for o in notes.itertuples(index=False):
        k = (ep.id == o.id) & (ep.kind == o.kind) & (ep.start == int(o.start)) & (ep.end == int(o.end))
        how = 'exact'
        if not k.any():
            k = (ep.id == o.id) & (ep.kind == o.kind) & (ep.start <= int(o.end)) & (ep.end >= int(o.start))
            if o.event_year: k &= (ep.start <= int(o.event_year)) & (ep.end >= int(o.event_year))
            how = 'moved'
        hits = ep.index[k]
        if len(hits) != 1:
            log['unmatched'].append(f'{o.id} {o.kind} {o.start}–{o.end}: {o.reason}'); continue
        if how == 'moved':
            r = ep.loc[hits[0]]; log['moved'].append(f'{o.id} {o.kind} {o.start}–{o.end} → {r.start}–{r.end}: {o.reason}')
        for c in NOTE_COLS: ep.at[hits[0], c] = getattr(o, c)
    return ep


def apply_exceptions(ep, ex, log):
    drop = []
    for o in ex.itertuples(index=False):
        k = (ep.id == o.id) & (ep.kind == o.kind) & (ep.start == int(o.start)) & (ep.end == int(o.end))
        if not k.any(): log['unmatched'].append(f'exception {o.id} {o.kind} {o.start}–{o.end} ({o.why})'); continue
        if o.action == 'drop': drop += list(ep.index[k])
    return ep.drop(index=drop)


def sharp_period(s, a, b, chg):
    """A sharp dip or spike: the move bottoms (or peaks) within three years and recovers half within four.
    Returns the bracket period (start of the sharp move, year of recovery) or None."""
    fall = chg < 0
    yrs = [y for y in range(a, b + 1) if y in s.index]
    ext = min(yrs, key=lambda y: s[y]) if fall else max(yrs, key=lambda y: s[y])
    pre = ext
    while pre - 1 in s.index and pre - 1 >= a and ((s[pre - 1] - s[pre]) if fall else (s[pre] - s[pre - 1])) >= 0.01: pre -= 1
    size = abs(s[pre] - s[ext])
    for y in range(ext + 1, ext + 5):
        if y in s.index and ((s[y] - s[ext]) if fall else (s[ext] - s[y])) >= 0.5 * size:
            return (pre, y) if ext - pre <= 3 and size >= T['sharp_min'] else None
    return None


def derive_presentation(ep, S, SC):
    """Arrow or bracket, arrow year and bracket period for every note, by rule:
       rise/fall: event year → arrow on it; else a sharp dip/spike → bracket over it (not inside another bracket);
                  else longer than five years with no year carrying half → bracket (high to low on the page);
                  else arrow on the sharpest year.
       jump: arrow on its event year (or its year). dip/spike: shown as an arrow only if it clears V-Dem's
       uncertainty against the shoulder of its larger leg."""
    ep = ep.copy()
    for c in ['mark', 'note_from', 'note_to']: ep[c] = ''
    for cid in ep.id.unique():
        s = S[cid]; spans = []
        rows = ep[(ep.id == cid) & (ep.reason != '')].sort_values('start')
        for i, r in rows.iterrows():
            a, b, k = int(r.start), int(r.end), r.kind
            if k in ('rise', 'fall'):
                if r.event_year: ep.at[i, 'mark'], ep.at[i, 'anchor'] = 'arrow', int(r.event_year); continue
                per = sharp_period(s, a, b, float(r.change))
                if per and not any(x <= a < y for x, y in spans):
                    ep.at[i, 'mark'], ep.at[i, 'note_from'], ep.at[i, 'note_to'] = 'bracket', str(per[0]), str(per[1]); spans.append(per); continue
                d = [abs(s[y] - s[y - 1]) for y in range(a + 1, b + 1) if y in s.index and y - 1 in s.index]
                if b - a > 5 and max(d) / abs(float(r.change)) < 0.5: ep.at[i, 'mark'] = 'bracket'; continue
                ep.at[i, 'mark'], ep.at[i, 'anchor'] = 'arrow', sharpest_year(s, a, b)
            elif k == 'jump':
                ep.at[i, 'mark'], ep.at[i, 'anchor'] = 'arrow', int(r.event_year) if r.event_year else b
            elif k in ('dip', 'spike'):
                w = s.loc[a - T['leg_years']:a + T['leg_years']]; dip = k == 'dip'
                l = w.loc[:a].idxmax() if dip else w.loc[:a].idxmin(); rr = w.loc[a:].idxmax() if dip else w.loc[a:].idxmin()
                sh = l if abs(s[l] - s[a]) >= abs(s[rr] - s[a]) else rr
                A, B = SC.loc[(cid, a)], SC.loc[(cid, sh)]
                clear = (A.libdem_high < B.libdem_low) if dip else (A.libdem_low > B.libdem_high)
                if clear: ep.at[i, 'mark'], ep.at[i, 'anchor'] = 'arrow', int(r.event_year) if r.event_year else a
    return ep
