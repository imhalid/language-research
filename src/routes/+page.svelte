<script lang="ts">
  const phases = [
    'Faz 1: Dexie schema, type sistemi, machine iskeletleri, design tokens',
    'Faz 2: Infinite canvas ve node altyapisi',
    'Faz 3: Chapter ve paragraph CRUD',
    'Faz 4: Kelime sistemi ve highlight akisi',
    'Faz 5: WordNet worker, FlexSearch, morphology',
    'Faz 6: Rope overlay ve baglanti gorsellestirmesi',
    'Faz 7: Yardimci araclar, image upload, settings persistence'
  ];
</script>

<svelte:head>
  <title>Language Research App</title>
  <meta
    name="description"
    content="Local-first language research workspace scaffolded with SvelteKit, Svelte 5, Dexie, XState and FlexSearch."
  />
</svelte:head>

<main class="shell">
  <section class="panel">
    <p class="eyebrow">Language Research App</p>
    <h1>Faz 0 basladi</h1>
    <p class="summary">
      Proje iskeleti kuruldu. SvelteKit tabani hazir. Sonraki adim temel altyapi dosyalari.
    </p>

    <div class="meta">
      <div>
        <span class="label">Stack</span>
        <strong>SvelteKit + Svelte 5 + TypeScript + Vite</strong>
      </div>
      <div>
        <span class="label">Hazir asset</span>
        <strong>`/static/wordnet.json`, `src/types/wordnet.types.ts`</strong>
      </div>
    </div>

    <ol>
      {#each phases as phase}
        <li>{phase}</li>
      {/each}
    </ol>
  </section>
</main>

<style>
  .shell {
    display: grid;
    min-height: 100vh;
    place-items: center;
    padding: 24px;
    background:
      radial-gradient(circle at top, rgba(86, 146, 255, 0.18), transparent 35%),
      linear-gradient(180deg, #131823 0%, #0f1217 100%);
  }

  .panel {
    width: min(760px, 100%);
    padding: 32px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px;
    background: rgba(12, 16, 24, 0.88);
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.32);
  }

  .eyebrow,
  .label {
    margin: 0 0 8px;
    color: #86b1ff;
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0 0 12px;
    font-size: clamp(2rem, 6vw, 3.5rem);
    line-height: 1;
  }

  .summary {
    margin: 0 0 24px;
    max-width: 56ch;
    color: rgba(243, 245, 247, 0.82);
  }

  .meta {
    display: grid;
    gap: 16px;
    margin-bottom: 24px;
    padding: 16px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.04);
  }

  .meta strong {
    display: block;
    font-size: 1rem;
  }

  ol {
    margin: 0;
    padding-left: 1.2rem;
    color: rgba(243, 245, 247, 0.82);
  }

  li + li {
    margin-top: 10px;
  }
</style>
