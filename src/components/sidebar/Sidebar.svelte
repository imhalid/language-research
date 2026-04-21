<script lang="ts">
  import type { ChapterTreeNode } from '../../types/research.types';
  import ChapterTree from './ChapterTree.svelte';

  interface Props {
    chapters: ChapterTreeNode[];
    activeChapterId: number | null;
    expandedIds: number[];
    chapterTitle: string;
    onSelect: (id: number) => void;
    onToggle: (id: number) => void;
    onAddRoot: () => void;
    onAddChild: (id: number) => void;
    onDelete: (id: number) => void;
  }

  let {
    chapters,
    activeChapterId,
    expandedIds,
    chapterTitle,
    onSelect,
    onToggle,
    onAddRoot,
    onAddChild,
    onDelete
  }: Props = $props();
</script>

<aside class="sidebar">
  <section class="panel stack">
    <div class="title-row">
      <div>
        <div class="eyebrow muted">Language Research App</div>
        <h1>Faz 7</h1>
      </div>
      <div class="status-pill"><span class="status-dot live"></span> edit</div>
    </div>
    <p class="summary">{chapterTitle}</p>
  </section>

  <section class="panel stack">
    <div class="section-row">
      <h2 class="workspace-title">Chapters</h2>
      <button type="button" class="mono" onclick={onAddRoot}>+ root</button>
    </div>
    <ChapterTree
      items={chapters}
      {activeChapterId}
      {expandedIds}
      {onSelect}
      {onToggle}
      {onAddChild}
      {onDelete}
    />
  </section>
</aside>
