import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ExploreArtwork, exploreCategoryIcons } from '@/components/explore-artwork';
import { AppText, EmptyState, Icon, Screen, type IconName } from '@/components/ui';
import { getExplorePlace, getExploreTrailhead, type ExplorePlace } from '@/explore-places';
import { isOfficialExploreUrl, selectExploreSources } from '@/explore-sources';
import { useLanguage } from '@/language';
import { colors, radius, space, touchTarget } from '@/theme';

export default function ExplorePlaceScreen() {
  const router = useRouter();
  const { copy, locale } = useLanguage();
  const { explore } = copy;
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const place = typeof id === 'string' ? getExplorePlace(id) : undefined;
  const trailhead = supportsUnifiedMaps() ? getExploreTrailhead(place) : undefined;
  const backToExplore = () => router.dismissTo('/explore');

  return (
    <>
      <Stack.Screen options={{
        headerBackVisible: true,
        headerLeft: ({ canGoBack }) => canGoBack ? null : (
          <Pressable accessibilityRole="button" accessibilityLabel={explore.backToExplore}
            onPress={backToExplore} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
            <Icon name="chevron.left" size={17} />
          </Pressable>
        ),
      }} />
      <Screen hasHeader>
        {place ? (
          <>
            <View style={styles.identity}>
              <View style={styles.meta}>
                <View style={styles.category}>
                  <Icon name={exploreCategoryIcons[place.category]} size={14} />
                  <AppText variant="caption" tone="primary" style={styles.shrink}>{explore.categories[place.category]}</AppText>
                </View>
                <View style={styles.district}>
                  <Icon name="mappin" size={13} color={colors.muted} />
                  <AppText variant="detail" tone="muted" style={styles.shrink}>{place.district[locale]}</AppText>
                </View>
              </View>
              <AppText variant="display" accessibilityRole="header" style={styles.title}>{place.title[locale]}</AppText>
            </View>
            <ExploreArtwork category={place.category} banner />
            <AppText>{place.summary[locale]}</AppText>
            <View style={styles.section}>
              <AppText variant="homeHeading" accessibilityRole="header">{explore.highlights}</AppText>
              {place.highlights.map((highlight) => (
                <View style={styles.highlight} key={highlight['zh-HK']}>
                  <View style={styles.dot} />
                  <AppText variant="detail" style={styles.copy}>{highlight[locale]}</AppText>
                </View>
              ))}
            </View>
            <View style={styles.travelCard}>
              <AppText variant="weatherTitle" accessibilityRole="header">{explore.travelNotes}</AppText>
              <TravelRow icon="bus" title={explore.transport} body={place.transport[locale]} />
              <View style={styles.divider} />
              <TravelRow icon="info.circle" title={explore.cautions} body={place.cautions[locale]} />
            </View>
            <OfficialSources place={place} />
            {trailhead && <TrailheadDirections name={trailhead.name[locale]} url={trailhead.url} />}
          </>
        ) : (
          <>
            <EmptyState icon="safari" title={explore.placeUnavailable} />
            <Pressable accessibilityRole="button" onPress={backToExplore}
              style={({ pressed }) => [styles.sourceLink, pressed && styles.pressed]}>
              <Icon name="chevron.left" size={14} />
              <AppText variant="title" tone="primary" style={styles.copy}>{explore.backToExplore}</AppText>
            </Pressable>
          </>
        )}
      </Screen>
    </>
  );
}

function TravelRow({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <View style={styles.travelRow}>
      <Icon name={icon} size={17} />
      <View style={styles.travelText}>
        <AppText variant="homeCardTitle" accessibilityRole="header">{title}</AppText>
        <AppText variant="detail" tone="muted">{body}</AppText>
      </View>
    </View>
  );
}

