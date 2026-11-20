import { Image, StyleSheet, View } from 'react-native';

import type { IconName } from '@/components/ui';
import { getExplorePhoto } from '@/explore-place-images';
import type { ExploreCategory } from '@/explore-places';
import { useLanguage } from '@/language';
import { homeColors, radius } from '@/theme';

export const exploreCategoryIcons = {
  parks: 'leaf',
  hiking: 'figure.hiking',
  waterfront: 'water.waves',
  pets: 'pawprint',
} as const satisfies Record<ExploreCategory, IconName>;

export function ExplorePlacePhoto({ placeId, banner = false, compact = false }: {
  placeId: string;
  banner?: boolean;
  compact?: boolean;
}) {
  const { locale } = useLanguage();
  const photo = getExplorePhoto(placeId);
  if (!photo) return null;

  return (
    <View style={[styles.artwork, banner ? styles.banner : styles.tile, !banner && compact && styles.compact]}>
      <Image source={photo.source} resizeMode="cover" style={styles.image}
        accessible={banner} accessibilityLabel={banner ? photo.description[locale] : undefined}
        accessibilityRole={banner ? 'image' : undefined}
        accessibilityElementsHidden={!banner} importantForAccessibility={banner ? 'auto' : 'no'} />
    </View>
  );
}

const styles = StyleSheet.create({
  artwork: { overflow: 'hidden', backgroundColor: homeColors.green },
  tile: { width: 66, height: 66, borderRadius: radius.control },
  compact: { width: 44, height: 44 },
  banner: { height: 142, borderRadius: radius.media },
  image: { width: '100%', height: '100%' },
});
