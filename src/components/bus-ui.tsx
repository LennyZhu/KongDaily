import { useRef, type RefObject } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import type { BusHistoryItem } from '@/bus-data';
import { loadBusFavorites, useBusFavorites } from '@/bus-favorite-hooks';
import { routePlaceName, type BusRoute } from '@/bus-routes';
import { HarbourBackdrop } from '@/components/home-ui';
import { FavoriteBusRow, savedBusStyles } from '@/components/saved-bus-ui';
import { AppText, EmptyState, Icon, type IconName } from '@/components/ui';
import type { Messages } from '@/i18n';
import { useLanguage } from '@/language';
import { colors, homeColors, homeLayout, radius, shadows, space, touchTarget, typography } from '@/theme';

type BusCopy = Messages['bus'];
type BusLocale = 'zh-HK' | 'en';

export function BusHero({ copy, inputRef, query, onChange, onSubmit, onBack }: {
  copy: BusCopy;
  inputRef: RefObject<TextInput | null>;
  query: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.hero}>
      <HarbourBackdrop />
      <Pressable accessibilityRole="button" accessibilityLabel={copy.back} onPress={onBack} style={styles.back}>
        <Icon name="chevron.left" size={18} />
      </Pressable>
      <View style={styles.brand}>
        <View style={styles.brandIcon}><Icon name="bus" size={27} color={colors.onPrimary} /></View>
        <View style={styles.rowCopy}>
          <AppText variant="moduleTitle" accessibilityRole="header">{copy.title}</AppText>
          <AppText variant="brandSubtitle" tone="muted">{copy.subtitle}</AppText>
        </View>
      </View>
      <View style={styles.search}>
        <Icon name="magnifyingglass" size={21} />
        <TextInput
          ref={inputRef}
          accessibilityLabel={copy.search}
          placeholder={copy.search}
          placeholderTextColor={colors.muted}
          selectionColor={colors.primary}
          value={query}
          onChangeText={onChange}
          onSubmitEditing={onSubmit}
          returnKeyType="search"
          submitBehavior="blurAndSubmit"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          multiline={false}
          maxLength={80}
          style={styles.searchInput}
        />
        {query.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.clearInput}
            onPress={() => {
              onChange('');
              inputRef.current?.focus();
            }}
            style={styles.clearInput}
          >
            <Icon name="xmark.circle.fill" size={19} color={colors.muted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const landingShortcuts = [
  { key: 'nearby', icon: 'mappin' },
  { key: 'saved', icon: 'star' },
  { key: 'map', icon: 'map' },
] as const satisfies ReadonlyArray<{ key: keyof BusCopy['shortcuts']; icon: IconName }>;

export function BusLanding({ copy, locale, history, historyLoading, routesById, onFocus, onJumpToFavorites, onClear, onRecent }: {
  copy: BusCopy;
  locale: BusLocale;
  history: BusHistoryItem[];
  historyLoading: boolean;
  routesById: Map<string, BusRoute>;
  onFocus: () => void;
  onJumpToFavorites: (offset: number) => void;
  onClear: () => void;
  onRecent: (entry: BusHistoryItem) => void;
}) {
  const { items, status } = useBusFavorites();
  const { copy: { busFavorites } } = useLanguage();
  const layoutOffsets = useRef({ landing: 0, favorites: 0 });

  return (
    <View style={styles.sections} onLayout={({ nativeEvent }) => { layoutOffsets.current.landing = nativeEvent.layout.y; }}>
      <View style={styles.shortcuts}>
        <Pressable
          accessibilityRole="button"
          onPress={onFocus}
          style={({ pressed }) => [styles.shortcut, styles.activeShortcut, pressed && styles.pressed]}
        >
          <Icon name="magnifyingglass" size={23} />
          <AppText variant="caption" style={styles.centered}>{copy.shortcuts.search}</AppText>
        </Pressable>
        {landingShortcuts.map(({ key, icon }) => key === 'saved' ? (
          <Pressable key={key} accessibilityRole="button"
            onPress={() => onJumpToFavorites(layoutOffsets.current.landing + layoutOffsets.current.favorites)}
            style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}>
            <Icon name={icon} size={23} />
            <AppText variant="caption" style={styles.centered}>{copy.shortcuts.saved}</AppText>
          </Pressable>
        ) : (
          <View key={key} style={styles.shortcut}>
            <Icon name={icon} size={23} />
            <AppText variant="caption" style={styles.centered}>{copy.shortcuts[key]}</AppText>
            <AppText variant="caption" tone="muted" style={styles.centered}>{copy.comingSoon}</AppText>
          </View>
        ))}
      </View>

      <View style={styles.section} onLayout={({ nativeEvent }) => { layoutOffsets.current.favorites = nativeEvent.layout.y; }}>
        <AppText variant="homeHeading" accessibilityRole="header">{copy.shortcuts.saved}</AppText>
        {status === 'loading' ? (
          <ActivityIndicator color={colors.primary} accessibilityLabel={busFavorites.loading} />
        ) : status === 'error' ? (
          <View style={styles.favouriteEmpty}>
            <AppText variant="homeCardTitle" accessibilityRole="alert" style={styles.centered}>{busFavorites.loadError}</AppText>
            <BusAction label={copy.retry} onPress={() => void loadBusFavorites()} />
          </View>
        ) : items.length > 0 ? items.map((favorite) => (
          <View key={favorite.id} style={savedBusStyles.card}>
            <FavoriteBusRow favorite={favorite} />
          </View>
        )) : (
          <View style={styles.favouriteEmpty}>
            <Icon name="star" size={29} color={colors.muted} />
            <AppText variant="homeCardTitle" style={styles.centered}>{copy.noFavourites}</AppText>
            <AppText variant="detail" tone="muted" style={styles.centered}>{copy.favouritesDetail}</AppText>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <AppText variant="homeHeading" accessibilityRole="header" style={styles.rowCopy}>{copy.recent}</AppText>
          {history.length > 0 && <BusAction label={copy.clearHistory} onPress={onClear} />}
        </View>
        {historyLoading ? (
          <ActivityIndicator color={colors.primary} accessibilityLabel={copy.historyLoading} />
        ) : history.length === 0 ? (
          <EmptyState icon="clock" title={copy.noRecent} detail={copy.recentDetail} />
        ) : history.map((item) => {
          const route = item.route_id ? routesById.get(item.route_id) : undefined;
          return (
            <Pressable
              key={item.history_key}
              accessibilityRole="button"
              onPress={() => onRecent(item)}
              style={({ pressed }) => [styles.cardRow, styles.recentRow, pressed && styles.pressed]}
            >
              <View style={styles.recentIcon}><Icon name={route ? 'bus' : 'clock'} size={18} /></View>
              <View style={styles.rowCopy}>
                <AppText variant="homeCardTitle">{item.query}</AppText>
                {route && (
                  <AppText variant="brandSubtitle" tone="muted">
                    {route.source === 'nlb' ? routePlaceName(route.routeName, locale)
                      : `${routePlaceName(route.origin, locale)} → ${routePlaceName(route.destination, locale)}`}
                  </AppText>
                )}
              </View>
              <Icon name="chevron.right" color={colors.muted} size={12} />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.cardRow}>
        <View style={styles.iconTile}><Icon name="mappin.and.ellipse" size={24} /></View>
        <View style={styles.rowCopy}>
          <AppText variant="homeCardTitle">{copy.nearbyTitle}</AppText>
          <AppText variant="detail" tone="muted">{copy.nearbyDetail}</AppText>
        </View>
      </View>
    </View>
  );
}

export function BusAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <AppText variant="title" tone="primary" style={styles.centered}>{label}</AppText>
    </Pressable>
  );
}

export function BusRouteRow({ copy, route, locale, onPress }: {
  copy: BusCopy;
  route: BusRoute;
  locale: BusLocale;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.cardRow, styles.result, pressed && styles.pressed]}
    >
      <View style={styles.routeNumber}>
        <AppText variant="section" tone="primary" numberOfLines={1} adjustsFontSizeToFit style={styles.centered}>
          {route.number}
        </AppText>
      </View>
      <View style={styles.rowCopy}>
        <AppText variant="caption" tone="muted">
          {copy.sources[route.source]}{route.source !== 'nlb' && ` · ${copy.directions[route.direction]}`}
        </AppText>
        <AppText variant="homeCardTitle">
          {routePlaceName(route.source === 'nlb' ? route.routeName : route.destination, locale)}
        </AppText>
        {route.source !== 'nlb' && (
          <AppText variant="brandSubtitle" tone="muted">{copy.origin} · {routePlaceName(route.origin, locale)}</AppText>
        )}
        {route.source === 'nlb' && route.special && <AppText variant="caption" tone="primary">{copy.specialRoute}</AppText>}
        {route.source === 'nlb' && route.overnight && <AppText variant="caption" tone="primary">{copy.overnightRoute}</AppText>}
        {route.serviceType && route.serviceType !== '1' && (
          <AppText variant="caption" tone="primary">{copy.service(route.serviceType)}</AppText>
        )}
      </View>
      <Icon name="chevron.right" color={colors.muted} size={13} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: homeColors.harbourSky,
    paddingHorizontal: homeLayout.gutter,
    paddingBottom: space.xxl,
    gap: space.sm,
  },
  back: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center', marginLeft: -space.md },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  brandIcon: {
    width: homeLayout.brandMark,
    height: homeLayout.brandMark,
    borderRadius: radius.card,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    minHeight: homeLayout.searchHeight,
    marginTop: space.sm,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: space.lg,
    paddingRight: space.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadows.search,
  },
  searchInput: {
    ...typography.detail,
    color: colors.text,
    flex: 1,
    minWidth: 0,
    minHeight: touchTarget,
    paddingRight: space.sm,
    paddingVertical: space.sm,
  },
  clearInput: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  sections: { paddingHorizontal: homeLayout.gutter, gap: homeLayout.sectionGap },
  shortcuts: { flexDirection: 'row', gap: space.sm },
  shortcut: {
    flex: 1,
    minWidth: 0,
    minHeight: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    padding: space.xs,
    borderRadius: radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  activeShortcut: { backgroundColor: colors.tintedBackground, borderColor: colors.primarySoft },
  centered: { textAlign: 'center' },
  section: { gap: space.sm },
  sectionHeader: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  favouriteEmpty: {
    alignItems: 'center',
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.media,
    backgroundColor: homeColors.busEmpty,
  },
  rowCopy: { flex: 1, minWidth: 0, gap: space.xs },
  action: { minWidth: touchTarget, minHeight: touchTarget, maxWidth: '46%', justifyContent: 'center' },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: touchTarget,
    padding: space.lg,
    borderRadius: radius.media,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  recentRow: { padding: space.md },
  recentIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.tintedBackground,
  },
  iconTile: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    backgroundColor: colors.tintedBackground,
  },
  pressed: { opacity: 0.75 },
  result: { marginHorizontal: homeLayout.gutter, marginBottom: space.sm, padding: space.md },
  routeNumber: {
    width: 64,
    minHeight: touchTarget,
    justifyContent: 'center',
    padding: space.xs,
    backgroundColor: colors.tintedBackground,
    borderRadius: radius.control,
  },
});
