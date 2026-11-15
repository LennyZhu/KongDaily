import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { Image, Pressable, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

import { AppText, Icon, type IconName } from '@/components/ui';
import type { Messages } from '@/i18n';
import { colors, homeColors, homeLayout, radius, shadows, space, touchTarget } from '@/theme';

type HomeCopy = Messages['home'];

export function HomeLink({ href, style, label, children }: PropsWithChildren<{
  href: Href;
  style: StyleProp<ViewStyle>;
  label?: string;
}>) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.navigate(href)}
      style={({ pressed }) => [style, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

export function HomeHero({ name, subtitle, search }: Pick<HomeCopy, 'name' | 'subtitle' | 'search'>) {
  return (
    <View style={styles.hero}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.heroPhoto}>
          <Image
            source={require('../../assets/home/victoria-harbour.jpg')}
            style={styles.photo}
            resizeMode="cover"
            accessible={false}
          />
        </View>
        <LinearGradient
          colors={[homeColors.harbourSky, homeColors.harbourVeil, homeColors.harbourWash]}
          locations={[0, 0.34, 0.69]}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[homeColors.pageWash, homeColors.pageWash, colors.background]}
          locations={[0, 0.66, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={styles.brand}>
        <LinearGradient
          colors={[colors.primarySoft, colors.primary, homeColors.weatherDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.brandMark}
        >
          <Icon name="water.waves" color={colors.onPrimary} size={28} />
        </LinearGradient>
        <View style={styles.brandCopy}>
          <AppText variant="brand" accessibilityRole="header">{name}</AppText>
          <AppText variant="brandSubtitle" tone="muted">{subtitle}</AppText>
        </View>
        <Icon name="bell" color={colors.text} size={21} />
      </View>

      <HomeLink href="/search" label={search} style={styles.search}>
        <Icon name="magnifyingglass" size={22} />
        <AppText
          variant="detail"
          numberOfLines={1}
          maxFontSizeMultiplier={1.45}
          tone="muted"
          style={styles.searchLabel}
        >
          {search}
        </AppText>
        <Icon name="viewfinder" size={20} />
      </HomeLink>
    </View>
  );
}

export function WeatherCard({
  weatherEmpty,
  weatherDetail,
  weatherLocation,
  weatherStatus,
}: Pick<HomeCopy, 'weatherEmpty' | 'weatherDetail' | 'weatherLocation' | 'weatherStatus'>) {
  return (
    <LinearGradient
      colors={[homeColors.weatherBright, colors.primary, homeColors.weatherDeep]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0.84 }}
      style={styles.weather}
    >
      <View pointerEvents="none" style={[styles.weatherWave, styles.weatherWaveLeft]} />
      <View pointerEvents="none" style={[styles.weatherWave, styles.weatherWaveRight]} />
      <View style={styles.weatherIcon}>
        <Icon name="cloud.fill" size={35} color={homeColors.weatherIcon} />
      </View>
      <View style={styles.weatherCopy}>
        <AppText variant="weatherTitle" tone="onPrimary" accessibilityRole="header">{weatherEmpty}</AppText>
        <AppText variant="brandSubtitle" tone="onPrimaryMuted">{weatherDetail}</AppText>
      </View>
      <View style={styles.weatherStatus}>
        <View style={styles.weatherLocation}>
          <Icon name="mappin" size={13} color={colors.onPrimary} />
          <AppText variant="caption" tone="onPrimary" style={styles.flexText}>{weatherLocation}</AppText>
        </View>
        <AppText variant="brandSubtitle" tone="onPrimaryMuted">{weatherStatus}</AppText>
      </View>
    </LinearGradient>
  );
}

type SectionProps = PropsWithChildren<{
  title: string;
  icon: IconName;
  action?: { label: string; href: Href };
}>;

export function HomeSection({ title, icon, action, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeading}>
          <Icon name={icon} size={22} />
          <AppText variant="homeHeading" style={styles.flexText} accessibilityRole="header">{title}</AppText>
        </View>
        {action && (
          <HomeLink href={action.href} label={action.label} style={styles.sectionLink}>
            <AppText
              variant="detail"
              numberOfLines={1}
              maxFontSizeMultiplier={1.4}
              tone="muted"
              style={styles.flexText}
            >
              {action.label}
            </AppText>
            <Icon name="chevron.right" size={11} color={colors.textSecondary} />
          </HomeLink>
        )}
      </View>
      {children}
    </View>
  );
}

export function QuickLinkCard({ href, icon, label, backgroundColor, iconColor }: {
  href: Href;
  icon: IconName;
  label: string;
  backgroundColor: string;
  iconColor?: string;
}) {
  return (
    <HomeLink href={href} label={label} style={[styles.quickLink, { backgroundColor }]}>
      <Icon name={icon} size={26} color={iconColor} />
      <AppText variant="detail" numberOfLines={2} maxFontSizeMultiplier={1.35} style={styles.quickLabel}>
        {label}
      </AppText>
    </HomeLink>
  );
}

export function FeaturedCard({ source, title, detail }: {
  source: ImageSourcePropType;
  title: string;
  detail: string;
}) {
  return (
    <View style={styles.featured}>
      <Image source={source} resizeMode="cover" style={styles.photo} accessible={false} />
      <LinearGradient
        colors={[homeColors.photoClear, homeColors.photoShade, homeColors.photoInk]}
        locations={[0.23, 0.53, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.featuredCopy}>
        <AppText variant="homeCardTitle" numberOfLines={2} maxFontSizeMultiplier={1.35} tone="onPrimary">
          {title}
        </AppText>
        <AppText variant="caption" numberOfLines={1} maxFontSizeMultiplier={1.35} tone="onPrimary">
          {detail}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: space.section + space.sm,
    paddingTop: space.md,
    paddingHorizontal: homeLayout.gutter,
    paddingBottom: space.xl,
    overflow: 'hidden',
    backgroundColor: homeColors.harbourSky,
  },
  heroPhoto: { ...StyleSheet.absoluteFill, top: space.xl },
  photo: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  brandMark: {
    width: homeLayout.brandMark,
    height: homeLayout.brandMark,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandCopy: { flex: 1, minWidth: 0, gap: space.xs },
  search: {
    minHeight: homeLayout.searchHeight,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.xs,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadows.search,
  },
  searchLabel: { flex: 1, minWidth: 0 },
  weather: {
    minHeight: homeLayout.weatherHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.largeCard,
    overflow: 'hidden',
    backgroundColor: colors.primary,
  },
  weatherIcon: {
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherCopy: { flex: 1, minWidth: 0, gap: space.xs },
  weatherStatus: {
    maxWidth: '28%',
    paddingLeft: space.sm,
    gap: space.xs,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: homeColors.weatherDivider,
  },
  weatherLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  weatherWave: { position: 'absolute', bottom: -49, width: '73%', height: 63, borderRadius: '50%' },
  weatherWaveLeft: { left: '-10%', backgroundColor: homeColors.weatherWaveLight, transform: [{ rotate: '4deg' }] },
  weatherWaveRight: { right: '-9%', backgroundColor: homeColors.weatherWave, transform: [{ rotate: '-8deg' }] },
  section: { gap: space.xs },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  sectionHeading: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flexText: { flexShrink: 1, minWidth: 0 },
  sectionLink: {
    minHeight: touchTarget,
    maxWidth: '46%',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: space.xs,
    paddingLeft: space.xs,
  },
  quickLink: {
    flex: 1,
    minWidth: 0,
    minHeight: homeLayout.quickLinkHeight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.xs,
    paddingHorizontal: space.xs,
    borderRadius: radius.card,
  },
  quickLabel: { alignSelf: 'stretch', fontWeight: '600', textAlign: 'center' },
  featured: {
    flex: 1,
    minWidth: 0,
    minHeight: homeLayout.featuredHeight,
    overflow: 'hidden',
    borderRadius: radius.media,
    backgroundColor: homeColors.weatherDeep,
  },
  featuredCopy: {
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    paddingTop: homeLayout.featuredCaptionTop,
  },
  pressed: { opacity: 0.8 },
});
