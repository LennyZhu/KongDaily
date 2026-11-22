import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, Pressable, StyleSheet, TextInput, View, type FlatListProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBusCatalogue } from '@/bus-hooks';
import { GlobalSearchResultRow, searchGroupIcons } from '@/components/global-search-result-row';
import { SearchHarbourIllustration } from '@/components/search-harbour-illustration';
import { AppText, EmptyState, Icon } from '@/components/ui';
import {
  globalSearchKinds, globalSearchMaxLength, loadGlobalBusStops, prepareGlobalSearchQuery, searchGlobal,
  type GlobalBusStopsState, type GlobalSearchCategory, type GlobalSearchGroup, type GlobalSearchKind, type GlobalSearchResult,
} from '@/global-search';
import { searchResultDestination } from '@/global-search-navigation';
import type { Messages } from '@/i18n';
import { useLanguage } from '@/language';
import { colors, radius, space, touchTarget, typography } from '@/theme';

const previewLimit = 5;
const debounceMs = 180;
type SearchCopy = Messages['search'];
type ListRow = {
  type: 'group'; key: string; kind: GlobalSearchKind; canExpand: boolean;
} | {
  type: 'result'; key: string; result: GlobalSearchResult; first: boolean; last: boolean;
};
type ListAnchor = { key: string; index: number };

