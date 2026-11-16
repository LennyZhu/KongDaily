import type { Href } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { loadBusFavorites, useBusFavorites, useUnavailableFavorites } from '@/bus-favorite-hooks';
import { pinnedBuses } from '@/bus-favorites';
import { BusAction } from '@/components/bus-ui';
import { FeaturedCard, HomeHero, HomeLink, HomeSection, QuickLinkCard, WeatherCard } from '@/components/home-ui';
import { HomeFavoriteBus } from '@/components/saved-bus-ui';
import { AppText, EmptyState, Icon, Screen, type IconName } from '@/components/ui';
import type { Messages } from '@/i18n';
import { useLanguage } from '@/language';
import { colors, homeColors, homeLayout, radius, space, touchTarget } from '@/theme';

const busSearch = '/bus' satisfies Href;
const facilityMap = { pathname: '/nearby', params: { category: 'all' } } satisfies Href;

type QuickLink = {
  key: keyof Messages['home']['quickLinks'];
  icon: IconName;
  href: Href;
  backgroundColor: string;
  iconColor?: string;
};

const quickLinkRows = [
  [
    { key: 'bus', icon: 'bus', href: busSearch, backgroundColor: colors.tintedBackground },
    { key: 'toilets', icon: 'figure.dress.line.vertical.figure', href: '/nearby?category=toilets', backgroundColor: homeColors.cream },
    { key: 'pets', icon: 'pawprint', href: '/explore?category=pets', backgroundColor: homeColors.peach, iconColor: homeColors.rustInk },
  ],
  [
    { key: 'parks', icon: 'tree', href: '/nearby?category=parks', backgroundColor: homeColors.green, iconColor: homeColors.greenInk },
    { key: 'hiking', icon: 'mountain.2', href: '/explore?category=hiking', backgroundColor: homeColors.blue, iconColor: homeColors.blueInk },
    { key: 'waterfront', icon: 'water.waves', href: '/explore?category=waterfront', backgroundColor: homeColors.lavender, iconColor: homeColors.blueInk },
  ],
] as const satisfies readonly (readonly [QuickLink, QuickLink, QuickLink])[];

export default function HomeScreen() {
  const { copy } = useLanguage();
  const { home } = copy;
  const { items, status } = useBusFavorites();
  const pins = useMemo(() => pinnedBuses(items), [items]);
  const unavailable = useUnavailableFavorites(pins);

  return (
    <Screen contentStyle={styles.screenContent} topBackgroundColor={homeColors.harbourSky}>
      <HomeHero name={home.name} subtitle={home.subtitle} search={home.search} />
      <View style={styles.sections}>
        <WeatherCard
          weatherEmpty={home.weatherEmpty}
          weatherDetail={home.weatherDetail}
          weatherLocation={home.weatherLocation}
          weatherStatus={home.weatherStatus}
        />

        <HomeSection title={home.buses} icon="bus"
          action={{ label: items.length ? copy.busFavorites.manage : home.viewAll, href: '/saved?category=buses' }}>
          {status === 'loading' ? (
            <EmptyState icon="clock" title={copy.busFavorites.loading} />
          ) : status === 'error' ? (
            <>
              <EmptyState icon="exclamationmark.circle" title={copy.busFavorites.loadError} />
              <BusAction label={copy.bus.retry} onPress={() => void loadBusFavorites()} />
            </>
          ) : pins.length > 0 ? (
            <>
              {pins.map((favorite) => <HomeFavoriteBus key={favorite.id} favorite={favorite} unavailable={unavailable.has(favorite.id)} />)}
              <HomeAddBus label={home.addBus} />
            </>
          ) : items.length > 0 ? (
            <EmptyState icon="pin" title={copy.busFavorites.noPins} detail={copy.busFavorites.noPinsDetail} />
          ) : (
            <View style={styles.busCard}>
              <View style={styles.busSummary}>
                <Icon name="bus" color={colors.muted} size={34} />
                <View style={styles.busCopy}>
                  <AppText variant="homeCardTitle">{home.busEmpty}</AppText>
                  <AppText variant="detail" tone="muted">{home.busDetail}</AppText>
                </View>
              </View>
              <HomeAddBus label={home.addBus} />
            </View>
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
            <FeaturedCard
              source={require('../../../assets/home/dragons-back.jpg')}
              {...home.places.dragon}
            />
            <FeaturedCard
              source={require('../../../assets/home/west-kowloon.jpg')}
              {...home.places.westKowloon}
            />
          </View>
        </HomeSection>
      </View>
    </Screen>
  );
}

function HomeAddBus({ label }: { label: string }) {
  return (
    <HomeLink href={busSearch} label={label} style={styles.addBus}>
      <Icon name="plus" size={16} />
      <AppText variant="detail" numberOfLines={1} maxFontSizeMultiplier={1.4} tone="primary" style={styles.buttonLabel}>
        {label}
      </AppText>
    </HomeLink>
  );
}

const styles = StyleSheet.create({
  screenContent: { paddingHorizontal: 0, paddingTop: 0, gap: 0 },
  sections: { paddingHorizontal: homeLayout.gutter, gap: homeLayout.sectionGap },
  busCard: {
    alignItems: 'center',
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.largeCard,
    backgroundColor: homeColors.busEmpty,
  },
  busSummary: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
  },
  busCopy: { flexShrink: 1, minWidth: 0, gap: space.xs },
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
