import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useBusEta } from '@/bus-eta-hooks';
import { describeEta, etaEntryNotes } from '@/bus-eta';
import { favoriteEtaHref, type BusFavorite } from '@/bus-favorites';
import { routePlaceName } from '@/bus-routes';
import { AppText, Icon, type IconName } from '@/components/ui';
import { useLanguage } from '@/language';
import { colors, radius, space, touchTarget } from '@/theme';

export function FavoriteBusRow({ favorite, destination, trailing, children }: {
  favorite: BusFavorite;
  destination?: string;
  trailing?: ReactNode;
  children?: ReactNode;
}) {
  const router = useRouter();
  const { copy, locale } = useLanguage();
  const { target } = favorite;
  const stop = routePlaceName(favorite.station, locale) || copy.busDetail.unavailableName;
  const to = destination || routePlaceName(favorite.destination, locale);
  const direction = target.source === 'nlb' ? copy.busDetail.routeOptions : copy.bus.directions[target.direction];
  const operator = copy.bus.sources[target.source];

  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(favoriteEtaHref(favorite))}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.line}>
        <View style={styles.badge}><Icon name="bus" color={colors.onPrimary} size={17} /></View>
        <AppText variant="section" style={styles.route}>{target.number}</AppText>
        <View style={styles.copy}>
          <AppText variant="homeCardTitle">{stop}</AppText>
          <AppText variant="detail">{to ? copy.busDetail.towards(to) : direction}</AppText>
          <AppText variant="brandSubtitle" tone="muted">
            {operator} · {copy.busDetail.stopOrder(target.stopSeq)}
            {target.source === 'kmbLwb' && target.serviceType !== '1' ? ` · ${copy.bus.service(target.serviceType)}` : ''}
          </AppText>
        </View>
        {trailing}
        <Icon name="chevron.right" color={colors.muted} size={12} />
      </View>
      {children}
    </Pressable>
  );
}

export function HomeFavoriteBus({ favorite, unavailable }: { favorite: BusFavorite; unavailable: boolean }) {
  // Each row is keyed by its complete stop-visit ID, so order changes preserve the active ETA request.
  const [target] = useState(favorite.target);
  const { copy, locale } = useLanguage();
  const { snapshot, error, now, loading } = useBusEta(target, locale, !unavailable);
  const eta = copy.busEta;
  const view = describeEta(snapshot, error, now, loading, locale, eta);
  const [next, later] = unavailable ? [] : view.upcoming;
  const to = next?.destination && routePlaceName(next.destination, locale);
  const countdown = (minutes: number) => minutes === 0 ? eta.due : `${eta.minutes.prefix}${minutes}${eta.minutes.suffix}`;
  const status = unavailable ? copy.busFavorites.unavailable : next ? undefined : view.status;
  const note = unavailable ? undefined : view.notices[0] || (next && etaEntryNotes(next, locale));
  const updating = loading && !!snapshot && !error && !unavailable;
  const errorText = unavailable ? undefined : view.errorText;
  const updateText = !next || errorText ? view.updateText : undefined;

  return (
    <View style={savedBusStyles.card}>
      <FavoriteBusRow favorite={favorite} destination={to} trailing={next && (
        <View style={styles.arrivals}>
          <AppText variant="title" tone="primary" style={styles.countdown}>{countdown(next.minutes)}</AppText>
          {later && <AppText variant="brandSubtitle" tone="muted" style={styles.countdown}>{countdown(later.minutes)}</AppText>}
        </View>
      )}>
        {(status || note || errorText || updateText || updating) && (
          <View style={styles.etaStatus}>
            {status && <AppText variant="detail" tone="muted">{status}</AppText>}
            {note && <AppText variant="brandSubtitle" tone="muted" numberOfLines={2}>{note}</AppText>}
            {errorText && <AppText variant="brandSubtitle" tone="error">{errorText}</AppText>}
            {updating && <AppText variant="brandSubtitle" tone="muted">{eta.refreshing}</AppText>}
            {updateText && <AppText variant="caption" tone="muted">{updateText}</AppText>}
          </View>
        )}
      </FavoriteBusRow>
    </View>
  );
}

export function FavoriteAction({ label, icon, onPress, disabled, destructive }: {
  label: string;
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} onPress={onPress}
      style={({ pressed }) => [styles.action, disabled && styles.disabled, pressed && styles.pressed]}>
      <Icon name={icon} size={14} color={destructive ? colors.error : colors.primary} />
      <AppText variant="caption" tone={destructive ? 'error' : 'primary'} style={styles.actionLabel}>{label}</AppText>
    </Pressable>
  );
}

export const savedBusStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: radius.media, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
});

const styles = StyleSheet.create({
  row: { padding: space.md, minHeight: touchTarget, gap: space.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  badge: {
    height: 32, width: 32, borderRadius: radius.control, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  route: { flexShrink: 1 },
  copy: { flex: 1, minWidth: 56, gap: space.xs },
  arrivals: { maxWidth: '33%', alignItems: 'flex-end', gap: space.xs },
  countdown: { textAlign: 'right', fontVariant: ['tabular-nums'] },
  etaStatus: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: space.sm, gap: space.xs },
  action: {
    minHeight: touchTarget, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: space.xs,
    paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.control, backgroundColor: colors.tint,
  },
  actionLabel: { flexShrink: 1 },
  disabled: { opacity: 0.5 },
  pressed: { backgroundColor: colors.pressed },
});
