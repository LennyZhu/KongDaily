import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Keyboard, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { facilityVisuals } from '@/components/nearby-facilities-map';
import { AppText, Icon, type IconName } from '@/components/ui';
import { facilityId, facilityText, petFacilityType } from '@/facilities';
import { useLanguage } from '@/language';
import { canSearchLandsd, LandsdSearchError, normalizePlaceQuery, placeSearchDebounceMs, placeSearchMaxLength,
  searchLandsd, type LandsdSearchIssue, type LandsdSearchResponse } from '@/landsd-location-search';
import type { NearbyLocationIssue } from '@/nearby-bus-location';
import { searchNearbyPlaces, type NearbySearchResult } from '@/nearby-place-search';
import { colors, homeLayout, radius, space, touchTarget, typography } from '@/theme';

type OnlineSearch = { query: string; attempt: number } & ({ response: LandsdSearchResponse } | { issue: LandsdSearchIssue });

export function NearbySearchSheet({ onChoose, onClose, onEdit, onLocate, locating, locationIssue }: {
  onChoose: (result: NearbySearchResult) => void;
  onClose: () => void;
  onEdit: () => void;
  onLocate: () => void;
  locating: boolean;
  locationIssue?: NearbyLocationIssue;
}) {
  const { copy, locale } = useLanguage();
  const { nearby: labels, nearbyBus } = copy;
  const text = labels.placeSearch;
  const input = useRef<TextInput>(null);
  const [value, setValue] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [online, setOnline] = useState<OnlineSearch>();
  const [active, setActive] = useState(AppState.currentState !== 'background');
  const query = normalizePlaceQuery(value);
  const ready = canSearchLandsd(query);
  const current = online?.query === query && online.attempt === attempt ? online : undefined;
  const response = current && 'response' in current ? current.response : undefined;
  const issue = current && 'issue' in current ? current.issue : undefined;
  const local = useMemo(() => searchNearbyPlaces(query), [query]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!ready || !active) return;
    const controller = new AbortController();
    const { signal } = controller;
    const timer = setTimeout(async () => {
      try {
        const response = await searchLandsd(query, signal);
        if (!signal.aborted) setOnline({ query, attempt, response });
      } catch (error) {
        if (!signal.aborted) {
          setOnline({ query, attempt, issue: error instanceof LandsdSearchError ? error.kind : 'unavailable' });
        }
      }
    }, placeSearchDebounceMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [active, attempt, query, ready]);

  function edit(next: string) {
    onEdit();
    if (normalizePlaceQuery(next) !== query) setOnline(undefined);
    setValue(next);
  }

  function choose(result: NearbySearchResult) {
    Keyboard.dismiss();
    onChoose(result);
  }

  const addressLine = (...fields: (Parameters<typeof facilityText>[0] | undefined)[]) =>
    [...new Set(fields.flatMap((field) => field ? [facilityText(field, locale)] : []).filter(Boolean))].join(' · ');

  return (
    <Modal visible presentationStyle="pageSheet" animationType="slide" onShow={() => input.current?.focus()} onRequestClose={onClose}>
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.screen} accessibilityViewIsModal>
        <View style={styles.header}>
          <View style={styles.field}>
            <Icon name="magnifyingglass" size={20} />
            <TextInput ref={input} style={styles.input} value={value} onChangeText={edit} maxLength={placeSearchMaxLength}
              accessibilityLabel={labels.searchPlaces} placeholder={labels.searchPlaces} placeholderTextColor={colors.muted}
              returnKeyType="search" autoCapitalize="none" autoCorrect={false} />
            {!!value && (
              <Pressable accessibilityRole="button" accessibilityLabel={text.clear}
                onPress={() => { edit(''); input.current?.focus(); }}
                style={({ pressed }) => [styles.clear, pressed && styles.pressed]}>
                <Icon name="xmark.circle.fill" size={18} color={colors.muted} />
              </Pressable>
            )}
          </View>
          <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
            <AppText variant="detail" tone="primary" style={styles.cancelText}>{labels.navigation.cancel}</AppText>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.results} keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
          {!query && (
            <SearchRow icon="location" title={locating ? nearbyBus.locating : labels.useLocation} busy={locating}
              onPress={() => { Keyboard.dismiss(); onLocate(); }} />
          )}
          {locationIssue && <AppText variant="detail" tone="muted" accessibilityRole="alert">{nearbyBus.issues[locationIssue]}</AppText>}
          {!!query && (
            <SearchGroup title={text.facilities} count={text.count(local.facilities.length, local.facilityCount)}>
              {local.facilities.length === 0 && <SearchStatus>{text.noFacilities}</SearchStatus>}
              {local.facilities.map((facility) => (
                <SearchRow key={facilityId(facility)} icon={facilityVisuals[facility.category].icon} title={facilityText(facility.name, locale)}
                  detail={addressLine(facility.area ?? facility.district, facility.address)}
                  source={facility.category === 'pets' ? petFacilityType(facility, labels)
                    : facility.sourceName ? facilityText(facility.sourceName, locale) : undefined}
                  onPress={() => choose({ kind: 'facility', facility })} />
              ))}
            </SearchGroup>
          )}
          {local.landmarks.length > 0 && (
            <SearchGroup title={labels.landmarks} count={text.count(local.landmarks.length, local.landmarks.length)}>
              {local.landmarks.map((landmark) => (
                <SearchRow key={landmark} icon="mappin" title={nearbyBus.landmarks[landmark]}
                  onPress={() => choose({ kind: 'landmark', landmark })} />
              ))}
            </SearchGroup>
          )}
          {!!query && (
            <SearchGroup title={text.places} count={response && text.count(response.places.length, response.total)}>
              {!ready ? <SearchStatus>{text.moreCharacters}</SearchStatus> : issue ? (
                <View style={styles.status}>
                  <AppText variant="detail" tone="muted" accessibilityRole="alert">{text.issues[issue]}</AppText>
                  <Pressable accessibilityRole="button" style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
                    onPress={() => setAttempt((previous) => previous + 1)}>
                    <AppText variant="caption" tone="primary">{text.retry}</AppText>
                  </Pressable>
                </View>
              ) : response ? (
                <>
                  {response.places.length === 0 && !response.invalidCoordinates && <SearchStatus>{text.noPlaces}</SearchStatus>}
                  {response.places.map((place) => (
                    <SearchRow key={place.id} icon="mappin" title={facilityText(place.name, locale)}
                      detail={addressLine(place.district, place.address)}
                      source={text.source} onPress={() => choose({ kind: 'place', place })} />
                  ))}
                  {!!response.invalidCoordinates && <SearchStatus>
                    {response.places.length ? text.invalidCoordinates : text.noValidCoordinates}
                  </SearchStatus>}
                </>
              ) : (
                <SearchStatus loading={active}>{active ? text.loading : text.issues.unavailable}</SearchStatus>
              )}
            </SearchGroup>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function SearchGroup({ title, count, children }: { title: string; count?: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <View style={styles.groupTitle}>
        <AppText variant="homeHeading" accessibilityRole="header">{title}</AppText>
        {!!count && <AppText variant="caption" tone="muted">{count}</AppText>}
      </View>
      {children}
    </View>
  );
}

function SearchStatus({ children, loading }: { children: string; loading?: boolean }) {
  return (
    <View style={styles.status} accessibilityLiveRegion="polite">
      {loading && <ActivityIndicator color={colors.primary} />}
      <AppText variant="detail" tone="muted" style={styles.rowText}>{children}</AppText>
    </View>
  );
}

function SearchRow({ icon, title, detail, source, busy, onPress }: {
  icon: IconName; title: string; detail?: string; source?: string; busy?: boolean; onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.icon}>{busy ? <ActivityIndicator color={colors.primary} /> : <Icon name={icon} size={18} />}</View>
      <View style={styles.rowText}>
        <AppText variant="homeCardTitle">{title}</AppText>
        {!!detail && <AppText variant="detail" tone="muted">{detail}</AppText>}
        {!!source && <AppText variant="caption" tone="muted">{source}</AppText>}
      </View>
      <Icon name="chevron.right" size={13} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: homeLayout.gutter, paddingVertical: space.sm },
  field: {
    flex: 1, minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingLeft: space.md, paddingRight: space.xs, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface,
  },
  input: { ...typography.body, color: colors.text, flex: 1, minWidth: 0, paddingVertical: space.sm },
  cancel: { minWidth: touchTarget, minHeight: touchTarget, maxWidth: '33%', alignItems: 'center', justifyContent: 'center' },
  cancelText: { textAlign: 'center' },
  clear: { width: touchTarget, minHeight: touchTarget, justifyContent: 'center', alignItems: 'center' },
  results: { padding: homeLayout.gutter, paddingTop: space.sm, gap: space.lg },
  group: { gap: space.xs },
  groupTitle: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: space.xs },
  row: {
    minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm,
    backgroundColor: colors.surface, borderRadius: radius.control, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, minWidth: 0, gap: space.xs },
  icon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.tint },
  status: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space.xs, paddingVertical: space.xs },
  retry: { minHeight: touchTarget, minWidth: touchTarget, justifyContent: 'center', paddingHorizontal: space.sm },
  pressed: { opacity: 0.72 },
});
