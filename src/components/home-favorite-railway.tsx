import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { lightRailTimeText } from '@/components/light-rail-next-trains';
import { savedBusStyles } from '@/components/saved-bus-ui';
import { AppText, Icon } from '@/components/ui';
import { useHomeEtaRegistration, type RegisterHomeEtaRefresh } from '@/home-eta-refresh';
import { homeLightRailPreview, homeMtrPreview } from '@/home-railway-eta';
import { useLanguage } from '@/language';
import { useLightRailNextTrains } from '@/light-rail-next-train-hooks';
import { useMtrNextTrains } from '@/mtr-next-train-hooks';
import { findMtrStation, mtrName } from '@/mtr-static';
import { railwayFavoriteHref, resolveRailwayService, type RailwayFavorite } from '@/railway-favorites';
import { colors, radius, space, touchTarget } from '@/theme';

type HomeRailwayProps = { favorite: RailwayFavorite; registerRefresh?: RegisterHomeEtaRefresh };

export function HomeFavoriteRailway({ favorite, registerRefresh }: HomeRailwayProps) {
  const { copy } = useLanguage();
  if (!resolveRailwayService(favorite)) return <RailwayCard favorite={favorite} notice={copy.railwayFavorites.unavailable} />;
  return favorite.mode === 'mtr' ? <HomeMtrFavorite favorite={favorite} registerRefresh={registerRefresh} />
    : <HomeLightRailFavorite favorite={favorite} registerRefresh={registerRefresh} />;
}

function HomeMtrFavorite({ favorite, registerRefresh }: HomeRailwayProps) {
  const { copy, locale } = useLanguage();
  const { lineId, stationId } = favorite;
  const { reading, now, busy, refresh } = useMtrNextTrains(lineId, stationId, true);
  useHomeEtaRegistration(registerRefresh, refresh);
  const view = reading ? homeMtrPreview(reading, now) : undefined;
  const kind = view?.kind ?? (busy === false ? 'failed' : 'loading');
  const labels = copy.mtr.nextTrains;
  const notice = kind === 'ready' ? undefined : { ...labels, ...copy.homeRailway.status }[kind];
  return (
    <RailwayCard favorite={favorite} notice={notice}>
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

function HomeLightRailFavorite({ favorite, registerRefresh }: HomeRailwayProps) {
  const { copy, locale } = useLanguage();
  const { reading, now, busy, refresh } = useLightRailNextTrains(favorite.stationId, true);
  useHomeEtaRegistration(registerRefresh, refresh);
  const view = reading ? homeLightRailPreview(reading, now, favorite.lineId) : undefined;
  const labels = copy.lightRail.nextTrains;
  const kind = view?.kind ?? (busy === false ? 'failed' : 'loading');
  const notice = kind === 'ready' ? undefined : kind === 'empty' ? copy.homeRailway.noMatching
    : { ...labels, ...copy.homeRailway.status }[kind];
  return (
    <RailwayCard favorite={favorite} notice={notice}>
      {view?.kind === 'ready' && view.platforms.map(({ id, train }) => (
        <View key={id} style={styles.lightRailForecast}>
          <View style={styles.lightRailCopy}>
            <AppText variant="detail">{copy.mtr.nextTrains.towards(
              (locale === 'en' ? train.destination.en ?? train.destination.zh : train.destination.zh ?? train.destination.en) ?? labels.unknownDestination,
            )}</AppText>
            <AppText variant="caption" tone="muted">{labels.platform(id)} · {labels[train.event]}</AppText>
          </View>
          <AppText variant="homeCardTitle" tone="primary" style={[styles.time, styles.lightRailTime]}>{lightRailTimeText(train, labels)}</AppText>
        </View>
      ))}
      {view?.kind === 'ready' && view.hasMore && <AppText variant="caption" tone="muted">{copy.homeRailway.morePredictions}</AppText>}
    </RailwayCard>
  );
}

function RailwayCard({ favorite, notice, children }: {
  favorite: RailwayFavorite;
  notice?: string;
  children?: ReactNode;
}) {
  const { copy, locale } = useLanguage();
  const router = useRouter();
  const names = resolveRailwayService(favorite) ?? { line: favorite.lineSnapshot, station: favorite.stationSnapshot };
  const nameKey = locale === 'en' ? 'en' : 'zh';
  const line = favorite.mode === 'mtr' ? names.line[nameKey] : copy.lightRail.route(favorite.lineId);
  const station = names.station[nameKey];
  const href = railwayFavoriteHref(favorite);
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
      {href ? <Pressable accessibilityRole="button" onPress={() => router.push(href)}
        style={({ pressed }) => [styles.heading, pressed && styles.pressed]}>
        {heading}<Icon name="chevron.right" size={12} color={colors.muted} />
      </Pressable> : <View style={styles.heading}>{heading}</View>}
      <View style={styles.body}>
        {!!notice && <AppText variant="detail" tone="muted">{notice}</AppText>}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.md, gap: space.sm },
  heading: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touchTarget },
  badge: { width: 32, height: 32, borderRadius: radius.control, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  body: { paddingTop: space.sm, gap: space.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  forecast: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  time: { flexShrink: 1, maxWidth: '38%', textAlign: 'right', fontVariant: ['tabular-nums'] },
  lightRailForecast: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.sm, rowGap: space.xs },
  lightRailCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 128, minWidth: 0 },
  lightRailTime: { maxWidth: '100%', marginStart: 'auto' },
  pressed: { backgroundColor: colors.pressed },
});
