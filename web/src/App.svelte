<script>
  // The page: one country in a 4:5 frame (shareable as #HUN, #TUR, …), then every country as small multiples.
  import { onMount } from 'svelte';
  import Chart from './components/Chart.svelte';
  import Header from './components/Header.svelte';
  import SmallMultiples from './components/SmallMultiples.svelte';
  import { DEFAULT_COUNTRY } from './lib/constants.js';
  import { countryView, loadData } from './lib/data.js';

  let db = $state(null);
  let error = $state(null);
  let selected = $state(location.hash.slice(1) || DEFAULT_COUNTRY);
  let fontsReady = $state(false);

  const countries = $derived(db ? [...db.scoresById.keys()].map((id) => countryView(db, id)).filter(Boolean) : []);
  const country = $derived(countries.find((c) => c.id === selected) ?? countries.find((c) => c.id === DEFAULT_COUNTRY));
  const byName = $derived([...countries].sort((a, b) => a.name.localeCompare(b.name)));

  onMount(() => {
    loadData().then((d) => (db = d)).catch((e) => (error = e.message));
    // text is measured for layout, so wait for the web fonts before the first draw
    document.fonts.ready.then(() => (fontsReady = true));
    const onHash = () => (selected = location.hash.slice(1) || DEFAULT_COUNTRY);
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  });

  function select(id) {
    history.replaceState(null, '', `#${id}`);
    selected = id;
  }

  const scrollToChart = () => document.getElementById('chart')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const scrollToAll = () => document.getElementById('all')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
</script>

<nav class="masthead" aria-label="Site">
  <div class="inner">
    <span class="title">Democracy in Europe</span>
    <span class="links">
      <a href="https://www.v-dem.net/">Data: V-Dem v16</a>
      <a href="https://github.com/GitNoise/europe-democracy-dashboard">Code</a>
    </span>
  </div>
</nav>

<header class="intro">
  <h1>Who governed when Europe’s democracies rose and fell</h1>
  <p class="dek">
    Democracies don’t erode or recover on their own: someone is in charge while it happens. For every European country
    in V-Dem’s data, this page follows the Liberal Democracy Index since 1945, from 0 (least democratic) to 1 (most),
    and shades the party that led the government during each big rise or fall.
  </p>
  <p class="byline">{countries.length || 45} countries · 1945–2025 · Liberal Democracy Index</p>
</header>

<div class="bar" id="chart">
  <label for="country">Country</label>
  <select id="country" value={country?.id} onchange={(e) => select(e.currentTarget.value)}>
    {#each byName as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
  </select>
  <button type="button" class="link" onclick={scrollToAll}>All countries ↓</button>
</div>

<main class="frame">
  {#if error}
    <p class="status">Couldn’t load the data ({error}).</p>
  {:else if !country || !fontsReady}
    <p class="status">Loading…</p>
  {:else}
    <Header {country} />
    {#key country.id}<Chart {country} />{/key}
    <p class="source">
      Source: V-Dem Institute (v16). Countries: all European states in V-Dem, including Türkiye,
      Cyprus and the South Caucasus. Shaded: the party leading the government during a rise or fall of 0.10 or more (when
      at least a quarter of the move happened on its watch), after V-Dem’s Episodes of Regime Transformation; grey for
      coalitions, caretakers and unknown party colours. Governments, party colours and notes compiled from public records.
      Flags: flag-icons (MIT).
    </p>
  {/if}
</main>

{#if countries.length && fontsReady}
  <section class="all" id="all">
    <h2>All countries at a glance</h2>
    <p>Every country since 1945 on the same scale, with the same shading as the chart above. Select one to open its chart.</p>
    <SmallMultiples {countries} selected={country?.id} onselect={(id) => { select(id); scrollToChart(); }} />
  </section>
{/if}

<footer>
  Methods, data and code: <a href="https://github.com/GitNoise/europe-democracy-dashboard">github.com/GitNoise/europe-democracy-dashboard</a>.
</footer>

<style>
  .masthead { margin: 0 -1rem 3rem; border-bottom: 1px solid var(--rule); font-family: var(--font-mono); font-size: 0.78rem; }
  .masthead .inner { max-width: 46rem; margin-inline: auto; padding: 0.9rem 1rem; display: flex; gap: 1rem; align-items: baseline; flex-wrap: wrap; }
  .masthead .title { font-weight: 600; }
  .masthead .links { margin-left: auto; display: flex; gap: 1.25rem; }
  .masthead a { color: var(--text); text-decoration: none; }
  .masthead a:hover { text-decoration: underline; text-underline-offset: 3px; }

  .intro, .bar, .frame, .all, footer { max-width: 46rem; margin-inline: auto; }
  .intro { margin-bottom: 2.25rem; }
  .intro h1 { font-size: clamp(2.2rem, 6vw, 3.4rem); font-weight: 500; line-height: 1.04; letter-spacing: -0.02em;
              margin: 0 0 1.1rem; text-wrap: balance; }
  .dek { font-size: 1.25rem; line-height: 1.5; margin: 0 0 1.1rem; max-width: 40rem; text-wrap: pretty; }
  .byline { font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); margin: 0; }

  .bar { display: flex; flex-wrap: wrap; align-items: stretch; margin-bottom: 1.75rem; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule);
         font-family: var(--font-mono); font-size: 0.8rem; scroll-margin-top: 1rem; }
  .bar label { display: flex; align-items: center; padding: 0.5rem 0.75rem 0.5rem 0; border-right: 1px solid var(--rule); }
  select { font: inherit; font-weight: 600; color: var(--text); background: transparent; border: none; border-radius: 0; cursor: pointer;
           padding: 0.5rem 1.8rem 0.5rem 0.75rem; appearance: none;
           background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(-45deg, transparent 50%, currentColor 50%);
           background-size: 5px 5px; background-position: right 12px center, right 7px center; background-repeat: no-repeat; }
  select { flex: 1 1 7rem; min-width: 0; }
  select:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .link { all: unset; cursor: pointer; margin-left: auto; padding: 0.5rem 0.9rem; background: var(--text); color: var(--page); font-weight: 600; }
  .link:hover { background: var(--accent); }
  .link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  .frame { position: relative; aspect-ratio: 4 / 5; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; }
  .frame > :global(*) { flex: none; }
  .frame > :global(.chart) { flex: 1 1 0; }
  /* on phones the 4:5 frame leaves the chart no room under a long headline: let the frame grow, give the chart a fixed height */
  @media (max-width: 40rem) {
    .frame { aspect-ratio: auto; }
    .frame > :global(.chart) { flex: none; height: 22rem; }
  }
  .status { color: var(--text-muted); margin: auto; font-family: var(--font-mono); font-size: 0.8rem; }
  .source { font-family: var(--font-mono); color: var(--text-muted); font-size: 0.68rem; line-height: 1.6; margin: 1.25rem 0 0; }

  .all { margin-top: 4rem; padding-top: 0.75rem; border-top: 1px solid var(--rule); scroll-margin-top: 1rem; }
  .all h2 { font-size: 2rem; font-weight: 500; line-height: 1.1; letter-spacing: -0.015em; margin: 0 0 0.5rem; }
  .all p { color: var(--text-muted); font-size: 1.05rem; line-height: 1.45; margin: 0; }
  footer { margin-top: 3.5rem; padding-top: 0.75rem; border-top: 1px solid var(--rule); font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); }
  footer a { color: var(--text); }
</style>
