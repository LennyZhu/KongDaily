import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useBusEta } from '@/bus-eta-hooks';
import { describeEta, etaEntryNotes, readEtaTarget, type EtaTarget } from '@/bus-eta';
import { changeBusFavorites, loadBusFavorites, useBusFavorites, useUnavailableFavorites } from '@/bus-favorite-hooks';
import { busFavoriteId } from '@/bus-favorites';
import { routePlaceName, type RouteName } from '@/bus-routes';
import { useRouteStopNames } from '@/bus-stop-hooks';
import { BusAction } from '@/components/bus-ui';
import { AppText, EmptyState, Icon, Screen } from '@/components/ui';
import { useLanguage } from '@/language';
import { colors, homeColors, radius, space, touchTarget } from '@/theme';

const hongKong = 'Asia/Hong_Kong';

export default function BusEtaScreen() {
  const params = useLocalSearchParams();
  const { copy } = useLanguage();
  const router = useRouter();
  const target = readEtaTarget(params);
  if (!target) {
    return (
      <Screen hasHeader>
        <EmptyState icon="exclamationmark.circle" title={copy.busEta.invalidStop} />
        <BusAction label={copy.busDetail.backToSearch} onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/bus');
        }} />
      </Screen>
    );
  }
  const name = (value: string | string[] | undefined) => typeof value === 'string' ? value : '';
  const destinationStopId = name(params.destinationStopId);

  return (
    <EtaDetails key={JSON.stringify(target)} initialTarget={target}
      station={{ zh: name(params.stationZh), en: name(params.stationEn) }}
      destination={{ zh: name(params.destinationZh), en: name(params.destinationEn) }}
      destinationStopId={target.source === 'citybus' && /^\d{6}$/.test(destinationStopId) ? destinationStopId : undefined} />
  );
}

