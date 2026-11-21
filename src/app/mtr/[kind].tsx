import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { MtrEntryRow } from '@/components/mtr-ui';
import { AppText, EmptyState, Filters, Icon, PageHeading, Screen } from '@/components/ui';
import { useLanguage } from '@/language';
import { findMtrLine, findMtrStation, mtrName, mtrSource, type MtrLine } from '@/mtr-static';
import { space, touchTarget } from '@/theme';

export default function MtrDetailsScreen() {
  const { kind, code } = useLocalSearchParams();
  const { copy, locale } = useLanguage();
  const entry = kind === 'line' ? findMtrLine(code) : kind === 'station' ? findMtrStation(code) : undefined;

  if (!entry) {
    return <Screen hasHeader><EmptyState icon="tram.fill.tunnel" title={copy.mtr.unavailable} /></Screen>;
  }

  return (
    <Screen hasHeader contentStyle={styles.section}>
      <PageHeading title={mtrName(entry, locale)} description={mtrName(entry, locale === 'en' ? 'zh-HK' : 'en')} />
      {entry.kind === 'mtr-line' ? (
        <MtrLineStations key={entry.id} line={entry} />
      ) : (
        <View style={styles.rows}>
          {entry.supplemental && <AppText variant="detail" tone="muted">{copy.mtr.racecourse}</AppText>}
          <AppText variant="homeHeading" accessibilityRole="header">{copy.mtr.lines}</AppText>
          {entry.memberships.map(({ lineCode }) => {
            const line = findMtrLine(lineCode);
            return line && <MtrEntryRow key={lineCode} entry={line} />;
          })}
        </View>
      )}
      <MtrSources racecourse={entry.kind === 'mtr-station' && entry.supplemental} />
    </Screen>
  );
}

function MtrLineStations({ line }: { line: MtrLine }) {
  const { copy, locale } = useLanguage();
  const [direction, setDirection] = useState(line.patterns[0]?.direction);
  const pattern = line.patterns.find((item) => item.direction === direction);
  const racecourse = line.id === 'EAL' ? findMtrStation('RAC') : undefined;

  const options = line.patterns.flatMap(({ direction, stations }) => {
    const first = findMtrStation(stations[0]);
    const last = findMtrStation(stations[stations.length - 1]);
    return first && last ? [[direction, `${mtrName(first, locale)} → ${mtrName(last, locale)}`] as const] : [];
  });

  return (
    <View style={styles.rows}>
      <AppText variant="homeHeading" accessibilityRole="header">{copy.mtr.stationOrder}</AppText>
      {pattern ? (
        <>
          <Filters options={options} selected={pattern.direction} onSelect={setDirection} />
          {pattern.stations.map((code, index) => {
            const station = findMtrStation(code);
            return station && <MtrEntryRow key={code} entry={station} sequence={index + 1} />;
          })}
        </>
      ) : <EmptyState icon="tram.fill.tunnel" title={copy.mtr.noDirectory} />}
      {racecourse && (
        <>
          <AppText variant="homeHeading" accessibilityRole="header">{copy.mtr.specialStations}</AppText>
          <AppText variant="detail" tone="muted">{copy.mtr.racecourse}</AppText>
          <MtrEntryRow entry={racecourse} />
        </>
      )}
    </View>
  );
}

function MtrSources({ racecourse }: { racecourse: boolean }) {
  const { copy } = useLanguage();
  const links = [
    [copy.mtr.dataset, mtrSource.resource],
    [copy.mtr.terms, 'https://data.gov.hk/en/terms-and-conditions'],
  ];
  if (racecourse) links.push([copy.mtr.serviceHours, mtrSource.racecourseHours]);

  return (
    <View style={styles.rows}>
      <AppText variant="homeHeading" accessibilityRole="header">{copy.mtr.source}</AppText>
      <AppText variant="detail" tone="muted">{copy.mtr.attribution}</AppText>
      <AppText variant="detail" tone="muted">{copy.mtr.snapshotDate(mtrSource.fetchedOn)}</AppText>
      <AppText variant="detail" tone="muted">{copy.mtr.disclaimer}</AppText>
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
