import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { changeBusFavorites, loadBusFavorites, useBusFavorites, useUnavailableFavorites } from '@/bus-favorite-hooks';
import { homeBusLimit, pinnedBuses, type FavoriteChange } from '@/bus-favorites';
import { BusAction } from '@/components/bus-ui';
import { facilityVisuals } from '@/components/nearby-facilities-map';
import { FavoriteAction, FavoriteBusRow, savedBusStyles } from '@/components/saved-bus-ui';
import { AppText, EmptyState, Filters, Icon, PageHeading, Screen } from '@/components/ui';
import { loadFacilityFavorites, removeSavedFacility, useFacilityFavorites } from '@/facility-favorite-hooks';
import { resolveFacilityFavorite } from '@/facility-favorites';
import { facilityText, facilityType } from '@/facilities';
import { useLanguage } from '@/language';
import { loadRailwayFavorites, removeSavedRailway, useRailwayFavorites } from '@/railway-favorite-hooks';
import { railwayFavoriteHref, resolveRailwayService, type RailwayMode } from '@/railway-favorites';
import { colors, radius, space, touchTarget } from '@/theme';

const categories = ['all', 'buses', 'mtr', 'lightRail', 'places'] as const;

export default function SavedScreen() {
  const { copy } = useLanguage();
  const router = useRouter();
  const { category: requestedCategory } = useLocalSearchParams<{ category?: string }>();
  const category = categories.find((key) => key === requestedCategory) ?? 'all';

  return (
    <Screen>
      <View style={styles.heading}>
        <PageHeading title={copy.tabs.saved} />
        <Link href="/settings" asChild>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.settings, pressed && styles.pressed]}
          >
            <Icon name="gearshape" size={19} />
            <AppText variant="detail" tone="primary">{copy.settings.title}</AppText>
          </Pressable>
        </Link>
      </View>
      <Filters
        options={categories.map((key) => [key, copy.saved.categories[key]])}
        selected={category}
        onSelect={(key) => router.setParams({ category: key })}
      />
      {(category === 'all' || category === 'buses') && <SavedBuses emptyTitle={copy.saved.empty.buses} />}
      {(category === 'all' || category === 'mtr' || category === 'lightRail') && (
        <SavedRailways mode={category === 'all' ? undefined : category === 'mtr' ? 'mtr' : 'light_rail'} />
      )}
      {(category === 'all' || category === 'places') && <SavedFacilities />}
    </Screen>
  );
}

function SavedBuses({ emptyTitle }: { emptyTitle: string }) {
  const { copy } = useLanguage();
  const router = useRouter();
  const { items, status } = useBusFavorites();
  const unavailable = useUnavailableFavorites(items);
  const pinCount = pinnedBuses(items).length;
  const labels = copy.busFavorites;
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<'failed' | 'limit'>();

  async function change(operation: FavoriteChange) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setFailure(undefined);
    const result = await changeBusFavorites(operation);
    if (result !== 'ok') setFailure(result);
    pending.current = false;
    setBusy(false);
  }

  const heading = (
    <View style={styles.heading}>
      <AppText variant="section" accessibilityRole="header" style={styles.sectionTitle}>{copy.saved.busSection}</AppText>
      <FavoriteAction label={copy.saved.addBus} icon="plus" accessibilityLabel={copy.home.addBus}
        onPress={() => router.push('/bus')} />
    </View>
  );

  if (status === 'loading') return <View style={styles.list}>{heading}<EmptyState icon="clock" title={labels.loading} /></View>;
  if (status === 'error') {
    return (
      <View style={styles.list}>
        {heading}
        <EmptyState icon="exclamationmark.circle" title={labels.loadError} />
        <BusAction label={copy.bus.retry} onPress={() => void loadBusFavorites()} />
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {heading}
      <AppText variant="caption" tone="muted">{labels.pinCount(pinCount, homeBusLimit)}</AppText>
      {failure && (
        <View style={styles.notice} accessibilityRole="alert">
          <AppText variant="detail" tone="error">{failure === 'limit' ? labels.pinLimit(homeBusLimit) : labels.saveError}</AppText>
        </View>
      )}
      {items.length === 0 && <EmptyState icon="bookmark" title={emptyTitle} />}
      {items.map((item) => (
        <View key={item.id} style={savedBusStyles.card}>
          <FavoriteBusRow favorite={item}>
            {item.pinOrder !== null && <AppText variant="caption" tone="primary">{labels.pinPosition(item.pinOrder)}</AppText>}
            {unavailable.has(item.id) && <AppText variant="detail" tone="muted">{labels.unavailable}</AppText>}
          </FavoriteBusRow>
          <View style={styles.actions}>
            <FavoriteAction label={item.pinOrder === null ? labels.pin : labels.unpin}
              icon={item.pinOrder === null ? 'pin' : 'pin.slash'} disabled={busy}
              onPress={() => void change({ type: item.pinOrder === null ? 'pin' : 'unpin', id: item.id })} />
            {item.pinOrder !== null && (
              <>
                <FavoriteAction label={labels.moveUp} icon="arrow.up" disabled={busy || item.pinOrder === 1}
                  onPress={() => void change({ type: 'move', id: item.id, step: -1 })} />
                <FavoriteAction label={labels.moveDown} icon="arrow.down" disabled={busy || item.pinOrder === pinCount}
                  onPress={() => void change({ type: 'move', id: item.id, step: 1 })} />
              </>
            )}
            <FavoriteAction label={labels.remove} icon="bookmark.slash" disabled={busy} destructive
              onPress={() => void change({ type: 'remove', id: item.id })} />
          </View>
        </View>
      ))}
    </View>
  );
}

