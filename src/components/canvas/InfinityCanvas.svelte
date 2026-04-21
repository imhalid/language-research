<script lang="ts">
  import { clientToWorld, getZoomCompensation, wheelDeltaToZoom } from '../../lib/utils/canvas';
  import type { CanvasPoint, CanvasWorkspaceNode, ViewState } from '../../types/canvas.types';
  import CanvasNode from './CanvasNode.svelte';
  import Minimap from './Minimap.svelte';

  interface Props {
    nodes: CanvasWorkspaceNode[];
    view: ViewState;
    selectedNodeId?: number | null;
    onPan: (dx: number, dy: number) => void;
    onZoom: (delta: number, compensation: CanvasPoint) => void;
    onStartNode: (nodeId: number, offsetX: number, offsetY: number) => void;
    onMoveNode: (nodeId: number, x: number, y: number) => void;
    onCommitNode: (nodeId: number, x: number, y: number) => void;
    onEndNode: () => void;
    onSelectNode: (nodeId: number) => void;
    onResetView: () => void;
  }

  let {
    nodes,
    view,
    selectedNodeId = null,
    onPan,
    onZoom,
    onStartNode,
    onMoveNode,
    onCommitNode,
    onEndNode,
    onSelectNode,
    onResetView
  }: Props = $props();

  let viewport: HTMLDivElement | null = null;
  let viewportWidth = $state(0);
  let viewportHeight = $state(0);
  let panPointerId = $state<number | null>(null);
  let lastPoint = $state<CanvasPoint | null>(null);

  const toWorldPoint = (clientX: number, clientY: number): CanvasPoint =>
    clientToWorld(
      { x: clientX, y: clientY },
      viewport?.getBoundingClientRect() ?? { left: 0, top: 0 },
      view
    );

  const startPan = (event: PointerEvent): void => {
    if (event.button !== 0 && event.button !== 1) return;

    panPointerId = event.pointerId;
    lastPoint = { x: event.clientX, y: event.clientY };
    viewport?.setPointerCapture(event.pointerId);
  };

  const movePan = (event: PointerEvent): void => {
    if (panPointerId !== event.pointerId || !lastPoint) return;

    onPan(event.clientX - lastPoint.x, event.clientY - lastPoint.y);
    lastPoint = { x: event.clientX, y: event.clientY };
  };

  const endPan = (event: PointerEvent): void => {
    if (panPointerId !== event.pointerId) return;

    viewport?.releasePointerCapture(event.pointerId);
    panPointerId = null;
    lastPoint = null;
  };

  const zoomCanvas = (event: WheelEvent): void => {
    if (!viewport) return;

    event.preventDefault();
    const delta = wheelDeltaToZoom(event.deltaY);
    const compensation = getZoomCompensation(
      { x: event.clientX, y: event.clientY },
      viewport.getBoundingClientRect(),
      view,
      delta
    );

    onZoom(delta, compensation);
  };
</script>

<section class="panel canvas-panel">
  <div class="canvas-toolbar">
    <div class="canvas-meta">
      <span class="section-label">Phase 2 Canvas</span>
      <span class="mono muted">{nodes.length} movable entities</span>
    </div>
    <div class="canvas-actions">
      <span class="mono muted">zoom {view.zoom.toFixed(2)}x</span>
      <button type="button" onclick={onResetView}>reset view</button>
    </div>
  </div>

  <div
    bind:this={viewport}
    bind:clientWidth={viewportWidth}
    bind:clientHeight={viewportHeight}
    class="viewport canvas-grid"
    data-panning={panPointerId != null}
    role="application"
    aria-label="Interactive language canvas"
    onpointerdown={startPan}
    onpointermove={movePan}
    onpointerup={endPan}
    onpointercancel={endPan}
    onlostpointercapture={endPan}
    onwheel={zoomCanvas}
  >
    <div class="world" style={`transform: translate3d(${view.panX}px, ${view.panY}px, 0) scale(${view.zoom});`}>
      {#each nodes as node (node.id)}
        <CanvasNode
          {node}
          selected={selectedNodeId === node.id}
          {toWorldPoint}
          onStart={onStartNode}
          onMove={onMoveNode}
          onCommit={onCommitNode}
          onEnd={onEndNode}
          onSelect={onSelectNode}
        />
      {/each}
    </div>

    <Minimap {nodes} {view} {viewportWidth} {viewportHeight} {selectedNodeId} />
  </div>
</section>

<style>
  .canvas-panel {
    display: grid;
    grid-template-rows: auto 1fr;
    padding: 0;
    min-height: 34rem;
  }

  .canvas-toolbar,
  .canvas-meta,
  .canvas-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .canvas-toolbar {
    padding: 10px 12px;
    border-bottom: 1px solid color-mix(in oklch, var(--color-border) 80%, transparent);
  }

  .viewport {
    position: relative;
    overflow: hidden;
    min-height: 30rem;
    touch-action: none;
    cursor: grab;
  }

  .viewport[data-panning='true'] {
    cursor: grabbing;
  }

  .world {
    position: absolute;
    inset: 0;
    transform-origin: 0 0;
    will-change: transform;
  }
</style>
