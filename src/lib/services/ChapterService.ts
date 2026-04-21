import { db } from '../db';
import { withTimestamps } from '../utils/date';
import { ensureResearchSeeded } from './ResearchBootstrapService';
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
}
