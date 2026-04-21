<script lang="ts">
  import type { ChapterTreeNode } from '../../types/research.types';

  interface Props {
    chapter: ChapterTreeNode;
    active: boolean;
    expanded: boolean;
    onSelect: (id: number) => void;
    onToggle: (id: number) => void;
    onAddChild: (id: number) => void;
  }

  let { chapter, active, expanded, onSelect, onToggle, onAddChild }: Props = $props();
</script>

<div class="chapter-item" data-active={active}>
  <button type="button" class="toggle mono" onclick={() => onToggle(chapter.id)}>
    {chapter.children.length > 0 ? (expanded ? '−' : '+') : '·'}
  </button>
  <button type="button" class="label" onclick={() => onSelect(chapter.id)}>{chapter.title}</button>
  <button type="button" class="add mono" onclick={() => onAddChild(chapter.id)}>+</button>
</div>

<style>
  .chapter-item {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr) 20px;
    align-items: center;
    gap: 6px;
    min-height: 28px;
  }

  .chapter-item[data-active='true'] .label {
    color: var(--color-accent);
    border-color: var(--color-border-active);
  }

  .toggle,
  .add,
  .label {
    min-height: 24px;
    padding: 0 6px;
  }

  .label {
    justify-content: flex-start;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
</style>
