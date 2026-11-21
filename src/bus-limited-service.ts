import { routeStopKey, type RouteStopIdentity } from '@/bus-stops';

const timetable258P = 'https://search.kmb.hk/TD_SS/258d.pdf';
const timetables = new Map([
  [routeStopKey({ source: 'kmbLwb', number: '258P', direction: 'outbound', serviceType: '1' }), timetable258P],
  [routeStopKey({ source: 'kmbLwb', number: '258P', direction: 'inbound', serviceType: '1' }), timetable258P],
  // KMB 261P towards Tuen Mun ended on 12 October 2026.
  [routeStopKey({ source: 'kmbLwb', number: '261P', direction: 'outbound', serviceType: '1' }), 'https://search.kmb.hk/TD_SS/261.pdf'],
]);

// Verified against KMB's timetable and the live KMB/LWB route catalogue on 21 November 2026.
export function limitedServiceTimetable(identity: RouteStopIdentity) {
  return timetables.get(routeStopKey(identity));
}
