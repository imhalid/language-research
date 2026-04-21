<script lang="ts">
  import { onMount } from 'svelte';
  import { createActor } from 'xstate';
  import InfinityCanvas from '../components/canvas/InfinityCanvas.svelte';
  import ParagraphCard from '../components/paragraph/ParagraphCard.svelte';
  import Sidebar from '../components/sidebar/Sidebar.svelte';
  import WordCard from '../components/word/WordCard.svelte';
  import { canvasMachine } from '$lib/machines/canvas.machine';
  import { chapterMachine } from '$lib/machines/chapter.machine';
  import { CanvasWorkspaceService, type CanvasWorkspaceData } from '$lib/services/CanvasWorkspaceService';
  import { ChapterService } from '$lib/services/ChapterService';
  import { ParagraphService } from '$lib/services/ParagraphService';
  import { WordService } from '$lib/services/WordService';
  import { wordStore } from '$lib/stores/word.store';
  import type { CanvasPoint } from '../types/canvas.types';
  import type {
    ChapterTreeNode,
    HighlightToken,
    ParagraphRecord,
    SentenceSelection,
    WordRecord
  } from '../types/research.types';

  const canvasActor = createActor(canvasMachine);
  const chapterActor = createActor(chapterMachine);

  let view = canvasActor.getSnapshot().context;
  let chapterState = chapterActor.getSnapshot().context;
  let chapters: ChapterTreeNode[] = [];
  let workspace: CanvasWorkspaceData | null = null;
  let paragraphs: ParagraphRecord[] = [];
  let wordState = { words: [] as WordRecord[], selectedWordId: null as number | null, hoveredWordId: null as number | null };
  let highlightVersion = 0;
  let draftParagraph = '';
  let selectedNodeId: number | null = null;
  let loading = true;
  let error: string | null = null;

  $: selectedNode = workspace?.nodes.find((node) => node.id === selectedNodeId) ?? workspace?.nodes[0] ?? null;
  $: selectedWord = wordState.words.find((word) => word.id === wordState.selectedWordId) ?? null;
  $: hoveredWord = wordState.words.find((word) => word.id === wordState.hoveredWordId) ?? null;

  onMount(() => {
    canvasActor.start();
    chapterActor.start();
    const canvasSub = canvasActor.subscribe((snapshot) => (view = snapshot.context));
    const chapterSub = chapterActor.subscribe((snapshot) => (chapterState = snapshot.context));
    const wordSub = wordStore.subscribe((state) => (wordState = state));
    void refresh();

    return () => {
      canvasSub.unsubscribe();
      chapterSub.unsubscribe();
      wordSub();
      canvasActor.stop();
      chapterActor.stop();
    };
  });

  const activeChapterId = (): number | null => chapterState.activeChapterId ?? workspace?.chapterId ?? null;
  const syncChapterState = (activeId: number, ancestorIds: number[]): void => {
    if (chapterState.activeChapterId !== activeId) chapterActor.send({ type: 'SELECT_CHAPTER', id: activeId });
    for (const id of ancestorIds) if (!chapterState.expandedIds.includes(id)) chapterActor.send({ type: 'TOGGLE_EXPAND', id });
  };
  const loadWords = async (chapterId: number): Promise<void> => {
    const words = await WordService.listByChapter(chapterId);
    wordStore.setWords(words);
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
    await loadWords(chapterId);
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
    if (compensation.x !== 0 || compensation.y !== 0) {
      canvasActor.send({ type: 'PAN', dx: compensation.x, dy: compensation.y });
    }
  };

  const refreshWordSurface = async (chapterId: number): Promise<void> => {
    await Promise.all([loadChapter(chapterId), loadWords(chapterId)]);
    highlightVersion += 1;
  };
</script>

<svelte:head>
  <title>Language Research App | Faz 4</title>
  <meta name="description" content="Word system, occurrence bridge, highlighted tokens, hover popover, and word cards." />
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
      <section class="panel stack"><div class="section-row"><h2 class="workspace-title">Workspace</h2><span class="section-label">boot</span></div><p class="summary">Loading chapter tree, paragraphs, words, canvas nodes.</p></section>
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
          workspace = {
            ...current,
            nodes: current.nodes.map((node) => (node.id === nodeId ? { ...node, x, y } : node))
          };
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
          await refreshWordSurface(chapterId);
        }}>add paragraph</button>
      <p class="summary">{hoveredWord ? `${hoveredWord.lemma} -> ${hoveredWord.translation || 'translation pending'}` : selectedNode ? `${selectedNode.title} / ${selectedNode.entityType}` : 'Click token to create word bridge. Hover highlighted token for popover.'}</p>
    </section>

    <div class="paragraph-list">
      {#each paragraphs as paragraph (paragraph.id)}
        <ParagraphCard
          {paragraph}
          version={highlightVersion}
          onSaveNotes={ParagraphService.updateNotes}
          onDelete={async (paragraphId) => {
            await ParagraphService.delete(paragraphId);
            const chapterId = activeChapterId();
            if (chapterId) await refreshWordSurface(chapterId);
          }}
          onSplitSentence={async (paragraphId, selection: SentenceSelection) => {
            const chapterId = activeChapterId();
            if (!chapterId) return;
            const sentenceId = await ParagraphService.splitSentence(paragraphId, chapterId, selection);
            const nextWorkspace = await loadChapter(chapterId);
            selectedNodeId =
              nextWorkspace.nodes.find(
                (node) => node.entityType === 'sentence' && node.entityId === sentenceId
              )?.id ?? selectedNodeId;
            highlightVersion += 1;
          }}
          onLinkWord={async (paragraphId, token: HighlightToken) => {
            const chapterId = activeChapterId();
            if (!chapterId || !token.lemma) return;
            const wordId = await WordService.linkTokenToParagraph({
              chapterId,
              paragraphId,
              token: token.text,
              startOffset: token.startOffset,
              endOffset: token.endOffset
            });
            wordStore.selectWord(wordId);
            await refreshWordSurface(chapterId);
          }}
          onHoverWord={(wordId) => wordStore.hoverWord(wordId)}
          onSelectWord={(wordId) => wordStore.selectWord(wordId)}
        />
      {/each}
    </div>

    <section class="panel stack">
      <div class="section-row"><h2 class="workspace-title">Words</h2><span class="section-label">{wordState.words.length}</span></div>
      <div class="word-list">
        {#each wordState.words as word (word.id)}
          <WordCard
            {word}
            selected={word.id === wordState.selectedWordId}
            onSelect={(wordId) => wordStore.selectWord(wordId)}
            onSaveTranslation={async (wordId, translation) => {
              const chapterId = activeChapterId();
              await WordService.annotate(wordId, { translation });
              wordStore.patchWord(wordId, { translation });
              if (chapterId) await refreshWordSurface(chapterId);
            }}
            onSaveNotes={async (wordId, notes) => {
              const chapterId = activeChapterId();
              await WordService.annotate(wordId, { notes });
              wordStore.patchWord(wordId, { notes });
              if (chapterId) await refreshWordSurface(chapterId);
            }}
          />
        {/each}
      </div>
      <p class="summary">{selectedWord ? `${selectedWord.lemma} selected. Linked paragraphs: ${selectedWord.linkedParagraphCount}.` : 'No word selected.'}</p>
    </section>
  </aside>
</main>

<style>
  .paragraph-column {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-height: 100vh;
  }

  .paragraph-list,
  .word-list {
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
