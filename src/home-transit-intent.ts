import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';

export const homeTransitIntent = 'add-home-transit';
export const addHomeTransitHref = { pathname: '/transport', params: { intent: homeTransitIntent } } as const;

export function useHomeTransitIntent() {
  const { intent } = useLocalSearchParams<{ intent?: string }>();
  return intent === homeTransitIntent;
}

export function homeTransitHref(href: Href, enabled: boolean): Href {
  if (!enabled) return href;
  const path = typeof href === 'string' ? href.split('?')[0] : href.pathname;
  if (!path || !/^(?:\/transport$|\/(?:bus|mtr|light-rail|minibus)\/)/.test(path)) return href;
  if (typeof href === 'string') {
    return (href + (href.includes('?') ? '&' : '?') + 'intent=' + homeTransitIntent) as Href;
  }
  return { ...href, params: { ...href.params, intent: homeTransitIntent } } as Href;
}

export function useHomeTransitRouter() {
  const router = useRouter();
  const enabled = useHomeTransitIntent();
  return useMemo(() => ({ ...router, push: (href: Href) => router.push(homeTransitHref(href, enabled)) }), [router, enabled]);
}
