const { copyFileSync, mkdirSync, writeFileSync } = require('node:fs');
const { join, posix } = require('node:path');

const content = require('../content/compliance.json');
const releaseInputs = require('./release.json');

const pages = ['home', 'privacy', 'support'];
const locales = ['zh-HK', 'en'];
const requiredSections = {
  privacy: ['scope', 'location', 'local-data', 'online-services', 'retention', 'security', 'rights'],
  support: ['bus', 'weather', 'location', 'offline', 'saved', 'contact'],
};

function provided(value) {
  return typeof value === 'string' && Boolean(value.trim())
    && !/\b(TBD|TODO|TBC|placeholder)\b|待確認|待填/i.test(value);
}

function publicHost(hostname) {
  const host = hostname.replace(/\.$/, '');
  return host.includes('.') && /[a-z]/i.test(host)
    && !/(^|\.)(localhost|example\.(com|net|org))$|\.(example|test|invalid|localhost|local)$/i.test(host);
}

function httpsOrigin(value) {
  if (!provided(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && publicHost(url.hostname) && value === url.origin;
  } catch {
    return false;
  }
}

function email(value) {
  if (!provided(value) || !/^[a-z0-9.!_+%-]+@[a-z0-9.-]+$/i.test(value)) return false;
  return publicHost(value.split('@')[1]);
}

function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
}

function legalOperator(value) {
  if (!provided(value)) return false;
  const name = value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  return !['lenny studio', 'kongdaily', '港日常', '港日常 · kongdaily', 'kongdaily by lenny studio'].includes(name);
}

function completeDocument(document, required, contactSection) {
  return provided(document?.title) && provided(document?.intro) && document.contactSection === contactSection
    && Array.isArray(document.sections)
    && required.every((id) => document.sections.some((section) => section?.id === id))
    && document.sections.every((section) => provided(section?.id) && provided(section.title)
      && Array.isArray(section.paragraphs) && section.paragraphs.length > 0 && section.paragraphs.every(provided));
}

function releaseIssues(input, copy = content) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return ['release.json must contain the approved release data'];
  const issues = [];
  const identity = copy.identity;
  if (identity?.product !== 'KongDaily' || identity.brand !== 'Lenny Studio') issues.push('identity requires the approved KongDaily and Lenny Studio branding');
  if (identity?.operatorType !== 'individual') issues.push('identity.operatorType must remain individual');
  if (!email(identity?.contactEmail)) issues.push('identity.contactEmail must be the verified privacy and support mailbox');
  if (!httpsOrigin(input.origin)) issues.push('origin must be the approved public HTTPS origin');
  if (!provided(input.operatorVerificationReference)) issues.push('operatorVerificationReference must record verification of the legal name');
  if (!calendarDate(input.effectiveOn)) issues.push('effectiveOn must be an approved calendar date');
  if (!calendarDate(input.updatedOn)) issues.push('updatedOn must be an approved calendar date');
  for (const locale of locales) {
    const labels = copy.locales?.[locale];
    if (!completeDocument(labels?.privacy, requiredSections.privacy, 'rights')) issues.push(`privacy.${locale} must contain the complete policy and contact section`);
    if (!completeDocument(labels?.support, requiredSections.support, 'contact')) issues.push(`support.${locale} must contain the complete FAQ and contact section`);
    if (!legalOperator(input.operator?.[locale])) issues.push(`operator.${locale} must name the verified legal operator, separate from the product brand`);
    if (!provided(input.siteAndSupportPrivacy?.[locale])) issues.push(`siteAndSupportPrivacy.${locale} requires approved hosting and support data handling copy`);
    if (!provided(input.retentionDisclosure?.[locale])) issues.push(`retentionDisclosure.${locale} requires the approved retention and deletion disclosure`);
  }
  if (!provided(input.approvalReference)) issues.push('approvalReference must record human approval of both languages, contacts and provider evidence');
  if (!provided(input.assetRightsApprovalReference)) issues.push('assetRightsApprovalReference must record an independent clearance decision for distribution and required asset rights');
  return issues;
}

function requireReleaseInputs(input) {
  const issues = releaseIssues(input);
  if (issues.length) throw new Error('Publication blocked:\n- ' + issues.join('\n- '));
}

const escape = (value) => value.replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function directory(locale, page) {
  return posix.join(locale === 'en' ? 'en' : '.', page === 'home' ? '.' : page);
}

