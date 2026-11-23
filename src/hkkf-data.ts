import type { FerryArrival, FerryDirection, FerryName, FerryPier, FerryPierId, FerryRoute } from '@/ferry-data';
import { parseHongKongTime } from '@/next-train-time';

export const hkkfSource = {
  operatorId: 'hkkf',
  api: 'https://www.hkkfeta.com',
  dataset: 'https://data.gov.hk/en-data/dataset/hkkf-hkkfdata-hkkf-eta-data',
  terms: 'https://hkkf.com.hk/en/hkkf-digital-services-terms-and-privacy-policy/',
  owner: { 'zh-HK': '港九小輪有限公司', en: 'Hong Kong & Kowloon Ferry Limited' },
  attribution: { 'zh-HK': '港九小輪有限公司 · DATA.GOV.HK', en: 'Hong Kong & Kowloon Ferry Limited · DATA.GOV.HK' },
} as const;

export type HkkfDirectionId = 'inbound' | 'outbound';
const piers = {
  1: ['中環4號渡輪碼頭', 'Central Pier 4'], 2: ['中環6號渡輪碼頭', 'Central Pier 6'],
  3: ['榕樹灣渡輪碼頭', 'Yung Shue Wan Pier'], 4: ['坪洲渡輪碼頭', 'Peng Chau Pier'],
  5: ['索罟灣公衆碼頭', 'Sok Kwu Wan Pier 2'], 6: ['喜靈洲碼頭', 'Hei Ling Chau Public Pier'],
} as const;
const routes = {
  1: { from: ['中環', 'Central'], to: ['索罟灣', 'Sok Kwu Wan'], inbound: [5, 1], outbound: [1, 5] },
  2: { from: ['中環', 'Central'], to: ['榕樹灣', 'Yung Shue Wan'], inbound: [3, 1], outbound: [1, 3] },
  3: { from: ['中環', 'Central'], to: ['坪洲', 'Peng Chau'], inbound: [4, 2], outbound: [2, 4] },
  4: { from: ['坪洲', 'Peng Chau'], to: ['喜靈洲', 'Hei Ling Chau'], inbound: [6, 4], outbound: [4, 6] },
} as const;
export type HkkfRouteId = keyof typeof routes;
export type HkkfPierId = keyof typeof piers;

export class HkkfFormatError extends Error {
  constructor(readonly kind: 'invalidResponse' | 'mappingMismatch') { super(kind); }
}

export function badHkkfResponse(): never { throw new HkkfFormatError('invalidResponse'); }
export function badHkkfMapping(): never { throw new HkkfFormatError('mappingMismatch'); }

export function isHkkfRouteId(id: unknown): id is HkkfRouteId {
  return typeof id === 'number' && Object.hasOwn(routes, id);
}

export function isHkkfPierId(id: unknown): id is HkkfPierId {
  return typeof id === 'number' && Object.hasOwn(piers, id);
}

export function isHkkfDirection(id: unknown): id is HkkfDirectionId {
  return id === 'inbound' || id === 'outbound';
}

function name([zh, en]: readonly [string, string]): FerryName { return { 'zh-HK': zh, en }; }

// Independent operator schedules used to validate the eight CSV directions in Phase 4B0.
const timetableSlugs: Record<HkkfRouteId, string> = {
  1: 'central-to-sok-kwu-wan',
  2: 'central-to-yung-shue-wan',
  3: 'central-to-peng-chau',
  4: 'peng-chau-to-hei-ling-chau',
};

export function hkkfOfficialTimetableUrl(id: HkkfRouteId) {
  return `https://hkkf.com.hk/en/timetables/${timetableSlugs[id]}/`;
}

export function hkkfRouteName(id: HkkfRouteId): FerryName {
  const { from, to } = routes[id];
  return name([from[0] + '往來' + to[0], from[1] + ' ↔ ' + to[1]]);
}

export function hkkfRouteParams(operator: unknown, id: unknown): HkkfRouteId | undefined {
  if (operator !== 'hkkf' || typeof id !== 'string') return;
  const route = Number(id);
  if (isHkkfRouteId(route) && String(route) === id) return route;
}

export function hkkfPierDisplayName(id: FerryPierId): FerryName | undefined {
  const match = /^hkkf:pier:([1-6])$/.exec(id);
  const pier = Number(match?.[1]);
  if (!isHkkfPierId(pier)) return;
  return pier === 2 ? name(['中環6號渡輪碼頭（西泊位）', 'Central Pier 6 (West Berth)']) : name(piers[pier]);
}

