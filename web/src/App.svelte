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
</script>

<div class="bar">
  <label for="country">Country</label>
  <select id="country" value={country?.id} onchange={(e) => select(e.currentTarget.value)}>
    {#each byName as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
  </select>
  <span>European countries with a national election between 2022 and 2027</span>
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
      Source: V-Dem Institute (v16). Countries: European states with a national election in 2022–27, including Türkiye,
      Cyprus and the South Caucasus. Shaded: the party leading the government during a rise or fall of 0.10 or more (when
      at least a quarter of the move happened on its watch), after V-Dem’s Episodes of Regime Transformation; grey for
      coalitions, caretakers and unknown party colours. Governments, party colours and notes compiled from public records.
      Flags: flag-icons (MIT).
    </p>
  {/if}
</main>

{#if countries.length && fontsReady}
  <section class="all">
    <h2>All countries at a glance</h2>
    <p>V-Dem’s Liberal Democracy Index since 1945, on the same scale for every country, sorted by the latest score.
       Shaded: the parties that governed during the biggest rises and falls. Select a country to open its chart above.</p>
    <SmallMultiples {countries} onselect={(id) => { select(id); scrollTo({ top: 0, behavior: 'smooth' }); }} />
  </section>
{/if}

<footer>
  Methods, data and code: <a href="https://github.com/GitNoise/europe-democracy-dashboard">github.com/GitNoise/europe-democracy-dashboard</a>.
</footer>

<style>
  .bar, .frame, .all, footer { max-width: 46rem; margin-inline: auto; }
  .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.75rem; margin-bottom: 0.75rem; font-size: 0.8rem; color: var(--text-muted); }
  select { font: inherit; font-size: 0.85rem; color: var(--text); background: var(--panel); border: 1px solid var(--border); border-radius: 6px; padding: 0.3rem 0.5rem; }
  .frame { position: relative; aspect-ratio: 4 / 5; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;
           padding: 1.75rem 1.75rem 1.25rem; background: var(--panel); border: 1px solid var(--border); }
  .frame > :global(*) { flex: none; }
  .frame > :global(.chart) { flex: 1 1 0; }
  .status { color: var(--text-muted); margin: auto; }
  .source { color: var(--text-muted); font-size: 0.68rem; line-height: 1.45; margin: 1.25rem 0 0; }
  .all { margin-top: 2.5rem; }
  .all h2 { font-family: var(--font-serif); font-size: 1.3rem; line-height: 1.15; margin: 0 0 0.35rem; letter-spacing: -0.01em; }
  .all p { color: var(--text-muted); font-size: 0.9rem; line-height: 1.4; margin: 0; }
  footer { margin-top: 2rem; font-size: 0.75rem; color: var(--text-muted); }
  footer a { color: inherit; }
</style>
