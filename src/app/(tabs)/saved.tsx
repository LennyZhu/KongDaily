import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { changeBusFavorites, loadBusFavorites, useBusFavorites, useUnavailableFavorites } from '@/bus-favorite-hooks';
import { BusAction } from '@/components/bus-ui';
import { facilityVisuals } from '@/components/nearby-facilities-map';
import { FavoriteBusRow, savedBusStyles } from '@/components/saved-bus-ui';
import { AppText, EmptyState, Filters, Icon, PageHeading, Screen } from '@/components/ui';
import { loadFacilityFavorites, removeSavedFacility, useFacilityFavorites } from '@/facility-favorite-hooks';
import { resolveFacilityFavorite } from '@/facility-favorites';
import { facilityText, facilityType } from '@/facilities';
import { changeHomePin, homePinKey, homeTransportLimit, loadHomePins, useHomePins, type HomePin } from '@/home-transport-pins';
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
      <Filters horizontal
        options={categories.map((key) => [key, copy.saved.categories[key]])}
        selected={category}
        onSelect={(key) => router.setParams({ category: key })}
      />
      {category !== 'places' && <HomePinSummary />}
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
  const { items, status } = useBusFavorites();
  const unavailable = useUnavailableFavorites(items);
  const labels = copy.busFavorites;

  const heading = <AppText variant="section" accessibilityRole="header">{copy.saved.busSection}</AppText>;

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
      {items.length === 0 && <EmptyState icon="bookmark" title={emptyTitle} />}
      {items.map((item) => (
        <View key={item.id} style={savedBusStyles.card}>
          <View style={styles.transportLine}>
            <View style={styles.transportDetails}>
              <FavoriteBusRow favorite={item} compact>
                <HomePinPosition pin={{ mode: 'bus', id: item.id }} />
                {unavailable.has(item.id) && <AppText variant="detail" tone="muted">{labels.unavailable}</AppText>}
              </FavoriteBusRow>
            </View>
            <TransportFavoriteActions pin={{ mode: 'bus', id: item.id }}
              onRemove={() => changeBusFavorites({ type: 'remove', id: item.id })} />
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
            <HomePinPosition pin={favorite} />
            {!resolved && <AppText variant="detail" tone="muted">{labels.unavailable}</AppText>}
          </View>
        </>;
        return (
          <View key={favorite.id} style={savedBusStyles.card}>
            <View style={styles.transportLine}>
              {href ? <Pressable accessibilityRole="button" style={({ pressed }) => [styles.facilityRow, pressed && styles.pressed]}
                onPress={() => router.push(href)}>
                {content}
              </Pressable> : <View style={styles.facilityRow}>{content}</View>}
              <TransportFavoriteActions pin={favorite} busy={busy} retryRemoval={operation === 'uncertain'}
                canPin={Boolean(resolved)} onRemove={() => removeSavedRailway(favorite)} />
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

function HomePinSummary() {
  const { copy } = useLanguage();
  const { pins, status } = useHomePins();
  if (status === 'loading') return <AppText variant="caption" tone="muted">{copy.homePins.loading}</AppText>;
  if (status === 'error') return <BusAction label={copy.bus.retry} onPress={() => void loadHomePins()} />;
  return <AppText variant="caption" tone="muted">{copy.busFavorites.pinCount(pins.length, homeTransportLimit)}</AppText>;
}

function HomePinPosition({ pin }: { pin: HomePin }) {
  const { copy } = useLanguage();
  const { pins } = useHomePins();
  const position = pins.findIndex((item) => homePinKey(item) === homePinKey(pin)) + 1;
  return position > 0 ? <AppText variant="caption" tone="primary">{copy.busFavorites.pinPosition(position)}</AppText> : null;
}

function TransportFavoriteActions({ pin, onRemove, busy = false, canPin = true, retryRemoval = false }: {
  pin: HomePin;
  onRemove: () => Promise<'ok' | 'failed' | void>;
  busy?: boolean;
  canPin?: boolean;
  retryRemoval?: boolean;
}) {
  const { copy, locale } = useLanguage();
  const { pins, status } = useHomePins();
  const { width, fontScale } = useWindowDimensions();
  const pending = useRef(false);
  const sheetOpen = useRef(false);
  const [working, setWorking] = useState(false);
  const labels = copy.busFavorites;
  const index = pins.findIndex((item) => homePinKey(item) === homePinKey(pin));
  const pinned = index >= 0;
  const disabled = busy || working;
  const pinsDisabled = disabled || status !== 'ready';

  async function run(change: () => Promise<'ok' | 'limit' | 'failed' | void>) {
    if (pending.current || busy) return;
    pending.current = true;
    setWorking(true);
    try {
      const result = await change();
      if (result === 'limit') Alert.alert(copy.homePins.limitTitle, labels.pinLimit(homeTransportLimit));
      if (result === 'failed') Alert.alert(labels.saveError);
    } finally {
      pending.current = false;
      setWorking(false);
    }
  }

  function openMenu() {
    if (pending.current || busy || sheetOpen.current) return;
    const moves = pinned ? [
      { label: labels.moveUp, disabled: pinsDisabled || index === 0, step: -1 as const },
      { label: labels.moveDown, disabled: pinsDisabled || index === pins.length - 1, step: 1 as const },
    ] : [];
    const removeIndex = moves.length;
    const options = [...moves.map(({ label }) => label), retryRemoval ? copy.bus.retry : labels.remove, copy.bus.cancel];
    sheetOpen.current = true;
    ActionSheetIOS.showActionSheetWithOptions({
      options,
      cancelButtonIndex: options.length - 1,
      destructiveButtonIndex: retryRemoval ? undefined : removeIndex,
      disabledButtonIndices: moves.flatMap((move, option) => move.disabled ? [option] : []),
    }, (option) => {
      sheetOpen.current = false;
      if (option === removeIndex) void run(onRemove);
      const move = moves[option];
      if (move && !move.disabled) void run(() => changeHomePin({ type: 'move', pin, step: move.step }));
    });
  }

  // Keep the icon and label together and leave room for the card body and More.
  const minWidthForPinLabel = (locale === 'en' ? 400 : 385) + Math.max(0, fontScale - 1) * 80;
  const showPinText = !pinned && width >= minWidthForPinLabel && fontScale <= 1.25;
  return (
    <View style={styles.transportActions}>
      {(canPin || pinned) && (
        <Pressable accessibilityRole="button" accessibilityLabel={pinned ? labels.unpin : labels.pin}
          accessibilityState={{ disabled: pinsDisabled, busy: working }} disabled={pinsDisabled}
          onPress={() => void run(() => changeHomePin({ type: pinned ? 'unpin' : 'pin', pin }))}
          style={({ pressed }) => [styles.quickAction, showPinText && styles.labeledQuickAction,
            pressed && styles.pressed, pinsDisabled && styles.disabledAction]}>
          <Icon name={pinned ? 'pin.fill' : 'pin'} size={showPinText ? 16 : 18} />
          {showPinText && <AppText variant="caption" tone="primary">{labels.pin}</AppText>}
        </Pressable>
      )}
      <Pressable accessibilityRole="button" accessibilityLabel={copy.saved.moreActions}
        accessibilityState={{ disabled }} disabled={disabled} onPress={openMenu}
        style={({ pressed }) => [styles.quickAction, pressed && styles.pressed, disabled && styles.disabledAction]}>
        <Icon name="ellipsis" size={20} />
      </Pressable>
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
  transportLine: { flexDirection: 'row', alignItems: 'center', paddingRight: space.xs },
  transportDetails: { flex: 1, minWidth: 0 },
  transportActions: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  quickAction: {
    minWidth: touchTarget, minHeight: touchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radius.control,
  },
  labeledQuickAction: { flexDirection: 'row', gap: space.xs, paddingHorizontal: space.xs },
  disabledAction: { opacity: 0.5 },
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
