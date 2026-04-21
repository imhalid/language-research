import SeedWorker from '$lib/db/seed.worker?worker';
import { db } from '../db';
import { FlexSearchIndex } from './FlexSearchIndex';
import type { WordnetWorkerCommand, WordnetWorkerMessage } from '../../types/machine.types';

const toRebuildProgress = (value: number): number => 91 + Math.round((value / 100) * 9);

const isWordnetSeeded = async (): Promise<boolean> => {
  const [setting, cacheCount] = await Promise.all([db.settings.get('wordnetSeeded'), db.wordnetCache.count()]);
  return setting?.value === true && cacheCount > 0;
};

const seedWithWorker = (onProgress: (value: number) => void): Promise<void> =>
  new Promise((resolve, reject) => {
    const worker = new SeedWorker();

    const cleanup = (): void => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    };

    worker.onmessage = (event: MessageEvent<WordnetWorkerMessage>) => {
      const message = event.data;

      if (message.type === 'PROGRESS') {
        onProgress(Math.max(1, Math.min(90, message.value)));
        return;
      }

      cleanup();

      if (message.type === 'DONE') {
        resolve();
        return;
      }

      reject(new Error(message.message));
    };

    worker.onerror = (event: ErrorEvent) => {
      cleanup();
      reject(new Error(event.message || 'wordnet worker failed'));
    };

    const command: WordnetWorkerCommand = { type: 'START' };
    worker.postMessage(command);
  });

export class WordnetBootstrapService {
  static async ensureReady(onProgress: (value: number) => void): Promise<void> {
    if (!(await isWordnetSeeded())) {
      await seedWithWorker(onProgress);
    }

    onProgress(91);
    await FlexSearchIndex.rebuildFromCache((value) => onProgress(toRebuildProgress(value)));
  }
}
