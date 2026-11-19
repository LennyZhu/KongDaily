import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FacilitySelectionCard } from '@/components/facility-selection-card';
import { NearbyFacilitiesMap } from '@/components/nearby-facilities-map';
import { AppText, EmptyState, Icon, Screen } from '@/components/ui';
import { loadFacilityFavorites } from '@/facility-favorite-hooks';
import { resolveFacilityIdentity, resolveStableFacilityIdentity } from '@/facility-identity';
import { facilityId, indexNearbyFacilities, nearbyFacilities, type Facility } from '@/facilities';
import { useLanguage } from '@/language';
import { regionAroundFacility } from '@/nearby-map-motion';
import { colors, radius, space, touchTarget } from '@/theme';

export default function SearchFacilityMapScreen() {
  const { source, stableFacilityId } = useLocalSearchParams();
  const { copy: { search } } = useLanguage();
  const router = useRouter();
  const resolved = typeof source === 'string' && !!source.trim()
    && typeof stableFacilityId === 'string' && !!stableFacilityId.trim()
    ? resolveStableFacilityIdentity({ source, stableFacilityId }) : undefined;

  function returnToSearch() {
    if (router.canGoBack()) router.back();
    else router.replace('/search');
  }

  if (resolved?.status !== 'available') {
    return (
      <Screen hasHeader>
        <EmptyState icon="mappin" title={resolved?.status === 'needs_review' ? search.facilityNeedsReview : search.facilityUnavailable} />
        <Pressable accessibilityRole="button" onPress={returnToSearch}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Icon name="chevron.left" size={16} />
          <AppText variant="title" tone="primary" style={styles.backText}>{search.backToSearch}</AppText>
        </Pressable>
      </Screen>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerLeft: ({ canGoBack }) => canGoBack ? null : (
        <Pressable accessibilityRole="button" accessibilityLabel={search.backToSearch} onPress={returnToSearch}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Icon name="chevron.left" size={17} />
        </Pressable>
      ) }} />
      <FacilityMap key={facilityId(resolved.facility)} initial={resolved.facility} />
    </>
  );
}

function FacilityMap({ initial }: { initial: Facility }) {
  const { copy: { nearby } } = useLanguage();
  const [selectedId, setSelectedId] = useState<string | undefined>(() => facilityId(initial));
  const items = useMemo(() => indexNearbyFacilities(
    nearbyFacilities.filter((facility) => resolveFacilityIdentity(facility).status === 'available'), 'all', initial.coordinate,
  ), [initial]);
  const initialRegion = useMemo(() => regionAroundFacility(initial.coordinate), [initial]);
  const selected = items.find((item) => item.id === selectedId);
  const dismiss = () => setSelectedId(undefined);

  useFocusEffect(useCallback(() => { void loadFacilityFavorites(); }, []));

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <NearbyFacilitiesMap initialRegion={initialRegion} items={items} selectedId={selected?.id}
        emptyMessage={nearby.noFacilitiesInView} onSelect={({ id }) => setSelectedId(id)} onDismiss={dismiss} />
      {selected && (
        <View style={styles.card}>
          <FacilitySelectionCard selected={selected} items={items} onSelect={setSelectedId} onClose={dismiss} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.searchBackground },
  card: { paddingBottom: space.sm },
  back: {
    alignSelf: 'flex-start', minHeight: touchTarget, minWidth: touchTarget, flexDirection: 'row',
    gap: space.xs, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm, borderRadius: radius.control,
  },
  backText: { flexShrink: 1 },
  pressed: { opacity: 0.72 },
});
