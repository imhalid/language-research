import { db } from '../db';
import { now, withTimestamps } from '../utils/date';

export const DEFAULT_ROOT_CHAPTER_TITLE = 'Atlas Terminal';
export const DEFAULT_CHILD_CHAPTER_TITLE = 'Field Notes';

export const resolveSelectedChapterId = async (): Promise<number | null> => {
  const selected = await db.settings.get('selectedChapterId');
  return typeof selected?.value === 'number' ? selected.value : null;
};

const createSeedWorkspace = async (): Promise<number> =>
  db.transaction(
    'rw',
    [db.chapters, db.paragraphs, db.sentences, db.words, db.canvasNodes, db.settings],
    async () => {
      const rootChapterId = await db.chapters.add(
        withTimestamps({
          parentId: null,
          title: DEFAULT_ROOT_CHAPTER_TITLE,
          order: 0
        })
      );
      const childChapterId = await db.chapters.add(
        withTimestamps({
          parentId: rootChapterId,
          title: DEFAULT_CHILD_CHAPTER_TITLE,
          order: 1
        })
      );
      const paragraphA = await db.paragraphs.add(
        withTimestamps({
          chapterId: rootChapterId,
          content: 'Manual translation workspace keeps long passages on canvas without breaking context.',
          notes: ''
        })
      );
      const paragraphB = await db.paragraphs.add(
        withTimestamps({
          chapterId: rootChapterId,
          content: 'Linked words and sentence snapshots should stay movable while chapter focus remains stable.',
          notes: ''
        })
      );
      const childParagraph = await db.paragraphs.add(
        withTimestamps({
          chapterId: childChapterId,
          content: 'Subchapter canvas can isolate side notes without polluting root chapter workspace.',
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
        { entityType: 'paragraph', entityId: paragraphA, x: -360, y: -180, chapterId: rootChapterId },
        { entityType: 'paragraph', entityId: paragraphB, x: -120, y: 120, chapterId: rootChapterId },
        { entityType: 'sentence', entityId: sentenceId, x: 260, y: -40, chapterId: rootChapterId },
        { entityType: 'word', entityId: wordA, x: 520, y: 210, chapterId: rootChapterId },
        { entityType: 'word', entityId: wordB, x: 120, y: -260, chapterId: rootChapterId },
        { entityType: 'paragraph', entityId: childParagraph, x: -220, y: -40, chapterId: childChapterId }
      ]);

      await db.settings.put({ key: 'selectedChapterId', value: rootChapterId });

      return rootChapterId;
    }
  );

export const ensureResearchSeeded = async (): Promise<number> => {
  const chapterCount = await db.chapters.count();

  if (chapterCount === 0) {
    return createSeedWorkspace();
  }

  const selectedChapterId = await resolveSelectedChapterId();

  if (selectedChapterId != null && (await db.chapters.get(selectedChapterId))) {
    return selectedChapterId;
  }

  const firstChapter = await db.chapters.orderBy('order').first();

  if (!firstChapter?.id) {
    return createSeedWorkspace();
  }

  await db.settings.put({ key: 'selectedChapterId', value: firstChapter.id });

  return firstChapter.id;
};
