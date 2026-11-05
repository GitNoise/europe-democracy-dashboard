<script>
  // Every country on the same scales, sorted by its latest score, with the same shading as the main chart.
  import { format, line, scaleLinear, scaleUtc } from 'd3';
  import { FIRST_YEAR, GREY } from '../lib/constants.js';
  import { yearEnd } from '../lib/data.js';
  import { shadedBands } from '../lib/shading.js';

  let { countries, onselect } = $props();

  const W = 160, H = 96;
  const fmt = format('.2f');
  const lastYear = $derived(Math.max(...countries.map((c) => c.last.year)));
  const x = $derived(scaleUtc([Date.UTC(FIRST_YEAR, 0, 1), yearEnd(lastYear)], [0, W]));
  const y = scaleLinear([0, 1], [H, 0]);
  const sorted = $derived([...countries].sort((a, b) => b.last.val - a.last.val));

  const bandsOf = (c) => shadedBands(c)
    .map((b) => ({ x0: x(Math.max(b.a, +c.series[0].date)), x1: x(Math.min(b.b, +c.last.date)), colour: b.colour || GREY }))
    .filter((b) => b.x1 > b.x0);
</script>

<div class="grid">
  {#each sorted as c (c.id)}
    <button type="button" class="cell" aria-label="{c.name}: open chart" onclick={() => onselect(c.id)}>
      <div class="head"><span class="name">{c.name}</span><span>{fmt(c.last.val)}</span></div>
      <svg viewBox="0 0 {W} {H}" role="img" aria-label="{c.name}, democracy score {FIRST_YEAR}–{lastYear}">
        {#each bandsOf(c) as b}<rect x={b.x0} width={b.x1 - b.x0} y="0" height={H} fill={b.colour} fill-opacity="0.22" />{/each}
        {#each [0.5, 1] as v}<line x1="0" x2={W} y1={y(v)} y2={y(v)} stroke="var(--grid)" />{/each}
        <line x1="0" x2={W} y1={H} y2={H} stroke="var(--axis)" />
        <path d={line().x((d) => x(d.date)).y((d) => y(d.val))(c.series)} fill="none" stroke="var(--ink)" stroke-width="1.4" stroke-linejoin="round" />
        <circle cx={x(c.last.date)} cy={y(c.last.val)} r="2.2" fill="var(--ink)" />
      </svg>
      <div class="axis"><span>{FIRST_YEAR}</span><span>{lastYear}</span></div>
    </button>
  {/each}
</div>

<style>
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr)); gap: 1.1rem 1rem; margin-top: 1rem; }
  .cell { all: unset; display: block; cursor: pointer; border-radius: 4px; }
  .cell:focus-visible { outline: 2px solid var(--text); outline-offset: 3px; }
  .cell:hover .name { text-decoration: underline; }
  .head { display: flex; align-items: baseline; gap: 0.4rem; font-size: 0.78rem; font-weight: 700; margin-bottom: 0.2rem; }
  .head span:last-child { margin-left: auto; font-variant-numeric: tabular-nums; }
  svg { display: block; width: 100%; height: auto; overflow: visible; }
  .axis { font-size: 0.62rem; color: var(--text-muted); display: flex; justify-content: space-between; margin-top: 0.1rem; }
</style>
