<script lang="ts">
  import NoteArea from '../ui/NoteArea.svelte';
  import type { ImageRecord } from '../../types/research.types';

  interface Props {
    image: ImageRecord;
    selected?: boolean;
    onSelect: (imageId: number) => void;
    onSaveCaption: (imageId: number, caption: string) => void;
    onSaveNotes: (imageId: number, notes: string) => void;
    onDelete: (imageId: number) => void;
  }

  let { image, selected = false, onSelect, onSaveCaption, onSaveNotes, onDelete }: Props = $props();
  let caption = $state('');
  let objectUrl = $state('');

  $effect(() => {
    caption = image.caption;
  });

  $effect(() => {
    const url = URL.createObjectURL(image.blob);
    objectUrl = url;

    return () => {
      URL.revokeObjectURL(url);
    };
  });
</script>

<article class="panel image-card" data-selected={selected}>
  <button type="button" class="preview" onclick={() => onSelect(image.id)}>
    <img src={objectUrl} alt={image.caption || `Image ${image.id}`} loading="lazy" />
  </button>

  <label class="field">
    <span class="section-label">Caption</span>
    <input bind:value={caption} placeholder="Image caption" onblur={() => onSaveCaption(image.id, caption)} />
  </label>

  <NoteArea
    label="Notes"
    value={image.notes}
    rows={3}
    placeholder="Image notes"
    onCommit={(value) => onSaveNotes(image.id, value)}
  />

  <button type="button" class="mono" onclick={() => onDelete(image.id)}>delete image</button>
</article>

<style>
  .image-card {
    display: grid;
    gap: 8px;
  }

  .image-card[data-selected='true'] {
    border-color: var(--color-border-active);
  }

  .preview {
    padding: 0;
    overflow: hidden;
    aspect-ratio: 16 / 10;
  }

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
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
