"""Finding the moves in each country's Liberal Democracy Index (RULES.md §2).

Every function takes one country's scores as a pandas Series indexed by year.
"""
import numpy as np
import pandas as pd
import ruptures

from .config import T


def episodes(s):
    """Rises and falls by V-Dem's Episodes of Regime Transformation thresholds, plus swings and jumps.
    Returns [(start_year, end_year, kind)]."""
    years, v, n, out = list(s.index), list(s.values), len(s), []
    consecutive = lambda i: years[i] == years[i - 1] + 1

    for direction in (1, -1):
        i = 0
        while i < n - 1:
            # an episode starts with a yearly move of ep_start in this direction
            if not consecutive(i + 1) or direction * (v[i + 1] - v[i]) < T["ep_start"]:
                i += 1
                continue
            start, peak, last_move, k = i, i + 1, i + 1, i + 2
            while k < n and consecutive(k):
                step = v[k] - v[k - 1]
                if direction * step <= -T["ep_turn"]: break                 # reverses sharply in a year
                if direction * (v[peak] - v[k]) >= T["ep_cum"]: break        # gives back ep_cum in total
                if direction * step >= T["ep_start"]: last_move = k
                if direction * (v[k] - v[peak]) > 0: peak = k
                if years[k] - years[last_move] >= T["ep_stasis"]: break     # stalls
                k += 1
            if direction * (v[peak] - v[start]) >= T["ep_cum"]:
                out.append((years[start], years[peak], "rise" if direction > 0 else "fall"))
            i = peak

    w = T["swing_window"]
    for t in range(w, n):
        if years[t] - years[t - w] == w and sum(abs(v[k] - v[k - 1]) for k in range(t - w + 1, t + 1)) >= T["swing_sum"]:
            out.append((years[t - w], years[t], "swing"))
    for k in range(1, n):
        if consecutive(k) and abs(v[k] - v[k - 1]) >= T["jump"]:
            out.append((years[k - 1], years[k], "jump"))
    return sorted(out)


def sharpest_year(s, start, end):
    """The year inside (start, end] with the largest one-year move."""
    years = [y for y in range(start + 1, end + 1) if y in s.index and y - 1 in s.index]
    return max(years, key=lambda y: abs(s[y] - s[y - 1])) if years else end


def core_span(s, start, end, change):
    """The shortest run of years carrying core_share of a rise or fall."""
    years = [y for y in s.index if start <= y <= end]
    need, direction, best = T["core_share"] * abs(change), np.sign(change), (start, end)
    for i, a in enumerate(years):
        for b in years[i + 1:]:
            if direction * (s[b] - s[a]) >= need and b - a < best[1] - best[0]:
                best = (a, b)
    return best


def _turning_points(v):
    """Indices where the series changes direction (flat steps keep the previous direction)."""
    idx, direction = [0], 0
    for i in range(1, len(v)):
        sign = np.sign(v[i] - v[i - 1])
        if sign == 0:
            continue
        if direction and sign != direction:
            idx.append(i - 1)
        direction = sign
    return idx + [len(v) - 1]


def dips_and_spikes(country, s, known, rises_falls):
    """Turning points where the move in plus the move out (each leg at most leg_years) adds up to dip_total,
    outside the moves already found and not within a year of a rise or fall. Research leads; not drawn."""
    v, years, out = s.values, s.index.values, []
    tp = _turning_points(v)
    rf = rises_falls[rises_falls.id == country]
    for a, i, b in zip(tp, tp[1:], tp[2:]):
        dip, spike = v[i] < v[a] and v[i] < v[b], v[i] > v[a] and v[i] > v[b]
        if not (dip or spike):
            continue
        left = v[max(a, i - T["leg_years"]):i + 1]
        right = v[i:min(b, i + T["leg_years"]) + 1]
        total = (left.max() + right.max() - 2 * v[i]) if dip else (2 * v[i] - left.min() - right.min())
        year = int(years[i])
        if total < T["dip_total"]:
            continue
        if not known[(known.id == country) & (known.start <= year) & (known.end >= year)].empty:
            continue
        if ((rf.start - year).abs().le(1) | (rf.end - year).abs().le(1)).any():
            continue
        out.append(dict(id=country, kind="dip" if dip else "spike", start=year, end=year,
                        change=round((-1 if dip else 1) * total, 3), anchor=year))
    return out


