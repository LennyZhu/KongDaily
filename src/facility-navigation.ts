import { ActionSheetIOS, Alert, Linking } from 'react-native';

import { facilityText, type Facility, type FacilityLocale } from '@/facilities';
import type { Messages } from '@/i18n';
import { isNearHongKong } from '@/nearby-bus-data';

type NavigationLabels = Messages['nearby']['navigation'];

let directionsInProgress = false;

export async function showFacilityDirections(facility: Facility, locale: FacilityLocale, labels: NavigationLabels) {
  if (directionsInProgress) return;

  const coordinate = facility.coordinate;
  if (!coordinate || !Number.isFinite(coordinate.latitude) || !Number.isFinite(coordinate.longitude)
    || !isNearHongKong(coordinate)) {
    Alert.alert(labels.invalidDestination, undefined, [{ text: labels.ok }]);
    return;
  }

  // Capture the selected facility's official destination before showing the menu.
  const destination = `${coordinate.latitude},${coordinate.longitude}`;
  const urls = [
    `https://maps.apple.com/?daddr=${destination}&dirflg=w`,
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=walking&dir_action=navigate`,
  ];

  directionsInProgress = true;
  try {
    const choice = await new Promise<number>((resolve) => {
      ActionSheetIOS.showActionSheetWithOptions({
        title: facilityText(facility.name, locale),
        message: facility.category === 'pets' ? labels.petGardenCoordinateNote
          : facility.category === 'parks' ? labels.parkCoordinateNote : labels.coordinateNote,
        options: [labels.appleMaps, labels.googleMaps, labels.cancel],
        cancelButtonIndex: 2,
      }, resolve);
    });
    const url = urls[choice];
    if (url) await Linking.openURL(url);
  } catch {
    Alert.alert(labels.openFailed, labels.tryAgain, [{ text: labels.ok }]);
  } finally {
    directionsInProgress = false;
  }
}
