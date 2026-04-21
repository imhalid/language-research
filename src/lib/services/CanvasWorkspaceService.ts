import { db } from '../db';
import { now, withTimestamps } from '../utils/date';
import type { CanvasWorkspaceNode } from '../../types/canvas.types';
import type { CanvasEntityType } from '../../types/domain.types';

const DEFAULT_CHAPTER_TITLE = 'Atlas Terminal';

export interface CanvasWorkspaceData {
  chapterId: number;
  chapterTitle: string;
  nodes: CanvasWorkspaceNode[];
}

const preview = (value: string): string => value.slice(0, 72).trim();

const resolveSelectedChapterId = async (): Promise<number | null> => {
  const selected = await db.settings.get('selectedChapterId');
  return typeof selected?.value === 'number' ? selected.value : null;
};

const createPhaseTwoDemo = async (): Promise<number> =>
  db.transaction(
    'rw',
    [db.chapters, db.paragraphs, db.sentences, db.words, db.canvasNodes, db.settings],
    async () => {
      const chapterId = await db.chapters.add(
        withTimestamps({
          parentId: null,
          title: DEFAULT_CHAPTER_TITLE,
          order: 0
        })
      );

      const paragraphA = await db.paragraphs.add(
        withTimestamps({
          chapterId,
          content: 'Manual translation workspace keeps long passages on canvas without breaking context.',
          notes: ''
        })
      );
      const paragraphB = await db.paragraphs.add(
        withTimestamps({
          chapterId,
          content: 'Linked words and sentence snapshots should stay movable while chapter focus remains stable.',
          notes: ''
        })
      );
      const sentenceId = await db.sentences.add({
        paragraphId: paragraphA,
        content: 'Manual translation workspace keeps long passages on canvas.',
        startOffset: 0,
        endOffset: 58,
        notes: '',
        createdAt: now()
      });
      const wordA = await db.words.add(
        withTimestamps({
          lemma: 'context',
          translation: 'baglam',
          notes: ''
        })
      );
      const wordB = await db.words.add(
        withTimestamps({
          lemma: 'anchor',
          translation: 'capa',
          notes: ''
        })
      );

      await db.canvasNodes.bulkAdd([
        { entityType: 'paragraph', entityId: paragraphA, x: -360, y: -180, chapterId },
        { entityType: 'paragraph', entityId: paragraphB, x: -120, y: 120, chapterId },
        { entityType: 'sentence', entityId: sentenceId, x: 260, y: -40, chapterId },
        { entityType: 'word', entityId: wordA, x: 520, y: 210, chapterId },
        { entityType: 'word', entityId: wordB, x: 120, y: -260, chapterId }
      ]);

      await db.settings.put({ key: 'selectedChapterId', value: chapterId });

      return chapterId;
    }
  );

const ensureWorkspace = async (): Promise<number> => {
  const chapterCount = await db.chapters.count();

  if (chapterCount === 0) {
    return createPhaseTwoDemo();
  }

  const selectedChapterId = await resolveSelectedChapterId();

  if (selectedChapterId != null && (await db.chapters.get(selectedChapterId))) {
    return selectedChapterId;
  }

  const firstChapter = await db.chapters.orderBy('order').first();

  if (!firstChapter?.id) {
    return createPhaseTwoDemo();
  }

  await db.settings.put({ key: 'selectedChapterId', value: firstChapter.id });

  return firstChapter.id;
};

const buildNodeMap = <T extends { id?: number }>(
  entries: T[],
  resolver: (entry: T) => { title: string; subtitle: string }
): Map<number, { title: string; subtitle: string }> =>
  new Map(entries.flatMap((entry) => (entry.id ? [[entry.id, resolver(entry)] as const] : [])));

const resolveNodePresentation = async (
  chapterId: number,
  entityType: CanvasEntityType
): Promise<Map<number, { title: string; subtitle: string }>> => {
  if (entityType === 'paragraph') {
    return buildNodeMap(await db.paragraphs.where('chapterId').equals(chapterId).toArray(), (entry) => ({
      title: `Paragraph ${entry.id}`,
      subtitle: preview(entry.content)
    }));
  }

  if (entityType === 'sentence') {
    const paragraphs = await db.sentences.toArray();
    return buildNodeMap(paragraphs, (entry) => ({
      title: `Sentence ${entry.id}`,
      subtitle: preview(entry.content)
    }));
  }

  if (entityType === 'word') {
    return buildNodeMap(await db.words.toArray(), (entry) => ({
      title: entry.lemma,
      subtitle: entry.translation || 'translation pending'
    }));
  }

  return new Map();
};

export class CanvasWorkspaceService {
  static async load(): Promise<CanvasWorkspaceData> {
    const chapterId = await ensureWorkspace();
    const [chapter, nodes, paragraphMap, sentenceMap, wordMap] = await Promise.all([
      db.chapters.get(chapterId),
      db.canvasNodes.where('chapterId').equals(chapterId).toArray(),
      resolveNodePresentation(chapterId, 'paragraph'),
      resolveNodePresentation(chapterId, 'sentence'),
      resolveNodePresentation(chapterId, 'word')
    ]);

    const dictionary = {
      paragraph: paragraphMap,
      sentence: sentenceMap,
      word: wordMap,
      image: new Map<number, { title: string; subtitle: string }>()
    };

    return {
      chapterId,
      chapterTitle: chapter?.title ?? DEFAULT_CHAPTER_TITLE,
      nodes: nodes.flatMap((node) => {
        if (!node.id) return [];

        const meta = dictionary[node.entityType].get(node.entityId);

        return [
          {
            ...node,
            id: node.id,
            title: meta?.title ?? `${node.entityType} ${node.entityId}`,
            subtitle: meta?.subtitle ?? 'unresolved entity'
          }
        ];
      })
    };
  }

  static async updateNodePosition(nodeId: number, x: number, y: number): Promise<void> {
    await db.canvasNodes.update(nodeId, { x, y });
  }
}
