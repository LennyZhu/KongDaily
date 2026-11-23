import type { FerryArrival, FerryPier, FerryReading, FerryResult, FerryRoute, FerrySource, FerryTimetable } from '@/ferry-data';
import {
  HkkfFormatError, hkkfEnvelope, hkkfSource, isHkkfDirection, isHkkfPierId, isHkkfRouteId,
  parseHkkfEta, parseHkkfPier, parseHkkfRoutes, type HkkfDirectionId, type HkkfPierId, type HkkfRouteId,
} from '@/hkkf-data';
import { parseHkkfTimetable } from '@/hkkf-timetable';
import { nextTrainClock } from '@/next-train-time';

type Parsed<T> = { data: T; generatedAt?: number; version?: string };
const staticLifetime = 15 * 60_000;
const etaRefresh = 60_000;
const staticFailureCooldown = 10_000;

function responseClock(headers: Headers, wall: number) {
  const date = Date.parse(headers.get('date') ?? '');
  const age = headers.get('age')?.trim() ?? '';
  return Number.isFinite(date) ? date + (/^\d{1,9}$/.test(age) ? Number(age) * 1000 : 0) : wall;
}

function backoff(headers: Headers, reference: number) {
  const hint = headers.get('retry-after')?.trim() ?? '';
  const delay = /^\d{1,9}$/.test(hint) ? Number(hint) * 1000 : Date.parse(hint) - reference;
  return delay > etaRefresh ? delay : etaRefresh;
}

/** Deliberate opt-in for approved consumers. No feature registry or app entry point imports this client. */
export function createHkkfClient({ enabled = false, request = fetch, clock = nextTrainClock, timeoutMs = 8_000 } = {}) {
  let nextRequestAt = 0;
  let blocked = !enabled;

  function sample<T>(payload: FerryResult<T>, wait = 0, receivedAt = clock(), serverNow = receivedAt.wall): FerryReading<T> {
    return { payload, receivedAt, serverNow, retryAt: receivedAt.monotonic + wait };
  }

  function observe<T>(pending: Promise<FerryReading<T>>, signal?: AbortSignal): Promise<FerryReading<T>> {
    if (!signal) return pending;
    if (signal.aborted) return Promise.resolve(sample({ kind: 'cancelled' }));
    return new Promise((resolve) => {
      const cancel = () => resolve(sample<T>({ kind: 'cancelled' }));
      signal.addEventListener('abort', cancel, { once: true });
      void pending.then((value) => {
        signal.removeEventListener('abort', cancel);
        resolve(value);
      });
    });
  }

  function resource<T>(kind: FerrySource['kind'], accept: string, ttl: number, failureWait: number) {
    const pending = new Map<string, Promise<FerryReading<T>>>();
    const cache = new Map<string, FerryReading<T>>();

    async function download(url: string, parse: (body: string) => Parsed<T>): Promise<FerryReading<T>> {
      const controller = new AbortController();
      const timedOut = () => sample<T>({ kind: 'timeout' }, failureWait);
      let timer: ReturnType<typeof setTimeout> | undefined;
      async function load() {
        const response = await request(url, { signal: controller.signal, credentials: 'omit', headers: { Accept: accept } });
        if (controller.signal.aborted) return timedOut();
        if (response.status === 403) {
          blocked = true;
          return sample<T>({ kind: 'unavailable' }, Infinity);
        }
        if (response.status === 429) {
          const now = clock();
          const reference = responseClock(response.headers, now.wall);
          nextRequestAt = Math.max(nextRequestAt, now.monotonic + backoff(response.headers, reference));
          return sample<T>({ kind: 'rateLimited' }, nextRequestAt - now.monotonic, now, reference);
        }
        if (response.status !== 200) return sample<T>({ kind: 'http', status: response.status }, failureWait);
        const body = await response.text();
        if (controller.signal.aborted) return timedOut();
        if (blocked) return sample<T>({ kind: 'unavailable' }, Infinity);
        let parsed: Parsed<T>;
        try { parsed = parse(body); } catch (error) {
          return sample<T>({ kind: error instanceof HkkfFormatError ? error.kind : 'invalidResponse' }, failureWait);
        }
        const now = clock();
        const source: FerrySource = { kind, url, fetchedAt: now.wall, generatedAt: parsed.generatedAt, version: parsed.version };
        return sample({ kind: 'ready', data: parsed.data, source }, ttl, now, responseClock(response.headers, now.wall));
      }

      try {
        return await Promise.race([
          new Promise<FerryReading<T>>((resolve) => {
            timer = setTimeout(() => {
              resolve(timedOut());
              controller.abort();
            }, timeoutMs);
          }),
          load(),
        ]);
      } catch {
        return sample({ kind: 'network' }, failureWait);
      } finally {
        clearTimeout(timer);
      }
    }

    return (path: string, parse: (body: string) => Parsed<T>, signal?: AbortSignal) => {
      if (signal?.aborted) return Promise.resolve(sample<T>({ kind: 'cancelled' }));
      if (blocked) return Promise.resolve(sample<T>({ kind: 'unavailable' }, Infinity));
      const now = clock();
      const recent = cache.get(path);
      if (recent && now.monotonic < recent.retryAt) return Promise.resolve(recent);
      const existing = pending.get(path);
      if (existing) return observe(existing, signal);
      if (now.monotonic < nextRequestAt) {
        return Promise.resolve(sample<T>({ kind: 'rateLimited' }, nextRequestAt - now.monotonic, now));
      }
      const request = download(hkkfSource.api + '/opendata/' + path, parse).then((value) => {
        if (value.payload.kind !== 'rateLimited' && value.payload.kind !== 'unavailable') cache.set(path, value);
        return value;
      }).finally(() => { pending.delete(path); });
      pending.set(path, request);
      return observe(request, signal);
    };
  }

  const routeReader = resource<readonly FerryRoute[]>('operatorCatalogue', 'application/json', staticLifetime, staticFailureCooldown);
  const pierReader = resource<FerryPier>('operatorCatalogue', 'application/json', staticLifetime, staticFailureCooldown);
  const tableReader = resource<FerryTimetable>('operatorTimetable', 'text/csv', staticLifetime, staticFailureCooldown);
  const etaReader = resource<readonly FerryArrival[]>('operatorLive', 'application/json', etaRefresh, etaRefresh);
  const invalid = () => Promise.resolve(sample<never>({ kind: 'invalidInput' }, Infinity));
  return {
    operatorId: hkkfSource.operatorId,
    readRoutes(signal?: AbortSignal) {
      return routeReader('route', (body) => hkkfEnvelope(body, 'Route', parseHkkfRoutes), signal);
    },
    readPier(id: HkkfPierId, signal?: AbortSignal) {
      if (!isHkkfPierId(id)) return invalid();
      return pierReader('pier/' + id, (body) => hkkfEnvelope(body, 'Pier', (data) => parseHkkfPier(data, id)), signal);
    },
    readTimetable(route: HkkfRouteId, direction: HkkfDirectionId, signal?: AbortSignal) {
      if (!isHkkfRouteId(route) || !isHkkfDirection(direction)) return invalid();
      return tableReader('time_table/' + route + '/' + direction, (body) => ({ data: parseHkkfTimetable(body, route, direction) }), signal);
    },
    readEta(route: HkkfRouteId, direction: HkkfDirectionId, signal?: AbortSignal) {
      if (!isHkkfRouteId(route) || !isHkkfDirection(direction)) return invalid();
      return etaReader('eta/' + route + '/' + direction,
        (body) => hkkfEnvelope(body, 'ETA', (data) => parseHkkfEta(data, route, direction)), signal);
    },
  };
}
