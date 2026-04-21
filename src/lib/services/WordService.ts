import { db } from '../db';
import { withTimestamps, withUpdatedAt } from '../utils/date';
import { FlexSearchIndex } from './FlexSearchIndex';
import { MorphologyEngine } from './MorphologyEngine';
import type { Occurrence, Paragraph, Sentence, Word, WordnetEntry } from '../../types/domain.types';
import type { WordRecord } from '../../types/research.types';

const getWordColumnPosition = async (chapterId: number): Promise<{ x: number; y: number }> => {
  const nodes = await db.canvasNodes.where('chapterId').equals(chapterId).toArray();
  const wordNodes = nodes.filter((node) => node.entityType === 'word');
  const paragraphNodes = nodes.filter((node) => node.entityType === 'paragraph');

  if (wordNodes.length > 0) {
    return {
      x: Math.max(...wordNodes.map((node) => node.x)),
      y: Math.max(...wordNodes.map((node) => node.y)) + 136
    };
  }

  return {
    x: Math.max(...paragraphNodes.map((node) => node.x), 120) + 420,
    y: Math.min(...paragraphNodes.map((node) => node.y), -180)
  };
};

const resolveSentenceId = async (
  paragraphId: number,
  tokenStart: number,
  tokenEnd: number
): Promise<number | null> => {
  const sentence = await db.sentences
    .where('paragraphId')
    .equals(paragraphId)
    .filter((entry) => tokenStart >= entry.startOffset && tokenEnd <= entry.endOffset)
    .first();

  return sentence?.id ?? null;
};

const buildLookupCandidates = (lemma: string): string[] => {
  const raw = lemma.trim().toLowerCase().replace(/_/g, ' ');
  const normalized = MorphologyEngine.normalizeToken(lemma);
  const forms = normalized ? MorphologyEngine.getForms(normalized) : [];

  return [...new Set([raw, normalized, ...forms].filter(Boolean))];
};

export class WordService {
  static async upsert(lemma: string): Promise<Word> {
    const normalized = MorphologyEngine.normalizeToken(lemma);
    const existing = await db.words.where('lemma').equals(normalized).first();

    if (existing) return existing;

    const id = await db.words.add(
      withTimestamps({
        lemma: normalized,
        translation: '',
        notes: ''
      })
    );

    return (await db.words.get(id)) as Word;
  }

  static async annotate(
    wordId: number,
    data: Partial<Pick<Word, 'translation' | 'notes'>>
  ): Promise<void> {
    await db.words.update(wordId, withUpdatedAt(data));
  }

  static async getOccurrencesByParagraph(paragraphId: number): Promise<Occurrence[]> {
    return db.occurrences.where('paragraphId').equals(paragraphId).toArray();
  }

  static async getLinkedParagraphs(wordId: number): Promise<Paragraph[]> {
    const paragraphIds = [...new Set((await db.occurrences.where('wordId').equals(wordId).toArray()).map((entry) => entry.paragraphId))];
    return paragraphIds.length === 0 ? [] : db.paragraphs.where('id').anyOf(paragraphIds).toArray();
  }

  static async getLinkedSentences(wordId: number): Promise<Sentence[]> {
    const sentenceIds = [
      ...new Set(
        (await db.occurrences.where('wordId').equals(wordId).toArray())
          .map((entry) => entry.sentenceId)
          .filter((value): value is number => value != null)
      )
    ];
    return sentenceIds.length === 0 ? [] : db.sentences.where('id').anyOf(sentenceIds).toArray();
  }

  static async lookupWordnet(lemma: string): Promise<WordnetEntry | null> {
    const candidates = buildLookupCandidates(lemma);

    if (candidates.length === 0) return null;

    const exactMatches = await db.wordnetCache.where('lemma').anyOf(candidates).toArray();

    if (exactMatches.length > 0) {
      const entryMap = new Map(exactMatches.map((entry) => [entry.lemma, entry]));

      for (const candidate of candidates) {
        const match = entryMap.get(candidate);
        if (match) return match;
      }
    }

    const searchMatches = await FlexSearchIndex.search(lemma, 6);
    const candidateSet = new Set(candidates);

    return searchMatches.find((entry) => candidateSet.has(entry.lemma)) ?? searchMatches[0] ?? null;
  }

  static async listByChapter(chapterId: number): Promise<WordRecord[]> {
    const paragraphIds = (await db.paragraphs.where('chapterId').equals(chapterId).primaryKeys()) as number[];
    const chapterOccurrences = paragraphIds.length === 0
      ? []
      : await db.occurrences.where('paragraphId').anyOf(paragraphIds).toArray();
    const wordIds = [...new Set(chapterOccurrences.map((entry) => entry.wordId))];
    const words = wordIds.length === 0 ? [] : await db.words.where('id').anyOf(wordIds).toArray();

    return words
      .filter((word): word is WordRecord => word.id != null)
      .map((word) => {
        const entries = chapterOccurrences.filter((occurrence) => occurrence.wordId === word.id);

        return {
          ...word,
          id: word.id,
          linkedParagraphCount: new Set(entries.map((entry) => entry.paragraphId)).size,
          linkedSentenceCount: new Set(entries.map((entry) => entry.sentenceId).filter((value) => value != null)).size
        };
      })
      .sort((left, right) => left.lemma.localeCompare(right.lemma));
  }

  static async linkTokenToParagraph(input: {
    chapterId: number;
    paragraphId: number;
    token: string;
    startOffset: number;
    endOffset: number;
  }): Promise<number> {
    const lemma = MorphologyEngine.normalizeToken(input.token);
    const word = await this.upsert(lemma);
    const sentenceId = await resolveSentenceId(input.paragraphId, input.startOffset, input.endOffset);
    const existing = await db.occurrences
      .where('[wordId+paragraphId]')
      .equals([word.id as number, input.paragraphId])
      .first();

    await db.transaction('rw', [db.occurrences, db.canvasNodes], async () => {
      if (!existing) {
        await db.occurrences.add({
          wordId: word.id as number,
          paragraphId: input.paragraphId,
          sentenceId
        });
      }

      const wordNode = await db.canvasNodes
        .where('chapterId')
        .equals(input.chapterId)
        .filter((node) => node.entityType === 'word' && node.entityId === (word.id as number))
        .first();

      if (!wordNode) {
        const position = await getWordColumnPosition(input.chapterId);
        await db.canvasNodes.add({
          entityType: 'word',
          entityId: word.id as number,
          x: position.x,
          y: position.y,
          chapterId: input.chapterId
        });
      }
    });

    return word.id as number;
  }
}
