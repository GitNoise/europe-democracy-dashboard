<script>
  // Headline, flag and subtitle for one country. The wording rules live in lib/headline.js.
  import { headlineFor } from '../lib/headline.js';

  let { country } = $props();
  const h = $derived(headlineFor(country));
  const flagSrc = $derived(country.flag ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(country.flag)}` : null);
</script>

{#if flagSrc}<img class="flag" src={flagSrc} alt="" />{/if}
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
  /* the flag runs from the top of the headline's capitals to the baseline of its second line, 4:3 wide */
  .flag { position: absolute; top: calc(1.75rem + 0.26rem); right: 1.75rem; height: 2.91rem; width: auto;
          box-shadow: 0 0 0 1px var(--border); border-radius: 2px; }
  h1 { font-family: var(--font-serif); font-size: 1.6rem; font-weight: 700; line-height: 1.12; letter-spacing: -0.015em;
       margin: 0 0 0.45rem; text-wrap: pretty; padding-right: calc(2.91rem * 4 / 3 + 1.5rem); }
  p { color: var(--text-muted); font-size: 0.9rem; line-height: 1.4; margin: 0 0 0.4rem; text-wrap: pretty; }
  p.last { margin-bottom: 1.1rem; }
  b { color: var(--text); font-variant-numeric: tabular-nums; }
</style>
