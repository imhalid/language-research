<script lang="ts">
  import { onMount } from 'svelte';
  import { createActor } from 'xstate';
  import InfinityCanvas from '../components/canvas/InfinityCanvas.svelte';
  import ParagraphCard from '../components/paragraph/ParagraphCard.svelte';
  import Sidebar from '../components/sidebar/Sidebar.svelte';
  import { canvasMachine } from '$lib/machines/canvas.machine';
  import { chapterMachine } from '$lib/machines/chapter.machine';
  import { CanvasWorkspaceService, type CanvasWorkspaceData } from '$lib/services/CanvasWorkspaceService';
  import { ChapterService } from '$lib/services/ChapterService';
  import { ParagraphService } from '$lib/services/ParagraphService';
  import type { CanvasPoint } from '../types/canvas.types';
  import type { ChapterTreeNode, ParagraphRecord, SentenceSelection } from '../types/research.types';

  const canvasActor = createActor(canvasMachine);
  const chapterActor = createActor(chapterMachine);

  let view = canvasActor.getSnapshot().context;
  let chapterState = chapterActor.getSnapshot().context;
  let chapters: ChapterTreeNode[] = [];
  let workspace: CanvasWorkspaceData | null = null;
  let paragraphs: ParagraphRecord[] = [];
  let draftParagraph = '';
  let selectedNodeId: number | null = null;
  let loading = true;
  let error: string | null = null;

  $: selectedNode = workspace?.nodes.find((node) => node.id === selectedNodeId) ?? workspace?.nodes[0] ?? null;

  onMount(() => {
    canvasActor.start();
    chapterActor.start();
    const canvasSub = canvasActor.subscribe((snapshot) => (view = snapshot.context));
    const chapterSub = chapterActor.subscribe((snapshot) => (chapterState = snapshot.context));
    void refresh();

    return () => {
      canvasSub.unsubscribe();
      chapterSub.unsubscribe();
      canvasActor.stop();
      chapterActor.stop();
    };
  });

  const activeChapterId = (): number | null => chapterState.activeChapterId ?? workspace?.chapterId ?? null;
  const syncChapterState = (activeId: number, ancestorIds: number[]): void => {
    if (chapterState.activeChapterId !== activeId) chapterActor.send({ type: 'SELECT_CHAPTER', id: activeId });
    for (const id of ancestorIds) if (!chapterState.expandedIds.includes(id)) chapterActor.send({ type: 'TOGGLE_EXPAND', id });
  };

  const loadChapter = async (chapterId: number): Promise<CanvasWorkspaceData> => {
    const [nextWorkspace, nextParagraphs] = await Promise.all([
      CanvasWorkspaceService.load(chapterId),
      ParagraphService.listByChapter(chapterId)
    ]);
    workspace = nextWorkspace;
    paragraphs = nextParagraphs;
    selectedNodeId = nextWorkspace.nodes.some((node) => node.id === selectedNodeId)
      ? selectedNodeId
      : nextWorkspace.nodes[0]?.id ?? null;
    return nextWorkspace;
  };

  const refresh = async (preferredChapterId?: number): Promise<void> => {
    loading = true;
    error = null;

    try {
      const treeState = await ChapterService.loadTree(preferredChapterId);
      chapters = treeState.chapters;
      syncChapterState(treeState.activeChapterId, treeState.ancestorIds);
      await loadChapter(treeState.activeChapterId);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'workspace load failed';
    } finally {
      loading = false;
    }
  };

  const handleZoom = (delta: number, compensation: CanvasPoint): void => {
    canvasActor.send({ type: 'ZOOM', delta });
    if (compensation.x !== 0 || compensation.y !== 0) canvasActor.send({ type: 'PAN', dx: compensation.x, dy: compensation.y });
  };
</script>

<svelte:head>
  <title>Language Research App | Faz 3</title>
  <meta name="description" content="Chapter tree, paragraph CRUD, and sentence splitting on top of canvas workspace." />
