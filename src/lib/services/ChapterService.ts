import { db } from '../db';
import { withTimestamps } from '../utils/date';
import { ensureResearchSeeded } from './ResearchBootstrapService';
import { SettingsService } from './SettingsService';
import type { ChapterTreeNode, ChapterTreeState } from '../../types/research.types';

const buildTree = (chapters: ChapterTreeNode[], parentId: number | null): ChapterTreeNode[] =>
  chapters
    .filter((chapter) => chapter.parentId === parentId)
    .sort((left, right) => left.order - right.order)
    .map((chapter) => ({
      ...chapter,
      children: buildTree(chapters, chapter.id)
    }));

const getAncestorIds = (chapterMap: Map<number, ChapterTreeNode>, chapterId: number): number[] => {
  const ancestors: number[] = [];
  let current = chapterMap.get(chapterId);

  while (current?.parentId != null) {
    ancestors.unshift(current.parentId);
    current = chapterMap.get(current.parentId);
  }

  return ancestors;
};

const nextOrder = async (parentId: number | null): Promise<number> => {
  const chapters = await db.chapters.toArray();
  const orders = chapters.filter((chapter) => chapter.parentId === parentId).map((chapter) => chapter.order);
  return orders.length === 0 ? 0 : Math.max(...orders) + 1;
};

const createBlankRoot = async (): Promise<number> => {
  const chapterId = await db.chapters.add(
    withTimestamps({
      parentId: null,
      title: 'Chapter 1',
      order: 0
    })
  );

  await SettingsService.set('selectedChapterId', chapterId);
  return chapterId;
};

const collectBranchIds = (chapters: ChapterTreeNode[], rootId: number): Set<number> => {
  const branch = new Set<number>([rootId]);
  let changed = true;

  while (changed) {
    changed = false;

    for (const chapter of chapters) {
      if (!chapter.id || chapter.parentId == null || branch.has(chapter.id) || !branch.has(chapter.parentId)) continue;
      branch.add(chapter.id);
      changed = true;
    }
  }

  return branch;
};

export class ChapterService {
  static async loadTree(preferredChapterId?: number): Promise<ChapterTreeState> {
    const fallbackId = await ensureResearchSeeded();
    const chapters = (await db.chapters.toArray())
      .filter((chapter): chapter is ChapterTreeNode => chapter.id != null)
      .map((chapter) => ({ ...chapter, id: chapter.id, children: [] }));
    const chapterMap = new Map(chapters.map((chapter) => [chapter.id, chapter]));
    const activeChapterId =
      preferredChapterId && chapterMap.has(preferredChapterId) ? preferredChapterId : fallbackId;

    return {
      chapters: buildTree(chapters, null),
      activeChapterId,
      ancestorIds: getAncestorIds(chapterMap, activeChapterId)
    };
  }

  static async createRoot(): Promise<number> {
    const order = await nextOrder(null);
    return db.chapters.add(
      withTimestamps({
        parentId: null,
        title: `Chapter ${order + 1}`,
        order
      })
    );
  }

  static async createChild(parentId: number): Promise<number> {
    const order = await nextOrder(parentId);
    return db.chapters.add(
      withTimestamps({
        parentId,
        title: `Subchapter ${order + 1}`,
        order
      })
    );
  }

  static async deleteCascade(chapterId: number): Promise<number> {
    const chapters = (await db.chapters.toArray())
      .filter((chapter): chapter is ChapterTreeNode => chapter.id != null)
      .map((chapter) => ({ ...chapter, id: chapter.id, children: [] }));
    const branchIds = collectBranchIds(chapters, chapterId);
    const chapterIds = [...branchIds];
    const remaining = chapters
      .filter((chapter) => !branchIds.has(chapter.id))
      .sort((left, right) => left.order - right.order);
    const paragraphIds =
      chapterIds.length === 0
        ? []
        : ((await db.paragraphs.where('chapterId').anyOf(chapterIds).primaryKeys()) as number[]);
    const sentenceIds =
      paragraphIds.length === 0
        ? []
        : ((await db.sentences.where('paragraphId').anyOf(paragraphIds).primaryKeys()) as number[]);

    await db.transaction(
      'rw',
      [db.chapters, db.paragraphs, db.sentences, db.occurrences, db.canvasNodes, db.images],
      async () => {
        if (paragraphIds.length > 0) {
          await db.sentences.where('paragraphId').anyOf(paragraphIds).delete();
          await db.occurrences.where('paragraphId').anyOf(paragraphIds).delete();
          await db.images.where('paragraphId').anyOf(paragraphIds).delete();
        }

        if (chapterIds.length > 0) {
          await db.canvasNodes.where('chapterId').anyOf(chapterIds).delete();
          await db.paragraphs.where('chapterId').anyOf(chapterIds).delete();
          await db.chapters.where('id').anyOf(chapterIds).delete();
        }

        if (sentenceIds.length > 0) {
          await db.occurrences.where('sentenceId').anyOf(sentenceIds).modify({ sentenceId: null });
        }
      }
    );

    if (remaining.length === 0) {
      return createBlankRoot();
    }

    await SettingsService.set('selectedChapterId', remaining[0].id);
    return remaining[0].id;
  }
}