function EtaDetails({ initialTarget, station, destination, destinationStopId }: {
  initialTarget: EtaTarget;
  station: RouteName;
  destination: RouteName;
  destinationStopId?: string;
}) {
  const [target] = useState(initialTarget);
  const { copy, locale } = useLanguage();
  const eta = copy.busEta;
  const favorites = copy.busFavorites;
  const { items, status: favoritesStatus } = useBusFavorites();
  const id = busFavoriteId(target);
  const saved = items.find((item) => item.id === id);
  const related = useMemo(() => saved ? [saved] : [], [saved]);
  const unavailable = useUnavailableFavorites(related).has(id);
  const { snapshot, error, now, loading, canRefresh, refresh } = useBusEta(target, locale, !unavailable);
  const changePending = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const needsStation = !station.zh && !station.en;
  const needsDestination = !destination.zh && !destination.en;
  const stopIds = useMemo(() => [...new Set([
    ...(needsStation ? [target.stopId] : []),
    ...(needsDestination && destinationStopId ? [destinationStopId] : []),
  ])], [needsStation, needsDestination, target.stopId, destinationStopId]);
  const { names } = useRouteStopNames(target.source === 'nlb' ? undefined : target.source, stopIds);
  const resolvedStop = names[target.stopId];
  const stationName = resolvedStop?.snapshot?.stop.name ?? station;
  const stopName = routePlaceName(stationName, locale)
    || (target.source !== 'nlb' && !resolvedStop?.error ? copy.busDetail.loadingName : copy.busDetail.unavailableName);

  const view = describeEta(snapshot, error, now, loading, locale, eta);
  const upcoming = unavailable ? [] : view.upcoming.slice(0, 4);
  const destinationName = upcoming.find((entry) => entry.destination)?.destination
    ?? snapshot?.entries.find((entry) => entry.destination)?.destination
    ?? (destinationStopId ? names[destinationStopId]?.snapshot?.stop.name : undefined)
    ?? destination;
  const towards = routePlaceName(destinationName, locale);
  const direction = target.source === 'nlb' ? undefined : copy.bus.directions[target.direction];
  const operator = copy.bus.sources[target.source];
  const context = [operator, direction, target.source === 'kmbLwb' ? copy.bus.service(target.serviceType) : undefined]
    .filter(Boolean).join(' · ');

  const notices = unavailable ? [] : view.notices;
  const favoriteDisabled = favoritesStatus !== 'ready' || saving;

  async function toggleFavorite() {
    if (changePending.current || favoritesStatus !== 'ready') return;
    changePending.current = true;
    setSaving(true);
    setSaveFailed(false);
    const result = await changeBusFavorites(saved ? { type: 'remove', id } : {
      type: 'save', visit: { target, station: stationName, destination: destinationName, destinationStopId },
    });
    setSaveFailed(result === 'failed');
    changePending.current = false;
    setSaving(false);
  }

  const time = (value: number) => new Date(value).toLocaleTimeString(locale, {
    timeZone: hongKong, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });

  return (
    <Screen hasHeader contentStyle={styles.content}>
      <View style={[styles.card, styles.station]}>
        <View style={styles.stationIcon}><Icon name="mappin" size={24} /></View>
        <View style={styles.copy}>
          <AppText variant="section" accessibilityRole="header">{stopName}</AppText>
          <AppText variant="title">
            {target.number}{towards ? ` · ${copy.busDetail.towards(towards)}` : ''}
          </AppText>
          <AppText variant="detail" tone="muted">
            {context} · {copy.busDetail.stopOrder(target.stopSeq)}
          </AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={saved ? favorites.remove : favorites.save}
          accessibilityState={{ selected: !!saved, disabled: favoriteDisabled, busy: saving }}
          disabled={favoriteDisabled} onPress={() => void toggleFavorite()}
          style={({ pressed }) => [styles.favoriteToggle, saved && styles.favoriteSelected, pressed && styles.pressed]}>
          {saving ? <ActivityIndicator color={colors.primary} size="small" />
            : <Icon name={saved ? 'bookmark.fill' : 'bookmark'} size={21} />}
          <AppText tone="primary" variant="caption" style={styles.center}>{saved ? favorites.saved : favorites.save}</AppText>
        </Pressable>
      </View>

      {(saveFailed || favoritesStatus === 'error') && (
        <View style={styles.notice} accessibilityRole="alert">
          <AppText variant="detail" tone="error">{saveFailed ? favorites.saveError : favorites.loadError}</AppText>
          {favoritesStatus === 'error' && <BusAction label={copy.bus.retry} onPress={() => void loadBusFavorites()} />}
        </View>
      )}

      <LinearGradient colors={[colors.primary, homeColors.weatherDeep]} style={styles.hero}>
        <View style={styles.heroHeader}>
          <View style={[styles.inline, styles.copy]}>
            <Icon name="bus" color={colors.onPrimary} size={22} />
            <AppText variant="title" tone="onPrimary" accessibilityRole="header" style={styles.flex}>{eta.arrivals}</AppText>
          </View>
          <Pressable onPress={refresh} disabled={!canRefresh} accessibilityRole="button"
            accessibilityLabel={eta.refresh} accessibilityState={{ disabled: !canRefresh, busy: loading }}
            style={({ pressed }) => [styles.refresh, pressed && styles.pressed]}>
            {loading && !unavailable ? <ActivityIndicator color={colors.primary} size="small" />
              : <Icon name="arrow.clockwise" size={15} />}
            <AppText variant="caption" tone="primary" style={styles.flex}>
              {loading && snapshot && !unavailable ? eta.refreshing : eta.refresh}
            </AppText>
          </Pressable>
        </View>
        {upcoming.length > 0 ? (
          <View style={styles.etaPair}>
            {upcoming.slice(0, 2).map((entry, index) => (
              <View key={index} style={[styles.featured, index > 0 && styles.divider]}>
                {entry.minutes === 0 ? <AppText variant="section" tone="onPrimary">{eta.due}</AppText> : (
                  <AppText variant="detail" tone="onPrimary">
                    {eta.minutes.prefix}<AppText variant="display" tone="onPrimary" style={styles.digits}>{entry.minutes}</AppText>{eta.minutes.suffix}
                  </AppText>
                )}
                <AppText variant="detail" tone="onPrimaryMuted" style={styles.digits}>{time(entry.arrivalAt)}</AppText>
                {!!etaEntryNotes(entry, locale) && <AppText variant="brandSubtitle" tone="onPrimaryMuted">{etaEntryNotes(entry, locale)}</AppText>}
              </View>
            ))}
          </View>
        ) : (
          <AppText variant="title" tone="onPrimary" accessibilityLiveRegion="polite" style={styles.status}>
            {unavailable ? favorites.unavailable : view.status}
          </AppText>
        )}
      </LinearGradient>

      {upcoming.length > 2 && (
        <View style={styles.card}>
          <AppText variant="homeCardTitle" accessibilityRole="header">{eta.later}</AppText>
          {upcoming.slice(2).map((entry, index) => (
            <View key={index} style={styles.laterRow}>
              <Icon name="bus" size={17} />
              <View style={styles.copy}>
                <AppText variant="homeCardTitle">
                  {entry.minutes === 0 ? eta.due : `${eta.minutes.prefix}${entry.minutes}${eta.minutes.suffix}`}
                </AppText>
                {!!etaEntryNotes(entry, locale) && <AppText variant="brandSubtitle" tone="muted">{etaEntryNotes(entry, locale)}</AppText>}
              </View>
              <AppText variant="detail" tone="muted" style={styles.digits}>{time(entry.arrivalAt)}</AppText>
            </View>
          ))}
        </View>
      )}

      {view.errorText && !unavailable && (
        <View style={[styles.notice, styles.inline]} accessibilityRole="alert">
          <Icon name="exclamationmark.circle" color={colors.error} size={20} />
          <View style={styles.copy}>
            {!!snapshot && <AppText variant="homeCardTitle">{eta.failed}</AppText>}
            <AppText variant="detail" tone="muted">{view.errorText}</AppText>
          </View>
        </View>
      )}
      {notices.length > 0 && (
        <View style={[styles.notice, styles.inline]}>
          <Icon name="info.circle" size={21} />
          <View style={styles.copy}>
            <AppText variant="homeCardTitle">{eta.operatorNotes}</AppText>
            {notices.map((note) => <AppText key={note} variant="detail" tone="muted">{note}</AppText>)}
          </View>
        </View>
      )}
      <View style={styles.provenance}>
        <AppText variant="caption" tone="primary">{eta.source(operator)}</AppText>
        {view.updateText && <AppText variant="detail" tone="muted">{view.updateText}</AppText>}
        {target.repeatedStop && <AppText variant="detail" tone="muted">{eta.repeatedStop}</AppText>}
        <AppText variant="brandSubtitle" tone="muted">{eta.estimate}</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.lg },
  card: {
    padding: space.lg, borderRadius: radius.media, backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: space.sm,
  },
  station: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  stationIcon: {
    width: touchTarget, height: touchTarget, borderRadius: radius.control,
    backgroundColor: colors.tintedBackground, alignItems: 'center', justifyContent: 'center',
  },
  favoriteToggle: {
    minHeight: touchTarget, minWidth: 62, maxWidth: '34%', padding: space.xs,
    alignItems: 'center', justifyContent: 'center', gap: space.xs, borderRadius: radius.control,
  },
  favoriteSelected: { backgroundColor: colors.tint },
  center: { textAlign: 'center' },
  copy: { flex: 1, minWidth: 0, gap: space.xs },
  flex: { flexShrink: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  hero: { borderRadius: radius.largeCard, padding: space.lg, gap: space.md },
  heroHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  refresh: {
    flexDirection: 'row', alignItems: 'center', gap: space.xs, maxWidth: '45%', minHeight: touchTarget,
    paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: colors.tintedBackground,
  },
  pressed: { opacity: 0.76 },
  etaPair: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.sm },
  featured: { flexBasis: 110, flexGrow: 1, minWidth: 0, gap: space.xs, paddingHorizontal: space.sm },
  divider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: homeColors.weatherDivider, paddingLeft: space.md },
  digits: { fontVariant: ['tabular-nums'] },
  status: { paddingVertical: space.sm },
  laterRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, minHeight: touchTarget,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  notice: {
    alignItems: 'flex-start', gap: space.md, borderRadius: radius.card,
    padding: space.lg, backgroundColor: homeColors.busEmpty,
  },
  provenance: { paddingHorizontal: space.xs, gap: space.xs },
});
