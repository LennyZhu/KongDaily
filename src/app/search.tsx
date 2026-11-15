import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, TextInput, View } from 'react-native';

import { EmptyState, Icon, Screen } from '@/components/ui';
import { useLanguage } from '@/language';
import { colors, radius, space, touchTarget, typography } from '@/theme';

export default function SearchScreen() {
  const { copy } = useLanguage();
  const { scope } = useLocalSearchParams<{ scope?: string }>();
  const prompt = scope === 'bus' ? copy.home.busSearch : copy.home.search;

  return (
    <Screen hasHeader>
      <View style={styles.field}>
        <Icon name="magnifyingglass" size={20} />
        <TextInput
          accessibilityLabel={prompt}
          placeholder={prompt}
          placeholderTextColor={colors.muted}
          selectionColor={colors.primary}
          clearButtonMode="while-editing"
          returnKeyType="search"
          autoCorrect={false}
          style={styles.input}
        />
      </View>
      <EmptyState icon="magnifyingglass" title={copy.search.empty} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
  },
  input: {
    ...typography.body,
    flex: 1,
    minHeight: touchTarget,
    paddingVertical: space.sm,
    color: colors.text,
  },
});
