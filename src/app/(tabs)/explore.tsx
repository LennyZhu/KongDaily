import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, EmptyState, Icon, PageHeading, Screen, type IconName } from '@/components/ui';
import { type Messages } from '@/i18n';
import { useLanguage } from '@/language';
import { colors, radius, space, touchTarget } from '@/theme';

type Category = keyof Messages['explore']['categories'];
const categories = [
  { key: 'parks', icon: 'leaf' },
  { key: 'hiking', icon: 'figure.hiking' },
  { key: 'waterfront', icon: 'water.waves' },
  { key: 'pets', icon: 'pawprint' },
] as const satisfies ReadonlyArray<{ key: Category; icon: IconName }>;

export default function ExploreScreen() {
  const { copy } = useLanguage();
  const { explore } = copy;
  const router = useRouter();
  const { category: requestedCategory } = useLocalSearchParams<{ category?: string }>();
  const category = categories.find(({ key }) => key === requestedCategory)?.key;

  return (
    <Screen>
      <PageHeading title={copy.tabs.explore} description={explore.intro} />
      <View style={styles.categories}>
        {categories.map(({ key, icon }) => {
          const selected = category === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => router.setParams({ category: selected ? '' : key })}
              style={({ pressed }) => [styles.category, pressed && styles.pressed, selected && styles.selected]}
            >
              <Icon name={icon} size={26} />
              <AppText variant="title" tone={selected ? 'primary' : 'text'}>{explore.categories[key]}</AppText>
            </Pressable>
          );
        })}
      </View>
      <EmptyState
        icon="safari"
        title={category ? explore.categories[category] : explore.empty}
        detail={category ? explore.categoryEmpty : undefined}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  category: {
    flexBasis: '46%',
    flexGrow: 1,
    minHeight: touchTarget,
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.pressed },
  selected: { backgroundColor: colors.tint, borderColor: colors.primary },
});
