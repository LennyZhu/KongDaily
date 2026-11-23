import { Pressable, StyleSheet, View } from 'react-native';

import { routePlaceName } from '@/bus-routes';
import { AppText, Icon, type IconName } from '@/components/ui';
import { facilityText } from '@/facilities';
import type { GlobalSearchKind, GlobalSearchResult } from '@/global-search';
import { gmbText } from '@/gmb-search';
import { hkkfSource } from '@/hkkf-data';
import { useLanguage } from '@/language';
import { findMtrLine, mtrName } from '@/mtr-static';
import { colors, radius, space } from '@/theme';

export const searchGroupIcons: Record<GlobalSearchKind, IconName> = {
  transport_route: 'bus',
  transport_stop: 'mappin',
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
        title: route.number, detail: [copy.transport.modes.bus, operator, routePlaceName(route.routeName, locale)],
        note: route.special ? copy.bus.specialRoute : undefined,
      };
      if (route.source === 'citybus') return {
        title: route.number, detail: [copy.transport.modes.bus, operator, [origin, destination].filter(Boolean).join(' – ')],
      };
      return {
        title: route.number, detail: [copy.transport.modes.bus, operator, copy.bus.directions[route.direction],
          destination && copy.busDetail.towards(destination)],
        note: copy.bus.service(route.serviceType),
      };
    }
    case 'ferry_route':
      return { title: result.service.name[locale].replace(/\s*<=>\s*/g, ' ↔ '),
        detail: [copy.transport.modes.ferry, hkkfSource.owner[locale]],
        note: result.service.directions.find(({ directionId }) => directionId === 'outbound')?.name[locale] };
    case 'gmb_route': {
      const { service } = result;
      const direction = service.directions.find(({ routeSeq }) => routeSeq === 1) ?? service.directions[0];
      const endpoints = direction ? [gmbText(direction.origin, locale), gmbText(direction.destination, locale)] : [];
      return { title: service.routeCode,
        detail: [copy.transport.modes.minibus, copy.minibus.regions[service.region], endpoints.filter(Boolean).join(' → ')],
        note: gmbText(service.description, locale) };
    }
    case 'bus_stop':
      return {
        title: routePlaceName(result.name, locale),
        detail: [copy.transport.modes.bus, copy.bus.sources[result.source], routePlaceName(result.street, locale)],
        note: copy.nearbyBus.officialStopId(result.stopId),
      };
    case 'mtr_line':
      return { title: mtrName(result.entry, locale), detail: [copy.mtr.lineType, result.entry.id,
        mtrName(result.entry, locale === 'en' ? 'zh-HK' : 'en')] };
    case 'mtr_station':
      return { title: mtrName(result.entry, locale), detail: [copy.mtr.stationType, result.entry.id,
        mtrName(result.entry, locale === 'en' ? 'zh-HK' : 'en')],
      note: result.entry.memberships.flatMap(({ lineCode }) => { const line = findMtrLine(lineCode); return line ? [mtrName(line, locale)] : []; }).join(' · ') };
    case 'light_rail_route':
      return { title: copy.lightRail.route(result.entry.id), detail: [copy.lightRail.routeType],
        note: result.entry.circular ? copy.lightRail.circular : undefined };
    case 'light_rail_stop':
      return { title: locale === 'en' ? result.entry.en : result.entry.zh,
        detail: [copy.lightRail.stopType, result.entry.id, locale === 'en' ? result.entry.zh : result.entry.en],
        note: copy.lightRail.servedBy(result.entry.routes.join(' · ')) };
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

export function GlobalSearchResultRow({ result, first, last, onPress }: {
  result: GlobalSearchResult; first: boolean; last: boolean; onPress: (result: GlobalSearchResult) => void;
}) {
  const language = useLanguage();
  const icon = result.kind === 'facility' ? facilityIcons[result.facility.category]
    : result.kind === 'explore_place' ? placeIcons[result.place.category]
      : result.kind === 'mtr_line' || result.kind === 'mtr_station' ? 'tram.fill.tunnel'
        : result.kind === 'light_rail_route' || result.kind === 'light_rail_stop' ? 'train.side.front.car'
          : result.kind === 'ferry_route' ? 'ferry' : result.kind === 'gmb_route' ? 'bus.fill' : result.kind === 'bus_route' ? 'bus' : 'mappin';
  const { title, detail, note } = resultCopy(result, language);
  const subtitle = detail.filter(Boolean).join(' · ');

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={[title, subtitle, note].filter(Boolean).join(' · ')}
      onPress={() => onPress(result)}
      style={({ pressed }) => [styles.row, first && styles.first, last && styles.last, pressed && styles.pressed]}>
      <View style={styles.icon}><Icon name={icon} size={21} /></View>
      <View style={styles.text}>
        <AppText variant={result.kind === 'bus_route' || result.kind === 'gmb_route' ? 'homeHeading' : 'homeCardTitle'}>{title}</AppText>
        {!!subtitle && <AppText variant="detail" tone="muted">{subtitle}</AppText>}
        {!!note && <AppText variant="caption" tone="muted">{note}</AppText>}
      </View>
      <Icon name="chevron.right" color={colors.muted} size={14} />
    </Pressable>
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
  pressed: { backgroundColor: colors.pressed },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.control, backgroundColor: colors.tint },
  text: { flex: 1, minWidth: 0, gap: space.xs },
});