function renderPage(locale, page, release) {
  const labels = content.locales[locale];
  const { brand, product, contactEmail } = content.identity;
  const brandName = `${product} by ${brand}`;
  const document = labels[page];
  const here = directory(locale, page);
  const href = (targetLocale, targetPage) => (posix.relative(here, directory(targetLocale, targetPage)) || '.') + '/';
  const alternate = locale === 'en' ? 'zh-HK' : 'en';
  const languageName = alternate === 'en' ? 'English' : '繁體中文';
  const stylesheet = posix.relative(here, 'site.css');
  const canonical = release ? new URL(here === '.' ? '/' : here + '/', release.origin).href : '';
  const date = release?.updatedOn ?? content.reviewedOn;
  const updated = `<p class="date">${labels.reviewDate} · <time datetime="${date}">${date}</time></p>`;
  const review = release ? '' : `<aside class="review"><strong>${labels.reviewStatus}</strong><p>${escape(labels.reviewNotice)}</p></aside>`;
  const sections = (document.sections ?? []).map(({ id, title, paragraphs, links }) => `<section aria-labelledby="${id}">
      <h2 id="${id}">${escape(title)}</h2>
      ${paragraphs.map((paragraph) => `<p>${escape(paragraph)}</p>`).join('\n      ')}
      ${links?.length ? `<ul class="sources">${links.map(({ label, url }) => `<li><a href="${escape(url)}">${escape(label)}</a></li>`).join('')}</ul>` : ''}
      ${id === document.contactSection ? `<p><a href="mailto:${escape(contactEmail)}">${escape(contactEmail)}</a></p>` : ''}
    </section>`).join('\n    ');
  const operator = release ? `<section class="operator">
      <h2>${locale === 'en' ? 'Legal operator' : '法定營運者'}</h2>
      <p>${escape(release.operator[locale])}</p>
      ${page === 'privacy' ? `<p>${labels.effectiveDate} · <time datetime="${release.effectiveOn}">${release.effectiveOn}</time></p>
      <p>${escape(release.siteAndSupportPrivacy[locale])}</p>
      <p>${escape(release.retentionDisclosure[locale])}</p>` : ''}
    </section>` : '';

  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  ${release ? '' : '<meta name="robots" content="noindex, nofollow">'}
  ${canonical ? `<link rel="canonical" href="${escape(canonical)}">` : ''}
  <title>${escape(document.title)} · ${escape(brandName)}</title>
  <link rel="stylesheet" href="${stylesheet}">
</head>
<body>
  <a class="skip" href="#main">${labels.skipToContent}</a>
  <header class="site-header">
    <div class="frame header-content">
      <a class="brand" href="${href(locale, 'home')}">${escape(brandName)}</a>
      <nav aria-label="${labels.languagesLabel}">
        <a class="language" href="${href(alternate, page)}" lang="${alternate}" hreflang="${alternate}">${languageName}</a>
      </nav>
    </div>
    <nav class="frame nav" aria-label="${labels.navigationLabel}">
      ${pages.slice(1).map((target) => `<a href="${href(locale, target)}"${target === page ? ' aria-current="page"' : ''}>${labels[target].title}</a>`).join('\n      ')}
    </nav>
  </header>
  <main class="frame" id="main" tabindex="-1">
    <div class="intro">
      <h1>${escape(document.title)}</h1>
      <p>${escape(document.intro)}</p>
      ${updated}
    </div>
    ${review}
    ${sections}
    ${operator}
  </main>
  <footer class="site-footer">
    <p class="frame">${escape(brandName)}</p>
  </footer>
</body>
</html>
`;
}

function buildSite(output, release) {
  if (release !== undefined) requireReleaseInputs(release);
  for (const locale of locales) {
    for (const page of pages) {
      const folder = join(output, directory(locale, page));
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, 'index.html'), renderPage(locale, page, release));
    }
  }
  copyFileSync(join(__dirname, 'site.css'), join(output, 'site.css'));
}

if (require.main === module) {
  const [mode, ...extra] = process.argv.slice(2);
  if (extra.length || (mode && !['--release', '--check-release'].includes(mode))) {
    console.error('Usage: node website/build.cjs [--release | --check-release]');
    process.exitCode = 1;
  } else {
    try {
      if (mode === '--check-release') {
        requireReleaseInputs(releaseInputs);
        console.log('Release inputs passed the publication check.');
      } else {
        const output = join(__dirname, 'dist', mode ? 'release' : 'review');
        buildSite(output, mode ? releaseInputs : undefined);
        console.log(output);
      }
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}

module.exports = { buildSite, releaseIssues };
