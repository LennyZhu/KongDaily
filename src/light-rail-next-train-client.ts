import { parseLightRailForecast, supportsLightRailForecast, type LightRailPayload } from '@/light-rail-realtime';
import { createNextTrainClient } from '@/next-train-client';
import { nextTrainClock } from '@/next-train-time';

const endpoint = 'https://rt.data.gov.hk/v1/transport/mtr/lrt/getSchedule';

export function createLightRailNextTrainClient({ request = fetch, clock = nextTrainClock } = {}) {
  const read = createNextTrainClient<LightRailPayload>({ request, clock });
  return function readLightRail(stationId: string) {
    const url = supportsLightRailForecast(stationId) ? `${endpoint}?station_id=${stationId}&with_special=1` : undefined;
    return read(url, (body) => parseLightRailForecast(body, stationId));
  };
}

export const readLightRailNextTrains = createLightRailNextTrainClient();
