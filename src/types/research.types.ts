import type { Chapter, Paragraph } from './domain.types';

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
