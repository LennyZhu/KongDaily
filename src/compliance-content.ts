import content from '../content/compliance-policy';

import type { LanguagePreference } from './i18n';

export type ComplianceLocale = Exclude<LanguagePreference, 'system'>;
export type ComplianceLink = Readonly<{ label: string; url: string }>;
export type ComplianceSection = Readonly<{
  id: string;
  title: string;
  paragraphs: readonly string[];
  links?: readonly ComplianceLink[];
}>;

export type ComplianceDocument = Readonly<{
  title: string;
  intro: string;
  contactSection: string;
  sections: readonly ComplianceSection[];
}>;

export const complianceDocuments: Readonly<Record<ComplianceLocale, {
  reviewStatus: string;
  reviewNotice: string;
  reviewDate: string;
  privacy: ComplianceDocument;
  support: ComplianceDocument;
}>> = content.locales;

export const complianceReviewedOn = content.reviewedOn;
export const complianceContact: ComplianceLink = {
  label: content.identity.contactEmail,
  url: `mailto:${content.identity.contactEmail}`,
};
