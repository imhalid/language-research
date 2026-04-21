import Dexie, { type Table } from 'dexie';
import type {
  CanvasNode,
  Chapter,
  Image,
  Occurrence,
  Paragraph,
  Sentence,
  Setting,
  Word,
  WordnetEntry
} from '../../types/domain.types';
import { applyMigrations } from './migrations';

export class AppDatabase extends Dexie {
  chapters!: Table<Chapter, number>;
  paragraphs!: Table<Paragraph, number>;
  sentences!: Table<Sentence, number>;
  words!: Table<Word, number>;
  occurrences!: Table<Occurrence, number>;
  canvasNodes!: Table<CanvasNode, number>;
  images!: Table<Image, number>;
  wordnetCache!: Table<WordnetEntry, number>;
  settings!: Table<Setting, string>;

  constructor() {
    super('LanguageResearchApp');
    applyMigrations(this);
  }
}

export const db = new AppDatabase();
