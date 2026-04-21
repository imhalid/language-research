<script lang="ts">
  import { onMount } from 'svelte';
  import { buildHighlightedTokens } from '../../lib/utils/highlight';
  import { getSelectionOffsets, resolveSentenceSelection } from '../../lib/utils/parser';
  import type { HighlightToken, SentenceSelection } from '../../types/research.types';
  import SentenceTooltip from './SentenceTooltip.svelte';
  import WordPopover from '../word/WordPopover.svelte';

  interface Props {
    paragraphId: number;
    content: string;
    version: number;
    onSplitSentence: (paragraphId: number, selection: SentenceSelection) => void;
    onLinkWord: (paragraphId: number, token: HighlightToken) => void;
    onHoverWord: (wordId: number | null) => void;
    onSelectWord: (wordId: number | null) => void;
  }

  let {
    paragraphId,
    content,
    version,
    onSplitSentence,
    onLinkWord,
    onHoverWord,
    onSelectWord
  }: Props = $props();

  let container: HTMLDivElement | null = null;
  let tokens = $state<HighlightToken[]>([]);
  let tooltip = $state<{ x: number; y: number; selection: SentenceSelection } | null>(null);
  let popover = $state<{ x: number; y: number; lemma: string; translation: string | null } | null>(null);

  const loadTokens = async (): Promise<void> => {
    tokens = await buildHighlightedTokens(paragraphId, content);
  };

  $effect(() => {
    void version;
    void loadTokens();
  });

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

  const showPopover = (event: MouseEvent, token: HighlightToken): void => {
    if (!token.isHighlighted || !container || !token.lemma) return;

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const base = container.getBoundingClientRect();

    popover = {
      x: rect.left - base.left + rect.width / 2,
      y: rect.top - base.top,
      lemma: token.lemma,
      translation: token.translation
    };
    onHoverWord(token.wordId);
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
  <div bind:this={container} class="paragraph-text">
    {#each tokens as token (token.key)}
      {#if token.isWord}
        <span
          class="token"
          role="button"
          tabindex="0"
          data-highlight={token.isHighlighted}
          onclick={() => {
            onLinkWord(paragraphId, token);
            if (token.wordId) onSelectWord(token.wordId);
          }}
          onkeydown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            onLinkWord(paragraphId, token);
            if (token.wordId) onSelectWord(token.wordId);
          }}
          onmouseenter={(event) => showPopover(event, token)}
          onmouseleave={() => {
            popover = null;
            onHoverWord(null);
          }}
        >
          {token.text}
        </span>
      {:else}
        <span>{token.text}</span>
      {/if}
    {/each}
  </div>

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

  {#if popover}
    <WordPopover x={popover.x} y={popover.y} lemma={popover.lemma} translation={popover.translation} />
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

  .token {
    cursor: pointer;
    transition: background-color 120ms ease;
  }

  .token:hover {
    background: var(--color-highlight);
  }

  .token[data-highlight='true'] {
    background: var(--color-highlight);
  }

  .token[data-highlight='true']:hover {
    background: var(--color-highlight-hover);
  }
</style>
