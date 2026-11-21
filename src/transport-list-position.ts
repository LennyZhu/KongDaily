import { useFocusEffect } from 'expo-router';
import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';
import type { FlatList, FlatListProps, NativeScrollEvent, NativeSyntheticEvent, ViewToken } from 'react-native';

type Anchor = { key: string; index: number };
type Restore = { anchors: Anchor[]; index: number; offset: number };
type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;

export function useTransportListPosition<Item>(
  enabled: boolean, scope: string, rows: readonly Item[], list: RefObject<FlatList<Item> | null>, itemKey: (item: Item) => string,
) {
  const previous = useRef<{ scope: string; rows: readonly Item[] }>(undefined);
  const anchors = useRef<Anchor[]>([]);
  const offset = useRef(0);
  const focused = useRef(false);
  const scrolling = useRef(false);
  const frame = useRef<number>(undefined);
  const pending = useRef<Restore>(undefined);
  const restoring = useRef<Restore>(undefined);

  const restoreAfterLayout = useCallback(() => {
    if (!focused.current || !pending.current || frame.current !== undefined) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      const restore = pending.current;
      pending.current = undefined;
      if (!restore || scrolling.current || !focused.current) return;
      restoring.current = restore;
      try {
        list.current?.scrollToIndex({ index: restore.index, animated: false });
      } finally {
        restoring.current = undefined;
      }
    });
  }, [list]);

  useFocusEffect(useCallback(() => {
    if (!enabled) return;
    focused.current = true;
    restoreAfterLayout();
    return () => {
      focused.current = false;
      scrolling.current = false;
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
      frame.current = undefined;
    };
  }, [enabled, restoreAfterLayout]));

  useLayoutEffect(() => {
    if (!enabled) return;
    const before = previous.current;
    previous.current = { scope, rows };
    if (before?.scope !== scope) {
      anchors.current = [];
      offset.current = 0;
      scrolling.current = false;
      pending.current = undefined;
      return;
    }
    if (before.rows === rows) return;

    const visible = pending.current?.anchors ?? anchors.current;
    const first = visible[0];
    if (!rows.length || !first || offset.current <= 0 || scrolling.current) {
      pending.current = undefined;
      return;
    }

    const keys = rows.map(itemKey);
    const surviving = visible.find(({ key }) => keys.includes(key));
    const index = surviving ? keys.indexOf(surviving.key) : Math.min(first.index, rows.length - 1);
    // Stable rows keep the native offset. Only changed prefixes need an anchor adjustment.
    if (!pending.current && keys.slice(0, index + 1)
      .every((key, i) => before.rows[i] !== undefined && key === itemKey(before.rows[i]))) return;

    pending.current = { anchors: visible, index, offset: offset.current };
    restoreAfterLayout();
  }, [enabled, itemKey, restoreAfterLayout, rows, scope]);

  const recordVisible = useCallback((items: ViewToken<Item>[]) => {
    anchors.current = items.flatMap(({ item, index }) => index === null ? [] : [{ key: itemKey(item), index }])
      .sort((a, b) => a.index - b.index);
  }, [itemKey]);

  function startScroll() {
    scrolling.current = true;
    anchors.current = [];
    pending.current = undefined;
  }

  function endScroll() {
    scrolling.current = false;
  }

  const onScrollToIndexFailed: NonNullable<FlatListProps<Item>['onScrollToIndexFailed']> = ({ averageItemLength }) => {
    const restore = restoring.current;
    if (restore) {
      const delta = restore.index - restore.anchors[0].index;
      list.current?.scrollToOffset({ offset: Math.max(0, restore.offset + delta * averageItemLength), animated: false });
    }
  };

  return {
    recordVisible,
    scrollProps: enabled ? {
      scrollEventThrottle: 32,
      onScroll: ({ nativeEvent }: ScrollEvent) => { offset.current = nativeEvent.contentOffset.y; },
      onScrollBeginDrag: startScroll,
      onScrollEndDrag: endScroll,
      onMomentumScrollBegin: startScroll,
      onMomentumScrollEnd: endScroll,
      onScrollToIndexFailed,
    } : undefined,
  };
}
