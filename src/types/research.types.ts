import type { Chapter, Paragraph, Word } from './domain.types';

export interface ChapterTreeNode extends Chapter {
  id: number;
  children: ChapterTreeNode[];
}

export interface ChapterTreeState {
  chapters: ChapterTreeNode[];
  activeChapterId: number;
  ancestorIds: number[];
}

export interface ParagraphRecord extends Paragraph {
  id: number;
  sentenceCount: number;
}

export interface SentenceSelection {
  text: string;
  startOffset: number;
  endOffset: number;
}

export interface HighlightToken {
  key: string;
  text: string;
  lemma: string | null;
  startOffset: number;
  endOffset: number;
  isWord: boolean;
  isHighlighted: boolean;
  wordId: number | null;
  translation: string | null;
}

export interface WordRecord extends Word {
  id: number;
  linkedParagraphCount: number;
  linkedSentenceCount: number;
}
