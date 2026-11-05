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

<header class="intro">
  <p class="kicker">V-Dem Liberal Democracy Index · {countries.length || 45} countries · 1945–2025</p>
  <h1>Who governed when Europe’s democracies rose and fell</h1>
  <p class="dek">
    Democracies don’t erode or recover on their own: someone is in charge while it happens. For every European country
    in V-Dem’s data, this page follows the Liberal Democracy Index since 1945 and shades the parties in power during
    each big rise or fall.
  </p>
  <ul class="key">
    <li>
      <svg viewBox="0 0 28 14" aria-hidden="true"><path d="M1 11 L8 9 L13 10 L19 4 L27 3" fill="none" stroke="var(--ink)" stroke-width="1.6" stroke-linejoin="round" /></svg>
      <span><b>The line</b> is V-Dem’s score, from 0 (least democratic) to 1 (most).</span>
    </li>
    <li>
      <svg viewBox="0 0 28 14" aria-hidden="true"><rect x="2" y="0" width="11" height="14" fill="#1B3892" fill-opacity="0.22" /><rect x="15" y="0" width="11" height="14" fill="#9aa0a6" fill-opacity="0.22" /></svg>
      <span><b>Shading</b> marks who led the government during a rise or fall of 0.10 or more. Grey: coalitions, caretakers, no set colour.</span>
    </li>
    <li>
      <svg viewBox="0 0 28 14" aria-hidden="true"><path d="M3 3 C 12 2, 18 5, 22 11" fill="none" stroke="var(--ink)" stroke-width="1.2" /><path d="M19 10 L22 11 L22.5 7.8" fill="none" stroke="var(--ink)" stroke-width="1.2" /></svg>
      <span><b>Notes</b> say what happened at each turning point.</span>
    </li>
  </ul>
</header>

<div class="bar" id="chart">
  <label for="country">Country</label>
  <select id="country" value={country?.id} onchange={(e) => select(e.currentTarget.value)}>
    {#each byName as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
  </select>
  <button type="button" class="link" onclick={scrollToAll}>or browse all countries ↓</button>
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
  .intro, .bar, .frame, .all, footer { max-width: 46rem; margin-inline: auto; }
  .intro { padding: 0.5rem 0 1.75rem; border-bottom: 1px solid var(--border); margin-bottom: 1.25rem; }
  .kicker { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted); margin: 0 0 0.6rem; }
  .intro h1 { font-family: var(--font-serif); font-size: clamp(1.9rem, 5vw, 2.6rem); line-height: 1.06; letter-spacing: -0.02em;
              margin: 0 0 0.8rem; text-wrap: balance; }
  .dek { font-size: 1.05rem; line-height: 1.5; margin: 0 0 1.25rem; max-width: 38rem; text-wrap: pretty; }
  .key { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: 0.6rem 1.25rem; }
  .key li { display: flex; gap: 0.55rem; align-items: flex-start; font-size: 0.8rem; line-height: 1.4; color: var(--text-muted); }
  .key svg { flex: none; width: 28px; height: 14px; margin-top: 0.15rem; }
  .key b { color: var(--text); }
  .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.75rem; margin-bottom: 0.75rem; font-size: 0.8rem; color: var(--text-muted);
         scroll-margin-top: 1rem; }
  .link { all: unset; cursor: pointer; color: var(--text-muted); text-decoration: underline; text-underline-offset: 2px; }
  .link:hover { color: var(--text); }
  .link:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; border-radius: 2px; }
  .all { scroll-margin-top: 1rem; }
  select { font: inherit; font-size: 0.85rem; color: var(--text); background: var(--panel); border: 1px solid var(--border); border-radius: 6px; padding: 0.3rem 0.5rem; }
  .frame { position: relative; aspect-ratio: 4 / 5; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;
           padding: 1.75rem 1.75rem 1.25rem; background: var(--panel); border: 1px solid var(--border); }
  .frame > :global(*) { flex: none; }
  .frame > :global(.chart) { flex: 1 1 0; }
  /* on phones the 4:5 frame leaves the chart no room under a long headline: let the frame grow, give the chart a fixed height */
  @media (max-width: 40rem) {
    .frame { aspect-ratio: auto; }
    .frame > :global(.chart) { flex: none; height: 22rem; }
  }
  .status { color: var(--text-muted); margin: auto; }
  .source { color: var(--text-muted); font-size: 0.68rem; line-height: 1.45; margin: 1.25rem 0 0; }
  .all { margin-top: 2.5rem; }
  .all h2 { font-family: var(--font-serif); font-size: 1.3rem; line-height: 1.15; margin: 0 0 0.35rem; letter-spacing: -0.01em; }
  .all p { color: var(--text-muted); font-size: 0.9rem; line-height: 1.4; margin: 0; }
  footer { margin-top: 2rem; font-size: 0.75rem; color: var(--text-muted); }
  footer a { color: inherit; }
</style>
