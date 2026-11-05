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
  <p class="last">V-Dem classifies {country.name} as {h.regime.name}: {h.regime.explained}.</p>
{/if}

<style>
  h1 { font-size: 1.6rem; font-weight: 800; line-height: 1.15; letter-spacing: -0.02em; margin: 0 0 0.5rem; text-wrap: balance; }
  p { color: var(--text-muted); font-size: 0.92rem; line-height: 1.45; margin: 0 0 0.35rem; text-wrap: pretty; }
  p.last { margin-bottom: 1.25rem; }
  b { color: var(--text); font-variant-numeric: tabular-nums; }
</style>
