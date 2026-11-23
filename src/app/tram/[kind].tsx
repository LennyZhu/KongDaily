import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppText, EmptyState, Filters, Icon, PageHeading, Screen } from '@/components/ui';
import { tramRouteHref, tramStopHref } from '@/global-search-navigation';
import { useLanguage } from '@/language';
import { colors, radius, space, touchTarget } from '@/theme';
import { tramDirectionLabel } from '@/tram-direction';
import { tramFeatureEnabled } from '@/tram-feature';
import {
  getTramRoute, getTramStop, getTramStopServiceStatus, getTramVisitsForStop, tramNoticeAttribution, tramSource,
  type TramDirection, type TramRoute, type TramStop, type TramStopServiceStatus, type TramVisit,
} from '@/tram-static';

function parseId(value: unknown) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : undefined;
}

function OfficialLink({ label, url }: { label: string; url: string }) {
  const { copy } = useLanguage();
  return (
    <Pressable accessibilityRole="link" accessibilityHint={copy.compliance.externalLink} style={styles.action}
      onPress={() => { void Linking.openURL(url).catch(() => Alert.alert(copy.compliance.linkFailed)); }}>
      <Icon name="arrow.up.right" size={14} />
      <AppText variant="detail" tone="primary" style={styles.fit}>{label}</AppText>
    </Pressable>
  );
}

function SourceCard({ showStopNote = false }: { showStopNote?: boolean }) {
  const { copy: { tram }, locale } = useLanguage();
  return (
    <View style={styles.panel}>
      <AppText variant="title" accessibilityRole="header">{tram.source}</AppText>
      <AppText variant="detail" tone="muted">{tram.dataDate(tramSource.sourceUpdatedAt.slice(0, 10))}</AppText>
      {showStopNote && <AppText variant="detail" tone="muted">{tram.staticStopNote}</AppText>}
      <OfficialLink label={tramSource.attribution[locale]} url={tramSource.dataset} />
    </View>
  );
}

function StopNames({ stop }: { stop: TramStop }) {
  const { locale } = useLanguage();
  return (
    <>
      <AppText variant="homeCardTitle">{stop.localizedStopNames[locale]}</AppText>
      <AppText variant="detail" tone="muted">{stop.localizedStopNames[locale === 'en' ? 'zh-HK' : 'en']}</AppText>
    </>
  );
}

function ServiceNotice({ status }: { status: TramStopServiceStatus }) {
  const { copy: { tram }, locale } = useLanguage();
  const closed = status.serviceStatus === 'temporarily_closed';
  return (
    <View style={styles.panel}>
      <AppText variant="title" tone={closed ? 'error' : 'text'} accessibilityRole={closed ? 'alert' : undefined}>
        {tram.status[status.serviceStatus]}
      </AppText>
      {status.notice && <>
        <AppText variant="detail">{status.notice.description[locale]}</AppText>
        <AppText variant="caption" tone="muted">{tramNoticeAttribution[locale]} · {tram.checkedOn(status.notice.checkedOn)}</AppText>
        <OfficialLink label={tram.officialNotice} url={status.notice.url} />
      </>}
    </View>
  );
}

function TramRouteDetail({ route, initialDirection, selectedVisit }: {
  route: TramRoute; initialDirection: TramDirection; selectedVisit?: TramVisit;
}) {
  const { copy: { tram }, locale } = useLanguage();
  const router = useRouter();
  const [direction, setDirection] = useState(initialDirection);
  const { visits } = direction;
  const selected = selectedVisit?.directionId === direction.directionId ? selectedVisit : undefined;
  const closed = [...new Set(visits.map(({ stopId }) => stopId))].flatMap((stopId) => {
    const status = getTramStopServiceStatus(stopId);
    return status?.serviceStatus === 'temporarily_closed' ? [{ stopId, status }] : [];
  });

  return (
    <Screen hasHeader>
      <PageHeading title={route.localizedRouteNames[locale]} description={tram.information} />
      <View style={styles.section}>
        <AppText variant="title" accessibilityRole="header">{tram.directions}</AppText>
        <Filters options={route.directions.map((bound) => [String(bound.directionId), tramDirectionLabel(bound, tram, locale)] as const)}
          selected={String(direction.directionId)} onSelect={(id) => {
            const bound = route.directions.find(({ directionId }) => String(directionId) === id);
            if (bound) setDirection(bound);
          }} />
        <View style={styles.panel}>
          <AppText variant="caption" tone="muted">{tram.from}</AppText>
          <AppText variant="title">{visits[0].stop.localizedStopNames[locale]}</AppText>
          <AppText variant="caption" tone="muted">{tram.to}</AppText>
          <AppText variant="title">{visits[visits.length - 1].stop.localizedStopNames[locale]}</AppText>
        </View>
      </View>
      {closed.map(({ stopId, status }) => <ServiceNotice key={stopId} status={status} />)}
      {selected && <View style={[styles.panel, styles.selected]}>
        <AppText variant="detail" tone="primary">{tram.chosenStop} · {selected.stopSequence}</AppText>
        <StopNames stop={selected.stop} />
      </View>}
      <View style={styles.section}>
        <AppText variant="homeHeading" accessibilityRole="header">{tram.sequence}</AppText>
        <AppText variant="detail" tone="muted">{tram.unknownHint}</AppText>
        <View style={styles.list}>
          {visits.map(({ key, stop, stopId, stopSequence, pickDrop }, index) => {
            const state = getTramStopServiceStatus(stopId)?.serviceStatus ?? 'unknown';
            return (
              <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: key === selected?.key }}
                style={({ pressed }) => [styles.row, index > 0 && styles.divider, key === selected?.key && styles.selected, pressed && styles.pressed]}
                onPress={() => router.push(tramStopHref(stopId))}>
                <AppText variant="detail" tone="muted" style={styles.order}>{stopSequence}</AppText>
                <View style={styles.rowCopy}>
                  <StopNames stop={stop} />
                  {state !== 'unknown' && <AppText variant="caption" tone={state === 'temporarily_closed' ? 'error' : 'primary'}>{tram.status[state]}</AppText>}
                  {state !== 'temporarily_closed' && pickDrop !== 3
                    && <AppText variant="caption" tone="muted">{tram.pickDrop[pickDrop]}</AppText>}
                </View>
                <Icon name="chevron.right" size={13} color={colors.muted} />
              </Pressable>
            );
          })}
        </View>
      </View>
      <SourceCard />
    </Screen>
  );
}

