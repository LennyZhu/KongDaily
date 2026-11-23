import type { FerryDeparture, FerryServiceDayType, FerryTimetable } from '@/ferry-data';
import {
  badHkkfMapping, badHkkfResponse, hkkfDirection, hkkfValidateRouteEndpoints, type HkkfDirectionId, type HkkfRouteId,
} from '@/hkkf-data';

const headers = [
  'route id/航綫', 'direction/方向', 'origin_en', '出發碼頭', '出发码头', 'destination_en', '目的地碼頭', '目的地码头',
  'remarks_en', '附註', '附注', 'Monday to Saturday/星期一至星期六', 'Sunday and Public Holidays/星期日及公眾假期',
];

function parseCsv(body: string) {
  const input = body.replace(/^\uFEFF/, '');
  if (!input || input.length > 65_536) badHkkfResponse();
  const field = /"(?:[^"]|"")*"|[^",\r\n]*/gy;
  const rows: string[][] = [];
  let row: string[] = [];
  while (true) {
    const match = field.exec(input);
    if (!match) badHkkfResponse();
    const value = match[0];
    row.push(value.startsWith('"') ? value.slice(1, -1).replace(/""/g, '"') : value);
    const end = field.lastIndex;
    if (end === input.length) { rows.push(row); return rows; }
    const separator = input[end];
    if (separator === ',') { field.lastIndex++; continue; }
    if (separator !== '\n' && separator !== '\r') badHkkfResponse();
    rows.push(row);
    row = [];
    field.lastIndex += separator === '\r' && input[end + 1] === '\n' ? 2 : 1;
    if (field.lastIndex === input.length) return rows;
  }
}

function plainNote(value: string) {
  return value.replace(/^\s*rgb\([^>]*?">/i, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
}

function offset(route: HkkfRouteId, direction: HkkfDirectionId, time: string,
  dayType: FerryServiceDayType, lastSailing: boolean): FerryDeparture['dayOffset'] {
  if (time >= '04:00') return 0;
  // These early times appear at the start of the named service day's official table.
  if (route === 2 && direction === 'outbound' && time === '02:30') return 0;
  if (route === 3 && time === (direction === 'inbound' ? '03:40' : '03:00')) return 0;
  // The Transport Department marks these particular tail sailings as the next civil day.
  if (lastSailing && direction === 'outbound' && (
    ((route === 2 || route === 3) && time === '00:30') ||
    (route === 4 && time === (dayType === 'mondayToSaturday' ? '01:00' : '00:10'))
  )) return 1;
  return undefined;
}

function parseDeparture(token: string, route: HkkfRouteId, direction: HkkfDirectionId,
  dayType: FerryServiceDayType): FerryDeparture {
  const match = /^([^\d]*?)((?:[01]\d|2[0-3]):[0-5]\d)([^\d]*)$/u.exec(token.trim());
  if (!match) badHkkfResponse();
  const [, before, time, after] = match;
  const marker = (before + after).replace(/\s+/gu, '');
  const allowedSymbols = /^[\^]?$/.test(marker) || (
    route === 1 ? marker === '@' :
      route === 2 ? ['{}', '#', '*'].includes(marker) :
        route === 3 && /^(?:\^?#?\{\}|#?[🞁▲])$/u.test(marker)
  );
  const lastSailing = marker.includes('^');
  const dayOffset = offset(route, direction, time, dayType, lastSailing);
  const rule = !allowedSymbols || dayOffset === undefined ? 'unverified'
    : marker === '@' ? 'optional'
      : route === 2 && marker === '{}' ? 'saturdayOnly' : 'regular';
  const freight = route === 1 && lastSailing || route === 3 && marker.includes('{}') ? 'restricted'
    : route === 2 && marker === '#' ? 'advanceBooking'
      : route === 2 && marker === '*' || route === 3 && /[🞁▲]/u.test(marker) ? 'limited' : undefined;
  return { kind: 'scheduledDeparture', dayType, time, dayOffset, rule, marker, lastSailing, freight,
    ...(route === 3 && direction === 'outbound' && allowedSymbols && marker.includes('#') ? { onwardService: true } : {}) };
}

function parseList(body: string, route: HkkfRouteId, direction: HkkfDirectionId, day: FerryServiceDayType) {
  if (!/^\[\s*(?:'[^'\r\n]*'\s*(?:,\s*'[^'\r\n]*'\s*)*)?\]$/.test(body.trim())) badHkkfResponse();
  return [...body.matchAll(/'([^']*)'/g)]
    .filter(([, token]) => token.trim())
    .map(([, token]) => parseDeparture(token, route, direction, day));
}

export function parseHkkfTimetable(body: string, route: HkkfRouteId, directionId: HkkfDirectionId): FerryTimetable {
  const [header, row, ...extra] = parseCsv(body);
  if (header.length !== headers.length || !headers.every((name, i) => name === header[i]) ||
      extra.length || (row && row.length !== headers.length)) badHkkfResponse();
  const direction = hkkfDirection(route, directionId);
  if (!row) return { direction, entries: [], notes: { 'zh-HK': '', en: '' } };
  const [id, bound, enFrom, zhFrom, , enTo, zhTo, , en, zh, , weekday, holiday] = row;
  if (id !== String(route) || bound !== directionId) badHkkfMapping();
  // CSV endpoints are route catalogue labels in both feeds. Only the audited map assigns direction.
  hkkfValidateRouteEndpoints(route, zhFrom, enFrom, zhTo, enTo);
  return {
    direction, notes: { 'zh-HK': plainNote(zh), en: plainNote(en) },
    entries: [...parseList(weekday, route, directionId, 'mondayToSaturday'),
      ...parseList(holiday, route, directionId, 'sundayOrPublicHoliday')],
  };
}
