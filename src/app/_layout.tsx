import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { LanguageProvider, useLanguage } from '@/language';
import { colors, typography } from '@/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <LanguageProvider>
        <RootStack />
      </LanguageProvider>
    </>
  );
}

function RootStack() {
  const { copy } = useLanguage();

  return (
    <Stack screenOptions={{
      contentStyle: { backgroundColor: colors.background },
      headerStyle: { backgroundColor: colors.surface },
      headerTitleStyle: { ...typography.title, color: colors.text },
      headerTintColor: colors.primary,
      headerBackButtonDisplayMode: 'minimal',
    }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: copy.settings.title }} />
      <Stack.Screen name="search" options={{ title: copy.search.title }} />
    </Stack>
  );
}
