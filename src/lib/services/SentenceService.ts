import { db } from '../db';

export class SentenceService {
  static async delete(sentenceId: number): Promise<void> {
    await db.transaction('rw', [db.sentences, db.occurrences, db.canvasNodes], async () => {
      await db.occurrences.where('sentenceId').equals(sentenceId).modify({ sentenceId: null });

      const nodeIds = (await db.canvasNodes.toArray())
        .filter((node) => node.entityType === 'sentence' && node.entityId === sentenceId)
        .flatMap((node) => (node.id ? [node.id] : []));

      if (nodeIds.length > 0) await db.canvasNodes.bulkDelete(nodeIds);
      await db.sentences.delete(sentenceId);
    });
  }
}
