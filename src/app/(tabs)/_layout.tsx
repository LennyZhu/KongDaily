import { Tabs } from 'expo-router';

import { FloatingTabBar } from '@/components/floating-tab-bar';
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

export default function TabsLayout() {
  const { copy } = useLanguage();

  return (
    <Tabs tabBar={(props) => <FloatingTabBar {...props} />} screenOptions={{ headerShown: false }}>
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
  );
}
