import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { type LanguagePreference } from '@/i18n';

const schemaVersion = 2;
let databasePromise: Promise<SQLiteDatabase> | undefined;

async function openAppDatabase() {
  const database = await openDatabaseAsync('kongdaily.db');

  try {
    await database.withExclusiveTransactionAsync(async (transaction) => {
      const version = await transaction.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      if (!version || version.user_version > schemaVersion) {
        throw new Error('Unsupported KongDaily database version');
      }

      if (version.user_version === 0) {
        await transaction.execAsync(`
          CREATE TABLE user_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            language TEXT NOT NULL CHECK (language IN ('system', 'zh-HK', 'en'))
          );
          PRAGMA user_version = 1;
        `);
      }

      if (version.user_version < 2) {
        await transaction.execAsync(`
          CREATE TABLE bus_route_cache (
            source TEXT PRIMARY KEY NOT NULL CHECK (source IN ('kmbLwb', 'citybus')),
            fetched_at INTEGER NOT NULL,
            payload TEXT NOT NULL
          );
          CREATE TABLE bus_search_history (
            history_key TEXT PRIMARY KEY NOT NULL,
            query TEXT NOT NULL,
            route_id TEXT,
            searched_at INTEGER NOT NULL
          );
          CREATE TRIGGER limit_bus_search_history AFTER INSERT ON bus_search_history BEGIN
            DELETE FROM bus_search_history
            WHERE history_key IN (
              SELECT history_key FROM bus_search_history
              ORDER BY searched_at DESC, rowid DESC LIMIT -1 OFFSET 8
            );
          END;
          PRAGMA user_version = 2;
        `);
      }
    });
    return database;
  } catch (error) {
    await database.closeAsync();
    throw error;
  }
}

export function getDatabase() {
  databasePromise ??= openAppDatabase().catch((error) => {
    databasePromise = undefined;
    throw error;
  });
  return databasePromise;
}

export async function readLanguage(): Promise<LanguagePreference> {
  const database = await getDatabase();
  const settings = await database.getFirstAsync<{ language: LanguagePreference }>(
    'SELECT language FROM user_settings WHERE id = 1',
  );
  return settings?.language ?? 'system';
}

export async function writeLanguage(language: LanguagePreference) {
  const database = await getDatabase();
  await database.runAsync(
    'INSERT INTO user_settings (id, language) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET language = excluded.language',
    language,
  );
}
