import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

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
      <EmptyState icon="bookmark" title={copy.saved.empty[category]} />
    </Screen>
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
});
