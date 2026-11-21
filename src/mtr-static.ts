import snapshot from '../assets/data/mtr-static.json';

type Names = { zh: string; en: string };
type MtrLineCode = keyof typeof snapshot.lines;
type Membership = { lineCode: MtrLineCode; stationId: number | null };
type StationRecord = Names & {
  lineIds: Partial<Record<MtrLineCode, number | null>>;
  supplemental?: boolean;
};

export type MtrPattern = { direction: string; stations: readonly string[] };
export type MtrLine = Names & { kind: 'mtr-line'; id: MtrLineCode; patterns: readonly MtrPattern[] };
export type MtrStation = Names & {
  kind: 'mtr-station';
  id: string;
  memberships: readonly Membership[];
  supplemental: boolean;
};
export type MtrEntry = MtrLine | MtrStation;

export const mtrSource = snapshot.source;

const codes = Object.keys(snapshot.lines) as MtrLineCode[];
const stationRecords: Record<string, StationRecord> = snapshot.stations;
export const mtrLines: readonly MtrLine[] = codes.map((id) => {
  const { zh, en, directions } = snapshot.lines[id];
  return {
    kind: 'mtr-line', id, zh, en,
    patterns: Object.entries(directions).map(([direction, stations]) => ({ direction, stations })),
  };
});

export const mtrStations: readonly MtrStation[] = Object.entries(stationRecords)
  .map(([id, { zh, en, lineIds, supplemental }]): MtrStation => ({
    kind: 'mtr-station', id, zh, en, supplemental: supplemental === true,
    memberships: codes.flatMap((lineCode) => {
      const stationId = lineIds[lineCode];
      return stationId === undefined ? [] : [{ lineCode, stationId }];
    }),
  }))
  .sort((a, b) => a.en.localeCompare(b.en) || a.id.localeCompare(b.id));

const linesByCode = new Map<string, MtrLine>(mtrLines.map((line) => [line.id, line]));
const stationsByCode = new Map(mtrStations.map((station) => [station.id, station]));

export function findMtrLine(code: unknown) {
  return typeof code === 'string' ? linesByCode.get(code) : undefined;
}

export function findMtrStation(code: unknown) {
  return typeof code === 'string' ? stationsByCode.get(code) : undefined;
}

export function mtrName(entry: Names, locale: 'zh-HK' | 'en') {
  return locale === 'en' ? entry.en : entry.zh;
}

function normalize(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').replace(/綫/g, '線').toLowerCase();
}

const searchIndex = [...mtrLines, ...mtrStations].map((entry) => ({
  entry, names: [entry.id, entry.zh, entry.en].map(normalize),
}));

export function searchMtr(input: string) {
  const query = normalize(input);
  if (!query) return [];
  return searchIndex.flatMap(({ entry, names }) => {
    if (names.includes(query)) return [{ entry, rank: 0 }];
    if (names.some((name) => name.startsWith(query))) return [{ entry, rank: 1 }];
    if (names.some((name) => name.includes(query))) return [{ entry, rank: 2 }];
    return [];
  }).sort((a, b) => a.rank - b.rank).map(({ entry }) => entry);
}
