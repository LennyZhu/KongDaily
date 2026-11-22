import {
  gmbEtaRefreshMs, gmbIsDirection, gmbIsRegion, gmbIsRouteCode, gmbPositiveId, parseGmbDirectory,
  parseGmbEnvelope, parseGmbEta, parseGmbRegionalDirectory, parseGmbRoutes, parseGmbRouteStops, parseGmbStop,
  type GmbDirectionKey, type GmbEta, type GmbFailure, type GmbReading, type GmbRegion, type GmbResult, type GmbVisitKey,
} from '@/gmb-data';
import { nextTrainClock, type NextTrainClock } from '@/next-train-time';

const endpoint = 'https://data.etagmb.gov.hk';
const staticLifetime = 15 * gmbEtaRefreshMs;
const staticFailureCooldown = 10_000;
const minimumBackoff = gmbEtaRefreshMs;
type Parser<T> = (data: unknown) => T;

export function createGmbClient({ request = fetch, clock = nextTrainClock, timeoutMs = 8_000 } = {}) {
  let backoffUntil = 0;

  function reading<T>(payload: GmbResult<T>, retryIn = 0, receivedAt = clock(), serverNow = receivedAt.wall): GmbReading<T> {
    return { payload, receivedAt, serverNow, retryAt: receivedAt.monotonic + retryIn };
  }

  async function download<T>(path: string, type: string, parse: Parser<T>, lifetime: number): Promise<GmbReading<T>> {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const failureCooldown = lifetime === gmbEtaRefreshMs ? gmbEtaRefreshMs : staticFailureCooldown;
    const failed = (kind: 'network' | 'timeout' | 'invalidResponse') => reading<T>({ kind }, failureCooldown);

    async function load() {
      const response = await request(endpoint + path, {
        signal: controller.signal, credentials: 'omit', headers: { Accept: 'application/json' },
      });
      if (controller.signal.aborted) return failed('timeout');
      if (response.status === 429) {
        const now = clock();
        const header = response.headers.get('retry-after')?.trim() ?? '';
        const serverDate = Date.parse(response.headers.get('date') ?? '');
        const age = responseAge(response.headers);
        const wait = /^\d{1,9}$/.test(header) ? Number(header) * 1000
          : Date.parse(header) - (Number.isFinite(serverDate) ? serverDate + age : now.wall);
        backoffUntil = Math.max(backoffUntil, now.monotonic + (wait > minimumBackoff ? wait : minimumBackoff));
        return reading<T>({ kind: 'rateLimited' }, backoffUntil - now.monotonic, now);
      }
      if (response.status !== 200) return reading<T>({ kind: 'http', status: response.status }, failureCooldown);

      const body = await response.text();
      if (controller.signal.aborted) return failed('timeout');
      let json: unknown;
      try {
        json = JSON.parse(body);
      } catch {
        return failed('invalidResponse');
      }
      const payload = parseGmbEnvelope(json, type, parse);
      const now = clock();
      const date = Date.parse(response.headers.get('date') ?? '');
      const serverNow = Number.isFinite(date) ? date + responseAge(response.headers) : now.wall;
      return reading(payload, payload.kind === 'ready' ? lifetime : failureCooldown, now, serverNow);
    }

    try {
      return await Promise.race([
        new Promise<GmbReading<T>>((resolve) => {
          timeout = setTimeout(() => {
            resolve(failed('timeout'));
            controller.abort();
          }, timeoutMs);
        }),
        load(),
      ]);
    } catch {
      return failed('network');
    } finally {
      clearTimeout(timeout);
    }
  }

  function observe<T>(pending: Promise<GmbReading<T>>, signal?: AbortSignal): Promise<GmbReading<T>> {
    if (!signal) return pending;
    if (signal.aborted) return Promise.resolve(reading({ kind: 'cancelled' }));
    return new Promise((resolve) => {
      function cancel() {
        signal?.removeEventListener('abort', cancel);
        resolve(reading({ kind: 'cancelled' }));
      }
      signal.addEventListener('abort', cancel, { once: true });
      void pending.then((result) => {
        signal.removeEventListener('abort', cancel);
        resolve(result);
      });
    });
  }

  function resource<T>(lifetime = staticLifetime, limit = 256) {
    const inFlight = new Map<string, Promise<GmbReading<T>>>();
    const cache = new Map<string, GmbReading<T>>();

    return (path: string, type: string, parse: Parser<T>, signal?: AbortSignal): Promise<GmbReading<T>> => {
      if (signal?.aborted) return Promise.resolve(reading({ kind: 'cancelled' }));
      const now = clock();
      const cached = cache.get(path);
      if (cached && now.monotonic < cached.retryAt) {
        cache.delete(path);
        cache.set(path, cached);
        return Promise.resolve(cached);
      }
      const pending = inFlight.get(path);
      if (pending) return observe(pending, signal);
      if (now.monotonic < backoffUntil) {
        return Promise.resolve(reading({ kind: 'rateLimited' }, backoffUntil - now.monotonic, now));
      }

      const started = download(path, type, parse, lifetime).then((result) => {
        if (result.payload.kind !== 'rateLimited') {
          cache.delete(path);
          cache.set(path, result);
          const oldest = cache.keys().next();
          if (cache.size > limit && !oldest.done) cache.delete(oldest.value);
        }
        return result;
      }).finally(() => inFlight.delete(path));
      inFlight.set(path, started);
      return observe(started, signal);
    };
  }

  const directory = resource<ReturnType<typeof parseGmbDirectory>>();
  const regional = resource<ReturnType<typeof parseGmbRegionalDirectory>>();
  const routes = resource<ReturnType<typeof parseGmbRoutes>>();
  const stops = resource<ReturnType<typeof parseGmbRouteStops>>();
  const stop = resource<ReturnType<typeof parseGmbStop>>();
  const eta = resource<GmbEta>(gmbEtaRefreshMs, 64);
  const invalidInput = () => Promise.resolve(reading<never>({ kind: 'invalidInput' }));

  return {
    readDirectory(signal?: AbortSignal) {
      return directory('/route', 'Routes-All', parseGmbDirectory, signal);
    },
    readRegionalDirectory(region: GmbRegion, signal?: AbortSignal) {
      if (!gmbIsRegion(region)) return invalidInput();
      return regional('/route/' + region, 'Routes-Regional', (data) => parseGmbRegionalDirectory(data, region), signal);
    },
    readRoutesByCode(region: GmbRegion, routeCode: string, signal?: AbortSignal) {
      if (!gmbIsRegion(region) || !gmbIsRouteCode(routeCode)) return invalidInput();
      return routes('/route/' + region + '/' + routeCode, 'Route', (data) => parseGmbRoutes(data, { region, routeCode }), signal);
    },
    readRouteById(routeId: number, signal?: AbortSignal) {
      if (!gmbPositiveId(routeId)) return invalidInput();
      return routes('/route/' + routeId, 'Route', (data) => parseGmbRoutes(data, { routeId }), signal);
    },
    readRouteStops({ routeId, routeSeq }: GmbDirectionKey, signal?: AbortSignal) {
      if (!gmbPositiveId(routeId) || !gmbIsDirection(routeSeq)) return invalidInput();
      return stops('/route-stop/' + routeId + '/' + routeSeq, 'Route-Stop',
        (data) => parseGmbRouteStops(data, { routeId, routeSeq }), signal);
    },
    readStop(stopId: number, signal?: AbortSignal) {
      if (!gmbPositiveId(stopId)) return invalidInput();
      return stop('/stop/' + stopId, 'Stop', (data) => parseGmbStop(data, stopId), signal);
    },
    async readEta({ routeId, routeSeq, stopSeq, stopId }: GmbVisitKey, signal?: AbortSignal): Promise<GmbReading<GmbEta>> {
      if (!gmbPositiveId(routeId) || !gmbIsDirection(routeSeq) || !gmbPositiveId(stopSeq) || !gmbPositiveId(stopId)) {
        return invalidInput();
      }
      const result = await eta('/eta/route-stop/' + routeId + '/' + routeSeq + '/' + stopSeq,
        'ETA-Route-Stop', parseGmbEta, signal);
      if (result.payload.kind === 'ready' && result.payload.data.stopId !== stopId) {
        const payload: GmbFailure = { kind: 'invalidResponse' };
        return { ...result, payload };
      }
      return result;
    },
  };
}

function responseAge(headers: Headers) {
  const age = headers.get('age')?.trim() ?? '';
  return /^\d{1,9}$/.test(age) ? Number(age) * 1000 : 0;
}

export const gmbClient = createGmbClient();
