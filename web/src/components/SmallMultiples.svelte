<script>
  // Every country on the same scales, with the same shading as the main chart.
  // Grouped by V-Dem regime class by default; can be grouped by trajectory since CHANGE_FROM, or sorted A–Z.
  // Each group: its name and size over a full-width rule, then its meaning in a margin column beside the grid.
  import { format, line, scaleLinear, scaleUtc } from 'd3';
  import { FIRST_YEAR, GREY, REGIME_EXPLAINED } from '../lib/constants.js';
  import { valueAt, yearEnd } from '../lib/data.js';
  import { shadedBands } from '../lib/shading.js';

  let { countries, selected, onselect } = $props();

  const CHANGE_FROM = 2015;
  const GROUPS = ['Closed autocracies', 'Electoral autocracies', 'Electoral democracies', 'Liberal democracies'];
  const SORTS = [
    { key: 'regime', label: 'Regime' },
    { key: 'trajectory', label: `Trajectory since ${CHANGE_FROM}` },
    { key: 'name', label: 'A–Z' },
  ];

  let sortBy = $state('regime');

  const W = 160, H = 80;
  const fmt = format('.2f');
  const fmtChange = format('+.2f');
  const lastYear = $derived(Math.max(...countries.map((c) => c.last.year)));
  const x = $derived(scaleUtc([Date.UTC(FIRST_YEAR, 0, 1), yearEnd(lastYear)], [0, W]));
  const y = scaleLinear([0, 1], [H, 0]);

  const changeOf = (c) => { const v = valueAt(c, CHANGE_FROM); return v ? c.last.val - v.val : null; };
  // V-Dem's Democracy Report rule: a change of at least 0.05 whose start and end uncertainty ranges don't overlap
  const TRAJECTORY_MIN = 0.05;
  const TRAJECTORIES = [
    { key: 'falling', title: 'Falling', note: `fell by ${TRAJECTORY_MIN} or more since ${CHANGE_FROM}, beyond V-Dem’s uncertainty (V-Dem: autocratizing).` },
    { key: 'stable', title: 'Stable', note: `no change that clears V-Dem’s uncertainty since ${CHANGE_FROM}.` },
    { key: 'rising', title: 'Rising', note: `rose by ${TRAJECTORY_MIN} or more since ${CHANGE_FROM}, beyond V-Dem’s uncertainty (V-Dem: democratizing).` },
  ].map((g) => ({ ...g, note: g.note[0].toUpperCase() + g.note.slice(1) }));
  function trajectoryOf(c) {
    const from = valueAt(c, CHANGE_FROM), to = c.last, d = to.val - from.val;
    if (d <= -TRAJECTORY_MIN && to.hi < from.lo) return 'falling';
    if (d >= TRAJECTORY_MIN && to.lo > from.hi) return 'rising';
    return 'stable';
  }
  const changeText = (d) => (Math.abs(d) < 0.005 ? '±0.00' : fmtChange(d));
  // the grid's cells are narrow: a few long names get their short form (the full name stays in the label and tooltip)
  const SHORT = { 'United Kingdom': 'UK', 'North Macedonia': 'N. Macedonia', 'Bosnia and Herzegovina': 'Bosnia-Herz.' };
  const flagSrc = (c) => (c.flag ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(c.flag)}` : null);

  const groups = $derived.by(() => {
    if (sortBy === 'name') return [{ title: null, items: [...countries].sort((a, b) => a.name.localeCompare(b.name)) }];
    if (sortBy === 'trajectory') {
      const known = countries.filter((c) => changeOf(c) !== null).sort((a, b) => changeOf(a) - changeOf(b));
      return TRAJECTORIES.map((tr) => ({ ...tr, items: known.filter((c) => trajectoryOf(c) === tr.key) })).filter((g) => g.items.length);
    }
    return [3, 2, 1, 0]
      .map((r) => ({
        title: GROUPS[r],
        note: REGIME_EXPLAINED[r][0].toUpperCase() + REGIME_EXPLAINED[r].slice(1) + '.',
        items: countries.filter((c) => c.last.reg === r).sort((a, b) => b.last.val - a.last.val),
      }))
      .filter((g) => g.items.length);
  });

  const bandsOf = (c) => shadedBands(c)
    .map((b) => ({ x0: x(Math.max(b.a, +c.series[0].date)), x1: x(Math.min(b.b, +c.last.date)), colour: b.colour || GREY }))
    .filter((b) => b.x1 > b.x0);
</script>

<div class="controls" role="group" aria-label="Order countries">
  <span>Sort</span>
  {#each SORTS as s (s.key)}
    <button type="button" aria-pressed={sortBy === s.key} onclick={() => (sortBy = s.key)}>{s.label}</button>
  {/each}
</div>

{#each groups as g (g.title ?? sortBy)}
  <section class="group" class:titled={g.title}>
    {#if g.title}
      <h3>{g.title} <span class="count">{g.items.length}</span></h3>
      <div class="margin">{#if g.note}<p>{g.note}</p>{/if}</div>
    {/if}
    <div class="grid">
      {#each g.items as c (c.id)}
        {@const change = changeOf(c)}
        {@const src = flagSrc(c)}
        <button type="button" class="cell" class:current={c.id === selected} aria-current={c.id === selected ? 'true' : undefined}
                aria-label="{c.name}, score {fmt(c.last.val)}: open chart" onclick={() => onselect(c.id)}>
          <div class="head">
            {#if src}<img src={src} alt="" />{/if}
            <span class="name" title={c.name}>{SHORT[c.name] ?? c.name}</span>
            <span class="score">{fmt(c.last.val)}</span>
          </div>
          <svg viewBox="0 0 {W} {H}" aria-hidden="true">
            {#each bandsOf(c) as b}<rect x={b.x0} width={b.x1 - b.x0} y="0" height={H} fill={b.colour} fill-opacity="0.22" />{/each}
            {#each [0.5, 1] as v}<line x1="0" x2={W} y1={y(v)} y2={y(v)} stroke="var(--grid)" />{/each}
            <line x1="0" x2={W} y1={H} y2={H} stroke="var(--axis)" />
            <path d={line().x((d) => x(d.date)).y((d) => y(d.val))(c.series)} fill="none" stroke={c.id === selected ? 'var(--accent)' : 'var(--ink)'} stroke-width={c.id === selected ? 2 : 1.4} stroke-linejoin="round" />
            <circle cx={x(c.last.date)} cy={y(c.last.val)} r="2.2" fill={c.id === selected ? 'var(--accent)' : 'var(--ink)'} />
          </svg>
          <!-- the years are the same in every cell (said once in the section intro), so only the recent change is written out -->
          <div class="foot">
            {#if c.id === selected}<span class="shown">Shown above</span>
            {:else if change !== null}<span class="change">{changeText(change)} since {CHANGE_FROM}</span>{/if}
          </div>
        </button>
      {/each}
    </div>
  </section>
{/each}

<style>
  /* boxed controls, like a magazine's section tabs */
  .controls { display: flex; flex-wrap: wrap; align-items: stretch; margin-top: var(--space-3); font-family: var(--font-sans); font-size: 0.88rem; }
  .controls span { display: flex; align-items: center; padding-right: 0.75rem; color: var(--text-muted); }
  .controls button { all: unset; cursor: pointer; padding: 0.4rem 0.8rem; border: 1px solid var(--rule); margin-left: -1px; color: var(--text); }
  .controls button:hover { background: var(--grid); }
  .controls button[aria-pressed='true'] { background: var(--text); color: var(--page); font-weight: 600; }
  .controls button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; position: relative; }

  /* each group: its name and size over a full-width rule, then its meaning in a margin column beside the grid.
     On wide screens the margin hangs outside the page column, so the grid keeps the page's left edge and full width
     and only the heading, its rule and the margin note reach out to the left. */
  .group { margin-top: var(--space-5); --margin: 6.5rem; --margin-gap: 1.25rem; }
  .group.titled { display: grid; grid-template-columns: var(--margin) minmax(0, 1fr); column-gap: var(--margin-gap); }
  @media (min-width: 72rem) {
    .group.titled { --margin: 9rem; --margin-gap: 1.5rem; margin-left: calc(-1 * (var(--margin) + var(--margin-gap))); }
  }
  .group h3 { grid-column: 1 / -1; font-family: var(--font-display); font-size: 1.1rem; font-weight: 800; line-height: 1.1;
              margin: 0 0 var(--space-2); padding-bottom: 0.4rem; border-bottom: 2px solid var(--text); }
  .margin { font-size: 0.85rem; line-height: 1.35; color: var(--text-muted); }
  .count { font-family: var(--font-chart); font-size: 0.9rem; font-weight: 400; color: var(--text-muted); margin-left: 0.3rem; }
  .margin p { margin: 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr)); gap: var(--space-3) 1rem; margin-top: 0; }
  .group:not(.titled) .grid { margin-top: var(--space-2); }
  /* phones: the margin folds away above the grid */
  @media (max-width: 40rem) {
    .group.titled { display: block; }
    .margin { margin-bottom: var(--space-2); }
  }
  .cell { all: unset; box-sizing: border-box; display: block; cursor: pointer; min-width: 0; }
  .cell:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
  .cell:hover .name { text-decoration: underline; text-underline-offset: 3px; }

  .head { display: flex; align-items: center; gap: 0.3rem; font-family: var(--font-sans); font-size: 0.88rem; font-weight: 700; margin-bottom: 0.3rem; min-width: 0; }
  .head img { width: 14px; height: 10.5px; flex: none; box-shadow: 0 0 0 0.5px var(--border); }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .score { margin-left: auto; font-family: var(--font-chart); font-size: 0.7rem; font-weight: 500; font-variant-numeric: tabular-nums; }
  .current .name, .current .score { color: var(--accent); }
  svg { display: block; width: 100%; height: auto; overflow: visible; }
  .foot { display: flex; gap: 0.3rem; font-family: var(--font-chart); font-size: 0.68rem; color: var(--text-muted);
          margin-top: 0.25rem; font-variant-numeric: tabular-nums; }
  .change, .shown { white-space: nowrap; }
  .shown { color: var(--accent); font-weight: 600; }
</style>
