<script>
  // Headline and subtitle for one country. The wording rules live in lib/headline.js.
  import { headlineFor } from '../lib/headline.js';

  let { country } = $props();
  const h = $derived(headlineFor(country));
</script>

<h1>{h.title}</h1>
<p>Shaded periods show which parties governed during the biggest rises and falls in V-Dem’s Liberal Democracy Index.</p>
{#if h.numbers}
  <p>On V-Dem’s Liberal Democracy Index, the score went from <b>{h.numbers.from}</b> in {h.numbers.fromYear} to <b>{h.numbers.to}</b> in {h.numbers.toYear}.</p>
{/if}
{#if h.slow}
  <p>From {h.slow.from} to {h.slow.to}, the score {h.slow.rising ? 'rose' : 'fell'} slowly by <b>{h.slow.change}</b>, mainly through {h.slow.driver}.</p>
{/if}
{#if h.regime}
  {@const [article, ...kind] = h.regime.name.split(' ')}
  <p class="last">V-Dem classifies {country.name} as {article} <span class="regime" style:color="var(--regime-{h.regime.index})">{kind.join(' ')}</span>: {h.regime.explained}.</p>
{/if}

<style>
  h1 { font-family: var(--font-display); font-size: 2.2rem; font-weight: 800; line-height: 1.05; letter-spacing: -0.01em; margin: 0 0 var(--space-1); text-wrap: pretty; }
  p { color: var(--text-muted); font-size: 1rem; line-height: 1.45; margin: 0 0 0.35rem; text-wrap: pretty; }
  p.last { margin-bottom: var(--space-3); }
  /* the regime class in its colour (app.css), the same as by the end of the line */
  .regime { font-weight: 600; }
  b { color: var(--text); font-weight: 600; font-variant-numeric: tabular-nums; }
</style>
