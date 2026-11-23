import type { Href } from 'expo-router';

import { busSources, normalizeBusQuery, type BusRoute } from '@/bus-routes';
import { getExplorePlace } from '@/explore-places';
import { resolveStableFacilityIdentity } from '@/facility-identity';
import { gmbPositiveId, type GmbRouteSeq, type GmbVisitKey } from '@/gmb-data';
import type { GlobalSearchResult } from '@/global-search';
import { hkkfRouteParams, type HkkfDirectionId } from '@/hkkf-data';
import { hkkfPreviewEnabled } from '@/hkkf-preview';
import { findLightRailRoute, findLightRailStop } from '@/light-rail-static';
import { findMtrLine, findMtrStation } from '@/mtr-static';

type SearchDestination = { href: Href } | { issue: 'resultUnavailable' | 'facilityUnavailable' | 'facilityNeedsReview' };

function isCatalogueIdentity(route: BusRoute) {
  const { id, number } = route;
  if (typeof number !== 'string' || !number || number.includes(':') || normalizeBusQuery(number) !== number) return false;
  switch (route.source) {
    case 'kmbLwb': {
      const bound = route.direction === 'outbound' ? 'O' : route.direction === 'inbound' ? 'I' : '';
      return !!bound && typeof route.serviceType === 'string' && /^\d+$/.test(route.serviceType)
        && id === `KMB-LWB:${number}:${bound}:${route.serviceType}`;
    }
    case 'citybus':
      return route.direction === 'listed' && id === `CTB:${number}`;
    case 'nlb':
      return typeof route.routeId === 'string' && /^\d+$/.test(route.routeId) && id === `NLB:${route.routeId}`;
  }
}

export function gmbRouteHref(routeId: number, routeSeq?: GmbRouteSeq, visit?: Pick<GmbVisitKey, 'stopSeq' | 'stopId'>): Href {
  return { pathname: '/minibus/[id]', params: {
    id: String(routeId), ...(routeSeq ? { routeSeq: String(routeSeq) } : {}),
    ...(visit ? { stopSeq: String(visit.stopSeq), stopId: String(visit.stopId) } : {}),
  } };
}

export function hkkfRouteHref(operatorId: string, id: string, direction?: HkkfDirectionId): Href | undefined {
  if (!hkkfPreviewEnabled || !hkkfRouteParams(operatorId, id)) return;
  return { pathname: '/ferry/[id]', params: { id, operatorId, ...(direction ? { direction } : {}) } };
}

export function searchResultDestination(result: GlobalSearchResult): SearchDestination {
  switch (result.kind) {
    case 'mtr_line':
      if (result.entry.kind === 'mtr-line' && findMtrLine(result.entry.id)) {
        return { href: { pathname: '/mtr/[kind]', params: { kind: 'line', code: result.entry.id } } };
      }
      break;
    case 'mtr_station':
      if (result.entry.kind === 'mtr-station' && findMtrStation(result.entry.id)) {
        return { href: { pathname: '/mtr/[kind]', params: { kind: 'station', code: result.entry.id } } };
      }
      break;
    case 'light_rail_route':
      if (result.entry.kind === 'light-rail-route' && findLightRailRoute(result.entry.id)) {
        return { href: { pathname: '/light-rail/[kind]', params: { kind: 'route', id: result.entry.id } } };
      }
      break;
    case 'light_rail_stop':
      if (result.entry.kind === 'light-rail-stop' && findLightRailStop(result.entry.id)) {
        return { href: { pathname: '/light-rail/[kind]', params: { kind: 'stop', id: result.entry.id } } };
      }
      break;
    case 'ferry_route': {
      const { operatorId, operatorRouteId, routeId } = result.service;
      if (routeId !== `hkkf:route:${operatorRouteId}`) break;
      const href = hkkfRouteHref(operatorId, operatorRouteId);
      if (href) return { href };
      break;
    }
    case 'gmb_route':
      if (gmbPositiveId(result.service.routeId)) {
        return { href: gmbRouteHref(result.service.routeId) };
      }
      break;
    case 'bus_route':
      if (isCatalogueIdentity(result.route)) {
        return { href: { pathname: '/bus/route', params: { routeId: result.route.id } } };
      }
      break;
    case 'bus_stop':
      if (busSources.includes(result.source) && typeof result.stopId === 'string'
        && result.stopId && result.stopId.trim() === result.stopId) {
        return { href: { pathname: '/bus/nearby/stop', params: { source: result.source, stopId: result.stopId } } };
      }
      break;
    case 'facility': {
      const resolved = resolveStableFacilityIdentity(result.identity);
      if (resolved.status === 'available') {
        return { href: { pathname: '/search/facility-map', params: resolved.identity } };
      }
      return { issue: resolved.status === 'needs_review' ? 'facilityNeedsReview' : 'facilityUnavailable' };
    }
    case 'explore_place':
      if (getExplorePlace(result.place.id)) {
        return { href: { pathname: '/explore/place/[id]', params: { id: result.place.id } } };
      }
      break;
  }
  return { issue: 'resultUnavailable' };
}
