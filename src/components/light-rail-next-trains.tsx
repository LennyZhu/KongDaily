import { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import type { Messages } from '@/i18n';
import { useLanguage } from '@/language';
import { readLightRailNextTrains } from '@/light-rail-next-train-client';
import { lightRailForecastView, type LightRailTrain } from '@/light-rail-realtime';
import { useNextTrainReading } from '@/next-train-hooks';
import { formatHongKongTime } from '@/next-train-time';
import { colors, radius, space, touchTarget } from '@/theme';

type Labels = Messages['lightRail']['nextTrains'];

function timeText(train: LightRailTrain, labels: Labels) {
  if (train.serviceIssue) return labels.serviceIssue;
  switch (train.time.kind) {
    case 'minutes': return labels.minutes(train.time.minutes);
    case 'arriving': return labels.arriving;
    case 'departing': return labels.departing;
    case 'imminent':
      return train.event === 'arrival' ? labels.atStop : train.event === 'departure' ? labels.leaving : labels.imminent;
    case 'unknown': return labels.noTime;
  }
}

export function LightRailNextTrains({ stationId, selectedRoute }: { stationId: string; selectedRoute?: string }) {
  const { copy, locale } = useLanguage();
  const labels = copy.lightRail.nextTrains;
  const read = useCallback(() => readLightRailNextTrains(stationId), [stationId]);
  const { reading, now, busy, refresh } = useNextTrainReading(stationId, read);
  const view = reading ? lightRailForecastView(reading, now) : undefined;
  const kind = view?.kind ?? 'loading';
  const updatedAt = view && 'updatedAt' in view ? view.updatedAt : undefined;
  const disabled = busy || kind === 'unsupported' || Boolean(reading && now.monotonic < reading.retryAt);

  return (
    <View style={styles.section}>
      <AppText variant="homeHeading" accessibilityRole="header">{labels.title}</AppText>
      {selectedRoute && <AppText variant="detail" tone="primary">{copy.railwayFavorites.routeContext(selectedRoute)}</AppText>}
      <View style={styles.card}>
        <View style={styles.toolbar}>
          <AppText variant="caption" tone="muted" style={styles.copy}>{labels.provider}</AppText>
          <Pressable accessibilityRole="button" accessibilityLabel={labels.refresh}
            accessibilityState={{ busy, disabled }} onPress={refresh} disabled={disabled}
            style={({ pressed }) => [styles.refresh, (pressed || disabled) && styles.dimmed]}>
            {busy ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="arrow.clockwise" size={15} />}
            <AppText variant="detail" tone="primary" style={styles.actionText}>{labels.refresh}</AppText>
          </Pressable>
        </View>
        {kind !== 'ready' && <AppText variant="detail" tone="muted" accessibilityLiveRegion="polite">{labels[kind]}</AppText>}
        {view?.kind === 'ready' && view.platforms.map(({ id, trains }) => (
          <View key={id} style={styles.group}>
            <AppText variant="homeCardTitle" accessibilityRole="header">{labels.platform(id)}</AppText>
            {trains.map((train, index) => {
              const { route, destination, remark, event, serviceIssue } = train;
              const special = route.kind === 'special';
              const dest = locale === 'en' ? destination.en ?? destination.zh : destination.zh ?? destination.en;
              const note = locale === 'en' ? remark.en ?? remark.zh : remark.zh ?? remark.en;
              const showEvent = !serviceIssue && train.time.kind !== 'unknown';
              return (
                <View key={index} style={styles.train}>
                  <View style={styles.copy}>
                    <AppText variant="detail" tone={selectedRoute === route.code && route.kind === 'regular' ? 'primary' : 'text'}>
                      {`${route.code ? copy.lightRail.route(route.code) : special ? labels.special : labels.unknownRoute}${
                        selectedRoute === route.code && route.kind === 'regular' ? ` · ${copy.railwayFavorites.selectedRoute}` : ''}`}
                    </AppText>
                    <AppText variant="detail" tone="muted">{dest ?? labels.unknownDestination}</AppText>
                    {special && route.code && <AppText variant="caption" tone="primary">{labels.special}</AppText>}
                    {!!note && <AppText variant="caption" tone="muted">{note}</AppText>}
                  </View>
                  <View style={styles.time}>
                    {showEvent && <AppText variant="caption" tone="muted" style={styles.eventLabel}>{labels[event]}</AppText>}
                    <AppText variant="detail" tone={serviceIssue ? 'muted' : 'primary'} style={styles.timeText}>
                      {timeText(train, labels)}
                    </AppText>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
        {updatedAt !== undefined && (
          <AppText variant="caption" tone="muted">{labels.updated(formatHongKongTime(updatedAt, true))}</AppText>
        )}
      </View>
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
  copy: { flex: 1, minWidth: 0, gap: space.xs },
  refresh: {
    minHeight: touchTarget, minWidth: touchTarget, maxWidth: '100%', paddingHorizontal: space.sm,
    flexDirection: 'row', alignItems: 'center', gap: space.xs, borderRadius: radius.control, backgroundColor: colors.tint,
  },
  actionText: { flexShrink: 1 },
  dimmed: { opacity: 0.65 },
  group: { gap: space.xs, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  train: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: space.xs },
  time: { flexShrink: 1, maxWidth: '42%', gap: space.xs },
  eventLabel: { textAlign: 'right', fontWeight: '400' },
  timeText: { textAlign: 'right', fontVariant: ['tabular-nums'] },
});
