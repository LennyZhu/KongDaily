import type { Facility } from '@/facilities';
import { hkGridToWgs84 } from '@/hk-grid';

export const placeSearchMaxLength = 80;
export const placeSearchMinCharacters = 2;
export const placeSearchDebounceMs = 400;
const maxResults = 15;
const cacheLifetime = 5 * 60_000;
const maxCacheEntries = 24;

export type LandsdPlace = {
  id: string;
  name: Facility['name'];
  district?: Facility['name'];
  address?: Facility['name'];
  point: Facility['coordinate'];
};

export type LandsdSearchResponse = { places: LandsdPlace[]; total: number; invalidCoordinates: number };
export type LandsdSearchIssue = 'unavailable' | 'timeout' | 'rateLimited' | 'invalidResponse';

export class LandsdSearchError extends Error {
  constructor(readonly kind: LandsdSearchIssue) {
    super(kind);
  }
}

export function normalizePlaceQuery(input: string) {
  return input.normalize('NFKC').trim().replace(/\s+/gu, ' ');
}

export function canSearchLandsd(input: string) {
  return input.length <= placeSearchMaxLength
    && !/[\ud800-\udfff]/u.test(input)
    && (input.match(/[\p{L}\p{N}]/gu)?.length ?? 0) >= placeSearchMinCharacters;
}

function officialText(zh: unknown, en: unknown): Facility['name'] | undefined {
  const chinese = typeof zh === 'string' ? zh.trim() : '';
  const english = typeof en === 'string' ? en.trim() : '';
  if (chinese) return { 'zh-HK': chinese, en: english || undefined };
  if (english) return { en: english };
}

export function parseLandsdResponse(payload: unknown): LandsdSearchResponse {
  if (!Array.isArray(payload)) throw new LandsdSearchError('invalidResponse');
  let invalidCoordinates = 0;
  const places = new Map<string, LandsdPlace>();
  for (const raw of payload) {
    if (typeof raw !== 'object' || raw === null) continue;
    const row = raw as Record<string, unknown>;
    const address = officialText(row.addressZH, row.addressEN);
    const name = officialText(row.nameZH, row.nameEN) ?? address;
    if (!name) continue;
    const point = hkGridToWgs84(row.x, row.y);
    if (!point) {
      invalidCoordinates += 1;
      continue;
    }
    const id = JSON.stringify([row.x, row.y, name, address]);
    if (!places.has(id)) places.set(id, { id, name, district: officialText(row.districtZH, row.districtEN), address, point });
  }
  if (payload.length && !places.size && !invalidCoordinates) throw new LandsdSearchError('invalidResponse');
  return { places: [...places.values()].slice(0, maxResults), total: places.size, invalidCoordinates };
}

const cache = new Map<string, { response: LandsdSearchResponse; expires: number }>();
let queue: Promise<unknown> = Promise.resolve();
let nextRequestAt = 0;
let cooldown: { until: number; issue: LandsdSearchIssue } | undefined;

function checkAborted(signal: AbortSignal) {
  if (signal.aborted) throw new Error('Cancelled');
}

export function searchLandsd(input: string, signal: AbortSignal) {
  const query = normalizePlaceQuery(input);
  const key = query.toLowerCase();
  const request = queue.then(async () => {
    checkAborted(signal);
    if (!canSearchLandsd(query)) throw new LandsdSearchError('invalidResponse');
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.response;
    if (cooldown && cooldown.until > Date.now()) throw new LandsdSearchError(cooldown.issue);
    const delay = nextRequestAt - Date.now();
    if (delay > 0) await new Promise<void>((resolve) => setTimeout(resolve, delay));
    checkAborted(signal);

    nextRequestAt = Date.now() + 750;
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal.addEventListener('abort', cancel, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; cancel(); }, 8000);
    try {
      const url = 'https://www.map.gov.hk/gs/api/v1.0.0/locationSearch?q=' + encodeURIComponent(query);
      const result = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      checkAborted(signal);
      if (timedOut) throw new LandsdSearchError('timeout');
      if (result.status === 429) {
        const retryAfter = result.headers.get('Retry-After');
        const delay = !retryAfter ? 10_000 : /^\d+$/.test(retryAfter)
          ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now();
        cooldown = { until: Date.now() + (Number.isFinite(delay) ? Math.max(delay, 5000) : 10_000), issue: 'rateLimited' };
        throw new LandsdSearchError('rateLimited');
      }
      if (!result.ok) throw new LandsdSearchError('unavailable');
      const body = await result.text();
      checkAborted(signal);
      if (timedOut) throw new LandsdSearchError('timeout');
      let payload: unknown;
      try {
        if (body.length > 250_000) throw new Error('Response too large');
        payload = JSON.parse(body);
      } catch {
        throw new LandsdSearchError('invalidResponse');
      }
      const response = parseLandsdResponse(payload);
      if (!response.invalidCoordinates) {
        cache.delete(key);
        cache.set(key, { response, expires: Date.now() + cacheLifetime });
        const oldest = cache.keys().next().value;
        if (cache.size > maxCacheEntries && oldest !== undefined) cache.delete(oldest);
      }
      return response;
    } catch (error) {
      checkAborted(signal);
      const issue = timedOut ? 'timeout' : error instanceof LandsdSearchError ? error.kind : 'unavailable';
      if (issue !== 'rateLimited') cooldown = { until: Date.now() + 4500, issue };
      throw new LandsdSearchError(issue);
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
    }
  });
  queue = request.catch(() => {});
  return request;
}