function TramStopDetail({ stop }: { stop: TramStop }) {
  const { copy: { tram }, locale } = useLanguage();
  const router = useRouter();
  const status = getTramStopServiceStatus(stop.stopId) ?? { serviceStatus: 'unknown' };
  const showNotice = status.serviceStatus === 'temporarily_closed' || (status.serviceStatus === 'active' && !!status.notice);
  return (
    <Screen hasHeader>
      <PageHeading title={stop.localizedStopNames[locale]} description={stop.localizedStopNames[locale === 'en' ? 'zh-HK' : 'en']} />
      <AppText variant="detail" tone="muted">{tram.stopId(stop.stopId)}</AppText>
      {showNotice && <ServiceNotice status={status} />}
      <View style={styles.section}>
        <AppText variant="homeHeading" accessibilityRole="header">{tram.visits}</AppText>
        <View style={styles.list}>
          {getTramVisitsForStop(stop.stopId).map((visit, index) => {
            const route = getTramRoute(visit.routeId);
            const direction = route?.directions.find(({ directionId }) => directionId === visit.directionId);
            if (!route || !direction) return null;
            const terminus = direction.visits[direction.visits.length - 1].stop.localizedStopNames[locale];
            return (
              <Pressable key={visit.key} accessibilityRole="button"
                onPress={() => router.push(tramRouteHref(route.routeId, visit))}
                style={({ pressed }) => [styles.row, index > 0 && styles.divider, pressed && styles.pressed]}>
                <View style={styles.rowCopy}>
                  <AppText variant="homeCardTitle">{route.localizedRouteNames[locale]}</AppText>
                  <AppText variant="detail">{tramDirectionLabel(direction, tram, locale)} · {tram.towards(terminus)}</AppText>
                  {status.serviceStatus !== 'temporarily_closed'
                    && <AppText variant="caption" tone="muted">{tram.pickDrop[visit.pickDrop]}</AppText>}
                </View>
                <Icon name="chevron.right" size={13} color={colors.muted} />
              </Pressable>
            );
          })}
        </View>
      </View>
      <SourceCard showStopNote />
    </Screen>
  );
}

export default function TramScreen() {
  const params = useLocalSearchParams();
  const { copy: { tram } } = useLanguage();
  if (!tramFeatureEnabled) return <Screen hasHeader><EmptyState icon="tram" title={tram.notOpen} /></Screen>;
  const id = parseId(params.id);
  if (id !== undefined && params.kind === 'stop') {
    const stop = getTramStop(id);
    if (stop) return <TramStopDetail stop={stop} />;
  }
  if (id !== undefined && params.kind === 'route') {
    const route = getTramRoute(id);
    if (route) {
      const direction = route.directions.find(({ directionId }) => String(directionId) === params.directionId) ?? route.directions[0];
      const selected = String(direction.directionId) === params.directionId
        ? direction.visits.find(({ stopSequence, stopId }) => String(stopSequence) === params.stopSequence && String(stopId) === params.stopId)
        : undefined;
      return <TramRouteDetail key={`${id}:${direction.directionId}:${selected?.key ?? ''}`}
        route={route} initialDirection={direction} selectedVisit={selected} />;
    }
  }
  return <Screen hasHeader><EmptyState icon="tram" title={tram.unavailable} /></Screen>;
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  panel: { gap: space.sm, padding: space.lg, borderRadius: radius.card, backgroundColor: colors.surface,
    borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
  list: { borderRadius: radius.card, backgroundColor: colors.surface, borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { minHeight: touchTarget, minWidth: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  rowCopy: { flex: 1, minWidth: 0, gap: space.xs },
  order: { minWidth: 24, fontVariant: ['tabular-nums'] },
  divider: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
  pressed: { backgroundColor: colors.pressed },
  selected: { backgroundColor: colors.tint },
  action: { minHeight: touchTarget, minWidth: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  fit: { flexShrink: 1 },
});
