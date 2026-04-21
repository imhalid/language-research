export interface Chapter {
  id?: number;
  parentId: number | null;
  title: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Paragraph {
  id?: number;
  chapterId: number;
  content: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Sentence {
  id?: number;
  paragraphId: number;
  content: string;
  startOffset: number;
  endOffset: number;
  notes: string;
  createdAt: string;
}

export interface Word {
  id?: number;
  lemma: string;
  translation: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Occurrence {
  id?: number;
  wordId: number;
  paragraphId: number;
  sentenceId: number | null;
}

export type CanvasEntityType = 'paragraph' | 'sentence' | 'word' | 'image';

export interface CanvasNode {
  id?: number;
  entityType: CanvasEntityType;
  entityId: number;
  x: number;
  y: number;
  chapterId: number;
}

export interface Image {
  id?: number;
  paragraphId: number;
  blob: Blob;
  caption: string;
  notes: string;
  createdAt: string;
}

export interface WordnetEntry {
  id?: number;
  lemma: string;
  synsets: string[];
  definitions: string[];
  synonyms: string[];
  examples: string[];
}

export interface Setting {
  key: string;
  value: unknown;
}
