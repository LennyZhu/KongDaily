import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';

import { changeBusFavorites } from '@/bus-favorite-hooks';
import { busFavoriteId, type BusVisitSummary } from '@/bus-favorites';
import { setGmbFavorite, type GmbFavorite } from '@/gmb-favorites';
import { homePinKey, useHomePins } from '@/home-transport-pins';
import { useHomeTransitIntent } from '@/home-transit-intent';
import { useLanguage } from '@/language';
import { saveRailwayToHome } from '@/railway-favorite-hooks';
import type { RailwayFavoriteIdentity } from '@/railway-favorites';
import { AppText, Icon } from '@/components/ui';
import { colors, space, touchTarget } from '@/theme';

type HomeService = { mode: 'bus'; visit: BusVisitSummary } | RailwayFavoriteIdentity | GmbFavorite;

export function useHomeTransitSave(service: HomeService, saved: boolean) {
  const enabled = useHomeTransitIntent();
  const { pins } = useHomePins();
  const { copy } = useLanguage();
  const pin = service.mode === 'bus' ? { mode: 'bus' as const, id: busFavoriteId(service.visit.target) } : service;
  const key = homePinKey(pin);
  const pinned = pins.some((item) => homePinKey(item) === homePinKey(pin));
  const pending = useRef(false);
  const active = useRef(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ key: string; text: string }>();
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  async function save() {
    if (!enabled || pending.current) return;
    pending.current = true;
    setBusy(true);
    let result: 'ok' | 'limit' | 'failed';
    try {
      result = service.mode === 'bus'
        ? await changeBusFavorites({ type: 'save', visit: service.visit, pinToHome: true })
        : service.mode === 'gmb' ? await setGmbFavorite(service, true, true) : await saveRailwayToHome(service);
    } catch { result = 'failed'; }
    pending.current = false;
    if (!active.current) return;
    const text = result === 'failed' ? copy.busFavorites.saveError : result === 'limit'
      ? copy.homeAddTransit.full : saved ? copy.homeAddTransit.pinned : copy.homeAddTransit.savedAndPinned;
    setFeedback({ key, text });
    setBusy(false);
    AccessibilityInfo.announceForAccessibility(text);
  }
  const message = feedback?.key === key ? feedback.text : undefined;
  return { enabled, pinned, busy, message, save };
}

export function HomeTransitPinAction({ action, saved }: {
  action: ReturnType<typeof useHomeTransitSave>;
  saved: boolean;
}) {
  const { copy } = useLanguage();
  if (!action.enabled) return null;
  const showShortcut = saved && !action.pinned;
  const showFeedback = action.message && (action.pinned || action.message === copy.busFavorites.saveError
    || (saved && action.message === copy.homeAddTransit.full));
  if (!showShortcut && !showFeedback) return null;
  return <View style={styles.content}>
    {showShortcut && <Pressable accessibilityRole="button" accessibilityLabel={copy.busFavorites.pin}
      accessibilityState={{ disabled: action.busy, busy: action.busy }} disabled={action.busy}
      onPress={() => void action.save()} style={styles.action}>
      <Icon name="pin" size={16} />
      <AppText variant="caption" tone="primary">{copy.busFavorites.pin}</AppText>
    </Pressable>}
    {showFeedback && <AppText variant="caption" accessibilityLiveRegion="polite">{action.message}</AppText>}
  </View>;
}

const styles = StyleSheet.create({
  content: { gap: space.xs },
  action: { minHeight: touchTarget, minWidth: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
