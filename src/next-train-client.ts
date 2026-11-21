import { nextTrainClock, nextTrainLifetime, type NextTrainClock, type NextTrainFailure, type NextTrainReading } from '@/next-train-time';

const minimumRefresh = 20_000;
const defaultBackoff = 60_000;
const requestTimeout = 8_000;

function httpTime(value: string | null) {
  if (!value || !/[A-Z]{3}, .+ GMT$/i.test(value)) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function serverTime(headers: Headers, receipt: NextTrainClock) {
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

export function createNextTrainClient<Payload extends { kind: string }>({ request = fetch, clock = nextTrainClock } = {}) {
  type Reading = NextTrainReading<Payload | NextTrainFailure>;
  const inFlight = new Map<string, Promise<Reading>>();
  const recent = new Map<string, Reading>();
  let backoffUntil = 0;

  function reading(payload: Payload | NextTrainFailure, captured = clock(), serverNow = captured.wall, retryAt = captured.monotonic + minimumRefresh) {
    return { payload, receivedAt: captured, serverNow, retryAt };
  }

  async function requestForecast(url: string, parse: (body: unknown) => Payload): Promise<Reading> {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    async function load() {
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
      return reading(parse(body), captured, serverTime(response.headers, captured));
    }
    try {
      return await Promise.race([
        load(),
        new Promise<Reading>((resolve) => {
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

  return function read(url: string | undefined, parse: (body: unknown) => Payload): Promise<Reading> {
    if (!url) return Promise.resolve(reading({ kind: 'unsupported' }));
    const now = clock();
    const pending = inFlight.get(url);
    if (pending) return pending;
    const cached = recent.get(url);
    if (cached && now.monotonic < cached.retryAt) return Promise.resolve(cached);
    if (now.monotonic < backoffUntil) return Promise.resolve(reading({ kind: 'rateLimited' }, now, now.wall, backoffUntil));

    for (const [pair, value] of recent) {
      if (now.monotonic - value.receivedAt.monotonic >= nextTrainLifetime) recent.delete(pair);
    }
    const loading = requestForecast(url, parse).then((result) => {
      if (result.payload.kind !== 'rateLimited') recent.set(url, result);
      return result;
    }).finally(() => { inFlight.delete(url); });
    inFlight.set(url, loading);
    return loading;
  };
}
