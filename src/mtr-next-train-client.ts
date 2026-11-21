import { mtrClock, parseMtrForecast, supportsMtrForecast, type MtrPayload, type MtrReading } from '@/mtr-realtime';
import { createNextTrainClient } from '@/next-train-client';

const endpoint = 'https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php';

export function createMtrNextTrainClient({ request = fetch, clock = mtrClock } = {}) {
  const read = createNextTrainClient<MtrPayload>({ request, clock });
  return function readMtr(line: string, station: string): Promise<MtrReading> {
    // EN preserves the documented notice vocabulary. Presentation is localized on device.
    const url = supportsMtrForecast(line, station)
      ? `${endpoint}?line=${encodeURIComponent(line)}&sta=${encodeURIComponent(station)}&lang=EN` : undefined;
    return read(url, (body) => parseMtrForecast(body, line, station));
  };
}

export const readMtrNextTrains = createMtrNextTrainClient();
