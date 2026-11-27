import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { FloatingTabBar } from '@/components/floating-tab-bar';
import { TabSwipeRegion } from '@/components/tab-swipe';
import { Icon, type IconName } from '@/components/ui';
import { useLanguage } from '@/language';

const tabs = [
  { name: 'index', label: 'home', icon: 'house' },
  { name: 'nearby', label: 'nearby', icon: 'map' },
  { name: 'explore', label: 'explore', icon: 'safari' },
  { name: 'saved', label: 'saved', icon: 'bookmark' },
] as const satisfies ReadonlyArray<{
  name: string;
  label: 'home' | 'nearby' | 'explore' | 'saved';
  icon: IconName;
}>;

const fill = { flex: 1 } as const;

export default function TabsLayout() {
  const { copy } = useLanguage();
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let current = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      current = false;
      setReduceMotion(enabled);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (current) setReduceMotion(enabled);
    }, () => {});
    return () => {
      current = false;
      subscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={fill}>
      <Tabs tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{ headerShown: false, animation: reduceMotion ? 'none' : 'fade' }}
        screenLayout={({ route, children }) => route.name === 'index' || route.name === 'explore'
          ? <TabSwipeRegion style={fill}>{children}</TabSwipeRegion> : children}>
        {tabs.map(({ name, label, icon }) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title: copy.tabs[label],
              tabBarIcon: ({ color, size }) => <Icon name={icon} color={color} size={size} />,
            }}
          />
        ))}
      </Tabs>
    </GestureHandlerRootView>
  );
}
