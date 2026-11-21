import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Filters, Icon } from '@/components/ui';
import { useLanguage } from '@/language';
import { useMtrNextTrains } from '@/mtr-next-train-hooks';
import { formatHongKongTime, mtrForecastView, mtrServiceAlertUrl, supportsMtrForecast } from '@/mtr-realtime';
import { findMtrLine, findMtrStation, mtrName, type MtrStation } from '@/mtr-static';
import { colors, radius, space, touchTarget } from '@/theme';

export function MtrNextTrains({ station, initialLine }: { station: MtrStation; initialLine?: string }) {
  const { copy, locale } = useLanguage();
  const labels = copy.mtr.nextTrains;
  const [line, selectLine] = useState(initialLine ?? (station.memberships.length === 1 ? station.memberships[0].lineCode : undefined));
  const options = station.memberships.flatMap(({ lineCode }) => {
    const entry = findMtrLine(lineCode);
    return entry ? [[lineCode, mtrName(entry, locale)] as const] : [];
  });

  return (
    <View style={styles.section}>
      <AppText variant="homeHeading" accessibilityRole="header">{labels.title}</AppText>
      {options.length > 1 && <Filters options={options} selected={line ?? ''} onSelect={selectLine} />}
      {line === undefined ? <AppText variant="detail" tone="muted">{labels.chooseLine}</AppText>
        : supportsMtrForecast(line, station.id) ? <ForecastCard key={line} line={line} station={station.id} />
          : <AppText variant="detail" tone="muted">{labels.unsupported}</AppText>}
    </View>
  );
}

function ForecastCard({ line, station }: { line: string; station: string }) {
  const { copy, locale } = useLanguage();
  const labels = copy.mtr.nextTrains;
  const { reading, now, busy, refresh } = useMtrNextTrains(line, station);
  const view = reading ? mtrForecastView(reading, now) : undefined;
  const disabled = busy || Boolean(reading && now.monotonic < reading.retryAt);
  const kind = view?.kind ?? 'loading';
  const notice = kind === 'ready' ? undefined : labels[kind];
  const updatedAt = view && 'updatedAt' in view ? view.updatedAt : undefined;

  function destinationName(code: string) {
    const terminal = findMtrStation(code);
    return terminal?.memberships.some(({ lineCode }) => lineCode === line)
      ? mtrName(terminal, locale) : labels.unknownDestination(code);
  }

  return (
    <View style={styles.card}>
      <View style={styles.toolbar}>
        <AppText variant="caption" tone="muted" style={styles.flex}>{labels.hongKongTime}</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel={labels.refresh} accessibilityState={{ disabled, busy }}
          disabled={disabled} onPress={refresh}
          style={({ pressed }) => [styles.action, (pressed || disabled) && styles.dimmed]}>
          {busy ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="arrow.clockwise" size={15} />}
          <AppText variant="detail" tone="primary" style={styles.actionText}>{labels.refresh}</AppText>
        </Pressable>
      </View>
      {notice && (
        <AppText variant="detail" tone="muted" accessibilityLiveRegion="polite">{notice}</AppText>
      )}
      {view?.kind === 'special' && (
        <Pressable accessibilityRole="link" accessibilityHint={copy.compliance.externalLink}
          onPress={() => { void Linking.openURL(mtrServiceAlertUrl).catch(() => Alert.alert(copy.compliance.linkFailed)); }}
          style={({ pressed }) => [styles.action, pressed && styles.dimmed]}>
          <AppText variant="detail" tone="primary" style={styles.actionText}>{labels.alertLink}</AppText>
          <Icon name="arrow.up.right" size={13} />
        </Pressable>
      )}
      {view && 'delayed' in view && view.delayed && (
        <AppText variant="detail" tone="muted">{labels.delayed}</AppText>
      )}
      {view?.kind === 'ready' && view.groups.map(({ direction, trains }) => (
        <View key={direction} style={styles.group}>
          <AppText variant="homeCardTitle" accessibilityRole="header">
            {labels.towards([...new Set(trains.map(({ destination }) => destinationName(destination)))].join(labels.destinationSeparator))}
          </AppText>
          {trains.map(({ sequence, destination, time, minutes, platform, timeType, viaRacecourse }, index) => (
            <View key={sequence} style={styles.train}>
              <View style={styles.flex}>
                <AppText variant="detail">{destinationName(destination)}</AppText>
                <AppText variant="caption" tone="muted">
                  {labels[timeType]} · {formatHongKongTime(time)}
                </AppText>
                {!!platform && <AppText variant="caption" tone="muted">{labels.platform(platform)}</AppText>}
                {viaRacecourse && <AppText variant="caption" tone="muted">{labels.viaRacecourse}</AppText>}
              </View>
              <AppText variant={index === 0 ? 'homeCardTitle' : 'detail'} tone="primary" style={styles.minutes}>
                {minutes === 0 ? labels.due : labels.minutes(minutes)}
              </AppText>
            </View>
          ))}
        </View>
      ))}
      {updatedAt !== undefined && (
        <AppText variant="caption" tone="muted">{labels.updated(formatHongKongTime(updatedAt, true))}</AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  card: {
    padding: space.md, gap: space.sm, backgroundColor: colors.surface,
    borderRadius: radius.media, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, alignItems: 'center' },
  flex: { flex: 1, minWidth: 0, gap: space.xs },
  action: {
    minHeight: touchTarget, minWidth: touchTarget, maxWidth: '100%', paddingHorizontal: space.sm,
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: space.xs,
    borderRadius: radius.control, backgroundColor: colors.tint,
  },
  actionText: { flexShrink: 1 },
  dimmed: { opacity: 0.65 },
  group: { gap: space.xs, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  train: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: space.xs },
  minutes: { flexShrink: 1, maxWidth: '40%', textAlign: 'right', fontVariant: ['tabular-nums'] },
});
