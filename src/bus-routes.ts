export const busSources = ['kmbLwb', 'citybus', 'nlb'] as const;
export type BusSource = (typeof busSources)[number];
export type BusDirection = 'outbound' | 'inbound' | 'listed';

export type RouteName = { zh: string; en: string };

export type BusRoute = {
  id: string;
  number: string;
  origin: RouteName;
  destination: RouteName;
} & (
  { source: 'kmbLwb'; direction: Exclude<BusDirection, 'listed'>; serviceType: string }
  | { source: 'citybus'; direction: 'listed'; serviceType?: never }
  | {
      source: 'nlb';
      serviceType?: never;
      routeId: string;
      routeName: RouteName;
      overnight: boolean;
      special: boolean;
    }
);

export function normalizeBusQuery(query: string) {
  return query.normalize('NFKC').trim().replace(/\s+/g, ' ').toUpperCase();
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function textField(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function splitNlbRouteName(name: string) {
  const separator = name.indexOf('>');
  if (separator < 0) return ['', ''];
  return [name.slice(0, separator).trim(), name.slice(separator + 1).trim()];
}

function parseRoute(source: BusSource, value: unknown): BusRoute | undefined {
  const row = asRecord(value);
  if (!row) return;

  if (source === 'nlb') {
    const routeId = typeof row.routeId === 'number' && Number.isSafeInteger(row.routeId)
      ? String(row.routeId) : textField(row.routeId);
    const number = normalizeBusQuery(textField(row.routeNo));
    const routeName = { zh: textField(row.routeName_c), en: textField(row.routeName_e) };
    if (!/^\d+$/.test(routeId) || !number || !(routeName.zh || routeName.en)) return;
    const [originZh, destinationZh] = splitNlbRouteName(routeName.zh);
    const [originEn, destinationEn] = splitNlbRouteName(routeName.en);
    return {
      id: `NLB:${routeId}`,
      source,
      routeId,
      number,
      routeName,
      origin: { zh: originZh, en: originEn },
      destination: { zh: destinationZh, en: destinationEn },
      overnight: row.overnightRoute === 1,
      special: row.specialRoute === 1,
    };
  }

  const number = normalizeBusQuery(textField(row.route));
  const origin = { zh: textField(row.orig_tc), en: textField(row.orig_en) };
  const destination = { zh: textField(row.dest_tc), en: textField(row.dest_en) };
  if (!number || !(origin.zh || origin.en) || !(destination.zh || destination.en)) return;

  if (source === 'citybus') {
    if (row.co !== 'CTB') return;
    // The Citybus route catalogue publishes the endpoint pair, without a direction code.
    return { id: `CTB:${number}`, source, number, direction: 'listed', origin, destination };
  }

  if (row.bound !== 'I' && row.bound !== 'O') return;
  const serviceType = typeof row.service_type === 'number'
    ? String(row.service_type)
    : textField(row.service_type);
  if (!/^\d+$/.test(serviceType)) return;

  return {
    id: `KMB-LWB:${number}:${row.bound}:${serviceType}`,
    source,
    number,
    direction: row.bound === 'O' ? 'outbound' : 'inbound',
    serviceType,
    origin,
    destination,
  };
}

export class BusCatalogueError extends Error {
  constructor(
    readonly kind: 'empty' | 'invalid',
    readonly receivedRows: number | null,
    readonly parsedRows: number,
  ) {
    super('Bus route catalogue validation failed');
  }
}

export function parseBusCatalogue(source: BusSource, response: unknown): BusRoute[] {
  const envelope = asRecord(response);
  const data = source === 'nlb' ? envelope?.routes : envelope?.data;
  if (!Array.isArray(data)) throw new BusCatalogueError('invalid', null, 0);
  if (data.length === 0) throw new BusCatalogueError('empty', 0, 0);

  const routes = [];
  const ids = new Set<string>();
  for (const row of data) {
    const route = parseRoute(source, row);
    if (!route || ids.has(route.id)) throw new BusCatalogueError('invalid', data.length, routes.length);
    routes.push(route);
    ids.add(route.id);
  }
  return routes;
}

const sourceTerms: Record<BusSource, string[]> = {
  kmbLwb: ['九巴', '九龍巴士', '龍運', 'KMB', 'LWB', 'LONG WIN'],
  citybus: ['城巴', 'CITYBUS', 'CTB'],
  nlb: ['新大嶼山巴士', '新大屿山巴士', '嶼巴', 'NLB', 'NEW LANTAO BUS'],
};

const routeOrder = new Intl.Collator('en', { numeric: true });

export function matchBusRoutes(routes: BusRoute[], input: string) {
  const query = normalizeBusQuery(input);
  if (!query) return [];

  const routeQuery = query.replace(/ /g, '');
  const matchNames = !/^(?:[A-Z]{0,2}\d+[A-Z]{0,2}|[A-Z])$/.test(routeQuery);
  const matches = [];
  for (const route of routes) {
    if (route.number === routeQuery) {
      matches.push({ route, rank: 0 });
    } else if (route.number.startsWith(routeQuery)) {
      matches.push({ route, rank: 1 });
    } else if (route.number.includes(routeQuery)) {
      matches.push({ route, rank: 2 });
    } else if (matchNames && [
      route.origin.zh, route.origin.en, route.destination.zh, route.destination.en, ...sourceTerms[route.source],
      ...(route.source === 'nlb' ? [route.routeName.zh, route.routeName.en] : []),
    ].some((term) => normalizeBusQuery(term).includes(query))) {
      matches.push({ route, rank: 3 });
    }
  }

  return matches
    .sort((a, b) => a.rank - b.rank
      || routeOrder.compare(a.route.number, b.route.number)
      || busSources.indexOf(a.route.source) - busSources.indexOf(b.route.source)
      || routeOrder.compare(a.route.serviceType ?? '', b.route.serviceType ?? '')
      || a.route.id.localeCompare(b.route.id))
    .map(({ route }) => route);
}

export function routePlaceName(name: RouteName, locale: 'zh-HK' | 'en') {
  return locale === 'en' ? name.en || name.zh : name.zh || name.en;
}
