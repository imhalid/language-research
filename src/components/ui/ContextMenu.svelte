<script lang="ts">
  import type { ContextMenuAction } from '../../types/research.types';

  interface Props {
    open: boolean;
    x: number;
    y: number;
    title: string;
    items: ContextMenuAction[];
    onSelect: (id: string) => void;
    onClose: () => void;
  }

  let { open, x, y, title, items, onSelect, onClose }: Props = $props();
  let element = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (!open) return;

    const handlePointer = (event: PointerEvent): void => {
      if (element?.contains(event.target as Node)) return;
      onClose();
    };
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  });
</script>

{#if open && items.length > 0}
  <div bind:this={element} class="context-menu panel" style={`left:${x}px; top:${y}px;`}>
    <div class="menu-title mono muted">{title}</div>
    <div class="menu-list">
      {#each items as item (item.id)}
        <button
          type="button"
          class="menu-item"
          data-tone={item.tone ?? 'default'}
          onclick={() => onSelect(item.id)}
        >
          {item.label}
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .context-menu {
    position: fixed;
    z-index: 20;
    min-width: 180px;
    padding: 8px;
  }

  .menu-list {
    display: grid;
    gap: 4px;
  }

  .menu-title {
    margin-bottom: 6px;
  }

  .menu-item {
    min-height: 28px;
    padding: 0 8px;
    text-align: left;
  }

  .menu-item[data-tone='danger'] {
    color: oklch(78% 0.13 22);
  }
</style>
