<script>
  // The page: one country in a 4:5 frame (shareable as #HUN, #TUR, …), then every country as small multiples.
  import { onMount } from 'svelte';
  import Chart from './components/Chart.svelte';
  import Header from './components/Header.svelte';
  import SmallMultiples from './components/SmallMultiples.svelte';
  import { DEFAULT_COUNTRY } from './lib/constants.js';
  import { countryView, loadData } from './lib/data.js';
  import { headLanes } from './lib/chartLayout.js';

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

  // footnotes to the head-of-state lanes, numbered as on the chart (lib/chartLayout.js headLanes)
  const FOOTNOTES = {
    cabinet: 'Head of state, cabinet: years when V-Dem judges the head of state to share or hold the power to appoint and dismiss ministers.',
    veto: 'Head of state, veto: years when the head of state can block laws that parliament can only override with a supermajority, or not at all.',
  };
</script>

<nav class="masthead" aria-label="Site">
  <div class="inner">
    <a class="title" href="https://gitnoise.github.io/portfolio/">Patrick Wojda</a>
    <span class="project">Democracy in Europe</span>
    <span class="links">
      <a href="https://www.v-dem.net/">Data: V-Dem v16</a>
      <a href="https://github.com/GitNoise/europe-democracy-dashboard">Code</a>
    </span>
  </div>
</nav>

<header class="intro">
  <h1><span class="label">Who governed</span> when Europe’s democracies <span class="rose">rose</span> and <span class="fell">fell</span></h1>
  <p class="dek">
    Democracies don’t erode or recover on their own: someone is in charge while it happens. For every European country
    in V-Dem’s data, this page follows the Liberal Democracy Index since 1945, from 0 (least democratic) to 1 (most;
    <a href="#index">what the score means</a>), and shades the party that led the government during each big rise or fall.
  </p>
  <p class="byline">A project by <a href="https://gitnoise.github.io/portfolio/">Patrick Wojda</a></p>
</header>

