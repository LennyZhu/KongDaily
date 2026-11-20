import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, type ComponentRef } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { ExplorePlacePhoto, exploreCategoryIcons } from '@/components/explore-artwork';
import { AppText, EmptyState, Icon, PageHeading, Screen } from '@/components/ui';
import { getExplorePhoto } from '@/explore-place-images';
import { getExplorePlaces, type ExploreCategory, type ExplorePlace } from '@/explore-places';
import { useLanguage } from '@/language';
import { colors, radius, space, touchTarget } from '@/theme';

const categories = ['parks', 'hiking', 'waterfront', 'pets'] as const satisfies readonly ExploreCategory[];
type CardRef = ComponentRef<typeof Pressable>;

export default function ExploreScreen() {
  const { copy } = useLanguage();
  const { explore } = copy;
  const router = useRouter();
  const { category: requestedCategory } = useLocalSearchParams<{ category?: string | string[] }>();
  const category = categories.find((item) => item === requestedCategory);
  const places = getExplorePlaces(category);
  const scrollView = useRef<ScrollView>(null);
  const returnFocus = useRef<{ card: CardRef; category?: ExploreCategory } | null>(null);
  const { width, fontScale } = useWindowDimensions();
  const singleColumn = width < 340 || fontScale >= 1.5;

  useEffect(() => {
    scrollView.current?.scrollTo({ y: 0, animated: false });
  }, [category]);

  useFocusEffect(useCallback(() => {
    const target = returnFocus.current;
    returnFocus.current = null;
    if (!target || target.category !== category) return;
    let active = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      if (enabled && active) {
        requestAnimationFrame(() => {
          if (active) AccessibilityInfo.sendAccessibilityEvent(target.card, 'focus');
        });
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [category]));

  function openPlace(id: string, card: CardRef | null) {
    if (card) returnFocus.current = { card, category };
    router.push({ pathname: '/explore/place/[id]', params: { id } });
  }

  return (
    <Screen scrollRef={scrollView}>
      <PageHeading title={copy.tabs.explore} description={explore.intro} />
      <View style={styles.categories}>
        {categories.map((key) => {
          const selected = category === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => router.setParams({ category: selected ? '' : key })}
              style={({ pressed }) => [styles.category, singleColumn && styles.fullWidth,
                selected && styles.selected, pressed && styles.pressed]}
            >
              <Icon name={exploreCategoryIcons[key]} size={19} />
              <AppText variant="homeCardTitle" tone={selected ? 'primary' : 'text'} style={styles.copy}>
                {explore.categoryButtonLabels[key]}
              </AppText>
              {selected && <Icon name="checkmark" size={12} />}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.list}>
        <View style={styles.sectionHeading}>
          <AppText variant="section" accessibilityRole="header" style={styles.copy}>
            {category ? explore.categories[category] : explore.featured}
          </AppText>
          {category && (
            <Pressable accessibilityRole="button" onPress={() => router.setParams({ category: '' })}
              style={({ pressed }) => [styles.clear, pressed && styles.pressed]}>
              <AppText variant="detail" tone="primary" style={styles.clearText}>{explore.viewAll}</AppText>
            </Pressable>
          )}
        </View>
        {places.length ? places.map((place) =>
          <PlaceCard key={place.id} place={place} compact={width <= 360 || fontScale >= 1.35} onPress={openPlace} />
        ) : (
          <EmptyState icon="safari" title={category ? explore.categoryEmpty : explore.empty} />
        )}
      </View>
    </Screen>
  );
}

function PlaceCard({ place, compact, onPress }: {
  place: ExplorePlace;
  compact: boolean;
  onPress: (id: string, card: CardRef | null) => void;
}) {
  const { copy, locale } = useLanguage();
  const ref = useRef<CardRef>(null);
  const title = place.title[locale];
  const subtitle = [copy.explore.categories[place.category], place.district[locale]].filter(Boolean);
  const summary = place.summary[locale];
  const credit = getExplorePhoto(place.id)?.creditLine?.[locale];

  return (
    <Pressable ref={ref} accessibilityRole="button" accessibilityLabel={[title, ...subtitle, credit, summary].filter(Boolean).join(', ')}
      onPress={() => onPress(place.id, ref.current)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <ExplorePlacePhoto placeId={place.id} compact={compact} />
      <View style={styles.cardText}>
        <AppText variant="weatherTitle">{title}</AppText>
        <AppText variant="caption" tone="primary">{subtitle.join(' · ')}</AppText>
        {credit && <AppText variant="caption" tone="muted">{credit}</AppText>}
        <AppText variant="detail" tone="muted">{summary}</AppText>
      </View>
      <Icon name="chevron.right" size={12} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  category: {
    flexBasis: '46%',
    flexGrow: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  fullWidth: { flexBasis: '100%' },
  copy: { flex: 1, minWidth: 0 },
  pressed: { backgroundColor: colors.pressed },
  selected: { backgroundColor: colors.tint, borderColor: colors.primary },
  list: { gap: space.md },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  clear: { minWidth: touchTarget, minHeight: touchTarget, maxWidth: '50%', justifyContent: 'center',
    borderRadius: radius.control, paddingHorizontal: space.xs },
  clearText: { textAlign: 'right', fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 98,
    paddingVertical: space.md, paddingHorizontal: space.md, backgroundColor: colors.surface,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.card },
  cardText: { flex: 1, minWidth: 0, gap: space.xs },
});
