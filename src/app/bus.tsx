import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { clearBusHistory, rememberBusSearch, type BusHistoryItem } from '@/bus-data';
import { useBusCatalogue, useBusHistory } from '@/bus-hooks';
import { busSources, matchBusRoutes, normalizeBusQuery, type BusRoute } from '@/bus-routes';
import { BusAction, BusHero, BusLanding, BusRouteRow } from '@/components/bus-ui';
import { AppText, EmptyState, Icon } from '@/components/ui';
import { useLanguage } from '@/language';
import { colors, homeColors, homeLayout, radius, space } from '@/theme';

// Retain the current input when the user visits Settings and reopens the bus page.
let sessionQuery = '';

export default function BusScreen() {
  const { copy, locale } = useLanguage();
  const bus = copy.bus;
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const input = useRef<TextInput>(null);
  const list = useRef<FlatList<BusRoute>>(null);
  const [query, setQuery] = useState(sessionQuery);
  const { feeds, failed, loading, retry } = useBusCatalogue();
  const { history, loadingHistory, historyFailed, changeHistory } = useBusHistory();

  const routes = useMemo(() => busSources.flatMap((source) => feeds[source]?.routes ?? []), [feeds]);
  const routesById = useMemo(() => new Map(routes.map((route) => [route.id, route])), [routes]);
  const results = useMemo(() => matchBusRoutes(routes, query), [routes, query]);
  const hasQuery = normalizeBusQuery(query).length > 0;
  const cacheSaveFailed = busSources.some((source) => feeds[source]?.persisted === false);
  const hasFailures = busSources.some((source) => failed[source]);

  function editQuery(value: string) {
    sessionQuery = value;
    setQuery(value);
  }

  function selectRoute(route: BusRoute) {
    Keyboard.dismiss();
    changeHistory(() => rememberBusSearch(route.number, route));
    router.push({ pathname: '/bus/route', params: { routeId: route.id } });
  }

  function openRecent(item: BusHistoryItem) {
    const route = item.route_id ? routesById.get(item.route_id) : undefined;
    if (route) {
      selectRoute(route);
      return;
    }
    editQuery(item.query);
    list.current?.scrollToOffset({ offset: 0, animated: false });
    changeHistory(() => rememberBusSearch(item.query));
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <FlatList
        ref={list}
        style={styles.page}
        contentContainerStyle={{ paddingBottom: bottom + space.section }}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        data={results}
        keyExtractor={(route) => route.id}
        renderItem={({ item }) => (
          <BusRouteRow copy={bus} locale={locale} route={item} onPress={() => selectRoute(item)} />
        )}
        ListHeaderComponent={(
          <>
            <BusHero
              copy={bus}
              inputRef={input}
              query={query}
              onChange={editQuery}
              onSubmit={() => changeHistory(() => rememberBusSearch(query))}
              onBack={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/');
              }}
            />
            {loading && routes.length === 0 && (
              <View style={styles.loading} accessibilityRole="progressbar">
                <ActivityIndicator color={colors.primary} />
                <AppText variant="detail" tone="muted" style={styles.shrink}>{bus.loading}</AppText>
              </View>
            )}
            {hasFailures && (
              <View style={styles.notice}>
                <View style={styles.noticeHeading}>
                  <Icon name="exclamationmark.circle" size={20} />
                  <AppText variant="homeCardTitle" accessibilityRole="alert" style={styles.shrink}>
                    {routes.length ? bus.updateFailed : bus.loadFailed}
                  </AppText>
                </View>
                {busSources.map((source) => {
                  const kind = failed[source];
                  if (!kind) return null;
                  return (
                    <AppText key={source} variant="detail" tone="muted">
                      {bus.sources[source]} · {bus.failureReasons[kind]}
                      {feeds[source] ? ` · ${bus.usingCache}` : ''}
                    </AppText>
                  );
                })}
                {!loading && <BusAction label={bus.retry} onPress={retry} />}
              </View>
            )}
            {(cacheSaveFailed || historyFailed) && (
              <View style={styles.notice}>
                {cacheSaveFailed && <AppText variant="detail" tone="muted">{bus.cacheSaveFailed}</AppText>}
                {historyFailed && <AppText variant="detail" tone="muted">{bus.historyError}</AppText>}
              </View>
            )}
            {hasQuery ? (
              <View style={styles.resultHeader}>
                <AppText variant="homeHeading" accessibilityRole="header">{bus.results}</AppText>
                {routes.length > 0 && <AppText variant="detail" tone="muted">{bus.resultCount(results.length)}</AppText>}
              </View>
            ) : (
              <BusLanding
                copy={bus}
                locale={locale}
                history={history}
                historyLoading={loadingHistory}
                routesById={routesById}
                onFocus={() => input.current?.focus()}
                onRecent={openRecent}
                onClear={() => Alert.alert(bus.clearHistoryTitle, undefined, [
                  { text: bus.cancel, style: 'cancel' },
                  { text: bus.clearHistory, style: 'destructive', onPress: () => changeHistory(clearBusHistory) },
                ])}
              />
            )}
          </>
        )}
        ListEmptyComponent={hasQuery && !loading && routes.length > 0 ? (
          <View style={styles.empty}>
            <EmptyState icon="magnifyingglass" title={bus.noResults} detail={bus.searchHint} />
          </View>
        ) : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: homeColors.harbourSky },
  page: { flex: 1, backgroundColor: colors.background },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: homeLayout.gutter,
    marginBottom: space.lg,
    padding: space.md,
  },
  notice: {
    marginHorizontal: homeLayout.gutter,
    marginBottom: space.lg,
    padding: space.md,
    borderRadius: radius.card,
    gap: space.xs,
    backgroundColor: colors.tintedBackground,
  },
  noticeHeading: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  shrink: { flexShrink: 1 },
  resultHeader: { marginHorizontal: homeLayout.gutter, marginBottom: space.md, gap: space.xs },
  empty: { paddingHorizontal: homeLayout.gutter },
});
