import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { loadGmbFavorites, setGmbFavorite, useGmbFavorites, type GmbFavorite } from '@/gmb-favorites';
import { useLanguage } from '@/language';
import { colors, radius, space, touchTarget } from '@/theme';

export function GmbFavoriteAction({ favorite }: { favorite: GmbFavorite }) {
  const { copy, locale } = useLanguage();
  const { items, status } = useGmbFavorites();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const saved = items.some(({ id }) => id === favorite.id);
  const labels = copy.railwayFavorites;
  const service = copy.gmbFavorites.service(copy.minibus.stopLabel(favorite.stopSeq, favorite.stopName[locale]), favorite.destination[locale]);
  const label = status === 'error' ? copy.bus.retry : saved ? copy.busFavorites.remove : labels.save;

  async function press() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setFailed(false);
    try {
      if (status === 'error') await loadGmbFavorites();
      else setFailed(await setGmbFavorite(favorite, !saved) === 'failed');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const disabled = busy || status === 'loading';
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} · ${service}`}
      accessibilityState={{ selected: saved, busy: disabled, disabled }} disabled={disabled}
      onPress={() => void press()} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
      <View style={[styles.glyph, saved && styles.saved]}>
        <Icon name={saved ? 'bookmark.fill' : 'bookmark'} size={15} color={colors.primary} />
      </View>
      <AppText variant="detail" tone="primary" style={styles.text}>
        {status === 'error' ? label : saved ? labels.saved : label}
      </AppText>
    </Pressable>
    {(failed || status === 'error') && <AppText variant="caption" tone="error" accessibilityRole="alert" style={styles.error}>
      {status === 'error' ? labels.read : labels.write}
    </AppText>}
  </>;
}

const styles = StyleSheet.create({
  action: { minHeight: touchTarget, minWidth: touchTarget, maxWidth: '100%', flexDirection: 'row',
    alignItems: 'center', gap: space.xs, paddingHorizontal: space.xs },
  glyph: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: radius.control },
  saved: { backgroundColor: colors.tint },
  pressed: { opacity: 0.65 },
  text: { flexShrink: 1 },
  error: { flexBasis: '100%' },
});
