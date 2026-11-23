import type { Href } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { loadBusFavorites, useBusFavorites, useUnavailableFavorites } from '@/bus-favorite-hooks';
import { BusAction } from '@/components/bus-ui';
import { FeaturedCard, HomeHero, HomeLink, HomeSection, QuickLinkCard } from '@/components/home-ui';
import { HomeFavoriteBus } from '@/components/saved-bus-ui';
import { HomeFavoriteGmb } from '@/components/home-favorite-gmb';
import { HomeFavoriteRailway } from '@/components/home-favorite-railway';
import { AppText, EmptyState, Icon, Screen, type IconName } from '@/components/ui';
import { WeatherWarningLink } from '@/components/weather-warning-ui';
import { getExplorePhoto } from '@/explore-place-images';
import { getExplorePlace, homeFeaturedPlaceIds } from '@/explore-places';
import type { Messages } from '@/i18n';
import { useLanguage } from '@/language';
import { homePinKey, homeTransportLimit, loadHomePins, useHomePins } from '@/home-transport-pins';
import { loadGmbFavorites, useGmbFavorites } from '@/gmb-favorites';
import { loadRailwayFavorites, useRailwayFavorites } from '@/railway-favorite-hooks';
import { colors, homeColors, homeLayout, radius, space, touchTarget } from '@/theme';

const facilityMap = { pathname: '/nearby', params: { category: 'all', view: 'map' } } satisfies Href;

type QuickLink = {
  key: keyof Messages['home']['quickLinks'];
  icon: IconName | readonly IconName[];
  href: Href;
  backgroundColor: string;
  iconColor?: string;
};

const quickLinkRows = [
  [
    { key: 'bus', icon: ['bus', 'tram.fill.tunnel'], href: '/transport', backgroundColor: colors.tintedBackground },
    { key: 'toilets', icon: 'figure.dress.line.vertical.figure', href: '/nearby?category=toilets', backgroundColor: homeColors.cream },
    { key: 'pets', icon: 'pawprint', href: '/nearby?category=pets', backgroundColor: homeColors.peach, iconColor: homeColors.rustInk },
  ],
  [
    { key: 'parks', icon: 'tree', href: '/nearby?category=parks', backgroundColor: homeColors.green, iconColor: homeColors.greenInk },
    { key: 'hiking', icon: 'mountain.2', href: '/explore?category=hiking', backgroundColor: homeColors.blue, iconColor: homeColors.blueInk },
    { key: 'waterfront', icon: 'water.waves', href: '/explore?category=waterfront', backgroundColor: homeColors.lavender, iconColor: homeColors.blueInk },
  ],
] as const satisfies readonly (readonly [QuickLink, QuickLink, QuickLink])[];

const featuredCards = [
  { id: homeFeaturedPlaceIds.dragon, source: getExplorePhoto(homeFeaturedPlaceIds.dragon)?.source },
  { id: homeFeaturedPlaceIds.westKowloon, source: require('../../../assets/home/west-kowloon.jpg') },
] as const;

