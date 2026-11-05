<script>
  // The main chart. All layout is worked out in lib/chartLayout.js; this component draws it and runs the tooltip.
  import { bisector, format, hsl } from 'd3';
  import { chartLayout } from '../lib/chartLayout.js';
  import { REGIME } from '../lib/constants.js';
  import { LINE_HEIGHT } from '../lib/notes.js';

  let { country } = $props();
  let width = $state(0), height = $state(0);
  let hover = $state(null);

  const fmt = format('.2f');
  const layout = $derived(width > 0 ? chartLayout(country, width, height) : null);

  // party names in their colour; very light colours are darkened so they stay readable
  const ink = (colour) => {
    if (!colour) return 'var(--text)';
    const c = hsl(colour);
    return c.l > 0.6 ? c.darker(1.6).formatHex() : colour;
  };

  // tooltip: the year under the pointer, who governed, the score and what drove the move it belongs to
  const nearest = bisector((d) => d.date).center;
  function onPointer(event) {
    const svg = event.currentTarget.ownerSVGElement, box = svg.getBoundingClientRect();
    const px = (event.clientX - box.left) * (layout.width / box.width);
    const d = country.series[nearest(country.series, layout.plot.x.invert(px))];
    const government = country.governments.find((g) => g.s <= +d.date && +d.date < g.e);
    const rank = { rise: 0, fall: 0, jump: 1, dip: 2, spike: 2, trend: 3 };
    const move = country.episodes
      .filter((e) => e.drivers && e.kind in rank)
      .filter((e) => (['dip', 'spike', 'trend'].includes(e.kind) ? e.from === d.year : e.from < d.year && d.year <= e.to))
      .sort((p, q) => rank[p.kind] - rank[q.kind])[0];
    hover = {
      d, x: layout.plot.x(d.date), y: layout.plot.y(d.val), scale: box.width / layout.width,
      government: government?.name, drivers: move?.drivers.replaceAll('; ', ', '),
      regime: Number.isFinite(d.reg) ? REGIME[d.reg].replace(/^an? /, '') : null,
    };
  }
</script>

