import { mtrClock, mtrForecastLifetime, parseMtrForecast, supportsMtrForecast, type MtrClock, type MtrPayload, type MtrReading } from '@/mtr-realtime';

const endpoint = 'https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php';
const minimumRefresh = 20_000;
const defaultBackoff = 60_000;
const requestTimeout = 8_000;

function httpTime(value: string | null) {
  if (!value || !/[A-Z]{3}, .+ GMT$/i.test(value)) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function serverTime(headers: Headers, receipt: MtrClock) {
  const date = httpTime(headers.get('date'));
  const age = headers.get('age') ?? '';
  const cachedFor = /^\d{1,9}$/.test(age) ? Number(age) * 1000 : 0;
  return date === undefined ? receipt.wall : date + cachedFor;
}

function rateLimitWait(headers: Headers, reference: number) {
  const hint = headers.get('retry-after')?.trim() ?? '';
  const date = httpTime(hint);
  const delay = /^\d{1,9}$/.test(hint) ? Number(hint) * 1000 : (date === undefined ? 0 : date - reference);
  return delay > 0 ? Math.max(delay, minimumRefresh) : defaultBackoff;
}

export function createMtrNextTrainClient({ request = fetch, clock = mtrClock } = {}) {
  const inFlight = new Map<string, Promise<MtrReading>>();
  const recent = new Map<string, MtrReading>();
  let backoffUntil = 0;

  function reading(payload: MtrPayload, captured = clock(), serverNow = captured.wall, retryAt = captured.monotonic + minimumRefresh) {
    return { payload, receivedAt: captured, serverNow, retryAt };
  }

  async function requestPair(line: string, station: string): Promise<MtrReading> {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      // EN preserves the documented notice vocabulary. Presentation is localized on device.
      const url = `${endpoint}?line=${encodeURIComponent(line)}&sta=${encodeURIComponent(station)}&lang=EN`;
      const response = await request(url, { signal: controller.signal, credentials: 'omit', headers: { Accept: 'application/json' } });
      if (response.status === 429) {
        const captured = clock();
        const reference = serverTime(response.headers, captured);
        if (!controller.signal.aborted) {
          backoffUntil = Math.max(backoffUntil, captured.monotonic + rateLimitWait(response.headers, reference));
        }
        return reading({ kind: 'rateLimited' }, captured, reference, backoffUntil);
      }
      if (response.status !== 200) return reading({ kind: 'failed' });
      const body: unknown = await response.json();
      const captured = clock();
      return reading(parseMtrForecast(body, line, station), captured, serverTime(response.headers, captured));
    }
    try {
      return await Promise.race([
        load(),
        new Promise<MtrReading>((resolve) => {
          timeout = setTimeout(() => {
            controller.abort();
            resolve(reading({ kind: 'failed' }));
          }, requestTimeout);
        }),
      ]);
    } catch {
      return reading({ kind: 'failed' });
    } finally {
      clearTimeout(timeout);
    }
  }

  return function read(line: string, station: string): Promise<MtrReading> {
    if (!supportsMtrForecast(line, station)) return Promise.resolve(reading({ kind: 'unsupported' }));
    const now = clock();
    const key = `${line}-${station}`;
    const pending = inFlight.get(key);
    if (pending) return pending;
    const cached = recent.get(key);
    if (cached && now.monotonic < cached.retryAt) return Promise.resolve(cached);
    if (now.monotonic < backoffUntil) return Promise.resolve(reading({ kind: 'rateLimited' }, now, now.wall, backoffUntil));

    for (const [pair, value] of recent) {
      if (now.monotonic - value.receivedAt.monotonic >= mtrForecastLifetime) recent.delete(pair);
    }
    const loading = requestPair(line, station).then((result) => {
      if (result.payload.kind !== 'rateLimited') recent.set(key, result);
      return result;
    }).finally(() => { inFlight.delete(key); });
    inFlight.set(key, loading);
    return loading;
  };
}

export const readMtrNextTrains = createMtrNextTrainClient();
