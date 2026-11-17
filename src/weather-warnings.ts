import { weatherRecord, weatherString, weatherTimestamp } from '@/weather';

export const warningSummaryApiType = 'warnsum';
export const warningDetailsApiType = 'warningInfo';
export const warningCheckInterval = 5 * 60_000;
export const warningMaxAge = 10 * 60_000;

// Codes and group identities from the HKO open data API documentation.
const codesByCategory = {
  WFIRE: ['WFIREY', 'WFIRER'],
  WFROST: ['WFROST'],
  WHOT: ['WHOT'],
  WCOLD: ['WCOLD'],
  WMSGNL: ['WMSGNL'],
  WRAIN: ['WRAINA', 'WRAINR', 'WRAINB'],
  WFNTSA: ['WFNTSA'],
  WL: ['WL'],
  WTCSGNL: ['TC1', 'TC3', 'TC8NE', 'TC8SE', 'TC8NW', 'TC8SW', 'TC9', 'TC10', 'CANCEL'],
  WTMW: ['WTMW'],
  WTS: ['WTS'],
} as const;

type WarningCategory = keyof typeof codesByCategory;
type WarningCode = (typeof codesByCategory)[WarningCategory][number];
type ActiveWarningCode = Exclude<WarningCode, 'CANCEL'>;
const actions = ['ISSUE', 'REISSUE', 'EXTEND', 'UPDATE', 'CANCEL'] as const;
type WarningAction = Exclude<(typeof actions)[number], 'CANCEL'>;

const signals = {
  WFIREY: [2, 'caution'], WFIRER: [4, 'severe'], WFROST: [1, 'neutral'],
  WHOT: [2, 'caution'], WCOLD: [2, 'caution'], WMSGNL: [2, 'caution'],
  WRAINA: [3, 'caution'], WRAINR: [7, 'severe'], WRAINB: [10, 'intense'],
  WFNTSA: [5, 'caution'], WL: [7, 'severe'], WTMW: [10, 'intense'], WTS: [3, 'caution'],
  TC1: [2, 'neutral'], TC3: [5, 'caution'], TC8NE: [8, 'severe'], TC8SE: [8, 'severe'],
  TC8NW: [8, 'severe'], TC8SW: [8, 'severe'], TC9: [9, 'severe'], TC10: [10, 'intense'],
} as const satisfies Record<ActiveWarningCode, readonly [number, string]>;

export type WarningTone = (typeof signals)[ActiveWarningCode][1];
export type ActiveWeatherWarning = {
  category: WarningCategory;
  code: ActiveWarningCode;
  name: string;
  type?: string;
  action: WarningAction;
  issueTime: number;
  updateTime: number;
  expireTime?: number;
};
type WarningSummary = { warnings: ActiveWeatherWarning[]; eventTime?: number };
export type WarningDetail = {
  category: WarningCategory | 'WTCPRE8';
  subtype?: WarningCode;
  contents: string[];
  updateTime: number;
};
type WarningDetails = { details: WarningDetail[] };
type WarningSummarySnapshot = { report: WarningSummary; fetchedAt: number; verified?: boolean };

function isCategory(category: string): category is WarningCategory {
  return Object.hasOwn(codesByCategory, category);
}

function isWarningCode(category: WarningCategory, code: unknown): code is WarningCode {
  return (codesByCategory[category] as readonly unknown[]).includes(code);
}

export function warningTone({ code }: ActiveWeatherWarning) {
  return signals[code][1];
}

export function parseWarningSummary(payload: unknown): WarningSummary | undefined {
  const root = weatherRecord(payload);
  if (!root) return;
  const warnings: ActiveWeatherWarning[] = [];
  let eventTime: number | undefined;
  for (const [category, value] of Object.entries(root)) {
    if (!isCategory(category)) return;
    const row = weatherRecord(value);
    if (!row) return;
    const { actionCode, code } = row;
    const name = weatherString(row.name);
    const type = weatherString(row.type);
    const issueTime = weatherTimestamp(row.issueTime);
    const updateTime = weatherTimestamp(row.updateTime);
    const expireTime = weatherTimestamp(row.expireTime);
    const action = actions.find((value) => value === actionCode);
    if (!name || !action || !isWarningCode(category, code) || issueTime === undefined || updateTime === undefined
      || (row.type != null && typeof row.type !== 'string')
      || (row.expireTime != null && (expireTime === undefined || expireTime < issueTime))) return;
    eventTime = Math.max(eventTime ?? -Infinity, issueTime, updateTime);
    if (action === 'CANCEL') continue;
    if (code === 'CANCEL') return;
    warnings.push({ category, code, name, type, action, issueTime, updateTime, expireTime });
  }
  warnings.sort((a, b) => signals[b.code][0] - signals[a.code][0] || b.issueTime - a.issueTime || a.code.localeCompare(b.code));
  return { warnings, eventTime };
}

export function parseWarningDetails(payload: unknown): WarningDetails | undefined {
  const root = weatherRecord(payload);
  if (!root) return;
  if (Object.keys(root).length === 0) return { details: [] };
  if (!Array.isArray(root.details)) return;
  const details: WarningDetail[] = [];
  for (const value of root.details) {
    const row = weatherRecord(value);
    const category = row?.warningStatementCode;
    if (!row || typeof category !== 'string' || (category !== 'WTCPRE8' && !isCategory(category))) return;
    const subtype = row.subtype ?? undefined;
    const updateTime = weatherTimestamp(row.updateTime);
    if (updateTime === undefined
      || (subtype !== undefined && (!isCategory(category) || !isWarningCode(category, subtype)))
      || (row.contents != null && (!Array.isArray(row.contents) || row.contents.some((part: unknown) => typeof part !== 'string')))) return;
    details.push({ category, subtype: subtype as WarningCode | undefined, contents: row.contents ?? [], updateTime });
  }
  return { details };
}

export function matchingWarningDetail(warning: ActiveWeatherWarning, details: WarningDetail[], now: number) {
  // A newer bulletin may describe a change the summary has not confirmed yet.
  return details.find((detail) => detail.category === warning.category
    && (detail.subtype ?? detail.category) === warning.code
    && detail.updateTime === warning.updateTime && detail.updateTime <= now
    && detail.contents.some((paragraph) => paragraph.trim()));
}

export function warningStatus(snapshot: WarningSummarySnapshot | undefined, failed: boolean, loading: boolean, now: number) {
  if (!snapshot) return failed || !loading ? 'unknown' : 'loading';
  const { report, fetchedAt, verified } = snapshot;
  // Passing the HKO expiry triggers re-verification; only HKO can confirm cancellation.
  if (!verified || failed || now < fetchedAt || now >= fetchedAt + warningMaxAge
    || (report.eventTime !== undefined && report.eventTime > now)
    || report.warnings.some(({ expireTime }) => expireTime !== undefined && expireTime <= now)) return 'stale';
  return report.warnings.length ? 'active' : 'none';
}