export default function SearchScreen() {
  const { copy } = useLanguage();
  const labels = copy.search;
  const router = useRouter();
  const input = useRef<TextInput>(null);
  const list = useRef<FlatList<ListRow>>(null);
  const opening = useRef(false);
  const visibleAnchor = useRef<ListAnchor>(undefined);
  const latestRows = useRef<ListRow[]>([]);
  const returnPosition = useRef<{ list: FlatList<ListRow> | null; offset: number; anchor?: ListAnchor }>(undefined);
  const anchorFallback = useRef(0);
  const sequence = useRef(0);
  const scrollPositions = useRef<Partial<Record<GlobalSearchCategory, number>>>({});
  const [draft, setDraft] = useState({ text: '', id: 0 });
  const [settledId, setSettledId] = useState(0);
  const [category, setCategory] = useState<GlobalSearchCategory>('all');
  const [catalogueRequested, setCatalogueRequested] = useState(false);
  const [busStops, setBusStops] = useState<GlobalBusStopsState>({ status: 'not_loaded' });
  const { feeds, failed, loading: catalogueLoading, retry: retryCatalogue } = useBusCatalogue(catalogueRequested);
  const prepared = useMemo(() => prepareGlobalSearchQuery(draft.text), [draft.text]);
  const searching = prepared.status === 'ready' && settledId !== draft.id;
  const canSearch = prepared.status === 'ready' && !searching;
  const canSearchNames = canSearch && prepared.terms.matchNames;
  const needsCatalogue = canSearch && (category === 'all' || category === 'transport_route');
  const needsStops = canSearchNames && (category === 'all' || category === 'transport_stop');

  useEffect(() => {
    if (!searching) return;
    const timer = setTimeout(() => setSettledId(draft.id), debounceMs);
    return () => clearTimeout(timer);
  }, [draft.id, searching]);

  useEffect(() => {
    if (needsCatalogue) setCatalogueRequested(true);
  }, [needsCatalogue]);

  useEffect(() => {
    if (needsStops && busStops.status === 'not_loaded') setBusStops({ status: 'loading' });
  }, [needsStops, busStops.status]);

  useEffect(() => {
    if (busStops.status !== 'loading') return;
    let active = true;
    void loadGlobalBusStops().then((stops) => { if (active) setBusStops(stops); });
    return () => { active = false; };
  }, [busStops.status]);

  const result = useMemo(() => canSearch ? searchGlobal(draft.text, {
    category, busStops, requestId: draft.id,
    busCatalogue: catalogueRequested ? { feeds, failed, loading: catalogueLoading } : undefined,
  }) : undefined, [canSearch, draft, category, busStops, catalogueRequested, feeds, failed, catalogueLoading]);
  const groups = result?.queryStatus === 'ready'
    ? result.groups.filter(({ kind }) => kind === 'transport_route' || canSearchNames) : [];
  const rows = resultRows(groups, category);
  const pendingSources = groups.some((group) => group.status === 'loading' || group.status === 'not_loaded'
    || ((group.kind === 'transport_route' || group.kind === 'transport_stop')
      && (group.bus?.status === 'loading' || group.bus?.status === 'not_loaded'))
    || (group.kind === 'transport_route' && group.bus?.status === 'partial' && catalogueLoading));
  const incomplete = groups.some((group) => group.status !== 'ready'
    || (group.kind === 'transport_route' && group.bus && Object.values(group.bus.sources).some(({ failure }) => !!failure)));
  const scopedGroup = category === 'all' ? undefined : groups[0];
  const offsets = scrollPositions.current;
  const initialOffset = useMemo(() => ({ x: 0, y: offsets[category] ?? 0 }), [category, offsets]);
  const queryStatus = result?.queryStatus ?? prepared.status;
  const showEmpty = canSearch && queryStatus === 'ready' && !rows.length && !pendingSources;

  useLayoutEffect(() => { latestRows.current = rows; }, [rows]);

  useFocusEffect(useCallback(() => {
    opening.current = false;
    const position = returnPosition.current;
    returnPosition.current = undefined;
    const frame = position && requestAnimationFrame(() => {
      const current = list.current;
      if (!current || current !== position.list || opening.current) return;
      const index = latestRows.current.findIndex(({ key }) => key === position.anchor?.key);
      if (position.anchor && index >= 0 && index !== position.anchor.index) {
        anchorFallback.current = position.offset;
        current.scrollToIndex({ index, animated: false });
      } else {
        current.scrollToOffset({ offset: position.offset, animated: false });
      }
    });
    return () => {
      opening.current = true;
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, []));

  const onViewableItemsChanged: NonNullable<FlatListProps<ListRow>['onViewableItemsChanged']> = useCallback(
    ({ viewableItems }) => {
      const first = viewableItems[0];
      visibleAnchor.current = typeof first?.index === 'number' ? { key: first.key, index: first.index } : undefined;
    }, [],
  );

  function edit(text: string) {
    scrollPositions.current = {};
    setDraft({ text, id: ++sequence.current });
    if (!text.trim()) setCategory('all');
  }

  function chooseCategory(next: GlobalSearchCategory) {
    // A late scroll event from the old list must not overwrite the saved return position.
    scrollPositions.current = { ...scrollPositions.current };
    Keyboard.dismiss();
    setCategory(next);
  }

  function openResult(result: GlobalSearchResult) {
    if (opening.current) return;
    const target = searchResultDestination(result);
    if ('issue' in target) {
      Alert.alert(labels[target.issue]);
      return;
    }

    const anchor = visibleAnchor.current;
    returnPosition.current = {
      list: list.current, offset: scrollPositions.current[category] ?? 0,
      anchor: anchor && rows[anchor.index]?.key === anchor.key ? anchor : undefined,
    };
    opening.current = true;
    Keyboard.dismiss();
    try {
      router.push(target.href);
    } catch {
      opening.current = false;
      returnPosition.current = undefined;
      Alert.alert(labels.openFailed);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <View style={[styles.searchBar, !!draft.text && styles.filledSearchBar]}>
        <Icon name="magnifyingglass" size={22} />
        <TextInput ref={input} value={draft.text} onChangeText={edit}
          onSubmitEditing={() => setSettledId(draft.id)} submitBehavior="blurAndSubmit"
          accessibilityLabel={labels.placeholder} placeholder={labels.placeholder}
          placeholderTextColor={colors.muted} selectionColor={colors.primary}
          maxLength={globalSearchMaxLength} returnKeyType="search" autoCapitalize="none" autoCorrect={false}
          style={styles.input} />
        {!!draft.text && (
          <Pressable accessibilityRole="button" accessibilityLabel={labels.clear} onPress={() => {
            edit('');
            input.current?.focus();
          }} style={({ pressed }) => [styles.control, styles.clear, pressed && styles.pressed]}>
            <Icon name="xmark.circle.fill" size={19} color={colors.muted} />
          </Pressable>
        )}
      </View>
      {category !== 'all' && (
        <Pressable accessibilityRole="button" onPress={() => chooseCategory('all')}
          style={({ pressed }) => [styles.control, styles.returnButton, pressed && styles.pressed]}>
          <Icon name="chevron.left" size={13} />
          <AppText variant="detail" tone="primary" style={styles.buttonText}>{labels.backToAll}</AppText>
        </Pressable>
      )}
      <FlatList<ListRow> ref={list} key={`${draft.id}:${category}`} data={rows}
        contentContainerStyle={styles.list} contentOffset={initialOffset}
        onScroll={({ nativeEvent }) => { offsets[category] = Math.max(0, nativeEvent.contentOffset.y); }}
        onViewableItemsChanged={onViewableItemsChanged}
        onScrollToIndexFailed={() => list.current?.scrollToOffset({ offset: anchorFallback.current, animated: false })}
        scrollEventThrottle={32} initialNumToRender={10} maxToRenderPerBatch={10}
        contentInsetAdjustmentBehavior="never" automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        ListHeaderComponent={(
          <>
            {groups.map((group) => (
              <SourceNotice key={group.kind} group={group} labels={labels} retryLabel={copy.bus.retry}
                catalogueLoading={catalogueLoading} retryCatalogue={retryCatalogue}
                retryStops={() => setBusStops({ status: 'loading' })} />
            ))}
          </>
        )}
        ListEmptyComponent={(
          queryStatus === 'empty' ? <Introduction labels={labels} selected={category} onChoose={(kind) => {
            chooseCategory(kind); input.current?.focus();
          }} />
            : searching ? <Feedback text={labels.searching} busy />
            : queryStatus === 'too_short' ? <Feedback text={labels.tooShort} />
            : queryStatus === 'too_long' ? <Feedback text={labels.tooLong(globalSearchMaxLength)} />
            : showEmpty ? <EmptyState icon="magnifyingglass" title={incomplete ? labels.emptyAvailable : labels.empty} detail={labels.emptyDetail} />
            : null
        )}
        ListFooterComponent={scopedGroup?.hasMore ? (
          <View style={styles.listFoot}>
            <AppText variant="detail" tone="muted">{labels.shown(scopedGroup.results.length, scopedGroup.totalMatches)}</AppText>
            <AppText variant="caption" tone="muted">{labels.refine}</AppText>
          </View>
        ) : null}
        keyExtractor={(row) => row.key}
        renderItem={({ item }) => item.type === 'result'
          ? <GlobalSearchResultRow result={item.result} first={item.first} last={item.last} onPress={openResult} />
          : <GroupHeading kind={item.kind} labels={labels} onExpand={item.canExpand ? () => chooseCategory(item.kind) : undefined} />}
      />
    </SafeAreaView>
  );
}

function resultRows(groups: readonly GlobalSearchGroup[], category: GlobalSearchCategory): ListRow[] {
  return groups.flatMap((group): ListRow[] => {
    const displayed = category === 'all' ? group.results.slice(0, previewLimit) : group.results;
    if (!displayed.length) return [];
    return [
      { type: 'group', key: `group:${group.kind}`, kind: group.kind, canExpand: category === 'all' && group.totalMatches > previewLimit },
      ...displayed.map((result, index): ListRow => ({
        type: 'result', key: result.key, result, first: index === 0, last: index === displayed.length - 1,
      })),
    ];
  });
}

function Introduction({ labels, selected, onChoose }: {
  labels: SearchCopy; selected: GlobalSearchCategory; onChoose: (kind: GlobalSearchKind) => void;
}) {
  return (
    <View style={styles.intro}>
      <SearchHarbourIllustration />
      <View style={styles.introCopy}>
        <AppText variant="section" accessibilityRole="header" style={styles.center}>{labels.introduction}</AppText>
        <AppText variant="detail" tone="muted" style={styles.center}>{labels.prompt}</AppText>
      </View>
      <View style={styles.guide}>
        {globalSearchKinds.map((kind) => (
          <Pressable key={kind} accessibilityRole="button" accessibilityLabel={labels.groups[kind]}
            accessibilityState={{ selected: selected === kind }} onPress={() => onChoose(kind)}
            style={({ pressed }) => [styles.guideRow, pressed && styles.pressed]}>
            <View style={styles.guideIcon}><Icon name={searchGroupIcons[kind]} size={20} /></View>
            <View style={styles.guideText}>
              <AppText variant="homeCardTitle">{labels.groups[kind]}</AppText>
              <AppText variant="detail" tone="muted">{labels.examples[kind]}</AppText>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function GroupHeading({ kind, labels, onExpand }: { kind: GlobalSearchKind; labels: SearchCopy; onExpand?: () => void }) {
  const title = labels.groups[kind];
  return (
    <View style={styles.groupHeading}>
      <View style={styles.groupTitle}>
        <Icon name={searchGroupIcons[kind]} size={21} />
        <AppText variant="homeHeading" accessibilityRole="header" style={styles.buttonText}>{title}</AppText>
      </View>
      {onExpand && (
        <Pressable accessibilityRole="button" accessibilityLabel={labels.viewAllFor(title)} onPress={onExpand}
          style={({ pressed }) => [styles.control, pressed && styles.pressed]}>
          <AppText variant="detail" tone="primary" style={styles.buttonText}>{labels.viewAll}</AppText>
          <Icon name="chevron.right" size={13} />
        </Pressable>
      )}
    </View>
  );
}

function SourceNotice({ group, labels, catalogueLoading, retryLabel, retryCatalogue, retryStops }: {
  group: GlobalSearchGroup; labels: SearchCopy; catalogueLoading: boolean; retryLabel: string;
  retryCatalogue: () => void; retryStops: () => void;
}) {
  if (group.kind === 'transport_stop') {
    if (group.bus?.status === 'not_loaded') return <Feedback text={labels.stopsNotLoaded} />;
    if (group.bus?.status === 'loading') return <Feedback text={labels.stopsLoading} busy />;
    if (group.bus?.status === 'failed') return <Feedback text={labels.stopsFailed} retryLabel={retryLabel} onRetry={retryStops} />;
  }
  if (group.kind === 'transport_route' && group.bus) {
    const sources = Object.values(group.bus.sources);
    const failed = sources.some(({ failure }) => !!failure);
    const retry = failed && !catalogueLoading ? retryCatalogue : undefined;
    if (group.bus.status === 'not_loaded') return <Feedback text={labels.routeNotLoaded} />;
    if (group.bus.status === 'loading') return <Feedback text={labels.routeLoading} busy />;
    if (group.bus.status === 'failed') return <Feedback text={labels.routeFailed} retryLabel={retryLabel} onRetry={retry} />;
    if (group.bus.status === 'partial') return <Feedback text={labels.routePartial} busy={catalogueLoading} retryLabel={retryLabel} onRetry={retry} />;
    if (failed || sources.some(({ freshness }) => freshness === 'stale')) {
      return <Feedback text={labels.routeCached} busy={catalogueLoading} retryLabel={retryLabel} onRetry={retry} />;
    }
  }
  return null;
}

function Feedback({ text, busy = false, retryLabel, onRetry }: {
  text: string; busy?: boolean; retryLabel?: string; onRetry?: () => void;
}) {
  return (
    <View style={styles.feedback}>
      <View style={styles.feedbackCopy} accessibilityLiveRegion="polite"
        accessible={busy || undefined} accessibilityLabel={busy ? text : undefined}
        accessibilityRole={busy ? 'progressbar' : undefined} accessibilityState={busy ? { busy: true } : undefined}>
        {busy && <ActivityIndicator size="small" color={colors.primary} accessible={false} />}
        <AppText variant="detail" tone="muted" style={styles.buttonText}>{text}</AppText>
      </View>
      {!!onRetry && (
        <Pressable accessibilityRole="button" accessibilityHint={text} onPress={onRetry}
          style={({ pressed }) => [styles.control, pressed && styles.pressed]}>
          <AppText variant="detail" tone="primary" style={styles.buttonText}>{retryLabel}</AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.searchBackground },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, marginHorizontal: space.xl, marginVertical: space.sm,
    paddingLeft: space.lg, paddingRight: space.xs, minHeight: 50,
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.largeCard,
  },
  filledSearchBar: { backgroundColor: colors.tintedBackground, borderColor: colors.surface },
  input: { ...typography.body, flex: 1, minWidth: 0, color: colors.text, minHeight: touchTarget, paddingVertical: space.sm, paddingRight: space.xs },
  control: { minWidth: touchTarget, minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    flexShrink: 1, gap: space.xs, paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.control },
  clear: { flexShrink: 0 },
  pressed: { backgroundColor: colors.pressed },
  buttonText: { flexShrink: 1 },
  list: { paddingHorizontal: space.xl, paddingBottom: space.section, paddingTop: space.xs },
  listFoot: { marginTop: space.md, gap: space.xs },
  returnButton: { alignSelf: 'flex-start', marginHorizontal: space.xl },
  intro: { alignItems: 'center', gap: space.xl, paddingTop: space.lg },
  introCopy: { gap: space.sm, maxWidth: 420 },
  center: { textAlign: 'center' },
  guide: { alignSelf: 'stretch', gap: space.sm },
  guideRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm,
    backgroundColor: colors.pressed, borderRadius: radius.card },
  guideIcon: { width: 42, height: 42, borderRadius: radius.control, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  guideText: { flex: 1, minWidth: 0, gap: space.xs },
  groupHeading: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    justifyContent: 'space-between', gap: space.xs, marginTop: space.md, marginBottom: space.xs },
  groupTitle: { flexDirection: 'row', alignItems: 'center', minWidth: 0, flexShrink: 1, gap: space.sm },
  feedback: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm, paddingVertical: space.sm },
  feedbackCopy: { flexDirection: 'row', alignItems: 'center', minWidth: 0, flexGrow: 1, flexShrink: 1, gap: space.sm },
});
