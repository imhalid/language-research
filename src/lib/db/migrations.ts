import type Dexie from 'dexie';

export const schemaV1 = {
  chapters: '++id, parentId, title, order, createdAt, updatedAt',
  paragraphs: '++id, chapterId, content, notes, createdAt, updatedAt',
  sentences: '++id, paragraphId, content, startOffset, endOffset, notes, createdAt',
  words: '++id, &lemma, translation, notes, createdAt, updatedAt',
  occurrences: '++id, wordId, paragraphId, sentenceId, [wordId+paragraphId]',
  canvasNodes: '++id, entityType, entityId, x, y, chapterId',
  images: '++id, paragraphId, caption, notes, createdAt',
  wordnetCache: '++id, &lemma, synsets, definitions, synonyms, examples',
  settings: '&key, value'
} as const;

type VersionedDatabase = Pick<Dexie, 'version'>;

export const applyMigrations = (database: VersionedDatabase): void => {
  database.version(1).stores(schemaV1);
};
