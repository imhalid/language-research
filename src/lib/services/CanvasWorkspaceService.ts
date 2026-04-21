import { db } from '../db';
import type { CanvasWorkspaceNode } from '../../types/canvas.types';
import type { CanvasEntityType } from '../../types/domain.types';
import { DEFAULT_ROOT_CHAPTER_TITLE, ensureResearchSeeded } from './ResearchBootstrapService';

export interface CanvasWorkspaceData {
  chapterId: number;
  chapterTitle: string;
  nodes: CanvasWorkspaceNode[];
}

const preview = (value: string): string => value.slice(0, 72).trim();

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

  if (entityType === 'image') {
    const paragraphIds = (await db.paragraphs.where('chapterId').equals(chapterId).primaryKeys()) as number[];

    if (paragraphIds.length === 0) return new Map();

    return buildNodeMap(await db.images.where('paragraphId').anyOf(paragraphIds).toArray(), (entry) => ({
      title: entry.caption || `Image ${entry.id}`,
      subtitle: entry.notes || `paragraph ${entry.paragraphId}`
    }));
  }

  return new Map();
};

export class CanvasWorkspaceService {
  static async load(chapterId?: number): Promise<CanvasWorkspaceData> {
    const targetChapterId = chapterId ?? (await ensureResearchSeeded());
    const [chapter, nodes, paragraphMap, sentenceMap, wordMap, imageMap] = await Promise.all([
      db.chapters.get(targetChapterId),
      db.canvasNodes.where('chapterId').equals(targetChapterId).toArray(),
      resolveNodePresentation(targetChapterId, 'paragraph'),
      resolveNodePresentation(targetChapterId, 'sentence'),
      resolveNodePresentation(targetChapterId, 'word'),
      resolveNodePresentation(targetChapterId, 'image')
    ]);

    const dictionary = {
      paragraph: paragraphMap,
      sentence: sentenceMap,
      word: wordMap,
      image: imageMap
    };

    return {
      chapterId: targetChapterId,
      chapterTitle: chapter?.title ?? DEFAULT_ROOT_CHAPTER_TITLE,
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
