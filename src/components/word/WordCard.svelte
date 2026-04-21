<script lang="ts">
  import type { WordRecord } from '../../types/research.types';
  import NoteArea from '../ui/NoteArea.svelte';

  interface Props {
    word: WordRecord;
    selected?: boolean;
    onSelect: (wordId: number) => void;
    onSaveTranslation: (wordId: number, translation: string) => void;
    onSaveNotes: (wordId: number, notes: string) => void;
  }

  let { word, selected = false, onSelect, onSaveTranslation, onSaveNotes }: Props = $props();
  let translation = $state('');

  $effect(() => {
    translation = word.translation;
  });
</script>

<article class="panel word-card" data-selected={selected}>
  <button type="button" class="card-head" onclick={() => onSelect(word.id)}>
    <div>
      <h3 class="workspace-title">{word.lemma}</h3>
      <div class="mono muted">
        {word.linkedParagraphCount} paragraphs / {word.linkedSentenceCount} sentences
      </div>
    </div>
    <span class="section-label">{selected ? 'focus' : 'word'}</span>
  </button>

  <label class="field">
    <span class="section-label">Translation</span>
    <input bind:value={translation} placeholder="Manual translation" onblur={() => onSaveTranslation(word.id, translation)} />
  </label>

  {#if selected}
    <NoteArea
      label="Notes"
      value={word.notes}
      placeholder="Word notes"
      onCommit={(value) => onSaveNotes(word.id, value)}
    />
  {/if}
</article>

<style>
  .word-card {
    display: grid;
    gap: 10px;
  }

  .word-card[data-selected='true'] {
    border-color: var(--color-border-active);
  }

  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    text-align: left;
  }

  .field {
    display: grid;
    gap: 6px;
  }

  input {
    min-height: 34px;
    padding: 0 8px;
  }
</style>
