import type { FerryRoute } from '@/ferry-data';
import { hkkfPierDisplayName } from '@/hkkf-data';

export type HkkfSearchState = { status: 'loading' } | { status: 'failed' }
  | { status: 'ready'; routes: readonly FerryRoute[] };

export function hkkfSearchText(value: string) {
  return value.normalize('NFKC').toLowerCase()
    .replace(/公衆/g, '公眾')
    .replace(/渡輪碼頭/g, '碼頭')
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

export function matchHkkfRoutes(routes: readonly FerryRoute[], input: string) {
  if (!input.trim()) return routes;
  const term = hkkfSearchText(input);
  if (!term) return [];
  return routes.filter(({ name, directions }) => {
    const names = Object.values(name);
    for (const direction of directions) {
      names.push(...Object.values(direction.name));
      for (const id of [direction.originPierId, direction.destinationPierId]) {
        const pier = hkkfPierDisplayName(id);
        if (pier) names.push(...Object.values(pier));
      }
    }
    return names.some((name) => hkkfSearchText(name).includes(term));
  });
}
