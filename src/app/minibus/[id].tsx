import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { GmbFeedback } from '@/components/gmb-status';
import { AppText, EmptyState, Filters, Icon, PageHeading, Screen } from '@/components/ui';
import { gmbClient } from '@/gmb-client';
import { gmbEtaView, gmbIsDirection, gmbPositiveId, type GmbDirection, type GmbRoute, type GmbRouteSeq, type GmbVisit, type GmbVisitKey } from '@/gmb-data';
import { useGmbQuery } from '@/gmb-query-hooks';
import { gmbRepeatedStopIds, gmbText, gmbVisitKey } from '@/gmb-search';
import { useLanguage } from '@/language';
import { useNextTrainReading } from '@/next-train-hooks';
import { formatHongKongTime } from '@/next-train-time';
import { colors, radius, space, touchTarget } from '@/theme';

const source = 'https://data.gov.hk/en-data/dataset/hk-td-sm_7-real-time-arrival-data-of-gmb';

type VisitSelection = Pick<GmbVisitKey, 'stopId' | 'stopSeq'>;

function numericParam(value?: string) {
  return typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
}

export default function MinibusRouteScreen() {
  const { id, routeSeq: seq, stopSeq: visitSeq, stopId: visitId } = useLocalSearchParams<{
    id?: string; routeSeq?: string; stopSeq?: string; stopId?: string;
  }>();
  const { copy } = useLanguage();
  const routeId = numericParam(id);
  const routeSeq = numericParam(seq);
  const direction = gmbIsDirection(routeSeq) ? routeSeq : undefined;
  const stopSeq = numericParam(visitSeq);
  const stopId = numericParam(visitId);
  const visit = direction && gmbPositiveId(stopSeq) && gmbPositiveId(stopId) ? { stopId, stopSeq } : undefined;
  return (
    <Screen hasHeader>
      {gmbPositiveId(routeId) ? <RouteData key={[routeId, direction, visit?.stopSeq, visit?.stopId].join(':')} routeId={routeId}
        initialDirection={direction} initialVisit={visit} />
        : <EmptyState icon="bus.fill" title={copy.minibus.routeMissing} />}
    </Screen>
  );
}

function RouteData({ routeId, initialDirection, initialVisit }: {
  routeId: number; initialDirection?: GmbRouteSeq; initialVisit?: VisitSelection;
}) {
  const { copy, locale } = useLanguage();
  const labels = copy.minibus;
  const read = useCallback((signal: AbortSignal) => gmbClient.readRouteById(routeId, signal), [routeId]);
  const { result, retry } = useGmbQuery(read);
  const payload = result?.payload;
  const route = payload?.kind === 'ready' ? payload.data[0] : undefined;

  if (!payload) return <GmbFeedback text={labels.loadingRoute} busy />;
  if (payload.kind !== 'ready') return <GmbFeedback text={labels.routeFailed} onRetry={retry} />;
  if (!route) return <EmptyState icon="bus.fill" title={labels.routeMissing} />;
  return (
    <>
      <PageHeading title={labels.routeTitle(route.routeCode)}
        description={[labels.regions[route.region], gmbText(route.description, locale)].filter(Boolean).join(' · ')} />
      <RouteDirections route={route} initialDirection={initialDirection} initialVisit={initialVisit} />
      <Pressable accessibilityRole="link" accessibilityHint={copy.compliance.externalLink}
        onPress={() => { void Linking.openURL(source).catch(() => Alert.alert(copy.compliance.linkFailed)); }}
        style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
        <AppText variant="detail" tone="primary" style={styles.flex}>{labels.source}</AppText>
        <Icon name="arrow.up.right" size={14} />
      </Pressable>
    </>
  );
}

function RouteDirections({ route, initialDirection, initialVisit }: {
  route: GmbRoute; initialDirection?: GmbRouteSeq; initialVisit?: VisitSelection;
}) {
  const { copy, locale } = useLanguage();
  const labels = copy.minibus;
  const first = route.directions.find(({ routeSeq }) => routeSeq === 1) ?? route.directions[0];
  const directionAvailable = route.directions.some(({ routeSeq }) => routeSeq === initialDirection);
  const [requested, setRequested] = useState(initialVisit);
  const [selected, select] = useState(String(directionAvailable ? initialDirection : first.routeSeq));
  const direction = route.directions.find(({ routeSeq }) => String(routeSeq) === selected) ?? first;
  const description = gmbText(direction.remarks, locale);
  return (
    <View style={styles.section}>
      {!!initialDirection && !directionAvailable && <GmbFeedback text={labels.directionChanged} />}
      <AppText variant="homeHeading" accessibilityRole="header">
        {gmbText(direction.origin, locale)} → {gmbText(direction.destination, locale)}
      </AppText>
      {route.directions.length > 1 && <>
        <AppText variant="caption" tone="muted">{labels.direction}</AppText>
        <Filters options={route.directions.map((option) => [String(option.routeSeq), gmbText(option.destination, locale)] as const)}
          selected={selected} onSelect={(value) => {
            if (value === selected) return;
            setRequested(undefined);
            select(value);
          }} />
      </>}
      {!!description && <AppText variant="detail" tone="muted">{description}</AppText>}
      <DirectionStops key={direction.routeSeq} direction={direction}
        initialVisit={direction.routeSeq === initialDirection ? requested : undefined} />
    </View>
  );
}