<div class="picker" id="chart">
  <div class="bar">
    <label for="country">Country</label>
    <select id="country" value={country?.id} onchange={(e) => select(e.currentTarget.value)}>
      {#each byName as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
    </select>
  </div>
  <span class="or">or <button type="button" class="link" onclick={scrollToAll}>browse all countries ↓</button></span>
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
      Source: V-Dem Institute (v16). Shaded: the party in power during each big rise or fall. Government: every government,
      coalition partners stacked under the leading party.
      <a href="#method">How this works</a>.
    </p>
    {#if country.heads.length}
      <ol class="footnotes">
        {#each headLanes(country) as l}<li value={l.n}>{FOOTNOTES[l.power]}</li>{/each}
        <li class="plain">In other years the head of state’s role is ceremonial.</li>
      </ol>
    {/if}
  {/if}
</main>

{#if countries.length && fontsReady}
  <section class="all" id="all">
    <h2>All countries at a glance</h2>
    <p>Every country from 1945 to 2025 on the same scale, with the same shading as the chart above. Under each chart: how far its score moved since 2015. Select one to open its chart.</p>
    <SmallMultiples {countries} selected={country?.id} onselect={(id) => { select(id); scrollToChart(); }} />
  </section>
{/if}

<section class="method" id="method">
  <h2>How this works</h2>
  <p id="index">
    <b>The score.</b> V-Dem’s Liberal Democracy Index (version 16) rates how far a country lives up to liberal
    democracy, from 0 (least democratic) to 1 (most). Country experts rate each country and year, and a statistical model
    combines their ratings. It has two halves, free and fair elections and limits on power (courts, parliament, the rule
    of law, civil liberties); half of the index is the two multiplied, so a country needs both to score high. Every chart
    shows the full scale.
  </p>
  <p>
    <b>Regime class.</b> An electoral democracy holds free and fair elections; a liberal democracy also limits what the
    winners can do. The class in each subtitle is V-Dem’s Regimes of the World, which uses its own criteria, not a
    cut-off on the score, so a lower-scoring country can be the more democratic class.
  </p>
  <p>
    <b>Uncertainty.</b> Each score is an estimate, with a range that holds the true value with 68% probability.
    Countries whose ranges overlap can’t be ranked against each other, and a change counts only when the ranges before
    and after don’t overlap. New V-Dem releases can revise past years.
  </p>
  <p>
    <b>Big moves.</b> Rises and falls follow V-Dem’s Episodes of Regime Transformation and count from 0.10. Sharp
    back-and-forth swings and one-year jumps count too.
  </p>
  <p>
    <b>Shading.</b> A party is shaded when at least a quarter of a big move happened while it governed. A coalition takes
    its leading party’s colour; provisional, caretaker, technocratic and unity governments are grey. A headline names a
    party only when it governed for most of the move.
  </p>
  <p>
    <b>Government and head of state.</b> The strip shows every government since 1945, coalition partners stacked under
    the leading party, or the president where the president runs the country. Below it, the head of state appears only
    in the years V-Dem judges them to share power over ministers (“cabinet”) or to hold a veto that parliament can only
    override with a supermajority (“veto”). Otherwise the role is ceremonial.
  </p>
  <p>
    <b>Notes.</b> A note names an event that coincides with a move, not proof that it caused it. Every note has a checked
    source in the <a href="https://github.com/gitnoise/europe-democracy-dashboard/blob/main/pipeline/notes.csv">notes
    file</a>: Wikipedia and Wikidata for events, expert reports for judgements about how a country was governed.
  </p>
  <p>
    <b>Limits.</b> Shading shows who governed during a move, not who caused it. Party colours, and where a coalition
    ends and a unity government begins, are judgement calls.
  </p>
  <p>
    Every threshold is in <a href="https://github.com/GitNoise/europe-democracy-dashboard/blob/main/pipeline/RULES.md">the rules</a>
    and the pipeline’s <a href="https://github.com/GitNoise/europe-democracy-dashboard/blob/main/pipeline/config.json">config</a>.
    Data: V-Dem, ParlGov, Wikipedia and Wikidata. Flags: flag-icons (MIT).
  </p>
</section>

<footer>
  <p>Data and code: <a href="https://github.com/GitNoise/europe-democracy-dashboard">github.com/GitNoise/europe-democracy-dashboard</a>.</p>
  <p>Made by Patrick Wojda. More of my work is in my <a href="https://gitnoise.github.io/portfolio/">portfolio</a>, or find me on <a href="https://www.linkedin.com/in/patrickwojda/">LinkedIn</a>.</p>
</footer>

<style>
  .masthead { margin: 0 -1rem var(--space-5); font-family: var(--font-sans); font-size: 0.88rem; }
  .masthead .inner { max-width: 46rem; margin-inline: auto; padding: 0.9rem 1rem; display: flex; gap: 1rem; align-items: baseline; flex-wrap: wrap; }
  .masthead .title { font-weight: 700; }
  .masthead .project { color: var(--text-muted); }
  @media (max-width: 30rem) { .masthead .project { display: none; } }   /* phones: name and links on one line */
  .masthead .links { margin-left: auto; display: flex; gap: 1.25rem; }
  .masthead a { color: var(--text); text-decoration: none; }
  .masthead a:hover { text-decoration: underline; text-underline-offset: 3px; }

  .intro, .picker, .frame, .all, .method, footer { max-width: 46rem; margin-inline: auto; }
  .intro h1 { font-family: var(--font-display); font-size: clamp(2.6rem, 7.5vw, 4.2rem); font-weight: 800; line-height: 1; letter-spacing: -0.01em;
              margin: 0 0 var(--space-4); text-wrap: balance; }
  /* a little punk: the question cut out as a label, and the title acting out its own rise and fall */
  .intro h1 .label { background: var(--text); color: var(--page); padding: 0 0.18em; margin-right: 0.05em; box-decoration-break: clone;
                     -webkit-box-decoration-break: clone; display: inline-block; transform: rotate(-1.5deg); }
  .intro h1 .rose, .intro h1 .fell { display: inline-block; }
  .intro h1 .rose { transform: translateY(-0.22em) rotate(-6deg); }
  .intro h1 .fell { transform: translateY(0.22em) rotate(7deg); transform-origin: left center; }
  .dek { font-size: 1.25rem; line-height: 1.5; margin: 0 0 var(--space-2); max-width: 40rem; text-wrap: pretty; }
  .byline { font-family: var(--font-sans); font-size: 0.85rem; color: var(--text-muted); margin: 0; }

  /* the picker box and the link to the grid, side by side on the text column's left edge */
  .picker { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem 1.25rem; margin-top: var(--space-6); margin-bottom: var(--space-3);
            font-family: var(--font-sans); font-size: 0.9rem; scroll-margin-top: 1rem; }
  .bar { display: flex; align-items: stretch; min-width: 0; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); }
  .bar label { display: flex; align-items: center; padding: 0.5rem 0.75rem; border-inline: 1px solid var(--rule); }
  select { font: inherit; font-weight: 600; color: var(--text); background: transparent; border: none; border-radius: 0; cursor: pointer;
           padding: 0.5rem 1.8rem 0.5rem 0.75rem; appearance: none;
           background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(-45deg, transparent 50%, currentColor 50%);
           background-size: 5px 5px; background-position: right 12px center, right 7px center; background-repeat: no-repeat; }
  /* the dropdown is its own box, closed by a rule; the link to the grid sits on its own row below */
  select { flex: 0 1 15rem; min-width: 10rem; border-right: 1px solid var(--rule); }
  select:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .or { color: var(--text-muted); white-space: nowrap; }
  .link { all: unset; cursor: pointer; color: var(--text); text-decoration: underline; text-underline-offset: 3px; white-space: nowrap; }
  .link:hover { color: var(--accent); }
  .link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  .frame { position: relative; aspect-ratio: 4 / 5; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; }
  .frame > :global(*) { flex: none; }
  .frame > :global(.chart) { flex: 1 1 0; }
  /* on phones the 4:5 frame leaves the chart no room under a long headline: let the frame grow, give the chart a fixed height */
  @media (max-width: 40rem) {
    .frame { aspect-ratio: auto; }
    .frame > :global(.chart) { flex: none; height: 22rem; }
  }
  .status { color: var(--text-muted); margin: auto; font-family: var(--font-sans); font-size: 0.9rem; }
  .source { font-family: var(--font-sans); color: var(--text-muted); font-size: 0.78rem; line-height: 1.6; margin: var(--space-2) 0 0; }
  /* footnotes to the head-of-state lanes: same face as the source line, numbered like the labels on the chart */
  .footnotes { font-family: var(--font-sans); color: var(--text-muted); font-size: 0.78rem; line-height: 1.6; margin: 0.3rem 0 0; padding-left: 1.2rem; }
  .footnotes li::marker { font-family: var(--font-chart); font-size: 0.72rem; }
  .footnotes li.plain { list-style: none; }

  .all { margin-top: var(--space-6); scroll-margin-top: 1rem; }
  .all h2 { font-family: var(--font-display); font-size: 2rem; font-weight: 800; line-height: 1.05; letter-spacing: -0.01em; margin: 0 0 var(--space-1); }
  .all p { color: var(--text-muted); font-size: 1.05rem; line-height: 1.45; margin: 0; }
  .method { margin-top: var(--space-6); scroll-margin-top: 1rem; }
  .method h2 { font-family: var(--font-display); font-size: 2rem; font-weight: 800; line-height: 1.05; letter-spacing: -0.01em; margin: 0 0 var(--space-3); }
  .method p[id] { scroll-margin-top: var(--space-3); }
  .method p { font-size: 1.05rem; line-height: 1.55; margin: 0 0 var(--space-2); max-width: 40rem; }
  .method b { font-family: var(--font-display); font-weight: 700; }
  .method a, .source a { color: var(--text); text-underline-offset: 3px; }
  footer { margin-top: var(--space-6); font-family: var(--font-sans); font-size: 0.82rem; color: var(--text-muted); }
  footer a, .byline a { color: var(--text); text-underline-offset: 3px; }
  footer p { margin: 0 0 0.4rem; }
</style>
