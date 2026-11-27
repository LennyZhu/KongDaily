import { useNavigation } from 'expo-router';
import { useMemo, useRef, type PropsWithChildren } from 'react';
import { Keyboard, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

type TabState = {
  type?: string;
  index: number;
  routes: readonly { key: string; name: string; params?: object }[];
};
type TabNavigation = {
  getState(): TabState | undefined;
  isFocused(): boolean;
  navigate(name: string, params?: object): void;
};

export function useTabSwipe(navigation: TabNavigation, enabled = true, reserveEdges = true) {
  const startKey = useRef<string | undefined>(undefined);

  return useMemo(() => {
    const pan = Gesture.Pan()
      .enabled(enabled)
      .runOnJS(true)
      .maxPointers(1)
      .activeOffsetX([-20, 20])
      .failOffsetY([-12, 12])
      .onBegin(() => {
        const state = navigation.getState();
        startKey.current = state?.type === 'tab' && navigation.isFocused() && !Keyboard.isVisible()
          ? state.routes[state.index]?.key : undefined;
      })
      .onEnd(({ translationX, translationY }, success) => {
        const key = startKey.current;
        startKey.current = undefined;
        if (!success || !key || !navigation.isFocused() || Keyboard.isVisible()) return;
        if (Math.abs(translationX) < 64 || Math.abs(translationX) < Math.abs(translationY) * 1.6) return;

        const state = navigation.getState();
        if (state?.type !== 'tab' || state.routes[state.index]?.key !== key) return;
        const next = state.routes[state.index + (translationX < 0 ? 1 : -1)];
        if (next) navigation.navigate(next.name, next.params);
      });

    // Leave the outer edges available to the native navigation gesture.
    return reserveEdges ? pan.hitSlop({ left: -24, right: -24 }) : pan;
  }, [enabled, navigation, reserveEdges]);
}

export function TabSwipeRegion({ children, enabled, style }: PropsWithChildren<{
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
}>) {
  const navigation = useNavigation<TabNavigation>();
  const gesture = useTabSwipe(navigation, enabled);
  return <GestureDetector gesture={gesture}>
    <View collapsable={false} style={style}>{children}</View>
  </GestureDetector>;
}
