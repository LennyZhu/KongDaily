import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { type LanguagePreference } from '@/i18n';

const schemaVersion = 11;
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

      if (version.user_version < 3) {
        await transaction.execAsync(`
          CREATE TABLE bus_route_stop_cache (
            route_key TEXT PRIMARY KEY NOT NULL,
            fetched_at INTEGER NOT NULL,
            payload TEXT NOT NULL
          );
          CREATE TABLE bus_stop_cache (
            source TEXT NOT NULL CHECK (source IN ('kmbLwb', 'citybus')),
            stop_id TEXT NOT NULL,
            fetched_at INTEGER NOT NULL,
            payload TEXT NOT NULL,
            PRIMARY KEY (source, stop_id)
          );
          PRAGMA user_version = 3;
        `);
      }

      if (version.user_version < 4) {
        await transaction.execAsync(`
          ALTER TABLE bus_route_cache RENAME TO bus_route_cache_v3;
          CREATE TABLE bus_route_cache (
            source TEXT PRIMARY KEY NOT NULL CHECK (source IN ('kmbLwb', 'citybus', 'nlb')),
            fetched_at INTEGER NOT NULL,
            payload TEXT NOT NULL
          );
          INSERT INTO bus_route_cache (source, fetched_at, payload)
            SELECT source, fetched_at, payload FROM bus_route_cache_v3;
          DROP TABLE bus_route_cache_v3;
          PRAGMA user_version = 4;
        `);
      }

      if (version.user_version < 5) {
        await transaction.execAsync(`
          CREATE TABLE bus_favorites (
            id TEXT PRIMARY KEY NOT NULL,
            source TEXT NOT NULL CHECK (source IN ('kmbLwb', 'citybus', 'nlb')),
            route_number TEXT NOT NULL,
            direction TEXT CHECK (direction IN ('outbound', 'inbound')),
            service_type TEXT,
            nlb_route_id TEXT,
            stop_id TEXT NOT NULL,
            stop_seq INTEGER NOT NULL CHECK (stop_seq > 0),
            repeated_stop INTEGER NOT NULL CHECK (repeated_stop IN (0, 1)),
            station_zh TEXT NOT NULL,
            station_en TEXT NOT NULL,
            destination_zh TEXT NOT NULL,
            destination_en TEXT NOT NULL,
            destination_stop_id TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            pin_order INTEGER UNIQUE CHECK (pin_order BETWEEN 1 AND 3)
          );
          PRAGMA user_version = 5;
        `);
      }

      if (version.user_version < 6) {
        await transaction.execAsync(`
          CREATE TABLE nearby_bus_sources (
            source TEXT PRIMARY KEY NOT NULL CHECK (source IN ('kmbLwb', 'citybus', 'nlb')),
            origin TEXT NOT NULL,
            fetched_at INTEGER NOT NULL
          );
          CREATE TABLE nearby_bus_stops (
            source TEXT NOT NULL CHECK (source IN ('kmbLwb', 'citybus', 'nlb')),
            stop_id TEXT NOT NULL,
            name_zh TEXT NOT NULL,
            name_en TEXT NOT NULL,
            street_zh TEXT NOT NULL,
            street_en TEXT NOT NULL,
            latitude REAL NOT NULL CHECK (latitude BETWEEN 22.12 AND 22.59),
            longitude REAL NOT NULL CHECK (longitude BETWEEN 113.82 AND 114.46),
            PRIMARY KEY (source, stop_id)
          );
          CREATE INDEX nearby_bus_coordinates ON nearby_bus_stops (latitude, longitude);
          PRAGMA user_version = 6;
        `);
      }

      if (version.user_version < 7) {
        await transaction.execAsync(`
          CREATE TABLE weather_cache (
            api_type TEXT NOT NULL,
            language TEXT NOT NULL CHECK (language IN ('zh-HK', 'en')),
            update_time INTEGER NOT NULL,
            fetched_at INTEGER NOT NULL,
            payload TEXT NOT NULL,
            PRIMARY KEY (api_type, language)
          );
          PRAGMA user_version = 7;
        `);
      }

      if (version.user_version < 8) {
        await transaction.execAsync(`
          CREATE TABLE facility_favorites (
            source TEXT NOT NULL CHECK (length(trim(source)) > 0),
            stable_facility_id TEXT NOT NULL CHECK (length(trim(stable_facility_id)) > 0),
            name_zh_hk_snapshot TEXT,
            name_en_snapshot TEXT,
            category_snapshot TEXT NOT NULL CHECK (category_snapshot IN ('toilets', 'parks', 'pets')),
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            CHECK (coalesce(length(trim(name_zh_hk_snapshot)), 0) > 0 OR coalesce(length(trim(name_en_snapshot)), 0) > 0),
            PRIMARY KEY (source, stable_facility_id)
          );
          PRAGMA user_version = 8;
        `);
      }

      if (version.user_version < 9) {
        await transaction.execAsync(`
          CREATE TABLE railway_favorites (
            mode TEXT NOT NULL CHECK (mode IN ('mtr', 'light_rail')),
            line_id TEXT NOT NULL CHECK (length(trim(line_id)) > 0),
            station_id TEXT NOT NULL CHECK (length(trim(station_id)) > 0),
            line_zh_snapshot TEXT NOT NULL,
            line_en_snapshot TEXT NOT NULL,
            station_zh_snapshot TEXT NOT NULL,
            station_en_snapshot TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (mode, line_id, station_id)
          );
          PRAGMA user_version = 9;
        `);
      }

      if (version.user_version < 10) {
        await transaction.execAsync(`
          CREATE TABLE home_transport_pins (
            position INTEGER PRIMARY KEY CHECK (position BETWEEN 1 AND 3),
            mode TEXT NOT NULL CHECK (mode IN ('bus', 'mtr', 'light_rail')),
            bus_id TEXT UNIQUE,
            line_id TEXT,
            station_id TEXT,
            CHECK (
              (mode = 'bus' AND bus_id IS NOT NULL AND line_id IS NULL AND station_id IS NULL)
              OR (mode <> 'bus' AND bus_id IS NULL AND line_id IS NOT NULL AND station_id IS NOT NULL)
            ),
            UNIQUE (mode, line_id, station_id)
          );
          INSERT INTO home_transport_pins (position, mode, bus_id)
            SELECT row_number() OVER (ORDER BY pin_order), 'bus', id
            FROM bus_favorites WHERE pin_order IS NOT NULL;
          INSERT INTO home_transport_pins (position, mode, line_id, station_id)
            SELECT position, mode, line_id, station_id FROM (
              SELECT (SELECT count(*) FROM home_transport_pins)
                + row_number() OVER (ORDER BY created_at DESC, mode, line_id, station_id) AS position,
                mode, line_id, station_id
              FROM railway_favorites
              ORDER BY created_at DESC, mode, line_id, station_id LIMIT 2
            ) WHERE position <= 3;
          CREATE TRIGGER remove_home_bus_pin AFTER DELETE ON bus_favorites BEGIN
            DELETE FROM home_transport_pins WHERE bus_id = OLD.id;
          END;
          CREATE TRIGGER remove_home_railway_pin AFTER DELETE ON railway_favorites BEGIN
            DELETE FROM home_transport_pins WHERE mode = OLD.mode AND line_id = OLD.line_id AND station_id = OLD.station_id;
          END;
          PRAGMA user_version = 10;
        `);
      }

      if (version.user_version < 11) {
        await transaction.execAsync(`
          CREATE TABLE gmb_favorites (
            id TEXT PRIMARY KEY NOT NULL,
            route_id INTEGER NOT NULL CHECK (typeof(route_id) = 'integer' AND route_id BETWEEN 1 AND 9007199254740991),
            route_seq INTEGER NOT NULL CHECK (route_seq IN (1, 2)),
            stop_seq INTEGER NOT NULL CHECK (typeof(stop_seq) = 'integer' AND stop_seq BETWEEN 1 AND 9007199254740991),
            stop_id INTEGER NOT NULL CHECK (typeof(stop_id) = 'integer' AND stop_id BETWEEN 1 AND 9007199254740991),
            region TEXT NOT NULL CHECK (region IN ('HKI', 'KLN', 'NT')),
            route_code TEXT NOT NULL CHECK (length(trim(route_code)) > 0),
            stop_zh TEXT NOT NULL CHECK (length(trim(stop_zh)) > 0),
            stop_en TEXT NOT NULL CHECK (length(trim(stop_en)) > 0),
            destination_zh TEXT NOT NULL CHECK (length(trim(destination_zh)) > 0),
            destination_en TEXT NOT NULL CHECK (length(trim(destination_en)) > 0),
            created_at INTEGER NOT NULL,
            CHECK (id = printf('%d:%d:%d:%d', route_id, route_seq, stop_seq, stop_id))
          );

          CREATE TABLE home_pin_v11_orphans (
            previous_position INTEGER PRIMARY KEY,
            mode TEXT NOT NULL,
            bus_id TEXT,
            line_id TEXT,
            station_id TEXT,
            reason TEXT NOT NULL CHECK (reason = 'missing_favorite')
          );
          INSERT INTO home_pin_v11_orphans
            SELECT p.position, p.mode, p.bus_id, p.line_id, p.station_id, 'missing_favorite'
            FROM home_transport_pins AS p
            WHERE (p.mode = 'bus' AND NOT EXISTS (SELECT 1 FROM bus_favorites WHERE id = p.bus_id))
               OR (p.mode IN ('mtr', 'light_rail') AND NOT EXISTS (
                 SELECT 1 FROM railway_favorites WHERE mode = p.mode AND line_id = p.line_id AND station_id = p.station_id
               ));

          DROP TRIGGER remove_home_bus_pin;
          DROP TRIGGER remove_home_railway_pin;
          ALTER TABLE home_transport_pins RENAME TO home_transport_pins_v10;
          CREATE TABLE home_transport_pins (
            position INTEGER PRIMARY KEY CHECK (position BETWEEN 1 AND 3),
            mode TEXT NOT NULL CHECK (mode IN ('bus', 'mtr', 'light_rail', 'gmb')),
            bus_id TEXT UNIQUE,
            line_id TEXT,
            station_id TEXT,
            gmb_id TEXT UNIQUE,
            CHECK (
              (mode = 'bus' AND bus_id IS NOT NULL AND line_id IS NULL AND station_id IS NULL AND gmb_id IS NULL)
              OR (mode IN ('mtr', 'light_rail') AND bus_id IS NULL AND line_id IS NOT NULL AND station_id IS NOT NULL AND gmb_id IS NULL)
              OR (mode = 'gmb' AND bus_id IS NULL AND line_id IS NULL AND station_id IS NULL AND gmb_id IS NOT NULL)
            ),
            UNIQUE (mode, line_id, station_id)
          );
          CREATE TRIGGER require_home_pin_target BEFORE INSERT ON home_transport_pins
          WHEN (NEW.mode = 'bus' AND NOT EXISTS (SELECT 1 FROM bus_favorites WHERE id = NEW.bus_id))
            OR (NEW.mode = 'gmb' AND NOT EXISTS (SELECT 1 FROM gmb_favorites WHERE id = NEW.gmb_id))
            OR (NEW.mode IN ('mtr', 'light_rail') AND NOT EXISTS (
              SELECT 1 FROM railway_favorites WHERE mode = NEW.mode AND line_id = NEW.line_id AND station_id = NEW.station_id
            ))
          BEGIN
            SELECT RAISE(ABORT, 'Missing home pin target');
          END;
          -- Reordering replaces the bounded set of rows so each write goes through INSERT validation.
          CREATE TRIGGER require_home_pin_reinsert BEFORE UPDATE ON home_transport_pins BEGIN
            SELECT RAISE(ABORT, 'Replace home pins to change them');
          END;
          CREATE TRIGGER remove_home_bus_pin AFTER DELETE ON bus_favorites BEGIN
            DELETE FROM home_transport_pins WHERE bus_id = OLD.id;
          END;
          CREATE TRIGGER remove_home_railway_pin AFTER DELETE ON railway_favorites BEGIN
            DELETE FROM home_transport_pins WHERE mode = OLD.mode AND line_id = OLD.line_id AND station_id = OLD.station_id;
          END;
          CREATE TRIGGER remove_home_gmb_pin AFTER DELETE ON gmb_favorites BEGIN
            DELETE FROM home_transport_pins WHERE gmb_id = OLD.id;
          END;
          CREATE TRIGGER preserve_pinned_bus_id BEFORE UPDATE OF id ON bus_favorites
          WHEN NEW.id <> OLD.id AND EXISTS (SELECT 1 FROM home_transport_pins WHERE bus_id = OLD.id) BEGIN
            SELECT RAISE(ABORT, 'Cannot change a pinned bus identity');
          END;
          CREATE TRIGGER preserve_pinned_railway_identity BEFORE UPDATE OF mode, line_id, station_id ON railway_favorites
          WHEN (NEW.mode <> OLD.mode OR NEW.line_id <> OLD.line_id OR NEW.station_id <> OLD.station_id)
            AND EXISTS (SELECT 1 FROM home_transport_pins WHERE mode = OLD.mode AND line_id = OLD.line_id AND station_id = OLD.station_id) BEGIN
            SELECT RAISE(ABORT, 'Cannot change a pinned railway identity');
          END;
          CREATE TRIGGER preserve_pinned_gmb_id BEFORE UPDATE OF id ON gmb_favorites
          WHEN NEW.id <> OLD.id AND EXISTS (SELECT 1 FROM home_transport_pins WHERE gmb_id = OLD.id) BEGIN
            SELECT RAISE(ABORT, 'Cannot change a pinned minibus identity');
          END;

          INSERT INTO home_transport_pins (position, mode, bus_id, line_id, station_id)
            SELECT row_number() OVER (ORDER BY position), mode, bus_id, line_id, station_id
            FROM home_transport_pins_v10
            WHERE position NOT IN (SELECT previous_position FROM home_pin_v11_orphans);
          DROP TABLE home_transport_pins_v10;
          PRAGMA user_version = 11;
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
