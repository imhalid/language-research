import { Document, type DocumentData } from 'flexsearch';
import { db } from '../db';
import { MorphologyEngine } from './MorphologyEngine';
import type { WordnetEntry } from '../../types/domain.types';

type WordnetSearchDocument = WordnetEntry & DocumentData;

const createWordnetIndex = (): Document<WordnetSearchDocument> =>
  new Document<WordnetSearchDocument>({
    document: {
      id: 'lemma',
      index: [
        { field: 'lemma', tokenize: 'forward', resolution: 9 },
        { field: 'definitions', tokenize: 'strict', resolution: 5 },
        { field: 'synonyms', tokenize: 'strict', resolution: 4 },
        { field: 'examples', tokenize: 'strict', resolution: 3 }
      ]
    }
  });

const extractResultIds = (results: unknown): string[] => {
  if (!Array.isArray(results)) return [];

  const ids: string[] = [];
  const seen = new Set<string>();

  for (const group of results as Array<{ result?: unknown[] }>) {
    if (!Array.isArray(group?.result)) continue;

    for (const item of group.result) {
      const id =
        typeof item === 'string'
          ? item
          : typeof item === 'object' && item && 'id' in item
            ? String((item as { id: unknown }).id)
            : null;

      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }

  return ids;
};

export let wordnetIndex = createWordnetIndex();
let ready = false;
const indexedLemmas = new Set<string>();

export class FlexSearchIndex {
  static add(entry: WordnetEntry): void {
    if (indexedLemmas.has(entry.lemma)) return;

    wordnetIndex.add(entry as WordnetSearchDocument);
    indexedLemmas.add(entry.lemma);
  }

  static bulkAdd(entries: WordnetEntry[]): void {
    for (const entry of entries) this.add(entry);
  }

  static clear(): void {
    wordnetIndex = createWordnetIndex();
    indexedLemmas.clear();
    ready = false;
  }

  static async rebuildFromCache(onProgress?: (value: number) => void): Promise<void> {
    this.clear();

    const total = await db.wordnetCache.count();

    if (total === 0) {
      ready = true;
      onProgress?.(100);
      return;
    }

    let processed = 0;

    await db.wordnetCache.orderBy('lemma').each((entry) => {
      this.add(entry);
      processed += 1;

      if (processed % 1000 === 0 || processed === total) {
        onProgress?.(Math.round((processed / total) * 100));
      }
    });

    ready = true;
  }

  static isReady(): boolean {
    return ready;
  }

  static async search(query: string, limit = 12): Promise<WordnetEntry[]> {
    const normalized = MorphologyEngine.normalizeToken(query);
    const raw = query.trim().toLowerCase().replace(/_/g, ' ');
    const term = normalized || raw;

    if (!term) return [];
    if (!ready) await this.rebuildFromCache();

    const lemmas = extractResultIds(wordnetIndex.search(term, { enrich: true, limit }));

    if (lemmas.length === 0) return [];

    const entries = await db.wordnetCache.where('lemma').anyOf(lemmas.slice(0, limit)).toArray();
    const entryMap = new Map(entries.map((entry) => [entry.lemma, entry]));

    return lemmas
      .map((lemma) => entryMap.get(lemma))
      .filter((entry): entry is WordnetEntry => !!entry)
      .slice(0, limit);
  }
}
