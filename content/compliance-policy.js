const copy = require('./compliance.json');

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

module.exports = { ...copy, locales: { 'zh-HK': resolveCopy('zh-HK'), en: resolveCopy('en') } };
