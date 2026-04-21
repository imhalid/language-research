<script lang="ts">
  import { buildMinimapModel } from '../../lib/utils/canvas';
  import type { CanvasWorkspaceNode, ViewState } from '../../types/canvas.types';

  const WIDTH = 220;
  const HEIGHT = 148;

  interface Props {
    nodes: CanvasWorkspaceNode[];
    view: ViewState;
    viewportWidth: number;
    viewportHeight: number;
    selectedNodeId?: number | null;
  }

  let {
    nodes,
    view,
    viewportWidth,
    viewportHeight,
    selectedNodeId = null
  }: Props = $props();

  const model = $derived(
    buildMinimapModel(
      nodes,
      view,
      { width: viewportWidth, height: viewportHeight },
      { width: WIDTH, height: HEIGHT }
    )
  );
</script>

<aside class="minimap panel">
  <div class="minimap-row">
    <span class="section-label">Minimap</span>
    <span class="mono muted">{nodes.length} nodes</span>
  </div>

  <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-label="Canvas minimap">
    <rect class="backdrop" x="0" y="0" width={WIDTH} height={HEIGHT} />
    {#each model.nodes as node (node.id)}
      <rect
        class:selected={selectedNodeId === node.id}
        class={`node ${node.entityType}`}
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
      />
    {/each}
    <rect
      class="viewport"
      x={model.viewport.x}
      y={model.viewport.y}
      width={model.viewport.width}
      height={model.viewport.height}
    />
  </svg>
</aside>

<style>
  .minimap {
    position: absolute;
    right: 12px;
    bottom: 12px;
    display: grid;
    gap: 10px;
    width: 244px;
    padding: 12px;
    background: color-mix(in oklch, var(--color-bg) 84%, var(--color-surface));
  }

  .minimap-row {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
  }

  svg {
    width: 100%;
    height: auto;
    border: 1px solid color-mix(in oklch, var(--color-border) 80%, transparent);
    background: var(--color-bg);
  }

  .backdrop {
    fill: none;
  }

  .node {
    fill: color-mix(in oklch, var(--color-surface) 80%, var(--color-text));
    opacity: 0.72;
  }

  .node.paragraph {
    fill: oklch(63% 0.08 75 / 0.72);
  }

  .node.sentence {
    fill: oklch(68% 0.1 230 / 0.72);
  }

  .node.word {
    fill: oklch(72% 0.1 155 / 0.72);
  }

  .node.selected,
  .selected {
    stroke: var(--color-text);
    stroke-width: 1;
  }

  .viewport {
    fill: none;
    stroke: var(--color-accent);
    stroke-width: 1.2;
  }
</style>