function SavedRailways({ mode }: { mode?: RailwayMode }) {
  const { copy, locale } = useLanguage();
  const router = useRouter();
  const { items, status, operations } = useRailwayFavorites();
  const labels = copy.railwayFavorites;
  const visible = mode ? items.filter((item) => item.mode === mode) : items;
  return (
    <View style={styles.list}>
      <AppText variant="section" accessibilityRole="header">{labels.title}</AppText>
      {status === 'loading' && <EmptyState icon="clock" title={labels.loading} />}
      {status === 'error' && <>
        <EmptyState icon="exclamationmark.circle" title={labels.loadError} />
        <BusAction label={copy.bus.retry} onPress={() => void loadRailwayFavorites()} />
      </>}
      {status === 'ready' && visible.length === 0 && <EmptyState icon="bookmark" title={labels.empty} detail={labels.emptyDetail} />}
      {visible.map((favorite) => {
        const resolved = resolveRailwayService(favorite);
        const names = resolved ?? { line: favorite.lineSnapshot, station: favorite.stationSnapshot };
        const nameKey = locale === 'en' ? 'en' : 'zh';
        const line = favorite.mode === 'mtr' ? names.line[nameKey] : copy.lightRail.route(favorite.lineId);
        const station = names.station[nameKey];
        const href = railwayFavoriteHref(favorite);
        const operation = operations.get(favorite.id);
        const busy = operation === 'saving';
        const content = <>
          <View style={styles.facilityBadge}><Icon name="train.side.front.car" size={18} /></View>
          <View style={styles.facilityCopy}>
            <AppText variant="caption" tone="primary">{copy.saved.categories[favorite.mode === 'mtr' ? 'mtr' : 'lightRail']}</AppText>
            <AppText variant="homeCardTitle">{line}</AppText>
            <AppText variant="detail">{station}</AppText>
            {!resolved && <AppText variant="detail" tone="muted">{labels.unavailable}</AppText>}
          </View>
        </>;
        return (
          <View key={favorite.id} style={savedBusStyles.card}>
            <View style={styles.facilityLine}>
              {href ? <Pressable accessibilityRole="button" style={({ pressed }) => [styles.facilityRow, pressed && styles.pressed]}
                onPress={() => router.push(href)}>
                {content}<Icon name="chevron.right" color={colors.muted} size={12} />
              </Pressable> : <View style={styles.facilityRow}>{content}</View>}
              <Pressable accessibilityRole="button" disabled={busy}
                accessibilityLabel={operation === 'uncertain' ? copy.bus.retry : copy.saved.facilities.remove(`${line} · ${station}`)}
                accessibilityState={{ busy, disabled: busy }} style={({ pressed }) => [styles.facilityAction, pressed && styles.pressed]}
                onPress={() => void removeSavedRailway(favorite)}>
                {busy ? <ActivityIndicator color={colors.primary} size="small" />
                  : <Icon name={operation === 'uncertain' ? 'arrow.clockwise' : 'bookmark.slash'} size={18} />}
              </Pressable>
            </View>
            {(operation === 'failed' || operation === 'uncertain') && (
              <AppText variant="detail" tone="error" accessibilityRole="alert" style={styles.facilityIssue}>
                {operation === 'uncertain' ? labels.read : labels.write}
              </AppText>
            )}
          </View>
        );
      })}
    </View>
  );
}

