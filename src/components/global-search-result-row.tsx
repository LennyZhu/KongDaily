import { StyleSheet, View } from 'react-native';

import { routePlaceName } from '@/bus-routes';
import { AppText, Icon, type IconName } from '@/components/ui';
import { facilityText } from '@/facilities';
import type { GlobalSearchKind, GlobalSearchResult } from '@/global-search';
import { useLanguage } from '@/language';
import { colors, radius, space } from '@/theme';

export const searchGroupIcons: Record<GlobalSearchKind, IconName> = {
  bus_route: 'bus',
  bus_stop: 'mappin',
  facility: 'tree',
  explore_place: 'safari',
};

const placeIcons = { hiking: 'mountain.2', waterfront: 'water.waves', parks: 'tree', pets: 'pawprint' } as const;
const facilityIcons = { toilets: 'figure.dress.line.vertical.figure', parks: 'tree', pets: 'pawprint' } as const;

function resultCopy(result: GlobalSearchResult, { copy, locale }: ReturnType<typeof useLanguage>) {
  switch (result.kind) {
    case 'bus_route': {
      const { route } = result;
      const origin = routePlaceName(route.origin, locale);
      const destination = routePlaceName(route.destination, locale);
      const operator = copy.bus.sources[route.source];
      if (route.source === 'nlb') return {
        title: route.number, detail: [operator, routePlaceName(route.routeName, locale)],
        note: route.special ? copy.bus.specialRoute : undefined,
      };
      if (route.source === 'citybus') return {
        title: route.number, detail: [operator, [origin, destination].filter(Boolean).join(' – ')],
      };
      return {
        title: route.number, detail: [operator, copy.bus.directions[route.direction],
          destination && copy.busDetail.towards(destination)],
        note: copy.bus.service(route.serviceType),
      };
    }
    case 'bus_stop':
      return {
        title: routePlaceName(result.name, locale),
        detail: [copy.bus.sources[result.source], routePlaceName(result.street, locale)],
        note: copy.nearbyBus.officialStopId(result.stopId),
      };
    case 'facility': {
      const { facility, typeLabel } = result;
      const area = facility.district ?? facility.area ?? facility.address;
      return { title: facilityText(facility.name, locale), detail: [typeLabel[locale], area && facilityText(area, locale)],
        note: facility.serviceNotice ? copy.nearby.serviceNotice : undefined };
    }
    case 'explore_place':
      return { title: result.place.title[locale],
        detail: [copy.explore.categories[result.place.category], result.place.district[locale]] };
  }
}

export function GlobalSearchResultRow({ result, first, last }: { result: GlobalSearchResult; first: boolean; last: boolean }) {
  const language = useLanguage();
  const icon = result.kind === 'facility' ? facilityIcons[result.facility.category]
    : result.kind === 'explore_place' ? placeIcons[result.place.category] : searchGroupIcons[result.kind];
  const { title, detail, note } = resultCopy(result, language);
  const subtitle = detail.filter(Boolean).join(' · ');

  return (
    <View style={[styles.row, first && styles.first, last && styles.last]}>
      <View style={styles.icon}><Icon name={icon} size={21} /></View>
      <View style={styles.text}>
        <AppText variant={result.kind === 'bus_route' ? 'homeHeading' : 'homeCardTitle'}>{title}</AppText>
        {!!subtitle && <AppText variant="detail" tone="muted">{subtitle}</AppText>}
        {!!note && <AppText variant="caption" tone="muted">{note}</AppText>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, paddingHorizontal: space.md,
    minHeight: 60, backgroundColor: colors.surface,
    borderColor: colors.border, borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  first: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
  last: { borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.control, backgroundColor: colors.tint },
  text: { flex: 1, minWidth: 0, gap: space.xs },
});
