import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ColorValue, type StyleProp, type TextProps, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, floatingTab, radius, space, touchTarget, typography } from '@/theme';

export type IconName = Extract<SymbolViewProps['name'], string>;

export function Icon({ name, color = colors.primary, size = 22 }: { name: IconName; color?: ColorValue; size?: number }) {
  return <SymbolView name={name} size={size} tintColor={color} weight="medium" accessible={false} />;
}

type AppTextProps = TextProps & {
  variant?: keyof typeof typography;
  tone?: 'text' | 'muted' | 'primary' | 'onPrimary' | 'onPrimaryMuted' | 'error';
};

export function AppText({ variant = 'body', tone = 'text', style, ...props }: AppTextProps) {
  return <Text {...props} style={[typography[variant], { color: colors[tone] }, style]} />;
}

export function Screen({ children, hasHeader = false, contentStyle, topBackgroundColor }: PropsWithChildren<{
  hasHeader?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  topBackgroundColor?: string;
}>) {
  const { bottom } = useSafeAreaInsets();
  const tabClearance = hasHeader ? 0 : bottom + floatingTab.height + floatingTab.bottomGap + space.lg;

  return (
    <SafeAreaView
      edges={hasHeader ? ['left', 'right', 'bottom'] : ['top', 'left', 'right']}
      style={[styles.screen, topBackgroundColor && { backgroundColor: topBackgroundColor }]}
    >
      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[styles.screenContent, contentStyle, !hasHeader && { paddingBottom: tabClearance }]}
        automaticallyAdjustsScrollIndicatorInsets={hasHeader}
        scrollIndicatorInsets={hasHeader ? undefined : { bottom: tabClearance }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={hasHeader}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function PageHeading({ title, description }: { title: string; description?: string }) {
  return (
    <View style={styles.heading}>
      <AppText variant="display" accessibilityRole="header">{title}</AppText>
      {description && <AppText variant="detail" tone="muted">{description}</AppText>}
    </View>
  );
}

export function EmptyState({ icon, title, detail }: { icon: IconName; title: string; detail?: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Icon name={icon} /></View>
      <View style={styles.emptyCopy}>
        <AppText variant="title">{title}</AppText>
        {detail && <AppText variant="detail" tone="muted">{detail}</AppText>}
      </View>
    </View>
  );
}

export function Filters<Category extends string>({ options, selected, onSelect }: {
  options: ReadonlyArray<readonly [Category, string]>;
  selected: Category;
  onSelect: (category: Category) => void;
}) {
  return (
    <View style={styles.filters}>
      {options.map(([key, label]) => {
        const active = selected === key;
        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(key)}
            style={({ pressed }) => [styles.filter, active && styles.activeFilter, pressed && styles.pressedFilter]}
          >
            <AppText variant="detail" tone={active ? 'onPrimary' : 'text'}>{label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { backgroundColor: colors.background },
  screenContent: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.section, gap: space.xxl },
  heading: { flexShrink: 1, gap: space.sm },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
  },
  emptyIcon: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.control,
    backgroundColor: colors.tint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCopy: { flex: 1, gap: space.xs },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  filter: {
    maxWidth: '100%',
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  activeFilter: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressedFilter: { opacity: 0.82 },
});
