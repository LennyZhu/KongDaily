import { useLocales } from 'expo-localization';
import { SplashScreen } from 'expo-router';
import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { readLanguage, writeLanguage } from '@/database';
import { messages, type LanguagePreference, type Messages } from '@/i18n';
import { colors, radius, space, touchTarget, typography } from '@/theme';

type LanguageContextValue = {
  preference: LanguagePreference;
  locale: Exclude<LanguagePreference, 'system'>;
  copy: Messages;
  isSaving: boolean;
  saveFailed: boolean;
  changeLanguage: (language: LanguagePreference) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: PropsWithChildren) {
  const locales = useLocales();
  const systemLanguage = locales.find(({ languageCode }) => languageCode === 'en' || languageCode === 'zh');
  const systemPreference = systemLanguage?.languageCode === 'en' ? 'en' : 'zh-HK';
  const [preference, setPreference] = useState<LanguagePreference>();
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const saving = useRef(false);

  useEffect(() => {
    let active = true;
    readLanguage().then(
      (language) => {
        if (active) setPreference(language);
      },
      (error: unknown) => {
        console.error('Could not read KongDaily language settings', error);
        if (active) setLoadFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [loadAttempt]);

  async function changeLanguage(language: LanguagePreference) {
    if (saving.current || language === preference) return;
    saving.current = true;
    setIsSaving(true);
    setSaveFailed(false);

    try {
      await writeLanguage(language);
      setPreference(language);
    } catch (error) {
      console.error('Could not save KongDaily language settings', error);
      setSaveFailed(true);
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  if (!preference) {
    const copy = messages[systemPreference].settings;
    return (
      <View style={styles.startup}>
        {loadFailed ? (
          <>
            {/* The navigator is not mounted when reading the language fails. */}
            <Text style={styles.startupText} accessibilityRole="alert" onLayout={SplashScreen.hide}>
              {copy.loadError}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setLoadFailed(false);
                setLoadAttempt((attempt) => attempt + 1);
              }}
              style={styles.retry}
            >
              <Text style={styles.retryLabel}>{copy.retry}</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={colors.primary} accessibilityLabel={copy.loading} />
        )}
      </View>
    );
  }

  const locale = preference === 'system' ? systemPreference : preference;
  const copy = messages[locale];
  return (
    <LanguageContext value={{ preference, locale, copy, isSaving, saveFailed, changeLanguage }}>
      {children}
    </LanguageContext>
  );
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage requires LanguageProvider');
  return value;
}

const styles = StyleSheet.create({
  startup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xxl,
    gap: space.md,
    backgroundColor: colors.background,
  },
  startupText: { ...typography.title, color: colors.text, textAlign: 'center' },
  retry: {
    minHeight: touchTarget,
    paddingHorizontal: space.lg,
    borderRadius: radius.control,
    justifyContent: 'center',
    backgroundColor: colors.tint,
  },
  retryLabel: { ...typography.title, color: colors.primary },
});
