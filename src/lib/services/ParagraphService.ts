import { db } from '../db';
import { now, withTimestamps, withUpdatedAt } from '../utils/date';
import { ensureResearchSeeded } from './ResearchBootstrapService';
import type { ParagraphRecord, SentenceSelection } from '../../types/research.types';

const getParagraphColumnPosition = async (chapterId: number): Promise<{ x: number; y: number }> => {
  const paragraphNodes = (await db.canvasNodes.where('chapterId').equals(chapterId).toArray()).filter(
    (node) => node.entityType === 'paragraph'
  );

  if (paragraphNodes.length === 0) {
    return { x: -340, y: -120 };
  }

  return {
    x: Math.min(...paragraphNodes.map((node) => node.x)),
    y: Math.max(...paragraphNodes.map((node) => node.y)) + 180
  };
};

export class ParagraphService {
  static async listByChapter(chapterId: number): Promise<ParagraphRecord[]> {
    await ensureResearchSeeded();
    const [paragraphs, sentences] = await Promise.all([
      db.paragraphs.where('chapterId').equals(chapterId).sortBy('createdAt'),
      db.sentences.toArray()
    ]);
    const countMap = new Map<number, number>();

    for (const sentence of sentences) {
      countMap.set(sentence.paragraphId, (countMap.get(sentence.paragraphId) ?? 0) + 1);
    }

    return paragraphs
      .filter((paragraph): paragraph is ParagraphRecord => paragraph.id != null)
      .map((paragraph) => ({
        ...paragraph,
        id: paragraph.id,
        sentenceCount: countMap.get(paragraph.id) ?? 0
      }));
  }

  static async create(
    chapterId: number,
    content: string,
    position?: { x: number; y: number }
  ): Promise<number> {
    const nextPosition = position ?? (await getParagraphColumnPosition(chapterId));

    return db.transaction('rw', [db.paragraphs, db.canvasNodes], async () => {
      const paragraphId = await db.paragraphs.add(
        withTimestamps({
          chapterId,
          content,
          notes: ''
        })
      );

      await db.canvasNodes.add({
        entityType: 'paragraph',
        entityId: paragraphId,
        x: nextPosition.x,
        y: nextPosition.y,
        chapterId
      });

      return paragraphId;
    });
  }

  static async updateNotes(paragraphId: number, notes: string): Promise<void> {
    await db.paragraphs.update(paragraphId, withUpdatedAt({ notes }));
  }

  static async delete(paragraphId: number): Promise<void> {
    await db.transaction(
      'rw',
      [db.paragraphs, db.sentences, db.occurrences, db.images, db.canvasNodes],
      async () => {
        const paragraph = await db.paragraphs.get(paragraphId);
        const chapterId = paragraph?.chapterId ?? null;
        const sentenceIds = (await db.sentences.where('paragraphId').equals(paragraphId).primaryKeys()) as number[];
        const imageIds = (await db.images.where('paragraphId').equals(paragraphId).primaryKeys()) as number[];
        const nodeIds = (await db.canvasNodes.toArray())
          .filter(
            (node) =>
              (node.entityType === 'paragraph' && node.entityId === paragraphId) ||
              (node.entityType === 'sentence' && sentenceIds.includes(node.entityId)) ||
              (node.entityType === 'image' && imageIds.includes(node.entityId))
          )
          .flatMap((node) => (node.id ? [node.id] : []));

        await db.sentences.where('paragraphId').equals(paragraphId).delete();
        await db.occurrences.where('paragraphId').equals(paragraphId).delete();
        await db.images.where('paragraphId').equals(paragraphId).delete();
        if (chapterId != null) {
          const remainingParagraphIds = (await db.paragraphs.where('chapterId').equals(chapterId).primaryKeys()) as number[];
          const remainingWordIds = new Set(
            remainingParagraphIds.length === 0
              ? []
              : (await db.occurrences.where('paragraphId').anyOf(remainingParagraphIds).toArray()).map((entry) => entry.wordId)
          );
          const orphanWordNodeIds = (await db.canvasNodes.where('chapterId').equals(chapterId).toArray())
            .filter((node) => node.entityType === 'word' && !remainingWordIds.has(node.entityId))
            .flatMap((node) => (node.id ? [node.id] : []));
          if (orphanWordNodeIds.length > 0) await db.canvasNodes.bulkDelete(orphanWordNodeIds);
        }
        if (nodeIds.length > 0) await db.canvasNodes.bulkDelete(nodeIds);
        await db.paragraphs.delete(paragraphId);
      }
    );
  }

  static async splitSentence(
    paragraphId: number,
    chapterId: number,
    selection: SentenceSelection
  ): Promise<number> {
    return db.transaction('rw', [db.sentences, db.canvasNodes], async () => {
      const sentenceId = await db.sentences.add({
        paragraphId,
        content: selection.text,
        startOffset: selection.startOffset,
        endOffset: selection.endOffset,
        notes: '',
        createdAt: now()
      });
      const paragraphNode = (await db.canvasNodes.where('chapterId').equals(chapterId).toArray()).find(
        (node) => node.entityType === 'paragraph' && node.entityId === paragraphId
      );
      const siblingCount = await db.sentences.where('paragraphId').equals(paragraphId).count();
      const x = (paragraphNode?.x ?? -120) + 320;
      const y = (paragraphNode?.y ?? 0) + siblingCount * 132 - 132;

      await db.canvasNodes.add({
        entityType: 'sentence',
        entityId: sentenceId,
        x,
        y,
        chapterId
      });

      return sentenceId;
    });
  }
}
