import { useRef } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon, PageHeading, Screen } from '@/components/ui';
import { complianceContact, complianceDocuments, compliancePublication, complianceReviewedOn, type ComplianceSection } from '@/compliance-content';
import { useLanguage } from '@/language';
import { colors, radius, space, touchTarget } from '@/theme';

type ComplianceDocumentProps = {
  title: string;
  intro?: string;
  sections: readonly ComplianceSection[];
  policy?: 'privacy' | 'support';
  contactSection?: string;
};

export function ComplianceDocumentScreen({ title, intro, sections, policy, contactSection }: ComplianceDocumentProps) {
  const { copy: { compliance }, locale } = useLanguage();
  const labels = complianceDocuments[locale];
  const opening = useRef(false);

  async function openSource(url: string) {
    if (opening.current) return;
    opening.current = true;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(compliance.linkFailed);
    } finally {
      opening.current = false;
    }
  }

  return (
    <Screen hasHeader>
      <View style={styles.heading}>
        <PageHeading title={title} description={intro} />
        {policy && (compliancePublication ? (
          <View>
            <AppText variant="detail" tone="muted">{labels.reviewDate} · {compliancePublication.updatedOn}</AppText>
            {policy === 'privacy' && (
              <AppText variant="detail" tone="muted">{labels.effectiveDate} · {compliancePublication.effectiveOn}</AppText>
            )}
          </View>
        ) : (
          <View style={styles.review}>
            <AppText variant="title" accessibilityRole="header">{labels.reviewStatus}</AppText>
            <AppText variant="detail">{labels.reviewNotice}</AppText>
            <AppText variant="detail" tone="muted">{labels.draftReviewDate} · {complianceReviewedOn}</AppText>
          </View>
        ))}
      </View>
      {sections.map(({ id, title: sectionTitle, paragraphs, links }) => (
        <View key={id} style={styles.section}>
          <AppText variant="homeHeading" accessibilityRole="header">{sectionTitle}</AppText>
          {paragraphs.map((paragraph) => <AppText key={paragraph}>{paragraph}</AppText>)}
          {(id === contactSection ? [...(links ?? []), complianceContact] : links)?.map(({ label, url }) => (
            <Pressable key={url} accessibilityRole="link" accessibilityHint={compliance.externalLink}
              onPress={() => { void openSource(url); }}
              style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
              <AppText variant="detail" tone="primary" style={styles.linkText}>{label}</AppText>
              <Icon name="arrow.up.right" size={13} />
            </Pressable>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: space.md },
  review: { padding: space.lg, gap: space.xs, backgroundColor: colors.tint, borderRadius: radius.card },
  section: { gap: space.sm, paddingBottom: space.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  link: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.sm,
    borderRadius: radius.control, paddingVertical: space.sm },
  linkText: { flexShrink: 1, textDecorationLine: 'underline' },
  pressed: { backgroundColor: colors.pressed },
});
