import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon, Screen } from '@/components/ui';
import { complianceDocuments } from '@/compliance-content';
import { languagePreferences } from '@/i18n';
import { useLanguage } from '@/language';
import { colors, radius, space, touchTarget } from '@/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const { copy, locale, preference, isSaving, saveFailed, changeLanguage } = useLanguage();
  const { settings, compliance } = copy;
  const { privacy, support } = complianceDocuments[locale];
  const aboutLinks = [
    { href: '/settings/privacy', label: privacy.title },
    { href: '/settings/support', label: support.title },
    { href: '/settings/credits', label: compliance.credits },
  ] as const;

  return (
    <Screen hasHeader>
      <View style={styles.section}>
        <View style={styles.heading}>
          <AppText variant="section" accessibilityRole="header">{settings.language}</AppText>
          {isSaving && <ActivityIndicator color={colors.primary} />}
        </View>
        <View style={styles.options}>
          {languagePreferences.map((language, index) => {
            const selected = preference === language;
            return (
              <Pressable
                key={language}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled: isSaving }}
                accessibilityLanguage={language === 'system' ? undefined : language}
                disabled={isSaving}
                onPress={() => void changeLanguage(language)}
                style={({ pressed }) => [styles.row, index > 0 && styles.separator, pressed && styles.pressed]}
              >
                <AppText variant="title" style={styles.rowLabel} tone={selected ? 'primary' : 'text'}>
                  {settings.options[language]}
                </AppText>
                {selected && <Icon name="checkmark" size={18} />}
              </Pressable>
            );
          })}
        </View>
        {saveFailed && <AppText variant="detail" tone="error" accessibilityRole="alert">{settings.saveError}</AppText>}
      </View>
      <View style={styles.section}>
        <AppText variant="section" accessibilityRole="header">{compliance.about}</AppText>
        <View style={styles.options}>
          {aboutLinks.map(({ href, label }, index) => (
            <Pressable key={href} accessibilityRole="link" onPress={() => router.push(href)}
              style={({ pressed }) => [styles.row, index > 0 && styles.separator, pressed && styles.pressed]}>
              <AppText variant="title" style={styles.rowLabel}>{label}</AppText>
              <Icon name="chevron.right" size={15} />
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  heading: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  options: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  row: {
    minHeight: touchTarget,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  rowLabel: { flex: 1 },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pressed: { backgroundColor: colors.pressed },
});