<div class="chart" bind:clientWidth={width} bind:clientHeight={height}>
  {#if layout}
    {@const { plot } = layout}
    <svg viewBox="0 0 {layout.width} {layout.height}" role="img" aria-label="{country.name}: Liberal Democracy Index, 1945–{country.last.year}">
      <defs>
        <marker id="arrowhead" viewBox="-10 -10 20 20" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto">
          <polyline points="-6.75,-6.75 0,0 -6.75,6.75" fill="none" stroke="var(--ink)" stroke-width="1.5" stroke-linejoin="bevel" />
        </marker>
      </defs>

      <!-- shaded governments -->
      {#each layout.bands as band}
        <rect x={band.x} y={plot.top} width={band.width} height={plot.bottom - plot.top} fill={band.colour} fill-opacity="0.22" />
        {#if band.divider}<line x1={band.x} x2={band.x} y1={plot.top} y2={plot.bottom} stroke="var(--panel)" stroke-width="1.5" />{/if}
      {/each}
      {#each layout.labels as label}
        <text class="party" x={label.x} y={label.baseline - 12} text-anchor={label.anchor} fill={ink(label.colour)}>{label.party}</text>
        <text class="years" x={label.x} y={label.baseline} text-anchor={label.anchor}>{label.years}</text>
      {/each}

      <!-- axes -->
      {#each layout.gridlines as g}
        <line x1="0" x2={plot.right} y1={g.y} y2={g.y} stroke="var(--grid)" />
        <text class="axis" x="0" y={g.y - 4}>{g.label}</text>
      {/each}
      <text class="axis" x="0" y={plot.y(1) + 12}>most</text>
      <text class="axis" x="0" y={plot.y(1) + 23}>democratic</text>
      <line x1={plot.left} x2={plot.right} y1={plot.y(0)} y2={plot.y(0)} stroke="var(--axis)" />
      {#each layout.ticks as t}
        <text class="axis" x={t.x} y={plot.bottom + 16} text-anchor="middle">{t.label}</text>
      {/each}

      <!-- lowest / highest since -->
      {#if layout.reference}
        {@const r = layout.reference}
        <line x1={r.x1} x2={r.x2} y1={r.y} y2={r.y} stroke="var(--ink)" stroke-dasharray="2 3" />
        <text class="note" x={r.textX} y={r.textY} text-anchor="end">{r.text}</text>
      {/if}

      <!-- the line and today's value -->
      <path d={layout.path} fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round" />
      <circle cx={layout.end.x} cy={layout.end.y} r="4" fill="var(--ink)" />
      <text class="end" x={layout.end.x + 9} y={layout.end.y} dy="0.35em">{layout.end.label}</text>

      <!-- notes -->
      {#each layout.brackets as b}
        <path d={b.path} fill="none" stroke="var(--ink)" />
      {/each}
      {#each layout.arrows as a}
        <path d={a.path} fill="none" stroke="var(--ink)" stroke-width="1.1" marker-end="url(#arrowhead)" />
      {/each}
      {#each [...layout.brackets, ...layout.arrows] as n}
        <text class="note" x={n.x} y={n.top + LINE_HEIGHT * 0.8} text-anchor={n.anchor}>
          {#each n.lines as l, i}<tspan x={n.x} dy={i ? '1.2em' : 0}>{l}</tspan>{/each}
        </text>
      {/each}

      <!-- tooltip target -->
      {#if hover}
        <line x1={hover.x} x2={hover.x} y1={plot.top} y2={plot.bottom} stroke="var(--axis)" />
        <circle cx={hover.x} cy={hover.y} r="4" fill="var(--panel)" stroke="var(--ink)" stroke-width="2" />
      {/if}
      <rect x={plot.left} y={plot.top} width={plot.right - plot.left} height={plot.bottom - plot.top} fill="transparent"
            role="presentation" onpointermove={onPointer} onpointerenter={onPointer} onpointerleave={() => (hover = null)} />
    </svg>

    {#if hover}
      <div class="tip" style:left="{(hover.x * hover.scale > width / 2 ? hover.x * hover.scale - 12 : hover.x * hover.scale + 12)}px"
           style:top="{Math.max(0, hover.y * hover.scale - 40)}px" class:left={hover.x * hover.scale > width / 2}>
        <div class="muted">{hover.d.year}{hover.d.election ? ' · national election' : ''}</div>
        {#if hover.government}<div class="muted">In power: {hover.government}</div>{/if}
        <div class="row"><span>Liberal democracy</span><b>{fmt(hover.d.val)}</b></div>
        {#if Number.isFinite(hover.d.lo)}<div class="muted">Range {fmt(hover.d.lo)}–{fmt(hover.d.hi)}</div>{/if}
        {#if hover.regime}<div class="muted">{hover.regime}</div>{/if}
        {#if hover.drivers}<div class="muted wrap">Driven by: {hover.drivers}</div>{/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .chart { position: relative; flex: 1 1 0; min-height: 0; }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; overflow: visible; }
  /* sizes must match lib/text.js FONTS */
  .axis { font-size: 0.7rem; fill: var(--text-muted); font-variant-numeric: tabular-nums; }
  .party { font-size: 0.7rem; font-weight: 700; }
  .years { font-size: 0.66rem; fill: var(--text-muted); font-variant-numeric: tabular-nums; }
  .end { font-size: 0.75rem; font-weight: 700; fill: var(--text); font-variant-numeric: tabular-nums; }
  .note { font-size: 0.75rem; font-weight: 500; fill: var(--text); }
  .tip { position: absolute; pointer-events: none; z-index: 2; background: var(--popover); border: 1px solid var(--border);
         border-radius: 6px; box-shadow: var(--popover-shadow); padding: 6px 10px; font-size: 0.75rem; line-height: 1.45;
         white-space: nowrap; max-width: 16rem; }
  .tip.left { transform: translateX(-100%); }
  .tip .muted { color: var(--text-muted); }
  .tip .wrap { white-space: normal; }
  .tip .row { display: flex; gap: 0.6rem; }
  .tip .row b { margin-left: auto; }
</style>
