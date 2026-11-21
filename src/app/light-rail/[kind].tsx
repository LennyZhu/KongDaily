import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { LightRailEntryRow, lightRailEndpoints } from '@/components/light-rail-ui';
import { AppText, EmptyState, Filters, Icon, PageHeading, Screen } from '@/components/ui';
import { useLanguage } from '@/language';
import { findLightRailRoute, findLightRailStop, lightRailSource, type LightRailRoute } from '@/light-rail-static';
import { space, touchTarget } from '@/theme';

export default function LightRailDetailsScreen() {
  const { kind, id } = useLocalSearchParams();
  const { copy, locale } = useLanguage();
  const labels = copy.lightRail;
  const entry = kind === 'route' ? findLightRailRoute(id) : kind === 'stop' ? findLightRailStop(id) : undefined;
  if (!entry) return <Screen hasHeader><EmptyState icon="train.side.front.car" title={labels.unavailable} /></Screen>;

  const isRoute = entry.kind === 'light-rail-route';
  return (
    <Screen hasHeader contentStyle={styles.section}>
      <PageHeading title={isRoute ? labels.route(entry.id) : locale === 'en' ? entry.en : entry.zh}
        description={isRoute ? (entry.circular ? labels.circular : undefined) : locale === 'en' ? entry.zh : entry.en} />
      {isRoute ? <LightRailRouteStops key={entry.id} route={entry} /> : (
        <View style={styles.rows}>
          <AppText variant="detail" tone="muted">{labels.stopId(entry.id)}</AppText>
          <AppText variant="homeHeading" accessibilityRole="header">{labels.lines}</AppText>
          {entry.routes.map((id) => {
            const route = findLightRailRoute(id);
            return route && <LightRailEntryRow key={id} entry={route} />;
          })}
        </View>
      )}
      <LightRailSources />
    </Screen>
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
        return stop && <LightRailEntryRow key={`${direction}:${sequence}`} entry={stop} sequence={sequence} />;
      })}
    </View>
  );
}

function LightRailSources() {
  const { copy, locale } = useLanguage();
  const labels = copy.lightRail;
  const links = [
    [labels.dataset, lightRailSource.resource],
    [labels.timetable, lightRailSource.timetable[locale]],
    [copy.mtr.terms, 'https://data.gov.hk/en/terms-and-conditions'],
  ];

  return (
    <View style={styles.rows}>
      <AppText variant="homeHeading" accessibilityRole="header">{copy.mtr.source}</AppText>
      <AppText variant="detail" tone="muted">{copy.mtr.attribution}</AppText>
      <AppText variant="detail" tone="muted">{labels.updated(lightRailSource.resourceUpdatedOn)}</AppText>
      <AppText variant="detail" tone="muted">{labels.coverage}</AppText>
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