function DirectionStops({ direction: { routeId, routeSeq }, initialVisit }: {
  direction: GmbDirection; initialVisit?: VisitSelection;
}) {
  const { copy, locale } = useLanguage();
  const labels = copy.minibus;
  const read = useCallback((signal: AbortSignal) => gmbClient.readRouteStops({ routeId, routeSeq }, signal), [routeId, routeSeq]);
  const { result, retry } = useGmbQuery(read);
  const [selected, select] = useState<string>();
  const payload = result?.payload;
  const visits = payload?.kind === 'ready' ? payload.data.visits : undefined;
  const repeated = visits ? gmbRepeatedStopIds(visits) : undefined;
  const matched = initialVisit && visits?.find((visit) => visit.stopId === initialVisit.stopId && visit.stopSeq === initialVisit.stopSeq);
  const activeKey = selected ?? (matched ? gmbVisitKey(matched) : '');
  const showUnmatched = !!initialVisit && !!visits && !matched;
  return (
    <View style={styles.section}>
      <AppText variant="homeHeading" accessibilityRole="header">{labels.stops}</AppText>
      {!payload ? <GmbFeedback text={labels.loadingStops} busy />
        : payload.kind !== 'ready' ? <GmbFeedback text={labels.stopsFailed} onRetry={retry} />
          : !visits?.length ? <EmptyState icon="mappin" title={labels.noStops} />
            : <>
              <AppText variant="detail" tone="muted">{showUnmatched ? labels.visitChanged : labels.chooseStop}</AppText>
              <View style={styles.stopList}>
                {visits.map((visit, index) => {
                  const key = gmbVisitKey(visit);
                  const name = gmbText(visit.name, locale);
                  const open = key === activeKey;
                  return (
                    <View key={key} style={index > 0 && styles.divider}>
                      <Pressable accessibilityRole="button" accessibilityLabel={labels.stopLabel(visit.stopSeq, name)}
                        accessibilityState={{ expanded: open }} onPress={() => select(open ? '' : key)}
                        style={({ pressed }) => [styles.stop, open && styles.selected, pressed && styles.pressed]}>
                        <AppText variant="caption" tone="primary">{visit.stopSeq}</AppText>
                        <AppText variant="detail" style={styles.flex}>{name}</AppText>
                        <Icon name={open ? 'chevron.up' : 'chevron.down'} size={13} />
                      </Pressable>
                      {open && (repeated?.has(visit.stopId)
                        ? <View style={styles.forecast}><GmbFeedback text={labels.etaAmbiguous} /></View>
                        : <StopForecast visit={visit} first={index === 0} />)}
                    </View>
                  );
                })}
              </View>
            </>}
    </View>
  );
}

function StopForecast({ visit, first }: { visit: GmbVisit; first: boolean }) {
  const { copy: { minibus: labels }, locale } = useLanguage();
  const read = useCallback(() => gmbClient.readEta(visit), [visit]);
  const { reading, busy, now, refresh } = useNextTrainReading(gmbVisitKey(visit), read, undefined, true);
  const view = reading ? gmbEtaView(reading, now) : undefined;
  const refreshDisabled = busy || Boolean(reading && now.monotonic < reading.retryAt);
  const message = !view ? labels.loadingEta : view.kind === 'forecast' ? undefined
    : view.kind === 'stale' ? labels.etaStale : view.kind === 'empty' ? labels.etaEmpty
      : view.kind === 'disabled' ? gmbText(view.description, locale) || labels.etaDisabled
        : view.kind === 'timeout' ? labels.etaTimeout
          : view.kind === 'rateLimited' ? labels.etaRateLimited : labels.etaFailed;
  return (
    <View style={styles.forecast}>
      <View style={styles.toolbar}>
        <AppText variant="homeCardTitle" accessibilityRole="header" style={styles.flex}>
          {first ? labels.firstStopEtaTitle : labels.etaTitle}
        </AppText>
        <Pressable accessibilityRole="button" accessibilityLabel={labels.refresh} accessibilityState={{ disabled: refreshDisabled, busy }}
          disabled={refreshDisabled} onPress={refresh}
          style={({ pressed }) => [styles.refresh, (pressed || refreshDisabled) && styles.pressed]}>
          {busy ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="arrow.clockwise" size={16} />}
        </Pressable>
      </View>
      {!!message && <AppText variant="detail" tone="muted" accessibilityLiveRegion="polite">{message}</AppText>}
      {view?.kind === 'forecast' && view.entries.map((entry) => {
        const remark = gmbText(entry.remarks, locale);
        if (entry.kind === 'notice') return <AppText key={entry.sequence} variant="detail" tone="muted">{remark}</AppText>;
        const time = formatHongKongTime(entry.timestamp);
        // The source does not distinguish typed arrival and departure times at the first stop.
        const label = entry.kind === 'scheduled' ? labels.scheduled
          : first && entry.imminent ? labels.dueSoonService
            : entry.imminent ? labels.due : entry.remainingMinutes === undefined ? undefined : labels.minutes(entry.remainingMinutes);
        return (
          <View key={entry.sequence} style={styles.etaRow}>
            {!!label && <AppText variant="detail" tone="primary" style={styles.flex}>{label}</AppText>}
            <AppText variant="detail">{time}</AppText>
          </View>
        );
      })}
      {view && 'generatedAt' in view && (
        <AppText variant="caption" tone="muted">{labels.updates(formatHongKongTime(view.generatedAt))}</AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  stopList: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radius.card,
    backgroundColor: colors.surface, overflow: 'hidden' },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  stop: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.md, paddingVertical: space.sm },
  selected: { backgroundColor: colors.tint },
  pressed: { opacity: 0.65 },
  forecast: { padding: space.md, gap: space.sm, backgroundColor: colors.tintedBackground },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  refresh: { minHeight: touchTarget, minWidth: touchTarget, justifyContent: 'center', alignItems: 'center' },
  etaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: space.sm },
  link: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
