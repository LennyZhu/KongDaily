import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { complianceDocuments } from '@/compliance-content';
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
  const { copy, locale } = useLanguage();
  const { privacy, support } = complianceDocuments[locale];

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
      <Stack.Screen name="settings/privacy" options={{ title: privacy.title }} />
      <Stack.Screen name="settings/support" options={{ title: support.title }} />
      <Stack.Screen name="settings/credits" options={{ title: copy.compliance.creditsHeader }} />
      <Stack.Screen name="search" options={{ title: copy.search.title }} />
      <Stack.Screen name="search/facility-map" options={{ title: copy.search.facilityMap }} />
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
      <Stack.Screen name="transport" options={{
        title: copy.transport.title,
        headerStyle: { backgroundColor: colors.tintedBackground },
        headerShadowVisible: false,
      }} />
      <Stack.Screen name="mtr/[kind]" options={{ title: copy.transport.modes.mtr }} />
      <Stack.Screen name="light-rail/[kind]" options={{ title: copy.transport.modes.lightRail }} />
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
      <Stack.Screen name="bus/route-map" options={{
        title: copy.busMap.title,
        headerStyle: { backgroundColor: colors.tintedBackground },
        headerShadowVisible: false,
      }} />
      <Stack.Screen name="explore/place/[id]" options={{
        title: copy.explore.placeDetail,
        headerStyle: { backgroundColor: colors.tintedBackground },
        headerShadowVisible: false,
      }} />
    </Stack>
  );
}
