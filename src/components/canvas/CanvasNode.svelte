<script lang="ts">
  import { NODE_HEIGHT, NODE_WIDTH } from '../../lib/utils/canvas';
  import type { CanvasPoint, CanvasWorkspaceNode } from '../../types/canvas.types';

  interface Props {
    node: CanvasWorkspaceNode;
    selected?: boolean;
    connected?: boolean;
    toWorldPoint: (clientX: number, clientY: number) => CanvasPoint;
    onStart: (nodeId: number, offsetX: number, offsetY: number) => void;
    onMove: (nodeId: number, x: number, y: number) => void;
    onCommit: (nodeId: number, x: number, y: number) => void;
    onEnd: () => void;
    onSelect: (nodeId: number) => void;
    onContext: (nodeId: number, clientX: number, clientY: number) => void;
  }

  let { node, selected = false, connected = false, toWorldPoint, onStart, onMove, onCommit, onEnd, onSelect, onContext }: Props =
    $props();

  let element: HTMLButtonElement | null = null;
  let dragPointerId = $state<number | null>(null);
  let offset = $state<CanvasPoint>({ x: 0, y: 0 });
  let draft = $state<CanvasPoint>({ x: 0, y: 0 });

  $effect(() => {
    if (dragPointerId == null) draft = { x: node.x, y: node.y };
  });

  const startDrag = (event: PointerEvent): void => {
    if (event.button !== 0) return;

    event.stopPropagation();
    onSelect(node.id);
    dragPointerId = event.pointerId;
    offset = (() => {
      const world = toWorldPoint(event.clientX, event.clientY);
      return { x: world.x - node.x, y: world.y - node.y };
    })();
    onStart(node.id, offset.x, offset.y);
    element?.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: PointerEvent): void => {
    if (dragPointerId !== event.pointerId) return;

    const world = toWorldPoint(event.clientX, event.clientY);
    draft = { x: world.x - offset.x, y: world.y - offset.y };
    onMove(node.id, draft.x, draft.y);
  };

  const endDrag = (event: PointerEvent): void => {
    if (dragPointerId !== event.pointerId) return;

    onCommit(node.id, draft.x, draft.y);
    onEnd();
    element?.releasePointerCapture(event.pointerId);
    dragPointerId = null;
  };

  const openContext = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    onSelect(node.id);
    onContext(node.id, event.clientX, event.clientY);
  };
</script>

<button
  bind:this={element}
  type="button"
  class="node"
  data-entity={node.entityType}
  data-selected={selected}
  data-connected={connected}
  aria-pressed={selected}
  style={`transform: translate3d(${node.x}px, ${node.y}px, 0); width: ${NODE_WIDTH}px; min-height: ${NODE_HEIGHT}px;`}
  onpointerdown={startDrag}
  onpointermove={moveDrag}
  onpointerup={endDrag}
  onpointercancel={endDrag}
  onlostpointercapture={endDrag}
  oncontextmenu={openContext}
>
  <span class="node-type">{node.entityType}</span>
  <strong>{node.title}</strong>
  <span class="node-copy">{node.subtitle}</span>
</button>

<style>
  .node {
    position: absolute;
    display: grid;
    gap: 10px;
    padding: 12px;
    color: var(--color-text);
    text-align: left;
    cursor: grab;
    touch-action: none;
    border-color: color-mix(in oklch, var(--color-border) 75%, transparent);
    background: color-mix(in oklch, var(--color-surface) 92%, var(--color-bg));
  }

  .node[data-selected='true'] {
    border-color: var(--color-border-active);
  }

  .node[data-connected='true'] {
    border-color: color-mix(in oklch, var(--color-rope) 55%, var(--color-border));
  }

  .node[data-entity='paragraph'] {
    background: color-mix(in oklch, var(--color-surface) 86%, oklch(63% 0.08 75));
  }

  .node[data-entity='sentence'] {
    background: color-mix(in oklch, var(--color-surface) 86%, oklch(68% 0.1 230));
  }

  .node[data-entity='word'] {
    background: color-mix(in oklch, var(--color-surface) 86%, oklch(72% 0.1 155));
  }

  .node[data-entity='image'] {
    background: color-mix(in oklch, var(--color-surface) 86%, oklch(74% 0.08 45));
  }

  .node-type {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  strong {
    font-size: 0.98rem;
    font-weight: 600;
  }

  .node-copy {
    color: var(--color-text-muted);
    line-height: 1.35;
  }
</style>
