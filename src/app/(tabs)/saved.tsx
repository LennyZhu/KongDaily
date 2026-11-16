import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { changeBusFavorites, loadBusFavorites, useBusFavorites, useUnavailableFavorites } from '@/bus-favorite-hooks';
import { homeBusLimit, pinnedBuses, type FavoriteChange } from '@/bus-favorites';
import { BusAction } from '@/components/bus-ui';
import { FavoriteAction, FavoriteBusRow, savedBusStyles } from '@/components/saved-bus-ui';
import { AppText, EmptyState, Filters, Icon, PageHeading, Screen } from '@/components/ui';
import { useLanguage } from '@/language';
import { colors, radius, space, touchTarget } from '@/theme';

const categories = ['all', 'buses', 'places'] as const;

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
      {category === 'places' ? <EmptyState icon="bookmark" title={copy.saved.empty.places} />
        : <SavedBuses emptyTitle={copy.saved.empty[category]} />}
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

  if (status === 'loading') return <EmptyState icon="clock" title={labels.loading} />;
  if (status === 'error') {
    return (
      <>
        <EmptyState icon="exclamationmark.circle" title={labels.loadError} />
        <BusAction label={copy.bus.retry} onPress={() => void loadBusFavorites()} />
      </>
    );
  }

  return (
    <View style={styles.list}>
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
      <BusAction label={copy.home.addBus} onPress={() => router.push('/bus')} />
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
  notice: { borderRadius: radius.control, backgroundColor: colors.tint, padding: space.md },
  actions: {
    flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, padding: space.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
});
