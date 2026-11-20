import type { ImageSourcePropType } from 'react-native';

import photoCredits from '../assets/explore/photos/attribution.json';

const photos = {
  'dragons-back-to-tei-wan-tai-tam-gap': require('../assets/explore/photos/dragons-back.jpg'),
  'peak-circle-walk': require('../assets/explore/photos/peak-circle-walk.jpg'),
  'west-kowloon-art-park': require('../assets/explore/photos/west-kowloon-art-park.jpg'),
  'avenue-of-stars': require('../assets/explore/photos/avenue-of-stars.jpg'),
  'hong-kong-park': require('../assets/explore/photos/hong-kong-park.jpg'),
  'kowloon-walled-city-park': require('../assets/explore/photos/kowloon-walled-city-park.jpg'),
  'tai-po-waterfront-park': require('../assets/explore/photos/tai-po-waterfront-park.jpg'),
  'victoria-peak-garden': require('../assets/explore/photos/victoria-peak-garden.jpg'),
} satisfies Record<keyof typeof photoCredits, ImageSourcePropType>;

export function getExplorePhoto(placeId: string) {
  if (!Object.hasOwn(photos, placeId)) return undefined;
  const id = placeId as keyof typeof photos;
  const credit = photoCredits[id];
  return {
    source: photos[id] as ImageSourcePropType,
    description: credit.description,
    creditLine: 'creditLine' in credit ? credit.creditLine : undefined,
  };
}
