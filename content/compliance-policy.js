const copy = require('./compliance.json');

/** @param {unknown} value @returns {value is string} */
function provided(value) {
  return typeof value === 'string' && Boolean(value.trim())
    && !/\b(TBD|TODO|TBC|placeholder)\b|待確認|待填|\{operatorName\}/i.test(value);
}

function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
}

function publicationIssues(publication) {
  const issues = [];
  if (!/^\d+\.\d+(?:\.\d+)?$/.test(publication?.version ?? '')) issues.push('version must identify the approved shared policy');
  const hasEffectiveDate = calendarDate(publication?.effectiveOn);
  const hasUpdateDate = calendarDate(publication?.updatedOn);
  if (!hasEffectiveDate) issues.push('effectiveOn must be an approved calendar date');
  if (!hasUpdateDate) issues.push('updatedOn must be an approved calendar date');
  if (hasEffectiveDate && hasUpdateDate && publication.updatedOn < publication.effectiveOn) {
    issues.push('updatedOn must be on or after effectiveOn');
  }
  for (const locale of ['zh-HK', 'en']) {
    if (!provided(publication?.siteAndSupportPrivacy?.[locale])) issues.push(`siteAndSupportPrivacy.${locale} requires approved hosting and support data handling copy`);
    if (!provided(publication?.retentionDisclosure?.[locale])) issues.push(`retentionDisclosure.${locale} requires the approved retention and deletion disclosure`);
  }
  return issues;
}

/** @typedef {{version: string, effectiveOn: string, updatedOn: string, siteAndSupportPrivacy: Record<'zh-HK'|'en', string>, retentionDisclosure: Record<'zh-HK'|'en', string>}} PolicyPublication */

/** @returns {PolicyPublication | null} */
function getPolicyPublication(publication = copy.publication) {
  if (publicationIssues(publication).length) return null;
  return /** @type {PolicyPublication} */ (publication);
}

/** @param {keyof typeof copy.locales} locale
 * @param {PolicyPublication | null} publication */
function getPrivacyDocument(locale, publication) {
  const { privacy } = locales[locale];
  const disclosures = publication ?? copy.publication;
  return {
    ...privacy,
    sections: privacy.sections.map((section) => {
      const paragraph = {
        'online-services': disclosures.siteAndSupportPrivacy[locale],
        retention: disclosures.retentionDisclosure[locale],
      }[section.id];
      return provided(paragraph) ? { ...section, paragraphs: [...section.paragraphs, paragraph] } : section;
    }),
  };
}

/** @param {keyof typeof copy.locales} locale */
function resolveCopy(locale) {
  const labels = copy.locales[locale];
  return {
    ...labels,
    privacy: {
      ...labels.privacy,
      sections: labels.privacy.sections.map((section) => section.id === 'scope' ? {
        ...section,
        paragraphs: section.paragraphs.map((paragraph) => paragraph.replace('{operatorName}', () => copy.identity.operatorName)),
      } : section),
    },
  };
}

const locales = { 'zh-HK': resolveCopy('zh-HK'), en: resolveCopy('en') };

module.exports = { ...copy, locales, provided, publicationIssues, getPolicyPublication, getPrivacyDocument };
