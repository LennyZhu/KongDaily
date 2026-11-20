import { ComplianceDocumentScreen } from '@/components/compliance-document';
import { getCompliancePrivacy } from '@/compliance-content';
import { useLanguage } from '@/language';

export default function PrivacyScreen() {
  const { locale } = useLanguage();
  return <ComplianceDocumentScreen {...getCompliancePrivacy(locale)} policy="privacy" />;
}
