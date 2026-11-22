import { useLocalSearchParams } from 'expo-router';
import { useRef, useState, type RefObject } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View, type ScrollView } from 'react-native';

import { LightRailNextTrains } from '@/components/light-rail-next-trains';
import { LightRailEntryRow, lightRailEndpoints } from '@/components/light-rail-ui';
import { RailwayStationHeading } from '@/components/railway-favorite-action';
import { AppText, EmptyState, Filters, Icon, PageHeading, Screen } from '@/components/ui';
import { useLanguage } from '@/language';
import { lightRailForecastSource } from '@/light-rail-realtime';
import { findLightRailRoute, findLightRailStop, lightRailSource, type LightRailRoute, type LightRailStop } from '@/light-rail-static';
import { space, touchTarget } from '@/theme';

export default function LightRailDetailsScreen() {
  const { kind, id, route } = useLocalSearchParams();
  const { copy } = useLanguage();
  const scrollRef = useRef<ScrollView>(null);
  const labels = copy.lightRail;
  const entry = kind === 'route' ? findLightRailRoute(id) : kind === 'stop' ? findLightRailStop(id) : undefined;
  if (!entry) return <Screen hasHeader><EmptyState icon="train.side.front.car" title={labels.unavailable} /></Screen>;

  const isRoute = entry.kind === 'light-rail-route';
  return (
    <Screen hasHeader contentStyle={styles.section} scrollRef={scrollRef}>
      {isRoute && <PageHeading title={labels.route(entry.id)} description={entry.circular ? labels.circular : undefined} />}
      {!isRoute && <LightRailStationServices key={JSON.stringify([entry.id, route])} station={entry}
        initialRoute={typeof route === 'string' ? route : undefined} scrollRef={scrollRef} />}
      {isRoute ? <LightRailRouteStops key={entry.id} route={entry} /> : (
        <View style={styles.rows}>
          <AppText variant="homeHeading" accessibilityRole="header">{labels.lines}</AppText>
          {entry.routes.map((id) => {
            const route = findLightRailRoute(id);
            return route && <LightRailEntryRow key={id} entry={route} />;
          })}
        </View>
      )}
      <LightRailSources forecast={!isRoute} />
    </Screen>
  );
}

function LightRailStationServices({ station, initialRoute, scrollRef }: {
  station: LightRailStop; initialRoute?: string; scrollRef?: RefObject<ScrollView | null>;
}) {
  const { copy, locale } = useLanguage();
  const [route, selectRoute] = useState(station.routes.includes(initialRoute ?? '') ? initialRoute
    : station.routes.length === 1 ? station.routes[0] : undefined);
  const chooserY = useRef(0);
  return (
    <>
      <View style={styles.rows}>
        <RailwayStationHeading title={locale === 'en' ? station.en : station.zh} description={locale === 'en' ? station.zh : station.en}
          identity={route ? { mode: 'light_rail', lineId: route, stationId: station.id } : undefined}
          chooseHint={copy.railwayFavorites.chooseRoute}
          onChooseService={() => scrollRef?.current?.scrollTo({ y: chooserY.current, animated: false })} />
        <AppText variant="detail" tone="muted">{copy.lightRail.stopId(station.id)}</AppText>
      </View>
      <View style={styles.rows} onLayout={({ nativeEvent }) => { chooserY.current = nativeEvent.layout.y; }}>
        <AppText variant="homeHeading" accessibilityRole="header">{copy.railwayFavorites.service}</AppText>
        <Filters options={station.routes.map((id) => [id, copy.lightRail.route(id)])} selected={route ?? ''} onSelect={selectRoute} />
        {!route && <AppText variant="detail" tone="muted">{copy.railwayFavorites.chooseRoute}</AppText>}
        <LightRailNextTrains stationId={station.id} selectedRoute={route} />
      </View>
    </>
  );
}

function LightRailRouteStops({ route }: { route: LightRailRoute }) {
  const { copy, locale } = useLanguage();
  const labels = copy.lightRail;
  const [direction, setDirection] = useState(route.patterns[0].direction);
  const pattern = route.patterns.find((candidate) => candidate.direction === direction);
  const options = route.patterns.map((item) => [
    item.direction,
    route.circular ? labels.segment(item.direction) : lightRailEndpoints(item, locale) ?? labels.direction(item.direction),
  ] as const);

  return (
    <View style={styles.rows}>
      <AppText variant="homeHeading" accessibilityRole="header">{labels.stationOrder}</AppText>
      {route.circular && <AppText variant="detail" tone="muted">{labels.circularNote}</AppText>}
      <Filters options={options} selected={direction} onSelect={setDirection} />
      {pattern?.visits.map(({ stopId, sequence }) => {
        const stop = findLightRailStop(stopId);
        // The same station may occur more than once in a published direction.
        return stop && <LightRailEntryRow key={`${direction}:${sequence}`} entry={stop} sequence={sequence} routeId={route.id} />;
      })}
    </View>
  );
}

function LightRailSources({ forecast }: { forecast: boolean }) {
  const { copy, locale } = useLanguage();
  const labels = copy.lightRail;
  const links = [
    [labels.dataset, lightRailSource.resource],
    [labels.timetable, lightRailSource.timetable[locale]],
    [copy.mtr.terms, 'https://data.gov.hk/en/terms-and-conditions'],
  ];
  if (forecast) links.push([labels.nextTrains.dataset, lightRailForecastSource]);

  return (
    <View style={styles.rows}>
      <AppText variant="homeHeading" accessibilityRole="header">{copy.mtr.source}</AppText>
      <AppText variant="detail" tone="muted">{copy.mtr.attribution}</AppText>
      <AppText variant="detail" tone="muted">{copy.mtr.offlineUpdated(lightRailSource.resourceUpdatedOn)}</AppText>
      <AppText variant="detail" tone="muted">{labels.coverage}</AppText>
      {forecast && <AppText variant="detail" tone="muted">{copy.mtr.forecastDisclaimer}</AppText>}
      {links.map(([label, url]) => (
        <Pressable key={url} accessibilityRole="link" accessibilityHint={copy.compliance.externalLink}
          onPress={() => { void Linking.openURL(url).catch(() => Alert.alert(copy.compliance.linkFailed)); }}
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
          <AppText variant="detail" tone="primary" style={styles.linkText}>{label}</AppText>
          <Icon name="arrow.up.right" size={13} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xl },
  rows: { gap: space.sm },
  link: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  linkText: { flexShrink: 1 },
  pressed: { opacity: 0.76 },
});
