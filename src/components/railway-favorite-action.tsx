import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon, PageHeading } from '@/components/ui';
import { useLanguage } from '@/language';
import { useRailwayFavorite } from '@/railway-favorite-hooks';
import { resolveRailwayService, type RailwayFavoriteIdentity } from '@/railway-favorites';
import { colors, radius, space, touchTarget } from '@/theme';

export function RailwayStationHeading({ title, description, identity, onChooseService, chooseHint }: {
  title: string;
  description: string;
  identity?: RailwayFavoriteIdentity;
  onChooseService: () => void;
  chooseHint: string;
}) {
  const { copy } = useLanguage();
  return (
    <View style={styles.heading}>
      <View style={styles.headingCopy}><PageHeading title={title} description={description} /></View>
      <View style={styles.headingAction}>
        {identity ? <RailwayFavoriteAction identity={identity} /> : (
          <FavoriteButton label={copy.railwayFavorites.save} accessibilityLabel={`${title} · ${copy.railwayFavorites.save}`}
            accessibilityHint={chooseHint} onPress={onChooseService} />
        )}
      </View>
    </View>
  );
}

export function RailwayFavoriteAction({ identity }: { identity: RailwayFavoriteIdentity }) {
  const { copy, locale } = useLanguage();
  const { saved, busy, issue, onPress } = useRailwayFavorite(identity);
  const service = resolveRailwayService(identity);
  if (!service) return null;
  const labels = copy.railwayFavorites;
  const line = identity.mode === 'light_rail' ? copy.lightRail.route(identity.lineId) : service.line[locale === 'en' ? 'en' : 'zh'];
  return (
    <View style={styles.favorite}>
      <FavoriteButton
        label={busy ? copy.busFavorites.stopLoading : issue === 'read' ? copy.bus.retry : saved ? labels.saved : labels.save}
        selected={issue === 'read' ? undefined : saved}
        accessibilityLabel={`${service.station[locale === 'en' ? 'en' : 'zh']} · ${line} · ${busy ? labels.loading
          : issue === 'read' ? copy.bus.retry : saved ? copy.busFavorites.remove : copy.busFavorites.save}`}
        busy={busy} onPress={() => void onPress()} />
      {issue && <AppText variant="detail" tone="error" accessibilityRole="alert">{labels[issue]}</AppText>}
    </View>
  );
}

function FavoriteButton({ label, selected, busy = false, accessibilityLabel, accessibilityHint, onPress }: {
  label: string;
  selected?: boolean;
  busy?: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, busy, disabled: busy }} disabled={busy} onPress={onPress}
      style={({ pressed }) => [styles.button, selected && styles.selected, busy && styles.busy, pressed && styles.pressed]}>
      {busy ? <ActivityIndicator color={colors.primary} size="small" />
        : <Icon name={selected ? 'bookmark.fill' : 'bookmark'} size={16} />}
      <AppText variant="detail" tone="primary" style={styles.buttonLabel}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: space.md },
  headingCopy: { flexBasis: 200, flexGrow: 1, flexShrink: 1, minWidth: 0 },
  headingAction: { marginLeft: 'auto', maxWidth: '100%' },
  favorite: { maxWidth: '100%', flexShrink: 1, alignItems: 'flex-start', gap: space.xs },
  button: {
    minHeight: touchTarget, minWidth: touchTarget, maxWidth: '100%', alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.md, paddingVertical: space.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radius.control, backgroundColor: colors.surface,
  },
  buttonLabel: { flexShrink: 1 },
  selected: { backgroundColor: colors.tint },
  pressed: { backgroundColor: colors.pressed },
  busy: { opacity: 0.65 },
});
