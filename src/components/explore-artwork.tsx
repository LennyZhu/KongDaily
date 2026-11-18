import { Image, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui';
import type { ExploreCategory } from '@/explore-places';
import { homeColors, radius } from '@/theme';

export const exploreCategoryIcons = {
  parks: 'leaf',
  hiking: 'figure.hiking',
  waterfront: 'water.waves',
  pets: 'pawprint',
} as const satisfies Record<ExploreCategory, IconName>;

const artwork = {
  hiking: {
    tile: require('../../assets/explore/hiking-tile.png'),
    banner: require('../../assets/explore/hiking-banner.png'),
  },
  waterfront: {
    tile: require('../../assets/explore/waterfront-tile.png'),
    banner: require('../../assets/explore/waterfront-banner.png'),
  },
};

export function ExploreArtwork({ category, banner = false, compact = false }: {
  category: ExploreCategory;
  banner?: boolean;
  compact?: boolean;
}) {
  const aspect = banner ? styles.banner : [styles.tile, compact && styles.compact];
  const motif = category === 'hiking' || category === 'waterfront' ? artwork[category] : undefined;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.artwork, aspect, { backgroundColor: category === 'pets' ? homeColors.cream : homeColors.green }]}>
      {motif ? (
        <Image accessible={false} source={banner ? motif.banner : motif.tile}
          resizeMode="cover" style={styles.image} />
      ) : (
        <Icon name={exploreCategoryIcons[category]} size={banner ? 52 : 26} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  artwork: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  tile: { width: 66, height: 66, borderRadius: radius.control },
  compact: { width: 44, height: 44 },
  banner: { height: 142, borderRadius: radius.media },
  image: { width: '100%', height: '100%' },
});
