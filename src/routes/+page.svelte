<script lang="ts">
  import { onMount } from 'svelte';
  import { createActor } from 'xstate';
  import InfinityCanvas from '../components/canvas/InfinityCanvas.svelte';
  import { canvasMachine } from '$lib/machines/canvas.machine';
  import {
    CanvasWorkspaceService,
    type CanvasWorkspaceData
  } from '$lib/services/CanvasWorkspaceService';
  import type { CanvasPoint } from '../types/canvas.types';

  const canvasActor = createActor(canvasMachine);

  let view = canvasActor.getSnapshot().context;
  let workspace: CanvasWorkspaceData | null = null;
  let selectedNodeId: number | null = null;
  let loading = true;
  let error: string | null = null;

  $: selectedNode = workspace?.nodes.find((node) => node.id === selectedNodeId) ?? workspace?.nodes[0] ?? null;

  onMount(() => {
    canvasActor.start();
    const subscription = canvasActor.subscribe((snapshot) => (view = snapshot.context));

    void loadWorkspace();

    return () => {
      subscription.unsubscribe();
      canvasActor.stop();
    };
  });

  const loadWorkspace = async (): Promise<void> => {
    loading = true;
    error = null;

    try {
      workspace = await CanvasWorkspaceService.load();
      selectedNodeId = selectedNodeId ?? workspace.nodes[0]?.id ?? null;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'workspace load failed';
    } finally {
      loading = false;
    }
  };

  const handleZoom = (delta: number, compensation: CanvasPoint): void => {
    canvasActor.send({ type: 'ZOOM', delta });
    if (compensation.x !== 0 || compensation.y !== 0) {
      canvasActor.send({ type: 'PAN', dx: compensation.x, dy: compensation.y });
    }
  };

  const handleMoveNode = (nodeId: number, x: number, y: number): void => {
    if (!workspace) return;
    canvasActor.send({ type: 'DRAG_MOVE', x, y });
    workspace = { ...workspace, nodes: workspace.nodes.map((node) => (node.id === nodeId ? { ...node, x, y } : node)) };
  };

  const handleCommitNode = async (nodeId: number, x: number, y: number): Promise<void> => {
    try {
      await CanvasWorkspaceService.updateNodePosition(nodeId, x, y);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'persist failed';
      await loadWorkspace();
    }
  };
</script>

<svelte:head>
  <title>Language Research App | Faz 2</title>
  <meta name="description" content="Infinite canvas, draggable nodes, minimap, and persisted positions." />
</svelte:head>

<main class="app-shell">
  <aside class="sidebar">
    <section class="panel stack">
      <div class="title-row">
        <div>
          <div class="eyebrow muted">Language Research App</div>
          <h1>Faz 2</h1>
        </div>
        <div class="status-pill"><span class="status-dot live"></span> live</div>
      </div>
      <p class="summary">{workspace?.chapterTitle ?? 'Canvas workspace bootstrapping.'}</p>
    </section>

    <section class="panel">
      <div class="section-row">
        <h2 class="workspace-title">Nodes</h2>
        <span class="section-label">{workspace?.nodes.length ?? 0}</span>
      </div>
      <ul class="terminal-list">
        {#each workspace?.nodes ?? [] as node}
          <li style={selectedNodeId === node.id ? 'color: var(--color-accent);' : ''}>
            <span>{node.title}</span>
            <span class="list-meta">{node.entityType}</span>
          </li>
        {/each}
      </ul>
    </section>
  </aside>

  <section class="workspace">
    {#if error}
      <section class="panel stack">
        <div class="section-row"><h2 class="workspace-title">Error</h2><span class="section-label">halt</span></div>
        <p class="summary">{error}</p>
      </section>
    {:else if loading || !workspace}
      <section class="panel stack">
        <div class="section-row"><h2 class="workspace-title">Workspace</h2><span class="section-label">boot</span></div>
        <p class="summary">Seeding default chapter, entities, canvas nodes.</p>
      </section>
    {:else}
      <InfinityCanvas
        nodes={workspace.nodes}
        view={view}
        {selectedNodeId}
        onPan={(dx, dy) => canvasActor.send({ type: 'PAN', dx, dy })}
        onZoom={handleZoom}
        onStartNode={(nodeId, offsetX, offsetY) => {
          selectedNodeId = nodeId;
          canvasActor.send({ type: 'DRAG_START', nodeId, offsetX, offsetY });
        }}
        onMoveNode={handleMoveNode}
        onCommitNode={handleCommitNode}
        onEndNode={() => canvasActor.send({ type: 'DRAG_END' })}
        onSelectNode={(nodeId) => (selectedNodeId = nodeId)}
        onResetView={() => canvasActor.send({ type: 'RESET_VIEW' })}
      />
    {/if}
  </section>

  <aside class="inspector">
    <section class="panel stack">
      <div class="section-row"><h2 class="workspace-title">View</h2><span class="section-label">actor</span></div>
      <div class="metric-row mono"><span>zoom</span><span>{view.zoom.toFixed(2)}x</span></div>
      <div class="metric-row mono"><span>pan x</span><span>{Math.round(view.panX)} px</span></div>
      <div class="metric-row mono"><span>pan y</span><span>{Math.round(view.panY)} px</span></div>
      <div class="metric-row mono"><span>dragging</span><span>{view.draggingNodeId ?? 'idle'}</span></div>
    </section>

    <section class="panel stack">
      <div class="section-row"><h2 class="workspace-title">Selection</h2><span class="section-label">focus</span></div>
      <p class="summary">{selectedNode ? `${selectedNode.title} / ${selectedNode.entityType}` : 'No node selected.'}</p>
      <p class="summary">{selectedNode?.subtitle ?? 'Select node, drag, wheel zoom, pan empty area.'}</p>
    </section>
  </aside>
</main>
