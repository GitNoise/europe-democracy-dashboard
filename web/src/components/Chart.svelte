<script>
  // The main chart. All layout is worked out in lib/chartLayout.js; this component draws it and runs the tooltip.
  import { bisector, format, hsl } from 'd3';
  import { chartLayout } from '../lib/chartLayout.js';
  import { GREY, REGIME } from '../lib/constants.js';
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

  // tooltip: one year in plain words — the score and how it moved, who governed, and the move the year is part of
  const fmtChange = format('+.2f');
  const MOVE_NAMES = { rise: ['Rise', 'Rise'], fall: ['Fall', 'Fall'], jump: ['Sudden rise', 'Sudden drop'], dip: ['Brief dip', 'Brief dip'], spike: ['Brief spike', 'Brief spike'] };
  const nearest = bisector((d) => d.date).center;
  let tipWidth = $state(0), tipHeight = $state(0);

  function moveFor(year) {
    const rank = { rise: 0, fall: 0, jump: 1, dip: 2, spike: 2 };
    const move = country.episodes
      .filter((e) => e.kind in rank)
      .filter((e) => (['dip', 'spike'].includes(e.kind) ? e.from === year : e.from < year && year <= e.to))
      .sort((p, q) => rank[p.kind] - rank[q.kind] || (q.reason ? 1 : 0) - (p.reason ? 1 : 0))[0];
    if (!move) return null;
    const name = MOVE_NAMES[move.kind][move.change < 0 ? 1 : 0];
    const years = move.from === move.to ? `${move.to}` : `${move.from}–${move.to}`;
    const driver = move.drivers.split(';')[0].replace(/\s*\d+%$/, '').trim().toLowerCase();
    return { label: `${name} ${years}`, text: move.reason || (driver ? `mostly ${driver}` : '') };
  }

  function onPointer(event) {
    const svg = event.currentTarget.ownerSVGElement, box = svg.getBoundingClientRect();
    const px = (event.clientX - box.left) * (layout.width / box.width);
    const i = nearest(country.series, layout.plot.x.invert(px));
    const d = country.series[i], prev = country.series[i - 1];
    const government = country.governments.find((g) => g.s <= +d.date && +d.date < g.e);
    hover = {
      d, x: layout.plot.x(d.date), y: layout.plot.y(d.val), scale: box.width / layout.width,
      change: prev && prev.year === d.year - 1 ? d.val - prev.val : null,
      // a coalition shows its name without the bracketed party list, then each party with its colour, leader first
      government: government && {
        name: government.parties.length > 1 ? government.name.replace(/\s*\([^)]*\)\s*$/, '') : government.name,
        colour: government.colour, parties: government.parties.length > 1 ? government.parties : null,
      },
      regime: Number.isFinite(d.reg) ? REGIME[d.reg].replace(/^an? /, '') : null,
      move: moveFor(d.year),
    };
  }

  // keep the tooltip inside the chart: beside the pointer, flipped to the left when there's no room on the right
  const tipPos = $derived.by(() => {
    if (!hover) return null;
    const px = hover.x * hover.scale, py = hover.y * hover.scale, gap = 14;
    let left = px + gap;
    if (left + tipWidth > width) left = px - gap - tipWidth;
    left = Math.max(0, Math.min(left, width - tipWidth));
    const top = Math.max(0, Math.min(py - tipHeight / 2, height - tipHeight));
    return { left, top };
  });
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
        <text class="party" x={label.x} y={label.baseline - 14} text-anchor={label.anchor} fill={ink(label.colour)}>{label.party}</text>
        <text class="years" x={label.x} y={label.baseline} text-anchor={label.anchor}>{label.years}</text>
      {/each}

      <!-- axes -->
      {#each layout.gridlines as g}
        {#if !g.base}<line x1="0" x2={plot.right} y1={g.y} y2={g.y} stroke="var(--grid)" />{/if}
        <text class="axis" x="0" y={g.y - 4}>{g.label}</text>
      {/each}
      <text class="axis" x="0" y={plot.y(1) + 12}>most</text>
      <text class="axis" x="0" y={plot.y(1) + 23}>democratic</text>
      <line x1={plot.left} x2={plot.right} y1={plot.y(plot.floor)} y2={plot.y(plot.floor)} stroke="var(--axis)" />
      {#each layout.ticks as t}
        <text class="axis" x={t.x} y={plot.bottom + 16} text-anchor="middle">{t.label}</text>
      {/each}

      <!-- who governed, every year -->
      <text class="axis" x="0" y={layout.strip.y + layout.strip.height / 2} dy="0.35em">In power</text>
      <rect x={plot.left} y={layout.strip.y} width={layout.end.x - plot.left} height={layout.strip.height} fill="var(--grid)" />
      {#each layout.governments as g}
        {#each g.stripes as s}
          <rect x={g.xa} y={layout.strip.y + s.y} width={Math.max(1, g.xb - g.xa)} height={s.h} fill={s.colour}><title>{g.name}</title></rect>
        {/each}
        <line x1={g.xa} x2={g.xa} y1={layout.strip.y} y2={layout.strip.y + layout.strip.height} stroke="var(--panel)" />
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
      <div class="tip" bind:clientWidth={tipWidth} bind:clientHeight={tipHeight}
           style:left="{tipPos?.left ?? 0}px" style:top="{tipPos?.top ?? 0}px" style:visibility={tipWidth ? 'visible' : 'hidden'}>
        <div class="year"><b>{hover.d.year}</b>{#if hover.d.election}<span>Election year</span>{/if}</div>
        <div class="score">
          <b>{fmt(hover.d.val)}</b>
          {#if hover.change !== null}<span>{Math.abs(hover.change) < 0.005 ? 'no change' : fmtChange(hover.change)} on {hover.d.year - 1}</span>{/if}
        </div>
        {#if hover.regime}<div class="muted">{hover.regime[0].toUpperCase() + hover.regime.slice(1)}</div>{/if}
        {#if hover.government || hover.move}
          <div class="more">
            {#if hover.government}
              {#if hover.government.parties}
                <div class="gov-name">{hover.government.name}</div>
                <div class="parties">
                  {#each hover.government.parties as p}<span class="gov"><i style:background={p.colour || GREY}></i>{p.party}</span>{/each}
                </div>
              {:else}
                <div class="gov"><i style:background={hover.government.colour || GREY}></i>{hover.government.name}</div>
              {/if}
            {/if}
            {#if hover.move}
              <div class="move"><b>{hover.move.label}</b>{hover.move.text ? `: ${hover.move.text}` : ''}</div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .chart { position: relative; flex: 1 1 0; min-height: 0; font-family: var(--font-chart); }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; overflow: visible; }
  /* sizes must match lib/text.js FONTS */
  .axis { font-size: 0.7rem; fill: var(--text-muted); font-variant-numeric: tabular-nums; }
  .party { font-family: var(--font-display); font-size: 15px; font-weight: 800; }
  .years { font-size: 0.66rem; fill: var(--text-muted); font-variant-numeric: tabular-nums; }
  .end { font-size: 0.75rem; font-weight: 700; fill: var(--text); font-variant-numeric: tabular-nums; }
  .note { font-size: 0.75rem; font-weight: 500; fill: var(--text); }
  .tip { position: absolute; pointer-events: none; z-index: 2; box-sizing: border-box; width: 15rem; max-width: 100%;
         background: var(--popover); border: 1px solid var(--rule); box-shadow: var(--popover-shadow);
         padding: 0.55rem 0.7rem 0.6rem; font-size: 0.72rem; line-height: 1.4; }
  .tip .year { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
  .tip .year span { color: var(--text-muted); font-size: 0.65rem; }
  .tip .score { display: flex; align-items: baseline; gap: 0.5rem; margin-top: 0.15rem; }
  .tip .score b { font-size: 1.15rem; font-variant-numeric: tabular-nums; }
  .tip .score span, .tip .muted { color: var(--text-muted); }
  .tip .more { margin-top: 0.45rem; padding-top: 0.45rem; border-top: 1px solid var(--border); display: grid; gap: 0.3rem; }
  .tip .gov { display: flex; gap: 0.4rem; align-items: baseline; }
  .tip .parties { display: flex; flex-wrap: wrap; gap: 0.15rem 0.7rem; }
  .tip .gov i { flex: none; width: 0.6rem; height: 0.6rem; transform: translateY(0.05rem); }
  .tip .move b { font-weight: 600; }
</style>
