import type { IconName } from '@/components/ui';

export type WeatherLocale = 'zh-HK' | 'en';
export type WeatherMeasurement = { place: string; value: number };
export type WeatherRainfall = { place: string; min?: number; max?: number };
export type WeatherReport = {
  updateTime: number;
  temperature?: { readings: WeatherMeasurement[]; recordTime: number };
  humidity?: { readings: WeatherMeasurement[]; recordTime: number };
  uv?: { readings: (WeatherMeasurement & { intensity?: string })[]; period?: string; recordTime?: number };
  rainfall?: { readings: WeatherRainfall[]; startTime: number; endTime: number };
  icons: number[];
  iconUpdateTime?: number;
};

export const weatherApiType = 'rhrread';
export const weatherStaleAge = 90 * 60_000;
export const weatherHideAge = 6 * 60 * 60_000;

function record(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function string(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function number(value: unknown, min: number, max = Infinity) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : undefined;
}

function time(value: unknown) {
  if (typeof value !== 'string') return;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return;
  const wallTime = Date.parse(`${match[1]}T${match[2]}Z`);
  const parsed = Date.parse(value);
  // Date.parse can roll impossible calendar days forward. Check the supplied wall time as well as the offset.
  if (!Number.isFinite(wallTime) || !Number.isFinite(parsed)
    || new Date(wallTime).toISOString().slice(0, 19) !== `${match[1]}T${match[2]}`) return;
  return parsed;
}

function readings<T extends { place: string }>(group: unknown, parse: (row: Record<string, unknown>) => T | undefined) {
  const data = record(group)?.data;
  if (!Array.isArray(data)) return [];
  const places = new Map<string, T>();
  for (const value of data) {
    const row = record(value);
    const item = row && parse(row);
    if (item && !places.has(item.place)) places.set(item.place, item);
  }
  return [...places.values()];
}

function timedMeasurements(group: unknown, unit: string, min: number, max: number) {
  const recordTime = time(record(group)?.recordTime);
  if (recordTime === undefined) return;
  const values = readings(group, (row) => {
    const place = string(row.place);
    const value = row.unit === unit ? number(row.value, min, max) : undefined;
    return place && value !== undefined ? { place, value } : undefined;
  });
  return values.length ? { readings: values, recordTime } : undefined;
}

export function parseWeatherReport(payload: unknown): WeatherReport | undefined {
  const root = record(payload);
  const updateTime = time(root?.updateTime);
  if (!root || updateTime === undefined) return;

  const temperature = timedMeasurements(root.temperature, 'C', -100, 100);
  const humidity = timedMeasurements(root.humidity, 'percent', 0, 100);
  const uvGroup = record(root.uvindex);
  const uvReadings = readings(uvGroup, (row) => {
    const place = string(row.place);
    const value = number(row.value, 0);
    return place && value !== undefined ? { place, value, intensity: string(row.desc) } : undefined;
  });
  const uv = uvReadings.length
    ? { readings: uvReadings, period: string(uvGroup?.recordDesc), recordTime: time(uvGroup?.recordTime) } : undefined;
  const rainGroup = record(root.rainfall);
  const startTime = time(rainGroup?.startTime);
  const endTime = time(rainGroup?.endTime);
  const rainReadings = readings(rainGroup, (row) => {
    const place = string(row.place);
    if (!place || row.unit !== 'mm') return;
    const min = number(row.min, 0);
    const max = number(row.max, 0);
    if ((min === undefined && max === undefined) || (min !== undefined && max !== undefined && min > max)) return;
    return { place, min, max };
  });
  const rainfall = startTime !== undefined && endTime !== undefined && startTime < endTime && rainReadings.length
    ? { readings: rainReadings, startTime, endTime } : undefined;
  if (!temperature && !humidity && !rainfall) return;

  const icons = Array.isArray(root.icon)
    ? [...new Set(root.icon.filter((code): code is number => Number.isSafeInteger(code) && code >= 0))]
    : [];
  return { updateTime, temperature, humidity, uv, rainfall, icons, iconUpdateTime: time(root.iconUpdateTime) };
}

function stationKey(place: string) {
  const name = place.normalize('NFKC').toLowerCase();
  return name === '香港天文台' || name === 'hong kong observatory' ? 'hko' : name;
}

export function primaryWeather(report: WeatherReport | undefined) {
  const temperatures = report?.temperature?.readings;
  const humidities = report?.humidity?.readings;
  const temperature = temperatures?.find(({ place }) => stationKey(place) === 'hko') ?? temperatures?.[0];
  const humidity = humidities?.find(({ place }) => stationKey(place) === stationKey(temperature?.place ?? '香港天文台'))
    ?? humidities?.[0];
  const sameObservation = Boolean(temperature && humidity && stationKey(temperature.place) === stationKey(humidity.place)
    && report?.temperature?.recordTime === report?.humidity?.recordTime);
  return { temperature, humidity, sameObservation };
}

export function formatWeatherTime(timestamp: number, locale: WeatherLocale, full = false) {
  const options = { timeZone: 'Asia/Hong_Kong', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const;
  return new Intl.DateTimeFormat(locale, full
    ? { ...options, year: 'numeric', month: '2-digit', day: '2-digit' } : options).format(timestamp);
}

export function weatherWarningUrl(locale: WeatherLocale) {
  return `https://www.hko.gov.hk/${locale === 'en' ? 'en' : 'tc'}/wxinfo/dailywx/wxwarntoday.htm`;
}

export function weatherDatasetUrl(locale: WeatherLocale) {
  return `https://data.gov.hk/${locale === 'en' ? 'en' : 'tc'}-data/dataset/hk-hko-rss-current-weather-report`;
}

export function weatherTermsUrl(locale: WeatherLocale) {
  return `https://data.gov.hk/${locale === 'en' ? 'en' : 'tc'}/terms-and-conditions`;
}

export function hasOtherLanguageWeatherText(report: WeatherReport, locale: WeatherLocale) {
  const labels = [
    ...report.temperature?.readings.map(({ place }) => place) ?? [],
    ...report.humidity?.readings.map(({ place }) => place) ?? [],
    ...report.rainfall?.readings.map(({ place }) => place) ?? [],
    ...report.uv?.readings.flatMap(({ place, intensity }) => intensity ? [place, intensity] : [place]) ?? [],
    ...(report.uv?.period ? [report.uv.period] : []),
  ];
  return labels.some((label) => /[\u3400-\u9fff]/u.test(label) !== (locale === 'zh-HK'));
}

// https://www.hko.gov.hk/en/textonly/explain/wxicon.htm
const conditions = {
  50: ['sun.max', 'sunny'], 51: ['cloud.sun', 'sunnyPeriods'], 52: ['cloud.sun', 'sunnyIntervals'],
  53: ['cloud.sun.rain', 'sunnyFewShowers'], 54: ['cloud.sun.rain', 'sunnyShowers'],
  60: ['cloud', 'cloudy'], 61: ['cloud.fill', 'overcast'], 62: ['cloud.drizzle', 'lightRain'],
  63: ['cloud.rain', 'rain'], 64: ['cloud.heavyrain', 'heavyRain'], 65: ['cloud.bolt.rain', 'thunderstorms'],
  70: ['moon.stars', 'fine'], 71: ['moon.stars', 'fine'], 72: ['moon.stars', 'fine'],
  73: ['moon.stars', 'fine'], 74: ['moon.stars', 'fine'], 75: ['moon.stars', 'fine'],
  76: ['cloud.moon', 'mainlyCloudy'], 77: ['moon', 'mainlyFine'],
  80: ['wind', 'windy'], 81: ['humidity', 'dry'], 82: ['humidity', 'humid'], 83: ['cloud.fog', 'fog'],
  84: ['cloud.fog', 'mist'], 85: ['sun.haze', 'haze'], 90: ['thermometer.sun', 'hot'],
  91: ['thermometer.medium', 'warm'], 92: ['thermometer.low', 'cool'], 93: ['thermometer.snowflake', 'cold'],
} as const satisfies Record<number, readonly [IconName, string]>;

export type WeatherCondition = (typeof conditions)[keyof typeof conditions][1] | 'unknown';

export function weatherCondition(code?: number): readonly [IconName, WeatherCondition] {
  return code !== undefined && Object.hasOwn(conditions, code)
    ? conditions[code as keyof typeof conditions] : ['questionmark.circle', 'unknown'];
}
