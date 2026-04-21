/// <reference lib="webworker" />

import { db } from './index';
import type { WordnetEntry } from '../../types/domain.types';
import type { Example, Synset, WordnetTypes } from '../../types/wordnet.types';
import type { WordnetWorkerCommand, WordnetWorkerMessage } from '../../types/machine.types';

const CHUNK_SIZE = 400;
const MAX_PROGRESS = 90;
const workerScope = self as DedicatedWorkerGlobalScope;

const stripPos = (value: string): string => value.replace(/^[anrsv]\./, '').toLowerCase();
const toCacheLemma = (value: string): string => stripPos(value).replace(/_/g, ' ');
const unique = (values: string[]): string[] => [...new Set(values.map((value) => value.trim()).filter(Boolean))];

const resolveTemplateExample = (
  example: Example,
  synset: Synset,
  data: WordnetTypes
): string | null => {
  const template = data.example[String(example.templateNumber)];

  if (!template) return null;

  const replacement = toCacheLemma(synset.word[Math.max(0, example.wordNumber - 1)] ?? synset.word[0] ?? '');
  return template.replace(/%s/g, replacement).trim();
};

const resolveGlossDetails = (gloss: string): { definition: string; examples: string[] } => {
  const definition = gloss.split(';')[0]?.trim() ?? gloss.trim();
  const examples = [...gloss.matchAll(/"([^"]+)"/g)].map((match) => match[1].trim());

  return {
    definition,
    examples
  };
};

const buildEntry = (
  cacheLemma: string,
  synsetIds: string[],
  data: WordnetTypes
): WordnetEntry | null => {
  const synsets = unique(synsetIds);
  const records = synsets
    .map((synsetId) => data.synset[synsetId])
    .filter((record): record is Synset => !!record);

  if (records.length === 0) return null;

  const definitions = unique(records.map((record) => resolveGlossDetails(record.gloss).definition));
  const synonyms = unique(records.flatMap((record) => record.word.map((word) => toCacheLemma(word))));
  const examples = unique(
    records.flatMap((record) => {
      const gloss = resolveGlossDetails(record.gloss).examples;
      const templated = (record.example ?? [])
        .map((entry) => resolveTemplateExample(entry, record, data))
        .filter((entry): entry is string => !!entry);

      return [...gloss, ...templated];
    })
  );

  return {
    lemma: cacheLemma,
    synsets,
    definitions,
    synonyms,
    examples
  };
};

const buildExceptionMap = (data: WordnetTypes): Map<string, string[]> => {
  const surfaceMap = new Map<string, string[]>();

  for (const [surface, lemmas] of Object.entries(data.exception)) {
    const cacheLemma = toCacheLemma(surface);
    const resolved = lemmas.map((lemma) => stripPos(lemma));
    const current = surfaceMap.get(cacheLemma) ?? [];
    surfaceMap.set(cacheLemma, unique([...current, ...resolved]));
  }

  return surfaceMap;
};

const postProgress = (processed: number, total: number): void => {
  const value = total === 0 ? MAX_PROGRESS : Math.min(MAX_PROGRESS, Math.round((processed / total) * MAX_PROGRESS));
  const message: WordnetWorkerMessage = { type: 'PROGRESS', value };
  workerScope.postMessage(message);
};

const flushEntries = async (
  entries: WordnetEntry[],
  processed: number,
  total: number
): Promise<void> => {
  if (entries.length > 0) {
    await db.wordnetCache.bulkAdd(entries);
  }

  postProgress(processed, total);
};

const seedWordnet = async (): Promise<void> => {
  const response = await fetch('/wordnet.json');

  if (!response.ok) {
    throw new Error(`wordnet fetch failed: ${response.status}`);
  }

  const data = (await response.json()) as WordnetTypes;
  const baseLemmas = Object.entries(data.lemma);
  const baseLemmaSet = new Set(baseLemmas.map(([lemma]) => toCacheLemma(lemma)));
  const exceptionMap = buildExceptionMap(data);
  const total = baseLemmas.length + exceptionMap.size;
  let processed = 0;
  let batch: WordnetEntry[] = [];

  await db.transaction('rw', [db.wordnetCache, db.settings], async () => {
    await db.wordnetCache.clear();
    await db.settings.put({ key: 'wordnetSeeded', value: false });
  });

  for (const [lemma, synsetIds] of baseLemmas) {
    const entry = buildEntry(toCacheLemma(lemma), synsetIds, data);
    processed += 1;

    if (entry) batch.push(entry);
    if (batch.length < CHUNK_SIZE) continue;

    const chunk = batch;
    batch = [];
    await flushEntries(chunk, processed, total);
  }

  for (const [surface, lemmas] of exceptionMap) {
    processed += 1;

    if (!baseLemmaSet.has(surface)) {
      const synsetIds = unique(lemmas.flatMap((lemma) => data.lemma[lemma] ?? []));
      const entry = buildEntry(surface, synsetIds, data);
      if (entry) batch.push(entry);
    }

    if (batch.length < CHUNK_SIZE) continue;

    const chunk = batch;
    batch = [];
    await flushEntries(chunk, processed, total);
  }

  await flushEntries(batch, processed, total);

  await db.settings.put({ key: 'wordnetSeeded', value: true });
};

workerScope.onmessage = (event: MessageEvent<WordnetWorkerCommand>) => {
  if (event.data?.type !== 'START') return;

  void seedWordnet()
    .then(() => {
      const message: WordnetWorkerMessage = { type: 'DONE' };
      workerScope.postMessage(message);
    })
    .catch((cause) => {
      const message: WordnetWorkerMessage = {
        type: 'ERROR',
        message: cause instanceof Error ? cause.message : 'wordnet seed failed'
      };
      workerScope.postMessage(message);
    });
};

export {};
