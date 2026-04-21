<script lang="ts">
  import type { WordnetEntry } from '../../types/domain.types';
  import type { WordnetState } from '../../types/machine.types';
  import type { WordRecord } from '../../types/research.types';

  interface Props {
    word: WordRecord | null;
    status: WordnetState;
    progress: number;
    error: string | null;
    entry: WordnetEntry | null;
    loading?: boolean;
  }

  let { word, status, progress, error, entry, loading = false }: Props = $props();
</script>

<article class="panel stack">
  <div class="section-row">
    <h2 class="workspace-title">WordNet</h2>
    <span class="section-label">{status === 'done' ? 'ready' : `${progress}%`}</span>
  </div>

  {#if status === 'error'}
    <p class="summary">{error}</p>
  {:else if status !== 'done'}
    <p class="summary">Seeding wordnet.json, caching entries, rebuilding search index.</p>
  {:else if !word}
    <p class="summary">Select word. WordNet preview shows definitions, synonyms, examples.</p>
  {:else if loading}
    <p class="summary">Lookup {word.lemma} in local WordNet cache.</p>
  {:else if !entry}
    <p class="summary">No WordNet match for {word.lemma}.</p>
  {:else}
    <div class="stack">
      <div class="mono muted">
        {entry.synsets.length} synsets / {entry.synonyms.length} synonyms / {entry.examples.length} examples
      </div>
      <p class="summary">{entry.definitions[0]}</p>
      {#if entry.synonyms.length > 0}
        <p class="summary">Synonyms: {entry.synonyms.slice(0, 8).join(', ')}</p>
      {/if}
      {#if entry.examples.length > 0}
        <p class="summary">Example: {entry.examples[0]}</p>
      {/if}
    </div>
  {/if}
</article>
