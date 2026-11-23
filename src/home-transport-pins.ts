import { useEffect, useSyncExternalStore } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/database';
import type { RailwayFavoriteIdentity, RailwayMode } from '@/railway-favorites';

export const homeTransportLimit = 3;
export type HomePin = { mode: 'bus'; id: string } | { mode: 'gmb'; id: string } | RailwayFavoriteIdentity;
type PinChange = { pin: HomePin } & ({ type: 'pin' } | { type: 'unpin' } | { type: 'move'; step: -1 | 1 });
type PinRow = { mode: 'bus'; bus_id: string } | { mode: 'gmb'; gmb_id: string } | { mode: RailwayMode; line_id: string; station_id: string };

export function homePinKey(pin: HomePin) {
  return pin.mode === 'bus' || pin.mode === 'gmb' ? JSON.stringify([pin.mode, pin.id]) : JSON.stringify([pin.mode, pin.lineId, pin.stationId]);
}

// All transport favorite writes share this queue. SQLite makes the pin changes and deletes atomic.
let writes: Promise<unknown> = Promise.resolve();
export function queueTransportFavoriteWrite<T>(write: () => Promise<T>) {
  const request = writes.then(write);
  writes = request.then(() => undefined, () => undefined);
  return request;
}
export function waitForTransportFavoriteWrites() {
  return writes;
}

export async function readHomePins(database?: SQLiteDatabase): Promise<HomePin[]> {
  const rows = await (database ?? await getDatabase()).getAllAsync<PinRow>(
    'SELECT mode, bus_id, line_id, station_id, gmb_id FROM home_transport_pins ORDER BY position',
  );
  return rows.map((row) => row.mode === 'bus' ? { mode: 'bus', id: row.bus_id }
    : row.mode === 'gmb' ? { mode: 'gmb', id: row.gmb_id } : { mode: row.mode, lineId: row.line_id, stationId: row.station_id });
}

type PinState = { pins: HomePin[]; status: 'loading' | 'ready' | 'error' };
let snapshot: PinState = { pins: [], status: 'loading' };
let loading: Promise<void> | undefined;
const listeners = new Set<() => void>();
function publish(state: PinState) {
  snapshot = state;
  for (const listener of listeners) listener();
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const getSnapshot = () => snapshot;

export function loadHomePins() {
  if (snapshot.status === 'ready') return Promise.resolve();
  if (loading) return loading;
  publish({ ...snapshot, status: 'loading' });
  loading = queueTransportFavoriteWrite(async () => {
    if (snapshot.status === 'ready') return;
    try { publish({ pins: await readHomePins(), status: 'ready' }); }
    catch { publish({ ...snapshot, status: 'error' }); }
  }).finally(() => { loading = undefined; });
  return loading;
}

export function useHomePins() {
  const state = useSyncExternalStore(subscribe, getSnapshot);
  useEffect(() => { void loadHomePins(); }, []);
  return state;
}

// Called after a committed favorite deletion, while still on the shared write queue.
export function forgetDeletedHomePin(pin: HomePin) {
  const key = homePinKey(pin);
  const pins = snapshot.pins.filter((item) => homePinKey(item) !== key);
  if (pins.length !== snapshot.pins.length) publish({ ...snapshot, pins });
}

async function favoriteExists(database: SQLiteDatabase, pin: HomePin) {
  return pin.mode === 'bus'
    ? database.getFirstAsync('SELECT 1 FROM bus_favorites WHERE id = ?', pin.id)
    : pin.mode === 'gmb' ? database.getFirstAsync('SELECT 1 FROM gmb_favorites WHERE id = ?', pin.id)
    : database.getFirstAsync('SELECT 1 FROM railway_favorites WHERE mode = ? AND line_id = ? AND station_id = ?',
      pin.mode, pin.lineId, pin.stationId);
}

export function changeHomePin(change: PinChange) {
  return queueTransportFavoriteWrite(async () => {
    try {
      const database = await getDatabase();
      let pins: HomePin[] = [];
      let outcome: 'ok' | 'limit' = 'ok';
      await database.withExclusiveTransactionAsync(async (transaction) => {
        pins = await readHomePins(transaction);
        const key = homePinKey(change.pin);
        const index = pins.findIndex((pin) => homePinKey(pin) === key);
        if (change.type === 'pin') {
          if (index >= 0 || !await favoriteExists(transaction, change.pin)) return;
          if (pins.length >= homeTransportLimit) { outcome = 'limit'; return; }
          pins.push(change.pin);
        } else if (change.type === 'unpin') {
          if (index < 0) return;
          pins.splice(index, 1);
        } else {
          if (index < 0) return;
          const next = index + change.step;
          if (next < 0 || next >= pins.length) return;
          [pins[index], pins[next]] = [pins[next], pins[index]];
        }
        await transaction.runAsync('DELETE FROM home_transport_pins');
        for (const [offset, pin] of pins.entries()) {
          const railway = pin.mode === 'bus' || pin.mode === 'gmb' ? undefined : pin;
          await transaction.runAsync(
            'INSERT INTO home_transport_pins (position, mode, bus_id, line_id, station_id, gmb_id) VALUES (?, ?, ?, ?, ?, ?)',
            offset + 1, pin.mode, pin.mode === 'bus' ? pin.id : null,
            railway?.lineId ?? null, railway?.stationId ?? null, pin.mode === 'gmb' ? pin.id : null,
          );
        }
      });
      publish({ pins, status: 'ready' });
      return outcome;
    } catch {
      return 'failed' as const;
    }
  });
}