def trend_changes(country, s):
    """Years where the slope changes: PELT change-point detection with a continuous piecewise-linear cost
    (the `ruptures` package). Penalty scales with the series' own noise. Stored; not drawn."""
    v, years, n = s.values, s.index.values.astype(int), len(s)
    second_diff = np.diff(v, 2)
    noise = max(np.median(np.abs(second_diff - np.median(second_diff))) / 0.6745 / np.sqrt(6), T["trend_noise_floor"])
    breaks = ruptures.Pelt(custom_cost=ruptures.costs.CostCLinear(), min_size=T["trend_min_years"], jump=1) \
        .fit(v.reshape(-1, 1)).predict(pen=T["trend_penalty"] * noise ** 2 * np.log(n))[:-1]
    points, out = [0, *breaks, n - 1], []
    for k, b in enumerate(breaks):
        a, c = points[k], points[k + 2]
        before, after = (v[b] - v[a]) / (years[b] - years[a]), (v[c] - v[b]) / (years[c] - years[b])
        if abs(after - before) >= T["trend_min_slope_change"]:
            out.append(dict(id=country, kind="trend", start=int(years[b]), end=int(years[b]), change=round(after - before, 4),
                            anchor=int(years[b]), slope_before=round(before, 4), slope_after=round(after, 4)))
    return out


def slow_trends(country, s, scores, shaded, trend_years, jumps):
    """Stretches between trend changes that move slow_min or more, clear V-Dem's uncertainty, are less than half
    shaded and contain no jump. Told in the headline and subtitle only."""
    out = []
    points = [int(s.index.min()), *sorted(trend_years), int(s.index.max())]
    for a, b in zip(points, points[1:]):
        change = s[b] - s[a]
        if abs(change) < T["slow_min"]:
            continue
        covering = shaded[(shaded.id == country) & (shaded.start < b) & (shaded.end > a)]
        if sum(max(0, min(b, r.end) - max(a, r.start)) for r in covering.itertuples()) / (b - a) >= 0.5:
            continue
        lo, hi = scores.loc[(country, a)], scores.loc[(country, b)]
        clears = hi.libdem_low > lo.libdem_high if change > 0 else hi.libdem_high < lo.libdem_low
        has_jump = not jumps[(jumps.id == country) & (jumps.start >= a) & (jumps.end <= b)].empty
        if clears and not has_jump:
            out.append(dict(id=country, kind="slow", start=a, end=b, change=round(change, 3), anchor=""))
    return out


def detect_all(series_by_country, scores):
    """Every move for every country, as one table."""
    rows = [dict(id=c, kind=k, start=a, end=b, change=round(float(s[b] - s[a]), 3), anchor=sharpest_year(s, a, b))
            for c, s in series_by_country.items() for a, b, k in episodes(s)]
    moves = pd.DataFrame(rows)
    rises_falls = moves[moves.kind.isin(["rise", "fall"])]
    extra = []
    for c, s in series_by_country.items():
        extra += dips_and_spikes(c, s, moves, rises_falls)
        extra += trend_changes(c, s)
    moves = pd.concat([moves, pd.DataFrame(extra)], ignore_index=True)

    shaded = moves[moves.kind.isin(["rise", "fall", "swing"]) | ((moves.kind == "jump") & (moves.change.abs() >= T["band_min"]))]
    jumps = moves[moves.kind == "jump"]
    slow = []
    for c, s in series_by_country.items():
        trend_years = moves[(moves.id == c) & (moves.kind == "trend")].start.tolist()
        slow += slow_trends(c, s, scores, shaded, trend_years, jumps)
    return pd.concat([moves, pd.DataFrame(slow)], ignore_index=True)
