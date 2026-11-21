export const nextTrainLifetime = 60_000;
const hongKongOffset = 8 * 60 * 60_000;
const timeTolerance = 5_000;

export type NextTrainFailure = { kind: 'failed' | 'unsupported' | 'rateLimited' };
export type NextTrainClock = { wall: number; monotonic: number };
export type NextTrainReading<Payload> = {
  payload: Payload;
  receivedAt: NextTrainClock;
  serverNow: number;
  retryAt: number;
};

export function nextTrainClock(): NextTrainClock {
  return { wall: Date.now(), monotonic: performance.now() };
}

export function parseHongKongTime(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return undefined;
  const iso = value.replace(' ', 'T') + 'Z';
  const utc = Date.parse(iso);
  if (!Number.isFinite(utc) || new Date(utc).toISOString() !== iso.replace('Z', '.000Z')) return undefined;
  return utc - hongKongOffset;
}

export function formatHongKongTime(timestamp: number, withSeconds = false) {
  return new Date(timestamp + hongKongOffset).toISOString().slice(0, withSeconds ? 19 : 16).replace('T', ' ');
}

export function nextTrainTiming<Payload>(reading: NextTrainReading<Payload>, now: NextTrainClock) {
  const { receivedAt } = reading;
  const elapsed = Math.max(0, now.monotonic - receivedAt.monotonic, now.wall - receivedAt.wall);
  return { elapsed, reference: reading.serverNow + elapsed };
}

export function nextTrainExpired({ elapsed, reference }: ReturnType<typeof nextTrainTiming>, updatedAt?: number) {
  return elapsed >= nextTrainLifetime || (updatedAt !== undefined
    && (reference - updatedAt >= nextTrainLifetime || updatedAt > reference + timeTolerance));
}
