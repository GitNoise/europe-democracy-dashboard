<script>
  // Every country on the same scales, with the same shading as the main chart.
  // Grouped by V-Dem regime class by default; can be sorted A–Z or by change since CHANGE_FROM.
  import { format, line, scaleLinear, scaleUtc } from 'd3';
  import { FIRST_YEAR, GREY, REGIME_EXPLAINED } from '../lib/constants.js';
  import { valueAt, yearEnd } from '../lib/data.js';
  import { shadedBands } from '../lib/shading.js';

  let { countries, selected, onselect } = $props();

  const CHANGE_FROM = 2015;
  const GROUPS = ['Closed autocracies', 'Electoral autocracies', 'Electoral democracies', 'Liberal democracies'];
  const SORTS = [
    { key: 'regime', label: 'By regime' },
    { key: 'change', label: `Change since ${CHANGE_FROM}` },
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
  const changeText = (d) => (Math.abs(d) < 0.005 ? '±0.00' : fmtChange(d));
  const flagSrc = (c) => (c.flag ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(c.flag)}` : null);

  const groups = $derived.by(() => {
    if (sortBy === 'name') return [{ title: null, items: [...countries].sort((a, b) => a.name.localeCompare(b.name)) }];
    if (sortBy === 'change') {
      const known = countries.filter((c) => changeOf(c) !== null).sort((a, b) => changeOf(a) - changeOf(b));
      return [{ title: null, note: `Biggest falls first, from ${CHANGE_FROM} to ${lastYear}.`, items: known }];
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
  {#each SORTS as s (s.key)}
    <button type="button" aria-pressed={sortBy === s.key} onclick={() => (sortBy = s.key)}>{s.label}</button>
  {/each}
</div>

{#each groups as g (g.title ?? sortBy)}
  {#if g.title}
    <h3>{g.title} <span class="count">{g.items.length}</span></h3>
  {/if}
  {#if g.note}<p class="note">{g.note}</p>{/if}
  <div class="grid">
    {#each g.items as c (c.id)}
      {@const change = changeOf(c)}
      {@const src = flagSrc(c)}
      <button type="button" class="cell" class:current={c.id === selected} aria-current={c.id === selected ? 'true' : undefined}
              aria-label="{c.name}, score {fmt(c.last.val)}: open chart" onclick={() => onselect(c.id)}>
        <div class="head">
          {#if src}<img src={src} alt="" />{/if}
          <span class="name">{c.name}</span>
          <span class="score">{fmt(c.last.val)}</span>
        </div>
        <svg viewBox="0 0 {W} {H}" aria-hidden="true">
          {#each bandsOf(c) as b}<rect x={b.x0} width={b.x1 - b.x0} y="0" height={H} fill={b.colour} fill-opacity="0.22" />{/each}
          {#each [0.5, 1] as v}<line x1="0" x2={W} y1={y(v)} y2={y(v)} stroke="var(--grid)" />{/each}
          <line x1="0" x2={W} y1={H} y2={H} stroke="var(--axis)" />
          <path d={line().x((d) => x(d.date)).y((d) => y(d.val))(c.series)} fill="none" stroke="var(--ink)" stroke-width="1.4" stroke-linejoin="round" />
          <circle cx={x(c.last.date)} cy={y(c.last.val)} r="2.2" fill="var(--ink)" />
        </svg>
        <div class="foot">
          <span>{FIRST_YEAR}</span>
          {#if c.id === selected}<span class="shown">Shown above</span>
          {:else if change !== null}<span class="change">{changeText(change)} since {CHANGE_FROM}</span>{/if}
          <span>{lastYear}</span>
        </div>
      </button>
    {/each}
  </div>
{/each}

<style>
  .controls { display: inline-flex; flex-wrap: wrap; gap: 0; margin-top: 1rem; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; background: var(--panel); }
  .controls button { all: unset; cursor: pointer; font-size: 0.78rem; padding: 0.35rem 0.75rem; color: var(--text-muted); border-left: 1px solid var(--border); }
  .controls button:first-child { border-left: none; }
  .controls button:hover { color: var(--text); }
  .controls button[aria-pressed='true'] { background: var(--text); color: var(--panel); font-weight: 700; }
  .controls button:focus-visible { outline: 2px solid var(--text); outline-offset: -2px; }

  h3 { display: flex; align-items: baseline; gap: 0.4rem; font-size: 0.95rem; margin: 1.6rem 0 0.1rem; }
  .count { font-size: 0.75rem; font-weight: 400; color: var(--text-muted); font-variant-numeric: tabular-nums; }
  .note { color: var(--text-muted); font-size: 0.78rem; margin: 0.15rem 0 0; }
  h3 + .note { margin-top: 0; }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr)); gap: 0.6rem; margin-top: 0.7rem; }
  .cell { all: unset; box-sizing: border-box; display: block; cursor: pointer; padding: 0.55rem 0.6rem 0.45rem;
          background: var(--panel); border: 1px solid var(--border); border-radius: 6px; transition: border-color 0.12s, box-shadow 0.12s; }
  .cell:hover { border-color: var(--axis); box-shadow: var(--popover-shadow); }
  .cell:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
  .cell.current { border-color: var(--text); box-shadow: 0 0 0 1px var(--text); }

  .head { display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; font-weight: 700; margin-bottom: 0.35rem; min-width: 0; }
  .head img { width: 16px; height: 12px; flex: none; border-radius: 1px; box-shadow: 0 0 0 1px var(--border); }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .score { margin-left: auto; font-variant-numeric: tabular-nums; }
  svg { display: block; width: 100%; height: auto; overflow: visible; }
  .foot { display: flex; justify-content: space-between; gap: 0.3rem; font-size: 0.62rem; color: var(--text-muted); margin-top: 0.2rem;
          font-variant-numeric: tabular-nums; }
  .change, .shown { white-space: nowrap; }
  .shown { color: var(--text); font-weight: 700; }
</style>
