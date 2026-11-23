import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

import { AppText, EmptyState, Icon, type IconName } from '@/components/ui';
import type { Messages } from '@/i18n';
import { colors, homeLayout, radius, space, touchTarget, typography } from '@/theme';
import { tramFeatureEnabled } from '@/tram-feature';

type TransportCopy = Messages['transport'];
export type TransportMode = keyof TransportCopy['modes'];

const modeIcons = {
  all: 'square.grid.2x2', bus: 'bus', mtr: 'tram.fill.tunnel', lightRail: 'train.side.front.car',
  minibus: 'bus.fill', tram: 'tram', ferry: 'ferry',
} satisfies Record<TransportMode, IconName>;
const modes = (Object.keys(modeIcons) as TransportMode[]).filter((mode) => mode !== 'tram' || tramFeatureEnabled);

export function TransportModePicker({ copy, selected, onSelect }: {
  copy: TransportCopy; selected: TransportMode; onSelect: (mode: TransportMode) => void;
}) {
  const { width } = useWindowDimensions();
  const maxWidth = Math.max(touchTarget, width - 2 * homeLayout.gutter - touchTarget - 2 * space.md);
  const scroll = useRef<ScrollView>(null);
  const metrics = useRef({ viewport: 0, content: 0, offset: 0 });
  const [position, setPosition] = useState<'fit' | 'start' | 'middle' | 'end'>('fit');

  function updatePosition() {
    const { viewport, content, offset } = metrics.current;
    const end = content - viewport;
    setPosition(viewport <= 0 || end <= 1 ? 'fit' : offset >= end - 1 ? 'end' : offset > 1 ? 'middle' : 'start');
  }

  function scrollModes() {
    const { viewport, content, offset } = metrics.current;
    const x = position === 'end' ? 0 : Math.min(content - viewport, Math.max(0, offset) + Math.max(1, viewport - space.xl));
    scroll.current?.scrollTo({ x, animated: true });
  }

  const showLeadingFade = position === 'middle' || position === 'end';
  const showTrailingFade = position === 'start' || position === 'middle';
  return (
    <View style={styles.modePicker}>
      <View style={styles.modeTrack}>
        <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist"
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={styles.modeRow} scrollEventThrottle={32}
          onLayout={({ nativeEvent }) => { metrics.current.viewport = nativeEvent.layout.width; updatePosition(); }}
          onContentSizeChange={(content) => { metrics.current.content = content; updatePosition(); }}
          onScroll={({ nativeEvent }) => { metrics.current.offset = nativeEvent.contentOffset.x; updatePosition(); }}>
          {modes.map((mode) => {
            const active = mode === selected;
            return (
              <Pressable key={mode} accessibilityRole="tab" accessibilityState={{ selected: active }}
                onPress={() => onSelect(mode)}
                style={({ pressed }) => [styles.chip, { maxWidth }, active && styles.selected, pressed && styles.pressed]}>
                <Icon name={modeIcons[mode]} size={17} color={active ? colors.onPrimary : colors.primary} />
                <AppText variant="detail" tone={active ? 'onPrimary' : 'text'} style={styles.shrink}>{copy.modes[mode]}</AppText>
              </Pressable>
            );
          })}
        </ScrollView>
        {showLeadingFade && <LinearGradient pointerEvents="none" style={[styles.fade, styles.leadingFade]}
          colors={[colors.tintedBackground, `${colors.tintedBackground}00`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />}
        {showTrailingFade && <LinearGradient pointerEvents="none" style={[styles.fade, styles.trailingFade]}
          colors={[`${colors.tintedBackground}00`, colors.tintedBackground]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />}
      </View>
      {position !== 'fit' && (
        <Pressable accessibilityRole="button" accessibilityLabel={position === 'end' ? copy.firstModes : copy.moreModes}
          onPress={scrollModes} style={({ pressed }) => [styles.moreModes, pressed && styles.pressed]}>
          <Icon name={position === 'end' ? 'chevron.left' : 'chevron.right'} size={14} />
        </Pressable>
      )}
    </View>
  );
}

export function TransportUnavailable({ copy, mode }: { copy: TransportCopy; mode: TransportMode }) {
  return (
    <EmptyState icon={modeIcons[mode]} title={copy.unavailable(copy.modes[mode])} detail={copy.availableNow} />
  );
}

export function TransportSearch({ label, clearLabel, cancelLabel, query, onChange, autoFocus }: {
  label: string; clearLabel: string; cancelLabel: string; query: string;
  onChange: (query: string) => void; autoFocus: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);
  return (
    <View style={styles.searchRow}>
      <View style={styles.search}>
        <Pressable accessible={false} onPress={() => input.current?.focus()} style={styles.searchIcon}>
          <Icon name="magnifyingglass" size={18} />
        </Pressable>
        <TextInput ref={input} accessibilityLabel={label} placeholder={label} placeholderTextColor={colors.muted}
          selectionColor={colors.primary} value={query} onChangeText={onChange}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} autoFocus={autoFocus}
          autoCapitalize="none" autoCorrect={false} spellCheck={false} maxLength={80}
          returnKeyType="search" submitBehavior="blurAndSubmit" style={styles.searchInput} />
        {query.length > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel={clearLabel} onPress={() => onChange('')}
            style={({ pressed }) => [styles.searchControl, pressed && styles.pressed]}>
            <Icon name="xmark.circle.fill" size={18} color={colors.muted} />
          </Pressable>
        )}
      </View>
      {(focused || query.length > 0) && (
        <Pressable accessibilityRole="button" onPress={() => { onChange(''); Keyboard.dismiss(); }}
          style={({ pressed }) => [styles.searchControl, pressed && styles.pressed]}>
          <AppText variant="detail" tone="primary" style={styles.shrink}>{cancelLabel}</AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modePicker: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  modeTrack: { flex: 1, minWidth: 0 },
  modeRow: { gap: space.sm },
  fade: { position: 'absolute', width: space.lg, top: 0, bottom: 0 },
  leadingFade: { left: 0 },
  trailingFade: { right: 0 },
  moreModes: {
    minHeight: touchTarget, minWidth: touchTarget, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.pill, backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  chip: {
    minHeight: touchTarget, minWidth: touchTarget, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.xs, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  searchRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  search: {
    flexGrow: 1, flexBasis: 170, minHeight: touchTarget, flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.control, backgroundColor: colors.surface,
  },
  searchIcon: { width: touchTarget, minHeight: touchTarget, alignItems: 'center', justifyContent: 'center' },
  searchInput: { ...typography.detail, flex: 1, minWidth: 0, minHeight: touchTarget, paddingRight: space.xs, color: colors.text },
  searchControl: { minWidth: touchTarget, minHeight: touchTarget, maxWidth: '100%', alignItems: 'center', justifyContent: 'center' },
  shrink: { flexShrink: 1 },
  pressed: { opacity: 0.76 },
});
