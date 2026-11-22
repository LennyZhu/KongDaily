import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { lightRailTimeText } from '@/components/light-rail-next-trains';
import { savedBusStyles } from '@/components/saved-bus-ui';
import { AppText, Icon } from '@/components/ui';
import { homeLightRailPreview, homeMtrPreview } from '@/home-railway-eta';
import { useLanguage } from '@/language';
import { useLightRailNextTrains } from '@/light-rail-next-train-hooks';
import { useMtrNextTrains } from '@/mtr-next-train-hooks';
import { findMtrStation, mtrName } from '@/mtr-static';
import type { NextTrainClock } from '@/next-train-time';
import { railwayFavoriteHref, resolveRailwayService, type RailwayFavorite } from '@/railway-favorites';
import { colors, radius, space, touchTarget } from '@/theme';

export function HomeFavoriteRailway({ favorite }: { favorite: RailwayFavorite }) {
  const { copy } = useLanguage();
  if (!resolveRailwayService(favorite)) return <RailwayCard favorite={favorite} notice={copy.railwayFavorites.unavailable} />;
  return favorite.mode === 'mtr' ? <HomeMtrFavorite favorite={favorite} /> : <HomeLightRailFavorite favorite={favorite} />;
}

function HomeMtrFavorite({ favorite }: { favorite: RailwayFavorite }) {
  const { copy, locale } = useLanguage();
  const { lineId, stationId } = favorite;
  const controls = useMtrNextTrains(lineId, stationId, true);
  const { reading, now } = controls;
  const view = reading ? homeMtrPreview(reading, now) : undefined;
  const kind = view?.kind ?? 'loading';
  const labels = copy.mtr.nextTrains;
  const notice = kind === 'ready' ? undefined : { ...labels, ...copy.homeRailway.status }[kind];
  return (
    <RailwayCard favorite={favorite} notice={notice} controls={{ ...controls, retryAt: reading?.retryAt }}>
      {view?.kind === 'ready' && view.groups.map(({ direction, trains: [train] }) => {
        const destination = findMtrStation(train.destination);
        const name = destination?.memberships.some(({ lineCode }) => lineCode === lineId)
          ? mtrName(destination, locale) : labels.unknownDestination(train.destination);
        return (
          <View key={direction} style={styles.forecast}>
            <View style={styles.copy}>
              <AppText variant="detail">{labels.towards(name)}</AppText>
              <AppText variant="caption" tone="muted">
                {[copy.homeRailway.direction(direction), labels[train.timeType],
                  train.platform && labels.platform(train.platform), train.viaRacecourse && labels.viaRacecourse]
                  .filter(Boolean).join(' · ')}
              </AppText>
            </View>
            <AppText variant="homeCardTitle" tone="primary" style={styles.time}>
              {train.minutes === 0 ? labels.due : labels.minutes(train.minutes)}
            </AppText>
          </View>
        );
      })}
      {view && 'delayed' in view && view.delayed && <AppText variant="caption" tone="muted">{labels.delayed}</AppText>}
    </RailwayCard>
  );
}

function HomeLightRailFavorite({ favorite }: { favorite: RailwayFavorite }) {
  const { copy, locale } = useLanguage();
  const controls = useLightRailNextTrains(favorite.stationId, true);
  const { reading, now } = controls;
  const view = reading ? homeLightRailPreview(reading, now, favorite.lineId) : undefined;
  const labels = copy.lightRail.nextTrains;
  const kind = view?.kind ?? 'loading';
  const notice = kind === 'ready' ? undefined : kind === 'empty' ? copy.homeRailway.noMatching
    : { ...labels, ...copy.homeRailway.status }[kind];
  return (
    <RailwayCard favorite={favorite} notice={notice} controls={{ ...controls, retryAt: reading?.retryAt }}>
      {view?.kind === 'ready' && view.platforms.map(({ id, train }) => (
        <View key={id} style={styles.forecast}>
          <View style={styles.copy}>
            <AppText variant="detail">{copy.mtr.nextTrains.towards(
              (locale === 'en' ? train.destination.en ?? train.destination.zh : train.destination.zh ?? train.destination.en) ?? labels.unknownDestination,
            )}</AppText>
            <AppText variant="caption" tone="muted">{labels.platform(id)} · {labels[train.event]}</AppText>
          </View>
          <AppText variant="homeCardTitle" tone="primary" style={styles.time}>{lightRailTimeText(train, labels)}</AppText>
        </View>
      ))}
      {view?.kind === 'ready' && view.hasMore && <AppText variant="caption" tone="muted">{copy.homeRailway.morePredictions}</AppText>}
    </RailwayCard>
  );
}

function RailwayCard({ favorite, notice, controls, children }: {
  favorite: RailwayFavorite;
  notice?: string;
  controls?: { busy: boolean; now: NextTrainClock; retryAt?: number; refresh: () => void };
  children?: ReactNode;
}) {
  const { copy, locale } = useLanguage();
  const router = useRouter();
  const names = resolveRailwayService(favorite) ?? { line: favorite.lineSnapshot, station: favorite.stationSnapshot };
  const nameKey = locale === 'en' ? 'en' : 'zh';
  const line = favorite.mode === 'mtr' ? names.line[nameKey] : copy.lightRail.route(favorite.lineId);
  const station = names.station[nameKey];
  const href = railwayFavoriteHref(favorite);
  const disabled = controls?.busy || (controls?.retryAt !== undefined && controls.now.monotonic < controls.retryAt);
  const mode = copy.saved.categories[favorite.mode === 'mtr' ? 'mtr' : 'lightRail'];
  const heading = <>
    <View style={styles.badge}><Icon name={favorite.mode === 'mtr' ? 'tram.fill.tunnel' : 'train.side.front.car'} size={18} /></View>
    <View style={styles.copy}>
      <AppText variant="homeCardTitle">{station}</AppText>
      <AppText variant="caption" tone="primary">{mode} · {line}</AppText>
    </View>
  </>;
  return (
    <View style={[savedBusStyles.card, styles.card]}>
      <View style={styles.header}>
        {href ? <Pressable accessibilityRole="button" onPress={() => router.push(href)}
          style={({ pressed }) => [styles.heading, pressed && styles.pressed]}>
          {heading}<Icon name="chevron.right" size={12} color={colors.muted} />
        </Pressable> : <View style={styles.heading}>{heading}</View>}
        {controls && (
          <Pressable accessibilityRole="button" accessibilityLabel={`${copy.mtr.nextTrains.refresh} · ${line} · ${station}`}
            accessibilityState={{ disabled, busy: controls.busy }} disabled={disabled} onPress={controls.refresh}
            style={({ pressed }) => [styles.refresh, (pressed || disabled) && styles.dimmed]}>
            <View style={styles.refreshIcon}>
              {controls.busy ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="arrow.clockwise" size={15} />}
            </View>
          </Pressable>
        )}
      </View>
      <View style={styles.body}>
        {!!notice && <AppText variant="detail" tone="muted">{notice}</AppText>}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.md, gap: space.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  heading: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touchTarget },
  badge: { width: 32, height: 32, borderRadius: radius.control, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  body: { paddingTop: space.sm, gap: space.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  refresh: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  refreshIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: radius.control, backgroundColor: colors.tint },
  forecast: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  time: { flexShrink: 1, maxWidth: '38%', textAlign: 'right', fontVariant: ['tabular-nums'] },
  pressed: { backgroundColor: colors.pressed },
  dimmed: { opacity: 0.65 },
});