function SavedFacilities() {
  const { copy, locale } = useLanguage();
  const router = useRouter();
  const requestNumber = useRef(0);
  const { status, items } = useFacilityFavorites();
  const labels = copy.saved.facilities;
  const actions = copy.nearby.facilityFavorites;

  useEffect(() => { void loadFacilityFavorites(); }, []);

  return (
    <View style={styles.list}>
      <AppText variant="section" accessibilityRole="header">{labels.title}</AppText>
      {status === 'loading' && <EmptyState icon="clock" title={actions.loading} />}
      {status === 'error' && (
        <>
          <EmptyState icon="exclamationmark.circle" title={labels.loadError} />
          <BusAction label={actions.retry} onPress={() => void loadFacilityFavorites()} />
        </>
      )}
      {status === 'ready' && items.length === 0 && (
        <EmptyState icon="bookmark" title={labels.emptyTitle} detail={labels.emptyDetail} />
      )}
      {items.map(({ key, favorite, pending, issue }) => {
        const resolved = resolveFacilityFavorite(favorite);
        const facility = resolved.status === 'available' ? resolved.facility : undefined;
        const category = facility?.category ?? favorite.categorySnapshot;
        const name = facilityText(facility?.name ?? favorite.nameSnapshot, locale);
        const type = facility ? facilityType(facility, locale, copy.nearby) : copy.nearby.categories[category];
        const location = facility?.area ?? facility?.district ?? facility?.address;
        const visual = facilityVisuals[category];
        const content = (
          <>
            <View style={[styles.facilityBadge, { backgroundColor: visual.surface }]}>
              <Icon name={visual.icon} color={visual.color} size={18} />
            </View>
            <View style={styles.facilityCopy}>
              <AppText variant="homeCardTitle">{name}</AppText>
              <AppText variant="caption" tone="muted" numberOfLines={location ? 2 : undefined}>
                {location ? `${type} · ${facilityText(location, locale)}` : type}
              </AppText>
              {resolved.status !== 'available' && (
                <AppText variant="detail" tone="muted">
                  {resolved.status === 'needs_review' ? labels.needsReview : labels.unavailable}
                </AppText>
              )}
            </View>
          </>
        );
        return (
          <View key={key} style={savedBusStyles.card}>
            <View style={styles.facilityLine}>
              {facility && issue !== 'read' ? (
                <Pressable accessibilityRole="button" accessibilityHint={labels.locateHint} disabled={pending}
                  style={({ pressed }) => [styles.facilityRow, pressed && styles.pressed]}
                  onPress={() => router.navigate({
                    pathname: '/(tabs)/nearby',
                    params: {
                      view: 'map', category: facility.category,
                      savedFacilitySource: favorite.source, savedFacilityId: favorite.stableFacilityId,
                      savedFacilityRequest: `${Date.now()}-${++requestNumber.current}`,
                    },
                  })}>
                  {content}
                  <Icon name="chevron.right" color={colors.muted} size={12} />
                </Pressable>
              ) : <View style={styles.facilityRow}>{content}</View>}
              <Pressable accessibilityRole="button"
                accessibilityLabel={issue === 'read' ? actions.retry : labels.remove(name)}
                accessibilityState={{ busy: pending, disabled: pending }}
                disabled={pending} onPress={() => void removeSavedFacility(favorite)}
                style={({ pressed }) => [styles.facilityAction, pressed && styles.pressed]}>
                {pending ? <ActivityIndicator color={colors.primary} size="small" />
                  : <Icon name={issue === 'read' ? 'arrow.clockwise' : 'bookmark.slash'} size={18} />}
              </Pressable>
            </View>
            {!pending && (issue === 'read' || issue === 'write') && (
              <AppText variant="detail" tone="error" accessibilityRole="alert" style={styles.facilityIssue}>
                {actions[issue]}
              </AppText>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center', justifyContent: 'space-between' },
  settings: {
    minHeight: touchTarget,
    maxWidth: '100%',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { backgroundColor: colors.pressed },
  list: { gap: space.md },
  sectionTitle: { flexShrink: 1 },
  notice: { borderRadius: radius.control, backgroundColor: colors.tint, padding: space.md },
  actions: {
    flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, padding: space.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  facilityLine: { flexDirection: 'row', alignItems: 'center', paddingRight: space.sm },
  facilityRow: {
    flex: 1, minWidth: 0, minHeight: touchTarget, flexDirection: 'row', alignItems: 'center',
    padding: space.md, gap: space.sm,
  },
  facilityBadge: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: radius.control },
  facilityCopy: { flex: 1, minWidth: 0, gap: space.xs },
  facilityAction: {
    width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.pill, backgroundColor: colors.tint,
  },
  facilityIssue: { paddingHorizontal: space.md, paddingBottom: space.md },
});
