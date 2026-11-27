import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui';
import { useTabSwipe } from '@/components/tab-swipe';
import { colors, floatingTab, radius, shadows, space, touchTarget } from '@/theme';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export function FloatingTabBar({ state, descriptors, navigation }: TabBarProps) {
  const { bottom, left, right } = useSafeAreaInsets();
  const gesture = useTabSwipe(navigation, true, false);

  return (
    <GestureDetector gesture={gesture}>
      <View
        collapsable={false}
        accessibilityRole="tablist"
        style={[
          styles.bar,
          {
            bottom: bottom + floatingTab.bottomGap,
            left: left + floatingTab.horizontalMargin,
            right: right + floatingTab.horizontalMargin,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const selected = state.index === index;
          const label = options.title ?? route.name;
          const color = selected ? colors.primary : colors.muted;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!selected && !event.defaultPrevented) navigation.navigate(route.name, route.params);
              }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={({ pressed }) => [styles.tab, selected && styles.selected, pressed && styles.pressed]}
            >
              {options.tabBarIcon?.({ focused: selected, color, size: 21 })}
              <AppText variant="tab" numberOfLines={1} maxFontSizeMultiplier={1.45} style={{ color }}>
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    zIndex: 1,
    height: floatingTab.height,
    flexDirection: 'row',
    alignItems: 'stretch',
    padding: space.xs,
    gap: space.xs,
    borderRadius: radius.pill,
    backgroundColor: floatingTab.background,
    borderWidth: 1,
    borderColor: colors.surface,
    ...shadows.tabBar,
  },
  tab: {
    flex: 1,
    minWidth: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    borderRadius: radius.pill,
  },
  selected: { backgroundColor: floatingTab.selected },
  pressed: { opacity: 0.72 },
});
