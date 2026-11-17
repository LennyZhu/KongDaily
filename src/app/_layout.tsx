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
      <Stack.Screen name="weather" options={{
        title: copy.weather.title,
        headerStyle: { backgroundColor: colors.tintedBackground },
        headerShadowVisible: false,
      }} />
      <Stack.Screen name="weather/forecast" options={{
        title: copy.weather.forecast,
        headerStyle: { backgroundColor: colors.tintedBackground },
        headerShadowVisible: false,
      }} />
      <Stack.Screen name="weather/warnings" options={{
        title: copy.weather.warning.title,
        headerStyle: { backgroundColor: colors.tintedBackground },
        headerShadowVisible: false,
      }} />
      <Stack.Screen name="bus" options={{ headerShown: false }} />
      <Stack.Screen name="bus/nearby" options={{
        title: copy.bus.shortcuts.nearby,
        headerStyle: { backgroundColor: colors.tintedBackground },
        headerShadowVisible: false,
      }} />
      <Stack.Screen name="bus/nearby/stop" options={{
        title: copy.busStation.title,
        headerStyle: { backgroundColor: colors.tintedBackground },
        headerShadowVisible: false,
      }} />
      <Stack.Screen name="bus/route" options={{
        title: copy.busDetail.title,
        headerStyle: { backgroundColor: colors.tintedBackground },
        headerShadowVisible: false,
      }} />
      <Stack.Screen name="bus/eta" options={{
        title: copy.busEta.title,
        headerStyle: { backgroundColor: colors.tintedBackground },
        headerShadowVisible: false,
      }} />
    </Stack>
  );
}
