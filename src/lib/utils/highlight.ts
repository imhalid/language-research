import { db } from '../db';
import { MorphologyEngine } from '../services/MorphologyEngine';
import { WordService } from '../services/WordService';
import type { HighlightToken } from '../../types/research.types';

const TOKEN_PATTERN = /([A-Za-z']+|[^A-Za-z']+)/g;

export async function buildHighlightedTokens(
  paragraphId: number,
  content: string
): Promise<HighlightToken[]> {
  const occurrences = await WordService.getOccurrencesByParagraph(paragraphId);
  const highlightedWordIds = new Set(occurrences.map((entry) => entry.wordId));
  const words = highlightedWordIds.size > 0
    ? await db.words.where('id').anyOf([...highlightedWordIds]).toArray()
    : [];
  const lemmaMap = new Map(words.map((word) => [word.lemma, word]));

  let offset = 0;

  return [...content.matchAll(TOKEN_PATTERN)].map((match, index) => {
    const text = match[0];
    const startOffset = offset;
    const endOffset = offset + text.length;
    offset = endOffset;
    const isWord = /^[A-Za-z']+$/.test(text);
    const lemma = isWord ? MorphologyEngine.normalizeToken(text) : null;
    const word = lemma ? lemmaMap.get(lemma) : null;

    return {
      key: `${paragraphId}-${index}-${startOffset}`,
      text,
      lemma,
      startOffset,
      endOffset,
      isWord,
      isHighlighted: !!word,
      wordId: word?.id ?? null,
      translation: word?.translation || null
    };
  });
}
