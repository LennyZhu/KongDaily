import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { facilityVisuals } from '@/components/nearby-facilities-map';
import { AppText, Icon } from '@/components/ui';
import { useFacilityFavorite } from '@/facility-favorite-hooks';
import { showFacilityDirections } from '@/facility-navigation';
import { facilityText, facilityTextUsesFallback, facilityType, type Facility, type FacilityLocale, type NearbyFacility } from '@/facilities';
import type { Messages } from '@/i18n';
import { useLanguage } from '@/language';
import { colors, homeColors, homeLayout, radius, space, touchTarget } from '@/theme';

export function FacilitySelectionCard({ selected, items, distance, onSelect, onClose }: {
  selected: NearbyFacility;
  items: readonly NearbyFacility[];
  distance?: number;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { copy: { nearby: labels }, locale } = useLanguage();
  const { height } = useWindowDimensions();
  const { latitude, longitude } = selected.facility.coordinate;
  const samePointFacilities = items.filter(({ id, facility: { coordinate } }) =>
    id !== selected.id && coordinate.latitude === latitude && coordinate.longitude === longitude);
  return (
    <View style={[styles.selectedCard, { maxHeight: height * 0.3 }]}>
      <ScrollView contentContainerStyle={styles.selectedContents}>
        <FacilitySummary facility={selected.facility} distance={distance} onClose={onClose} />
        {samePointFacilities.length > 0 && (
          <View>
            <AppText variant="caption" tone="muted">{labels.sameOfficialCoordinate}</AppText>
            {samePointFacilities.map(({ id, facility }) => (
              <Pressable key={id} accessibilityRole="button" onPress={() => onSelect(id)}
                style={({ pressed }) => [styles.samePointChoice, pressed && styles.pressed]}>
                <AppText variant="detail" tone="primary" style={styles.grow}>{facilityText(facility.name, locale)}</AppText>
                <Icon name="chevron.right" size={13} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

export function facilityPlace(facility: Facility, locale: FacilityLocale) {
  return [facility.area ?? facility.district, facility.address]
    .flatMap((value) => value ? [facilityText(value, locale)] : []).filter(Boolean).join(' · ');
}

export function facilityDistance(distance: number, labels: Messages['nearbyBus']) {
  return distance < 1000 ? labels.metres(Math.round(distance)) : labels.kilometres(Math.round(distance / 100) / 10);
}

export function PetGardenTypeBadge({ label }: { label: string }) {
  return (
    <View style={styles.petGardenType}>
      <AppText variant="caption" tone="primary">{label}</AppText>
    </View>
  );
}

export function SharedPetRules({ access, expanded = false }: {
  access: NonNullable<Facility['petAccess']>; expanded?: boolean;
}) {
  const { copy: { nearby: labels }, locale } = useLanguage();
  const terms = [access.leashRequired && labels.dogsLeashed, labels.petAccessScopes[access.scope]].filter(Boolean);
  return (
    <>
      <AppText variant="caption" tone="primary">{terms.join(' · ')}</AppText>
      {expanded && access.scope === 'exclusions' && (
        <AppText variant="detail" tone="muted">{facilityText(access.scopeText, locale)}</AppText>
      )}
    </>
  );
}

function isAllDayOpeningHours(hours: string) {
  const text = hours.normalize('NFKC').trim().toLowerCase().replace(/[ \t]+/g, ' ');
  return /^(?:(?:每日 ?)?24 ?小時(?: ?開放)?|全日 ?開放|(?:open )?24 (?:hours|hrs)(?: daily)?)$/.test(text);
}

function FacilityDirections({ facility }: { facility: Facility }) {
  const { copy, locale } = useLanguage();
  const labels = copy.nearby.navigation;
  const isOfficialToilet = facility.category === 'toilets' && (facility.source === 'fehd' || facility.source === 'afcd');
  const isLcsdPark = facility.category === 'parks' && facility.source === 'lcsd-parks';
  const isLcsdPetFacility = facility.category === 'pets'
    && (facility.source === 'lcsd-pet-gardens' || facility.source === 'lcsd-inclusive-pet-parks');
  if (!isOfficialToilet && !isLcsdPark && !isLcsdPetFacility) return null;

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={labels.directions}
      onPress={() => void showFacilityDirections(facility, locale, labels)}
      style={({ pressed }) => [styles.roundAction, pressed && styles.pressed]}>
      <Icon name="location" size={18} />
    </Pressable>
  );
}

export function FacilityServiceNotice({ remarks }: { remarks?: string }) {
  const { copy } = useLanguage();
  return (
    <View style={[styles.serviceNotice, !remarks && styles.serviceNoticeBadge]}>
      <AppText variant="caption">{copy.nearby.serviceNotice}</AppText>
      {remarks && <AppText variant="detail">{remarks}</AppText>}
    </View>
  );
}

export function FacilityDetails({ facility, distance, type, usesFallback, mode }: {
  facility: Facility; distance?: number; type?: string; usesFallback: boolean; mode: 'map' | 'list';
}) {
  const { copy, locale } = useLanguage();
  const labels = copy.nearby;
  const { fontScale } = useWindowDimensions();
  const favorite = useFacilityFavorite(facility);
  const favoriteLabels = labels.facilityFavorites;
  const favoriteLabel = favorite.busy && favorite.saved === undefined ? favoriteLabels.loading
    : favorite.issue === 'read' ? favoriteLabels.retry
    : favorite.saved ? favoriteLabels.remove : favoriteLabels.add;
  const openingHours = facility.openingHours && facilityText(facility.openingHours, locale);
  const isPetGarden = facility.category === 'pets';
  const hoursLabel = openingHours && (isPetGarden && !facility.serviceNotice
    && [facility.openingHours?.['zh-HK'], facility.openingHours?.en].every((hours) => !hours?.trim() || isAllDayOpeningHours(hours))
      ? labels.allDayOpeningHours : labels.officialHours(openingHours));
  const remarks = facility.remarks && facilityText(facility.remarks, locale);
  const details = facility.details && facilityText(facility.details, locale);
  const phone = facility.phone && facilityText(facility.phone, locale);
  const showFullDetails = !isPetGarden || mode === 'list';
  return (
    <>
      {facility.serviceNotice ? <FacilityServiceNotice remarks={remarks} />
        : showFullDetails && remarks && <AppText variant="detail" tone="muted">{labels.officialRemarks(remarks)}</AppText>}
      <View style={styles.directionsRow}>
        <View style={[styles.grow, { flexBasis: 140 * Math.max(1, fontScale) }]}>
          {type && (isPetGarden ? <PetGardenTypeBadge label={type} /> : <AppText variant="caption" tone="muted">{type}</AppText>)}
          {distance !== undefined && (
            <AppText variant="caption" tone="primary">{labels.directDistance(facilityDistance(distance, copy.nearbyBus))}</AppText>
          )}
          {hoursLabel ? <AppText variant="detail" tone="muted">{hoursLabel}</AppText>
            : (facility.category === 'parks' || isPetGarden) && <AppText variant="detail" tone="muted">{labels.parkHoursUnavailable}</AppText>}
          {showFullDetails && details && <AppText variant="detail" tone="muted">{labels.officialDetails(details)}</AppText>}
          {showFullDetails && phone && <AppText variant="detail" tone="muted">{labels.venueEnquiries(phone)}</AppText>}
          {facility.petAccess ? <SharedPetRules access={facility.petAccess} expanded={showFullDetails} />
            : isPetGarden && <AppText variant="caption" tone="muted">{labels.petGardenRules}</AppText>}
          {usesFallback && <AppText variant="caption" tone="muted">{labels.originalLanguage}</AppText>}
        </View>
        <View style={styles.facilityActions}>
          <Pressable accessibilityRole="button" accessibilityLabel={favoriteLabel}
            accessibilityState={{ selected: favorite.saved, disabled: !favorite.onPress, busy: favorite.busy }}
            disabled={!favorite.onPress} onPress={favorite.onPress}
            style={({ pressed }) => [styles.roundAction, pressed && styles.pressed]}>
            {favorite.busy ? <ActivityIndicator accessible={false} size="small" color={colors.primary} />
              : <Icon name={favorite.issue === 'read' ? 'arrow.clockwise' : favorite.saved ? 'bookmark.fill' : 'bookmark'}
                color={favorite.issue === 'unavailable' ? colors.muted : colors.primary} size={18} />}
          </Pressable>
          {favorite.facility && <FacilityDirections facility={favorite.facility} />}
        </View>
      </View>
      {favorite.issue && (
        <AppText variant="caption" tone={favorite.issue === 'unavailable' ? 'muted' : 'error'} accessibilityRole="alert">
          {favoriteLabels[favorite.issue]}
        </AppText>
      )}
    </>
  );
}

function FacilitySummary({ facility, distance, onClose }: { facility: Facility; distance?: number; onClose: () => void }) {
  const { copy, locale } = useLanguage();
  const labels = copy.nearby;
  const visual = facilityVisuals[facility.category];
  const name = facilityText(facility.name, locale);
  const type = facility.officialType === 'toilet' ? undefined : facilityType(facility, locale, labels);
  const place = facilityPlace(facility, locale);
  const usesFallback = [facility.name, facility.area ?? facility.district, facility.address, facility.typeName,
    facility.openingHours, facility.remarks, facility.details].some((field) => facilityTextUsesFallback(field, locale));
  return (
    <>
      <View style={styles.selectedSummary}>
        <View style={[styles.facilityIcon, { backgroundColor: visual.surface }]}><Icon name={visual.icon} color={visual.color} size={23} /></View>
        <View style={styles.grow}>
          <AppText variant="homeCardTitle">{name}</AppText>
          {place !== '' && <AppText variant="detail" tone="muted">{place}</AppText>}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={labels.closeFacility} onPress={onClose}
          style={({ pressed }) => [styles.roundAction, pressed && styles.pressed]}>
          <Icon name="xmark" size={15} />
        </Pressable>
      </View>
      <FacilityDetails facility={facility} distance={distance} mode="map" type={type} usesFallback={usesFallback} />
    </>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0, gap: space.xs },
  petGardenType: {
    alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: colors.tint, borderRadius: radius.pill,
    paddingHorizontal: space.sm, paddingVertical: space.xs,
  },
  directionsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: space.sm },
  facilityActions: { flexDirection: 'row', flexShrink: 0, marginLeft: 'auto', gap: space.xs },
  facilityIcon: { width: touchTarget, height: touchTarget, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  serviceNotice: { gap: space.xs, padding: space.sm, borderRadius: radius.control, backgroundColor: homeColors.cream },
  serviceNoticeBadge: { alignSelf: 'flex-start', paddingVertical: space.xs },
  selectedCard: {
    marginHorizontal: homeLayout.gutter, marginTop: space.sm, borderRadius: radius.largeCard, backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  selectedContents: { padding: space.md, gap: space.sm },
  selectedSummary: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  samePointChoice: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  roundAction: {
    width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.pill, backgroundColor: colors.tint,
  },
  pressed: { opacity: 0.72 },
});
