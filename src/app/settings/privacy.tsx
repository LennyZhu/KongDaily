import { ComplianceDocumentScreen } from '@/components/compliance-document';
import { complianceDocuments } from '@/compliance-content';
import { useLanguage } from '@/language';

export default function PrivacyScreen() {
  const { locale } = useLanguage();
  return <ComplianceDocumentScreen {...complianceDocuments[locale].privacy} review />;
}
