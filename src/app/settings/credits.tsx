import { useLocalSearchParams } from 'expo-router';

import { ComplianceDocumentScreen } from '@/components/compliance-document';
import { getComplianceCredits } from '@/compliance-credits';
import { useLanguage } from '@/language';

export default function CreditsScreen() {
  const { copy: { compliance }, locale } = useLanguage();
  const { photo } = useLocalSearchParams<{ photo?: string | string[] }>();
  return <ComplianceDocumentScreen title={compliance.credits} sections={getComplianceCredits(locale, photo)} />;
}
