<script lang="ts">
  import type { ChapterTreeNode } from '../../types/research.types';
  import ChapterTree from './ChapterTree.svelte';
  import ChapterItem from './ChapterItem.svelte';

  interface Props {
    items: ChapterTreeNode[];
    activeChapterId: number | null;
    expandedIds: number[];
    onSelect: (id: number) => void;
    onToggle: (id: number) => void;
    onAddChild: (id: number) => void;
    onDelete: (id: number) => void;
    depth?: number;
  }

  let {
    items,
    activeChapterId,
    expandedIds,
    onSelect,
    onToggle,
    onAddChild,
    onDelete,
    depth = 0
  }: Props = $props();
</script>

<div class="tree" style={`--depth:${depth};`}>
  {#each items as chapter (chapter.id)}
    <div class="branch">
      <ChapterItem
        active={chapter.id === activeChapterId}
        expanded={expandedIds.includes(chapter.id)}
        {chapter}
        {onSelect}
        {onToggle}
        {onAddChild}
        {onDelete}
      />

      {#if chapter.children.length > 0 && expandedIds.includes(chapter.id)}
        <ChapterTree
          items={chapter.children}
          {activeChapterId}
          {expandedIds}
          {onSelect}
          {onToggle}
          {onAddChild}
          {onDelete}
          depth={depth + 1}
        />
      {/if}
    </div>
  {/each}
</div>

<style>
  .tree {
    display: grid;
    gap: 4px;
    padding-left: calc(var(--depth) * 12px);
  }

  .branch {
    display: grid;
    gap: 4px;
  }
</style>
