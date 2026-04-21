<script lang="ts">
  import { onMount } from 'svelte';
  import { createActor } from 'xstate';
  import InfinityCanvas from '../components/canvas/InfinityCanvas.svelte';
  import ImageCard from '../components/image/ImageCard.svelte';
  import ParagraphCard from '../components/paragraph/ParagraphCard.svelte';
  import Sidebar from '../components/sidebar/Sidebar.svelte';
  import ContextMenu from '../components/ui/ContextMenu.svelte';
  import WordCard from '../components/word/WordCard.svelte';
  import WordnetCard from '../components/word/WordnetCard.svelte';
  import { canvasMachine } from '$lib/machines/canvas.machine';
  import { chapterMachine } from '$lib/machines/chapter.machine';
  import { selectionMachine } from '$lib/machines/selection.machine';
  import { wordnetMachine } from '$lib/machines/wordnet.machine';
  import { CanvasWorkspaceService, type CanvasWorkspaceData } from '$lib/services/CanvasWorkspaceService';
  import { ChapterService } from '$lib/services/ChapterService';
  import { ImageService } from '$lib/services/ImageService';
  import { ParagraphService } from '$lib/services/ParagraphService';
  import { SentenceService } from '$lib/services/SentenceService';
  import { SettingsService } from '$lib/services/SettingsService';
  import { WordService } from '$lib/services/WordService';
  import { WordnetBootstrapService } from '$lib/services/WordnetBootstrapService';
  import { wordStore } from '$lib/stores/word.store';
  import {
    buildSelectionConnections,
    buildSelectionKey,
    findCanvasNodeId
  } from '$lib/utils/canvasSelection';
  import type { CanvasPoint, Connection } from '../types/canvas.types';
  import type { CanvasWorkspaceNode } from '../types/canvas.types';
  import type { WordnetEntry } from '../types/domain.types';
  import type { SelectableEntityType } from '../types/machine.types';
  import type {
    ChapterTreeNode,
    ContextMenuAction,
    HighlightToken,
    ImageRecord,
    ParagraphRecord,
    SentenceSelection,
    WordRecord
  } from '../types/research.types';

  interface CanvasContextMenuState {
    open: boolean;
    x: number;
    y: number;
    nodeId: number | null;
    world: CanvasPoint | null;
  }

  const closedContextMenu = (): CanvasContextMenuState => ({
    open: false,
    x: 0,
    y: 0,
    nodeId: null,
    world: null
  });

  const canvasActor = createActor(canvasMachine);
  const chapterActor = createActor(chapterMachine);
  const selectionActor = createActor(selectionMachine);
  const wordnetActor = createActor(wordnetMachine);

  let view = canvasActor.getSnapshot().context;
  let chapterState = chapterActor.getSnapshot().context;
  let selectionState = selectionActor.getSnapshot().context;
  let wordnetState = wordnetActor.getSnapshot().context;
  let chapters: ChapterTreeNode[] = [];
  let workspace: CanvasWorkspaceData | null = null;
  let paragraphs: ParagraphRecord[] = [];
  let images: ImageRecord[] = [];
  let wordState = { words: [] as WordRecord[], selectedWordId: null as number | null, hoveredWordId: null as number | null };
  let wordnetEntry: WordnetEntry | null = null;
  let wordnetLoading = false;
  let highlightVersion = 0;
  let draftParagraph = '';
  let selectedNodeId: number | null = null;
  let loading = true;
  let error: string | null = null;
  let connections: Connection[] = [];
  let connectedNodeIds: number[] = [];
  let selectionKey = '';
  let imageScopeKey = '';
  let imageScopeNonce = 0;
  let imageInput: HTMLInputElement | null = null;
  let pendingImageParagraphId: number | null = null;
  let canvasSettingsReady = false;
  let lastSavedZoom = 1;
  let contextMenu = closedContextMenu();
  let wordnetLookupKey = '';
  let wordnetLookupNonce = 0;

  $: selectedNode = workspace?.nodes.find((node) => node.id === selectedNodeId) ?? workspace?.nodes[0] ?? null;
  $: contextNode =
    contextMenu.nodeId != null
      ? workspace?.nodes.find((node) => node.id === contextMenu.nodeId) ?? null
      : null;
  $: connections = buildSelectionConnections(
    workspace?.nodes ?? [],
    selectedNode?.id ?? null,
    selectionState.connectedIds
  );
  $: connectedNodeIds = connections.map((connection) => connection.toNodeId);
  $: selectedWord = wordState.words.find((word) => word.id === wordState.selectedWordId) ?? null;
  $: hoveredWord = wordState.words.find((word) => word.id === wordState.hoveredWordId) ?? null;
  $: contextMenuItems = (() => {
    if (!contextMenu.open) return [] as ContextMenuAction[];
    if (!contextNode) return [{ id: 'add-paragraph-here', label: 'Add paragraph here' }];

    if (contextNode.entityType === 'paragraph') {
      return [
        { id: 'upload-image', label: 'Upload image' },
        { id: 'delete-paragraph', label: 'Delete paragraph', tone: 'danger' as const }
      ];
    }

    if (contextNode.entityType === 'sentence') {
      return [{ id: 'detach-sentence', label: 'Detach sentence', tone: 'danger' as const }];
    }

    if (contextNode.entityType === 'word') {
      return [{ id: 'inspect-word', label: 'Focus word card' }];
    }

    if (contextNode.entityType === 'image') {
      return [{ id: 'delete-image', label: 'Delete image', tone: 'danger' as const }];
    }

    return [] as ContextMenuAction[];
  })();
  $: contextMenuTitle = contextNode ? contextNode.title : 'Canvas';
  $: {
    const nextKey = buildSelectionKey(workspace?.chapterId, selectedNode);

    if (!nextKey) {
      if (selectionKey) {
        selectionKey = '';
        selectionActor.send({ type: 'DESELECT' });
      }
    } else if (nextKey !== selectionKey && selectedNode) {
      selectionKey = nextKey;
      selectionActor.send({
        type: 'SELECT',
        entityType: selectedNode.entityType as SelectableEntityType,
        id: selectedNode.entityId
      });
    }
  }
  $: {
    const lookupKey = wordnetState.status === 'done' ? selectedWord?.lemma ?? '' : '';

    if (!lookupKey) {
      wordnetLookupKey = '';
      wordnetEntry = null;
      wordnetLoading = wordnetState.status === 'checking' || wordnetState.status === 'seeding';
    } else if (lookupKey !== wordnetLookupKey) {
      wordnetLookupKey = lookupKey;
      void loadWordnetEntry(lookupKey);
    }
  }
  $: {
    const nextImageScopeKey =
      selectedNode?.entityType === 'paragraph'
        ? `paragraph:${selectedNode.entityId}`
        : selectedNode?.entityType === 'image'
          ? `image:${selectedNode.entityId}`
          : '';

    if (nextImageScopeKey !== imageScopeKey) {
      imageScopeKey = nextImageScopeKey;
      void loadImageScope();
    }
  }
  $: if (canvasSettingsReady && view.zoom !== lastSavedZoom) {
    lastSavedZoom = view.zoom;
    void SettingsService.set('canvasZoom', view.zoom);
  }

  onMount(() => {
    canvasActor.start();
    chapterActor.start();
    selectionActor.start();
    wordnetActor.start();
    const canvasSub = canvasActor.subscribe((snapshot) => (view = snapshot.context));
    const chapterSub = chapterActor.subscribe((snapshot) => (chapterState = snapshot.context));
    const selectionSub = selectionActor.subscribe((snapshot) => (selectionState = snapshot.context));
    const wordnetSub = wordnetActor.subscribe((snapshot) => (wordnetState = snapshot.context));
    const wordSub = wordStore.subscribe((state) => (wordState = state));
    void restoreCanvasZoom();
    void refresh();
    void bootWordnet();

    return () => {
      canvasSub.unsubscribe();
      chapterSub.unsubscribe();
      selectionSub.unsubscribe();
      wordnetSub.unsubscribe();
      wordSub();
      canvasActor.stop();
      chapterActor.stop();
      selectionActor.stop();
      wordnetActor.stop();
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
  const closeContextMenu = (): void => {
    contextMenu = closedContextMenu();
  };
  const focusCanvasEntity = (
    entityType: CanvasWorkspaceNode['entityType'],
    entityId: number,
    nodes = workspace?.nodes ?? []
  ): void => {
    const nodeId = findCanvasNodeId(nodes, entityType, entityId);
    if (nodeId != null) selectedNodeId = nodeId;
  };
  const syncWordStoreFromNode = (nodeId: number, nodes = workspace?.nodes ?? []): void => {
    const node = nodes.find((entry) => entry.id === nodeId);
    if (node?.entityType === 'word') wordStore.selectWord(node.entityId);
  };
  const restoreCanvasZoom = async (): Promise<void> => {
    const zoom = await SettingsService.getNumber('canvasZoom', 1);
    lastSavedZoom = zoom;
    canvasActor.send({ type: 'SET_ZOOM', value: zoom });
    canvasSettingsReady = true;
  };
  const bootWordnet = async (): Promise<void> => {
    wordnetActor.send({ type: 'START_SEED' });

    try {
      await WordnetBootstrapService.ensureReady((value) => {
        wordnetActor.send({ type: 'PROGRESS', value });
      });
      wordnetActor.send({ type: 'DONE' });
    } catch (cause) {
      wordnetActor.send({
        type: 'ERROR',
        message: cause instanceof Error ? cause.message : 'wordnet bootstrap failed'
      });
    }
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

  const loadWordnetEntry = async (lemma: string): Promise<void> => {
    const nonce = ++wordnetLookupNonce;
    wordnetLoading = true;

    try {
      const entry = await WordService.lookupWordnet(lemma);
      if (nonce === wordnetLookupNonce) wordnetEntry = entry;
    } finally {
      if (nonce === wordnetLookupNonce) wordnetLoading = false;
    }
  };

  const loadImageScope = async (): Promise<void> => {
    const nonce = ++imageScopeNonce;
    const node = selectedNode;
    let nextImages: ImageRecord[] = [];

    if (!node) {
      images = [];
      return;
    }

    if (node.entityType === 'paragraph') {
      nextImages = await ImageService.listByParagraph(node.entityId);
    } else if (node.entityType === 'image') {
      const image = await ImageService.get(node.entityId);
      nextImages = image ? [image] : [];
    }

    if (nonce === imageScopeNonce) images = nextImages;
  };

  const refresh = async (preferredChapterId?: number): Promise<void> => {
    loading = true;
    error = null;
    closeContextMenu();

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

  const handleDeleteChapter = async (chapterId: number): Promise<void> => {
    selectedNodeId = null;
    await refresh(await ChapterService.deleteCascade(chapterId));
  };

  const handleZoom = (delta: number, compensation: CanvasPoint): void => {
    canvasActor.send({ type: 'ZOOM', delta });
    if (compensation.x !== 0 || compensation.y !== 0) {
      canvasActor.send({ type: 'PAN', dx: compensation.x, dy: compensation.y });
    }
  };

  const refreshWordSurface = async (chapterId: number): Promise<void> => {
    await loadChapter(chapterId);
    highlightVersion += 1;
  };
  const handleContextAction = async (actionId: string): Promise<void> => {
    const chapterId = activeChapterId();
    const node = contextNode;
    const world = contextMenu.world;

    closeContextMenu();

    if (actionId === 'add-paragraph-here') {
      if (!chapterId || !world) return;
      const paragraphId = await ParagraphService.create(
        chapterId,
        draftParagraph.trim() || 'New paragraph',
        world
      );
      draftParagraph = '';
      const nextWorkspace = await loadChapter(chapterId);
      highlightVersion += 1;
      focusCanvasEntity('paragraph', paragraphId, nextWorkspace.nodes);
      return;
    }

    if (!node || !chapterId) return;

    if (actionId === 'upload-image' && node.entityType === 'paragraph') {
      pendingImageParagraphId = node.entityId;
      imageInput?.click();
      return;
    }

    if (actionId === 'delete-paragraph' && node.entityType === 'paragraph') {
      await ParagraphService.delete(node.entityId);
      await refreshWordSurface(chapterId);
      return;
    }

    if (actionId === 'detach-sentence' && node.entityType === 'sentence') {
      await SentenceService.delete(node.entityId);
      await refreshWordSurface(chapterId);
      return;
    }

    if (actionId === 'inspect-word' && node.entityType === 'word') {
      wordStore.selectWord(node.entityId);
      focusCanvasEntity('word', node.entityId);
      return;
    }

    if (actionId === 'delete-image' && node.entityType === 'image') {
      await ImageService.delete(node.entityId);
      await loadChapter(chapterId);
    }
  };

  const handleImageUpload = async (event: Event): Promise<void> => {
    const chapterId = activeChapterId();
    const paragraphId = pendingImageParagraphId;
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    pendingImageParagraphId = null;

    if (!chapterId || !paragraphId || !file) return;

    const imageId = await ImageService.create({ chapterId, paragraphId, file });
    const nextWorkspace = await loadChapter(chapterId);
    focusCanvasEntity('image', imageId, nextWorkspace.nodes);
  };
</script>

<svelte:head>
  <title>Language Research App | Faz 7</title>
  <meta name="description" content="Context menus, image blobs, chapter cascade delete, settings persistence, and rope graph overlay." />
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
    onDelete={handleDeleteChapter}
  />

  <section class="workspace">
    {#if error}
      <section class="panel stack"><div class="section-row"><h2 class="workspace-title">Error</h2><span class="section-label">halt</span></div><p class="summary">{error}</p></section>
    {:else if loading || !workspace}
      <section class="panel stack"><div class="section-row"><h2 class="workspace-title">Workspace</h2><span class="section-label">boot</span></div><p class="summary">Loading chapter tree, paragraphs, words, canvas nodes.</p></section>
    {:else}
      <InfinityCanvas
        nodes={workspace.nodes}
        {connections}
        {connectedNodeIds}
        view={view}
        {selectedNodeId}
        onPan={(dx, dy) => canvasActor.send({ type: 'PAN', dx, dy })}
        onZoom={handleZoom}
        onStartNode={(nodeId, offsetX, offsetY) => {
          selectedNodeId = nodeId;
          syncWordStoreFromNode(nodeId);
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
        onSelectNode={(nodeId) => {
          selectedNodeId = nodeId;
          syncWordStoreFromNode(nodeId);
        }}
        onContextNode={(nodeId, clientX, clientY) => {
          selectedNodeId = nodeId;
          syncWordStoreFromNode(nodeId);
          contextMenu = { open: true, x: clientX, y: clientY, nodeId, world: null };
        }}
        onContextCanvas={(clientX, clientY, world) => {
          contextMenu = { open: true, x: clientX, y: clientY, nodeId: null, world };
        }}
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
      <p class="summary">{hoveredWord ? `${hoveredWord.lemma} -> ${hoveredWord.translation || 'translation pending'}` : selectedNode ? `${selectedNode.title} / ${selectedNode.entityType}` : 'Right click canvas for quick actions. Hover highlighted token for popover.'}</p>
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
            const nextWorkspace = await loadChapter(chapterId);
            highlightVersion += 1;
            focusCanvasEntity('word', wordId, nextWorkspace.nodes);
          }}
          onHoverWord={(wordId) => wordStore.hoverWord(wordId)}
          onSelectWord={(wordId) => {
            wordStore.selectWord(wordId);
            if (wordId != null) focusCanvasEntity('word', wordId);
          }}
        />
      {/each}
    </div>

    <section class="panel stack">
      <div class="section-row"><h2 class="workspace-title">Images</h2><span class="section-label">{images.length}</span></div>
      {#if images.length === 0}
        <p class="summary">Select paragraph or image node. Right click paragraph node to upload image.</p>
      {:else}
        <div class="image-list">
          {#each images as image (image.id)}
            <ImageCard
              {image}
              selected={selectedNode?.entityType === 'image' && selectedNode.entityId === image.id}
              onSelect={(imageId) => focusCanvasEntity('image', imageId)}
              onSaveCaption={async (imageId, caption) => {
                const chapterId = activeChapterId();
                await ImageService.update(imageId, { caption });
                if (chapterId) await loadChapter(chapterId);
                await loadImageScope();
              }}
              onSaveNotes={async (imageId, notes) => {
                const chapterId = activeChapterId();
                await ImageService.update(imageId, { notes });
                if (chapterId) await loadChapter(chapterId);
                await loadImageScope();
              }}
              onDelete={async (imageId) => {
                const chapterId = activeChapterId();
                await ImageService.delete(imageId);
                if (chapterId) await loadChapter(chapterId);
                await loadImageScope();
              }}
            />
          {/each}
        </div>
      {/if}
    </section>

    <section class="panel stack">
      <div class="section-row"><h2 class="workspace-title">Words</h2><span class="section-label">{wordState.words.length}</span></div>
      <div class="word-list">
        {#each wordState.words as word (word.id)}
          <WordCard
            {word}
            selected={word.id === wordState.selectedWordId}
            onSelect={(wordId) => {
              wordStore.selectWord(wordId);
              focusCanvasEntity('word', wordId);
            }}
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

    <WordnetCard
      word={selectedWord}
      status={wordnetState.status}
      progress={wordnetState.progress}
      error={wordnetState.error}
      entry={wordnetEntry}
      loading={wordnetLoading}
    />
  </aside>
</main>

<input
  bind:this={imageInput}
  type="file"
  accept="image/*"
  hidden
  onchange={handleImageUpload}
/>

<ContextMenu
  open={contextMenu.open}
  x={contextMenu.x}
  y={contextMenu.y}
  title={contextMenuTitle}
  items={contextMenuItems}
  onSelect={handleContextAction}
  onClose={closeContextMenu}
/>

<style>
  .paragraph-column {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto auto;
    min-height: 100vh;
  }

  .paragraph-list,
  .image-list,
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