function OfficialSources({ place }: { place: ExplorePlace }) {
  const { copy: { explore }, locale } = useLanguage();
  const openExternalLink = useExploreExternalLink(explore.linkFailed);
  const sources = selectExploreSources(place, locale);

  function openSource(url: string) {
    if (!isOfficialExploreUrl(url)) {
      Alert.alert(explore.linkFailed);
      return;
    }
    void openExternalLink(url);
  }

  return (
    <View style={styles.section}>
      <AppText variant="homeHeading" accessibilityRole="header">{explore.sources}</AppText>
      {sources.map((source) => {
        const language = source.language === locale || source.language === 'bilingual'
          ? undefined : explore.sourceLanguages[source.language];
        return (
          <Pressable key={source.id} accessibilityRole="link"
            accessibilityLabel={[source.title[locale], source.organization[locale], language].filter(Boolean).join(', ')}
            accessibilityHint={explore.externalLinkHint} onPress={() => openSource(source.url)}
            style={({ pressed }) => [styles.sourceLink, pressed && styles.pressed]}>
            <Icon name="link" size={16} />
            <View style={styles.sourceText}>
              <AppText variant="homeCardTitle" tone="primary">{source.title[locale]}</AppText>
              <AppText variant="caption" tone="muted">
                {[source.organization[locale], language].filter(Boolean).join(' · ')}
              </AppText>
            </View>
            <Icon name="arrow.up.right" size={13} />
          </Pressable>
        );
      })}
      <AppText variant="detail" tone="muted">{explore.sourceNote}</AppText>
    </View>
  );
}

function supportsUnifiedMaps() {
  if (Platform.OS !== 'ios') return false;
  const [major, minor = 0] = String(Platform.Version).split('.').map(Number);
  return major > 18 || (major === 18 && minor >= 4);
}

function TrailheadDirections({ name, url }: { name: string; url: string }) {
  const { copy: { explore: { trailhead } } } = useLanguage();
  const openExternalLink = useExploreExternalLink(trailhead.openFailed);

  return (
    <View style={styles.trailheadSection}>
      <AppText variant="title" accessibilityRole="header" style={styles.centered}>
        <AppText variant="detail" tone="muted">{`${trailhead.destination} · `}</AppText>
        {name}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${trailhead.action} · ${name}`}
        accessibilityHint={trailhead.detail}
        onPress={() => { void openExternalLink(url); }}
        style={({ pressed }) => [styles.trailheadButton, pressed && styles.trailheadPressed]}
      >
        <Icon name="location" size={18} color={colors.onPrimary} />
        <AppText variant="title" tone="onPrimary" style={styles.trailheadButtonText}>{trailhead.action}</AppText>
      </Pressable>
      <AppText variant="caption" tone="muted">{trailhead.detail}</AppText>
    </View>
  );
}

function useExploreExternalLink(errorTitle: string) {
  const { copy: { explore } } = useLanguage();
  const opening = useRef(false);

  return async function open(url: string) {
    if (opening.current) return;
    opening.current = true;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(errorTitle, explore.linkFailedDetail, [
        { text: explore.cancel, style: 'cancel' },
        { text: explore.retryLink, onPress: () => { void open(url); } },
      ]);
    } finally {
      opening.current = false;
    }
  };
}

const styles = StyleSheet.create({
  identity: { gap: space.sm },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md },
  category: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: space.xs,
    backgroundColor: colors.tint, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill },
  district: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: space.xs },
  title: { fontSize: 32 },
  shrink: { flexShrink: 1 },
  copy: { flex: 1, minWidth: 0 },
  section: { gap: space.sm },
  highlight: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  dot: { width: 5, height: 5, marginTop: space.sm, borderRadius: radius.pill, backgroundColor: colors.primary },
  travelCard: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1,
    borderColor: colors.border, padding: space.lg, gap: space.md },
  travelRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  travelText: { flex: 1, minWidth: 0, gap: space.xs },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  sourceLink: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touchTarget,
    paddingVertical: space.sm, paddingHorizontal: space.lg, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.control },
  sourceText: { flex: 1, minWidth: 0, gap: space.xs },
  headerButton: { minWidth: touchTarget, minHeight: touchTarget, borderRadius: radius.control,
    justifyContent: 'center', alignItems: 'center' },
  centered: { textAlign: 'center' },
  trailheadSection: { gap: space.xs },
  trailheadButton: {
    minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm,
    borderRadius: radius.control, backgroundColor: colors.primary,
  },
  trailheadButtonText: { flexShrink: 1, minWidth: 0, textAlign: 'center' },
  trailheadPressed: { opacity: 0.86 },
  pressed: { backgroundColor: colors.pressed },
});
