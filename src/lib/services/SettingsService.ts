import { db } from '../db';

export class SettingsService {
  static async getNumber(key: string, fallback: number): Promise<number> {
    const value = (await db.settings.get(key))?.value;
    return typeof value === 'number' ? value : fallback;
  }

  static async set(key: string, value: unknown): Promise<void> {
    await db.settings.put({ key, value });
  }
}