export default function HomeScreen() {
  const { copy, locale } = useLanguage();
  const { home } = copy;
  const { items, status } = useBusFavorites();
  const railway = useRailwayFavorites();
  const minibus = useGmbFavorites();
  const homePins = useHomePins();
  const cards = useMemo(() => {
    const busesById = new Map(items.map((favorite) => [favorite.id, favorite]));
    const minibusesById = new Map(minibus.items.map((favorite) => [favorite.id, favorite]));
    const railwaysByKey = new Map(railway.items.map((favorite) => [homePinKey(favorite), favorite]));
    return homePins.pins.map((pin) => {
      const key = homePinKey(pin);
      return pin.mode === 'bus'
        ? { key, bus: busesById.get(pin.id) }
        : pin.mode === 'gmb' ? { key, gmb: minibusesById.get(pin.id) }
          : { key, rail: railwaysByKey.get(key) };
    }).filter(({ bus, rail, gmb }) => bus || rail || gmb);
  }, [homePins.pins, items, railway.items, minibus.items]);
  const buses = useMemo(() => cards.flatMap(({ bus }) => bus ? [bus] : []), [cards]);
  const unavailable = useUnavailableFavorites(buses);
  const hasMinibusPin = homePins.pins.some(({ mode }) => mode === 'gmb');
  const waiting = status === 'loading' || railway.status === 'loading' || (hasMinibusPin && minibus.status === 'loading') || homePins.status === 'loading';
  const hasError = status === 'error' || railway.status === 'error' || (hasMinibusPin && minibus.status === 'error') || homePins.status === 'error';
  const canAddTransport = !waiting && !hasError && cards.length < homeTransportLimit;

  return (
    <Screen contentStyle={styles.screenContent} topBackgroundColor={homeColors.harbourSky}>
      <HomeHero name={home.name} subtitle={home.subtitle} search={home.search} />
      <View style={styles.sections}>
        <WeatherWarningLink compact />

        <HomeSection title={home.buses} icon="bus" action={{ label: copy.homeRailway.viewSaved, href: '/saved?category=all' }}>
          {cards.map(({ key, bus, rail, gmb }) => {
            if (bus) return <HomeFavoriteBus key={key} favorite={bus} unavailable={unavailable.has(bus.id)} />;
            if (gmb) return <HomeFavoriteGmb key={key} favorite={gmb} />;
            return rail ? <HomeFavoriteRailway key={key} favorite={rail} /> : null;
          })}
          {waiting && <AppText variant="detail" tone="muted">{copy.homePins.loading}</AppText>}
          {hasError && <>
            <AppText variant="detail" tone="error">{copy.homePins.loadError}</AppText>
            <BusAction label={copy.bus.retry} onPress={() => {
              void Promise.all([loadBusFavorites(), loadRailwayFavorites(), loadGmbFavorites(), loadHomePins()]);
            }} />
          </>}
          {cards.length === 0 && !waiting && !hasError && (
            <EmptyState icon="pin" title={copy.homePins.empty} detail={copy.homePins.emptyDetail} />
          )}
          {canAddTransport && (
            <HomeLink href="/transport" label={home.addFrequentRoute} style={styles.addBus}>
              <Icon name="plus" size={16} />
              <AppText variant="detail" tone="primary" style={styles.buttonLabel}>{home.addFrequentRoute}</AppText>
            </HomeLink>
          )}
        </HomeSection>

        <HomeSection title={home.shortcuts} icon="safari">
          <View style={styles.quickLinks}>
            {quickLinkRows.map((row) => (
              <View key={row[0].key} style={styles.row}>
                {row.map(({ key, ...link }) => (
                  <QuickLinkCard key={key} label={home.quickLinks[key]} {...link} />
                ))}
              </View>
            ))}
          </View>
        </HomeSection>

        <HomeSection title={home.nearby} icon="map" action={{ label: home.openMap, href: facilityMap }}>
          <HomeLink href={facilityMap} style={styles.nearbyCard}>
            <View style={styles.nearbyIcon}><Icon name="mappin.and.ellipse" size={24} /></View>
            <View style={styles.cardCopy}>
              <AppText variant="homeCardTitle">{home.nearbyTitle}</AppText>
              <AppText variant="detail" tone="muted">{home.nearbyDetail}</AppText>
            </View>
            <Icon name="chevron.right" size={13} />
          </HomeLink>
        </HomeSection>

        <HomeSection title={home.featured} icon="safari" action={{ label: home.browseExplore, href: '/explore?category=' }}>
          <View style={styles.row}>
            {featuredCards.map(({ id, source }) => {
              const place = getExplorePlace(id);
              if (!place || !source) return null;
              return (
                <FeaturedCard key={place.id}
                  href={{ pathname: '/explore/place/[id]', params: { id: place.id } }}
                  source={source}
                  title={place.title[locale]}
                  detail={copy.explore.categoryButtonLabels[place.category]}
                />
              );
            })}
          </View>
        </HomeSection>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: { paddingHorizontal: 0, paddingTop: 0, gap: 0 },
  sections: { paddingHorizontal: homeLayout.gutter, gap: homeLayout.sectionGap },
  cardCopy: { flex: 1, minWidth: 0, gap: space.xs },
  addBus: {
    maxWidth: '100%',
    minHeight: touchTarget,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.surface,
  },
  buttonLabel: { fontWeight: '600', flexShrink: 1 },
  quickLinks: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  nearbyCard: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.media,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  nearbyIcon: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    backgroundColor: colors.tintedBackground,
  },
});
