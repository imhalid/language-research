<script lang="ts">
  import { onMount } from 'svelte';
  import { getSelectionOffsets, resolveSentenceSelection } from '../../lib/utils/parser';
  import type { SentenceSelection } from '../../types/research.types';
  import SentenceTooltip from './SentenceTooltip.svelte';

  interface Props {
    paragraphId: number;
    content: string;
    onSplitSentence: (paragraphId: number, selection: SentenceSelection) => void;
  }

  let { paragraphId, content, onSplitSentence }: Props = $props();

  let container: HTMLDivElement | null = null;
  let tooltip = $state<{ x: number; y: number; selection: SentenceSelection } | null>(null);

  const closeTooltip = (): void => {
    tooltip = null;
  };

  const updateSelection = (): void => {
    if (!container) return;

    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      closeTooltip();
      return;
    }

    const range = selection.getRangeAt(0);

    if (!container.contains(range.commonAncestorContainer)) {
      closeTooltip();
      return;
    }

    const offsets = getSelectionOffsets(container, range);
    const parsed = offsets
      ? resolveSentenceSelection(content, offsets.startOffset, offsets.endOffset)
      : null;

    if (!parsed) {
      closeTooltip();
      return;
    }

    const rect = range.getBoundingClientRect();
    const base = container.getBoundingClientRect();
    tooltip = {
      x: rect.left - base.left + rect.width / 2,
      y: Math.max(16, rect.top - base.top - 8),
      selection: parsed
    };
  };

  onMount(() => {
    const handleMouseUp = (): void => queueMicrotask(updateSelection);
    const handleSelectionChange = (): void => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) closeTooltip();
    };

    container?.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      container?.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  });
</script>

<div class="text-wrap">
  <p bind:this={container} class="paragraph-text">{content}</p>

  {#if tooltip}
    <SentenceTooltip
      x={tooltip.x}
      y={tooltip.y}
      text={tooltip.selection.text}
      onConfirm={() => {
        const current = tooltip;
        if (!current) return;
        onSplitSentence(paragraphId, current.selection);
        window.getSelection()?.removeAllRanges();
        closeTooltip();
      }}
      onClose={closeTooltip}
    />
  {/if}
</div>

<style>
  .text-wrap {
    position: relative;
  }

  .paragraph-text {
    margin: 0;
    color: var(--color-text);
    line-height: 1.55;
    white-space: pre-wrap;
    user-select: text;
  }
</style>
