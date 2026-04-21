<script lang="ts">
  import type { ParagraphRecord, SentenceSelection } from '../../types/research.types';
  import ParagraphText from './ParagraphText.svelte';

  interface Props {
    paragraph: ParagraphRecord;
    version: number;
    onSaveNotes: (paragraphId: number, notes: string) => void;
    onDelete: (paragraphId: number) => void;
    onSplitSentence: (paragraphId: number, selection: SentenceSelection) => void;
    onLinkWord: (paragraphId: number, token: import('../../types/research.types').HighlightToken) => void;
    onHoverWord: (wordId: number | null) => void;
    onSelectWord: (wordId: number | null) => void;
  }

  let {
    paragraph,
    version,
    onSaveNotes,
    onDelete,
    onSplitSentence,
    onLinkWord,
    onHoverWord,
    onSelectWord
  }: Props = $props();
  let draftNotes = $state('');

  $effect(() => {
    draftNotes = paragraph.notes;
  });
</script>

<article class="panel paragraph-card">
  <div class="section-row">
    <div>
      <h3 class="workspace-title">Paragraph {paragraph.id}</h3>
      <div class="mono muted">{paragraph.sentenceCount} sentence nodes</div>
    </div>
    <button type="button" class="mono" onclick={() => onDelete(paragraph.id)}>delete</button>
  </div>

  <ParagraphText
    paragraphId={paragraph.id}
    content={paragraph.content}
    {version}
    {onSplitSentence}
    {onLinkWord}
    {onHoverWord}
    {onSelectWord}
  />

  <label class="field">
    <span class="section-label">Notes</span>
    <textarea
      bind:value={draftNotes}
      rows="4"
      placeholder="Manual notes"
      onblur={() => onSaveNotes(paragraph.id, draftNotes)}
    ></textarea>
  </label>
</article>

<style>
  .paragraph-card {
    display: grid;
    gap: 12px;
  }

  .field {
    display: grid;
    gap: 6px;
  }

  textarea {
    min-height: 88px;
    padding: 8px;
    resize: vertical;
  }
</style>