</svelte:head>

<main class="app-shell">
  <Sidebar
    {chapters}
    activeChapterId={chapterState.activeChapterId}
    expandedIds={chapterState.expandedIds}
    chapterTitle={workspace?.chapterTitle ?? 'Chapter workspace'}
    onSelect={async (id) => refresh(id)}
    onToggle={(id) => chapterActor.send({ type: 'TOGGLE_EXPAND', id })}
    onAddRoot={async () => refresh(await ChapterService.createRoot())}
    onAddChild={async (id) => refresh(await ChapterService.createChild(id))}
  />

  <section class="workspace">
    {#if error}
      <section class="panel stack"><div class="section-row"><h2 class="workspace-title">Error</h2><span class="section-label">halt</span></div><p class="summary">{error}</p></section>
    {:else if loading || !workspace}
      <section class="panel stack"><div class="section-row"><h2 class="workspace-title">Workspace</h2><span class="section-label">boot</span></div><p class="summary">Loading chapter tree, paragraphs, canvas nodes.</p></section>
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
        onMoveNode={(nodeId, x, y) => {
          const current = workspace;
          if (!current) return;
          canvasActor.send({ type: 'DRAG_MOVE', x, y });
          workspace = { ...current, nodes: current.nodes.map((node) => (node.id === nodeId ? { ...node, x, y } : node)) };
        }}
        onCommitNode={async (nodeId, x, y) => CanvasWorkspaceService.updateNodePosition(nodeId, x, y)}
        onEndNode={() => canvasActor.send({ type: 'DRAG_END' })}
        onSelectNode={(nodeId) => (selectedNodeId = nodeId)}
        onResetView={() => canvasActor.send({ type: 'RESET_VIEW' })}
      />
    {/if}
  </section>

  <aside class="inspector paragraph-column">
    <section class="panel stack">
      <div class="section-row"><h2 class="workspace-title">Paragraphs</h2><span class="section-label">{paragraphs.length}</span></div>
      <textarea bind:value={draftParagraph} rows="5" placeholder="Paste paragraph text"></textarea>
      <button
        type="button"
        onclick={async () => {
          const chapterId = activeChapterId();
          if (!chapterId || !draftParagraph.trim()) return;
          await ParagraphService.create(chapterId, draftParagraph.trim());
          draftParagraph = '';
          await loadChapter(chapterId);
        }}>add paragraph</button>
      <p class="summary">{selectedNode ? `${selectedNode.title} / ${selectedNode.entityType}` : 'Select node, drag, then split sentence from paragraph text.'}</p>
    </section>

    <div class="paragraph-list">
      {#each paragraphs as paragraph (paragraph.id)}
        <ParagraphCard
          {paragraph}
          onSaveNotes={ParagraphService.updateNotes}
          onDelete={async (paragraphId) => {
            await ParagraphService.delete(paragraphId);
            const chapterId = activeChapterId();
            if (chapterId) await loadChapter(chapterId);
          }}
          onSplitSentence={async (paragraphId, selection: SentenceSelection) => {
            const chapterId = activeChapterId();
            if (!chapterId) return;
            const sentenceId = await ParagraphService.splitSentence(paragraphId, chapterId, selection);
            const nextWorkspace = await loadChapter(chapterId);
            selectedNodeId = nextWorkspace.nodes.find((node) => node.entityType === 'sentence' && node.entityId === sentenceId)?.id ?? selectedNodeId;
          }}
        />
      {/each}
    </div>
  </aside>
</main>

<style>
  .paragraph-column {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-height: 100vh;
  }

  .paragraph-list {
    display: grid;
    gap: 8px;
    align-content: start;
    overflow: auto;
    padding-right: 2px;
  }

  textarea {
    min-height: 92px;
    padding: 8px;
    resize: vertical;
  }
</style>