export function hkkfDirection(route: HkkfRouteId, directionId: HkkfDirectionId): FerryDirection {
  const [origin, destination] = routes[route][directionId];
  return {
    operatorId: 'hkkf', operatorRouteId: String(route), routeId: `hkkf:route:${route}`, directionId,
    originPierId: `hkkf:pier:${origin}`, destinationPierId: `hkkf:pier:${destination}`,
    name: name([piers[origin][0] + ' → ' + piers[destination][0], piers[origin][1] + ' → ' + piers[destination][1]]),
  };
}

function obj(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) badHkkfResponse();
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) badHkkfResponse();
  return value.trim();
}

function exactName(value: unknown, expected: string) {
  const normalize = (s: string) => s.normalize('NFKC').replace(/\s+/g, '').toLowerCase().replace(/眾/g, '衆');
  if (normalize(text(value)) !== normalize(expected)) badHkkfMapping();
}

export function hkkfValidateRouteEndpoints(id: HkkfRouteId, zhFrom: unknown, enFrom: unknown, zhTo: unknown, enTo: unknown) {
  const { from, to } = routes[id];
  exactName(zhFrom, from[0]);
  exactName(enFrom, from[1]);
  exactName(zhTo, to[0]);
  exactName(enTo, to[1]);
}

function instant(value: unknown) {
  const iso = text(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(iso) ||
      parseHongKongTime(iso.slice(0, 19).replace('T', ' ')) === undefined) badHkkfResponse();
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : badHkkfResponse();
}

export function hkkfEnvelope<T>(body: string, type: 'Route' | 'Pier' | 'ETA', parse: (data: unknown) => T) {
  let json: unknown;
  try { json = JSON.parse(body); } catch { badHkkfResponse(); }
  const row = obj(json);
  if (row.type !== type) badHkkfResponse();
  return { generatedAt: instant(row.generated_timestamp), version: text(row.version), data: parse(row.data) };
}

export function parseHkkfRoutes(value: unknown): readonly FerryRoute[] {
  if (!Array.isArray(value)) badHkkfResponse();
  const seen = new Set<HkkfRouteId>();
  const parsed = value.map((entry): FerryRoute => {
    const row = obj(entry);
    const id = row.route_id;
    if (!isHkkfRouteId(id) || seen.has(id)) badHkkfMapping();
    seen.add(id);
    hkkfValidateRouteEndpoints(id, row.origin_tc, row.origin_en, row.destination_tc, row.destination_en);
    exactName(row.route_name_en, routes[id].from[1] + '<=>' + routes[id].to[1]);
    exactName(row.route_name_tc, routes[id].from[0] + '往來' + routes[id].to[0]);
    return { operatorId: 'hkkf', operatorRouteId: String(id), routeId: `hkkf:route:${id}`,
      name: name([text(row.route_name_tc), text(row.route_name_en)]),
      directions: [hkkfDirection(id, 'inbound'), hkkfDirection(id, 'outbound')] };
  });
  if (seen.size !== Object.keys(routes).length) badHkkfMapping();
  return parsed.sort((a, b) => a.operatorRouteId.localeCompare(b.operatorRouteId));
}

export function parseHkkfPier(value: unknown, id: HkkfPierId): FerryPier {
  const row = obj(value);
  if (row.pier_id !== id) badHkkfMapping();
  exactName(row.name_tc, piers[id][0]);
  exactName(row.name_en, piers[id][1]);
  const { lat, long } = row;
  if (typeof lat !== 'number' || typeof long !== 'number' ||
      !(lat >= 22.12 && lat <= 22.59 && long >= 113.82 && long <= 114.46)) badHkkfResponse();
  return { operatorId: 'hkkf', operatorPierId: String(id), pierId: `hkkf:pier:${id}`,
    name: name([text(row.name_tc), text(row.name_en)]), coordinate: { latitude: lat, longitude: long, kind: 'pierReference' } };
}

export function parseHkkfEta(value: unknown, route: HkkfRouteId, directionId: HkkfDirectionId): readonly FerryArrival[] {
  if (!Array.isArray(value)) badHkkfResponse();
  const direction = hkkfDirection(route, directionId);
  const arrivals = value.map((entry): FerryArrival => {
    const row = obj(entry);
    if (row.route_id !== route || row.direction !== directionId) badHkkfMapping();
    const sessionDate = text(row.date);
    const sessionTime = text(row.session_time);
    if (parseHongKongTime(sessionDate + ' ' + sessionTime) === undefined) badHkkfResponse();
    return { kind: 'liveArrival', direction, destinationPierId: direction.destinationPierId,
      arrivalAt: instant(row.ETA), sessionDate, sessionTime };
  });
  return arrivals.sort((a, b) => a.arrivalAt - b.arrivalAt);
}
