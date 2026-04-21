<script lang="ts">
  const tables = ['chapters', 'paragraphs', 'sentences', 'words', 'occurrences', 'canvasNodes'];
  const machines = ['canvas.machine', 'chapter.machine', 'selection.machine', 'wordnet.machine'];
  const tokens = ['oklch palette', 'compact spacing', 'mono labels', '24px canvas grid'];
</script>

<svelte:head>
  <title>Language Research App</title>
  <meta
    name="description"
    content="Local-first language research workspace with Phase 1 data layer, machine skeletons and compact TUI design system."
  />
</svelte:head>

<main class="app-shell">
  <aside class="sidebar">
    <section class="panel stack">
      <div class="title-row">
        <div>
          <div class="eyebrow muted">Language Research App</div>
          <h1>Faz 1</h1>
        </div>
        <div class="status-pill"><span class="status-dot live"></span> active</div>
      </div>
      <p class="summary">Dexie schema, machine skeletons, compact TUI shell.</p>
    </section>

    <section class="panel">
      <div class="section-row">
        <h2 class="workspace-title">IndexedDB v1</h2>
        <span class="section-label">schema</span>
      </div>
      <ul class="terminal-list">
        {#each tables as table}
          <li><span>{table}</span><span class="list-meta">ready</span></li>
        {/each}
      </ul>
    </section>
  </aside>

  <section class="workspace">
    <section class="panel workspace-header">
      <div class="workspace-meta">
        <span class="section-label">workspace</span>
        <span class="mono muted">wordnet.json local / 96MB</span>
      </div>
      <div class="metric-grid">
        <article class="metric"><span class="section-label">stack</span><strong>SvelteKit</strong></article>
        <article class="metric"><span class="section-label">state</span><strong>XState v5</strong></article>
        <article class="metric"><span class="section-label">storage</span><strong>Dexie</strong></article>
      </div>
    </section>

    <section class="workspace-grid">
      <section class="panel canvas-stage canvas-grid">
        <div class="stage-copy">
          <div class="section-row">
            <h2 class="workspace-title">Canvas shell</h2>
            <span class="section-label">phase 2 target</span>
          </div>
          <p>Grid, spacing, muted palette, flat panel system ready for node canvas work.</p>
          <div class="tag-row">
            {#each tokens as token}
              <span class="tag">{token}</span>
            {/each}
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="section-row">
          <h2 class="workspace-title">State actors</h2>
          <span class="section-label">skeleton</span>
        </div>
        <ul class="terminal-list">
          {#each machines as machine}
            <li><span>{machine}</span><span class="list-meta">bootstrapped</span></li>
          {/each}
        </ul>
      </section>
    </section>
  </section>

  <aside class="inspector">
    <section class="panel">
      <div class="section-row">
        <h2 class="workspace-title">Next</h2>
        <span class="section-label">faz 2</span>
      </div>
      <ol class="timeline">
        <li><span>Infinity canvas</span><span class="list-meta">pending</span></li>
        <li><span>Drag persistence</span><span class="list-meta">pending</span></li>
        <li><span>Minimap</span><span class="list-meta">pending</span></li>
      </ol>
    </section>

    <section class="panel stack">
      <div class="section-row">
        <h3 class="workspace-title">Assets</h3>
        <span class="section-label">loaded</span>
      </div>
      <p class="summary">`static/wordnet.json`, `src/types/wordnet.types.ts`, `rope-manager.js`</p>
    </section>
  </aside>
</main>
