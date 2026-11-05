"""What drove each move: the share of a change carried by each of V-Dem's eight components (RULES.md §2).

The Liberal Democracy Index is 0.25·E^1.585 + 0.25·L + 0.5·E^1.585·L, where E is the electoral component
(itself a formula of five parts) and L the liberal component (three parts, combined by V-Dem's statistical model).
The change is split between E and L, and E among its parts, with Shapley values; L is split among its parts in
proportion to their change. Shares are rescaled to the real change.
"""
import math
from itertools import combinations

import numpy as np

from .config import T
from .detect import core_span
from .vdem import COMPONENTS

ELECTORAL = ["v2x_elecoff", "v2xel_frefair", "v2x_frassoc_thick", "v2x_suffr", "v2x_freexp_altinf"]
LIBERAL = ["v2xcl_rol", "v2x_jucon", "v2xlg_legcon"]


def liberal_democracy(e, l):
    return 0.25 * e ** 1.585 + 0.25 * l + 0.5 * e ** 1.585 * l


def electoral_democracy(x):
    """V-Dem's polyarchy formula: half multiplicative, half additive over its five parts."""
    multiplicative = np.prod([x[k] for k in ELECTORAL])
    additive = x["v2x_elecoff"] / 8 + x["v2xel_frefair"] / 4 + x["v2x_frassoc_thick"] / 4 + x["v2x_suffr"] / 8 + x["v2x_freexp_altinf"] / 4
    return 0.5 * multiplicative + 0.5 * additive


def shapley(f, before, after, keys):
    """Each key's average contribution to f(after) − f(before), over every order of switching keys on."""
    n, out = len(keys), dict.fromkeys(keys, 0.0)
    for k in keys:
        others = [o for o in keys if o != k]
        for size in range(n):
            weight = math.factorial(size) * math.factorial(n - size - 1) / math.factorial(n)
            for switched in combinations(others, size):
                x = {o: after[o] if o in switched else before[o] for o in keys}
                out[k] += weight * (f({**x, k: after[k]}) - f({**x, k: before[k]}))
    return out


def attribute(components, country, y0, y1):
    """The three components carrying most of the change from y0 to y1: [(label, share)], or None."""
    try:
        a, b = components.loc[(country, y0)], components.loc[(country, y1)]
    except KeyError:
        return None
    if a.isna().any() or b.isna().any():
        return None
    total = b.v2x_libdem - a.v2x_libdem
    if abs(total) < 1e-6:
        return None

    halves = shapley(lambda x: liberal_democracy(x["E"], x["L"]),
                     {"E": a.v2x_polyarchy, "L": a.v2x_liberal}, {"E": b.v2x_polyarchy, "L": b.v2x_liberal}, ["E", "L"])
    scale = total / (halves["E"] + halves["L"]) if abs(halves["E"] + halves["L"]) > 1e-9 else 0
    e_part, l_part = halves["E"] * scale, halves["L"] * scale

    contrib = {}
    e_split = shapley(electoral_democracy, a[ELECTORAL], b[ELECTORAL], ELECTORAL)
    e_total = sum(e_split.values())
    for k in ELECTORAL:
        contrib[k] = e_part * e_split[k] / e_total if abs(e_total) > 1e-9 else e_part / len(ELECTORAL)
    l_changes = {k: b[k] - a[k] for k in LIBERAL}
    l_total = sum(l_changes.values())
    for k in LIBERAL:
        if abs(l_total) > 1e-6:
            contrib[k] = l_part * l_changes[k] / l_total
        else:
            contrib[k] = l_part * abs(l_changes[k]) / max(1e-9, sum(abs(c) for c in l_changes.values()))

    ranked = sorted(contrib, key=lambda k: -contrib[k] * np.sign(total))
    return [(COMPONENTS[k], contrib[k] / total) for k in ranked[:3] if contrib[k] * np.sign(total) > 0]


def span_for(move, s, trend_years):
    """The years a move's drivers are measured over."""
    a, b, kind = int(move["start"]), int(move["end"]), move["kind"]
    if kind in ("rise", "fall"):
        return core_span(s, a, b, float(move["change"]))
    if kind in ("jump", "slow"):
        return a, b
    if kind in ("dip", "spike"):   # the larger of its two legs
        window = s.loc[a - T["leg_years"]:a + T["leg_years"]]
        before, after = window.loc[:a], window.loc[a:]
        l = before.idxmax() if kind == "dip" else before.idxmin()
        r = after.idxmax() if kind == "dip" else after.idxmin()
        return (int(l), a) if abs(s[l] - s[a]) >= abs(s[r] - s[a]) else (a, int(r))
    if kind == "trend":           # the next four years, or up to the next trend change
        later = [t for t in trend_years if t > a]
        return a, min([a + 4, *later, int(s.index.max())])
    return None


def add_drivers(moves, series_by_country, components):
    """Adds driver (the main one), driver_share and drivers (top three, as text) to every move."""
    trend_years = {c: sorted(moves[(moves.id == c) & (moves.kind == "trend")].start.astype(int)) for c in series_by_country}
    main, share, top3 = [], [], []
    for _, m in moves.iterrows():
        span = span_for(m, series_by_country[m.id], trend_years[m.id])
        top = attribute(components, m.id, *span) if span and span[0] != span[1] else None
        main.append(top[0][0] if top else "")
        share.append(f"{top[0][1]:.2f}" if top else "")
        top3.append("; ".join(f"{name} {round(p * 100)}%" for name, p in top) if top else "")
    return moves.assign(driver=main, driver_share=share, drivers=top3)
