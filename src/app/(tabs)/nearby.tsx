import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { HomeLink } from '@/components/home-ui';
import { AppText, Filters, Icon, PageHeading, Screen } from '@/components/ui';
import { useLanguage } from '@/language';
import { colors, radius, space } from '@/theme';

const categories = ['all', 'toilets', 'parks', 'transport'] as const;

export default function NearbyScreen() {
  const { copy } = useLanguage();
  const { nearby } = copy;
  const router = useRouter();
  const { category: requestedCategory } = useLocalSearchParams<{ category?: string }>();
  const category = categories.find((key) => key === requestedCategory) ?? 'all';

  return (
    <Screen>
      <PageHeading title={copy.tabs.nearby} description={nearby.intro} />
      <Filters
        options={categories.map((key) => [key, nearby.categories[key]])}
        selected={category}
        onSelect={(key) => router.setParams({ category: key })}
      />
      {(category === 'all' || category === 'transport') && (
        <HomeLink href="/bus/nearby" style={styles.busLink}>
          <Icon name="bus" size={20} />
          <AppText variant="title" tone="primary" style={styles.busLabel}>{copy.nearbyBus.title}</AppText>
          <Icon name="chevron.right" size={13} />
        </HomeLink>
      )}
      <View style={styles.map}>
        <Icon name="map" size={34} />
        <AppText variant="title" style={styles.centered}>{nearby.map}</AppText>
        <AppText variant="detail" tone="muted" style={styles.centered}>{nearby.empty}</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  busLink: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.control, backgroundColor: colors.surface,
  },
  busLabel: { flex: 1 },
  map: {
    minHeight: 240,
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.sm,
    padding: space.xxl,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.tint,
  },
  centered: { textAlign: 'center' },
});
