import { distanceBetween, type NearbyBusStop } from '@/nearby-bus-data';

export type NearbyStopGroup = {
  id: string;
  stops: [NearbyBusStop, ...NearbyBusStop[]];
};

// The limit applies to every pair in a display group. It says nothing about shared boarding bays.
const maxGroupSpan = 100;

function stopKey(stop: NearbyBusStop) {
  return `${stop.source}:${stop.stop_id}`;
}

function nameKey(stop: NearbyBusStop) {
  const normalize = (name: string) => name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  const chinese = normalize(stop.name_zh);
  const english = normalize(stop.name_en);
  return chinese ? `zh:${chinese}` : english ? `en:${english}` : stopKey(stop);
}

function nearestFirst(a: NearbyBusStop, b: NearbyBusStop) {
  return a.distance - b.distance || stopKey(a).localeCompare(stopKey(b));
}

export function groupNearbyStops(stops: NearbyBusStop[]) {
  const byName = new Map<string, NearbyStopGroup[]>();
  const groups: NearbyStopGroup[] = [];
  // Keep group IDs stable when only the reference distances change.
  const ordered = [...stops].sort((a, b) => stopKey(a).localeCompare(stopKey(b)));
  for (const stop of ordered) {
    const name = nameKey(stop);
    const sameName = byName.get(name) ?? [];
    const group = sameName.find((candidate) => candidate.stops.every((member) => distanceBetween(member, stop) <= maxGroupSpan));
    if (group) {
      group.stops.push(stop);
    } else {
      const next: NearbyStopGroup = { id: `stop-group:${stopKey(stop)}`, stops: [stop] };
      sameName.push(next);
      byName.set(name, sameName);
      groups.push(next);
    }
  }
  for (const group of groups) group.stops.sort(nearestFirst);
  return groups.sort((a, b) => nearestFirst(a.stops[0], b.stops[0]));
}
