const { lstatSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } = require('node:fs');
const { join, posix } = require('node:path');

const content = require('../content/compliance-policy');
const { provided, publicationIssues, getPolicyPublication, getPrivacyDocument } = content;
const { creditsCopy, loadExplorePhotos, renderExploreCredits, sha256 } = require('./explore-credits.cjs');
const releaseInputs = require('./release.json');

const pages = ['home', 'privacy', 'support', 'credits'];
const locales = ['zh-HK', 'en'];
const approvedSupportRetention = {
  'zh-HK': '個案解決後最多保留 12 個月',
  en: 'up to 12 months after the case is resolved',
};
const missingRoute = '/__kongdaily_missing_release_check__/';
const stylesheetPath = join(__dirname, 'site.css');
const requiredSections = {
  privacy: ['scope', 'location', 'local-data', 'online-services', 'retention', 'security', 'rights'],
  support: ['bus', 'weather', 'location', 'offline', 'saved', 'contact'],
};

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
  if (!legalOperator(identity?.operatorName)) issues.push('identity.operatorName must be the verified individual name, separate from the product brand');
  if (!email(identity?.contactEmail)) issues.push('identity.contactEmail must be the verified privacy and support mailbox');
  if (input.origin != null && !httpsOrigin(input.origin)) issues.push('origin must be a public HTTPS origin or null before the first deployment');
  if (!provided(input.operatorVerificationReference)) issues.push('operatorVerificationReference must record verification of the legal name');
  const policyIssues = publicationIssues(copy.publication);
  issues.push(...policyIssues);
  if (input.firstPublicDeploymentAt != null) {
    const publicDay = firstPublicDay(input.firstPublicDeploymentAt);
    if (!publicDay) issues.push('firstPublicDeploymentAt must record the actual launch timestamp with its time zone');
    else if (!policyIssues.length && publicDay !== copy.publication.effectiveOn) {
      issues.push('The actual Hong Kong launch date differs from effectiveOn. Reconcile the policy before releasing again.');
    }
  } else if (!policyIssues.length && copy.publication.effectiveOn !== copy.publication.updatedOn) {
    issues.push('updatedOn must equal effectiveOn for the first public release');
  }
  for (const locale of locales) {
    const labels = copy.locales?.[locale];
    if (!completeDocument(labels?.privacy, requiredSections.privacy, 'rights')) issues.push(`privacy.${locale} must contain the complete policy and contact section`);
    else if (!labels.privacy.sections.find(({ id }) => id === 'retention').paragraphs.some((paragraph) => paragraph.includes(approvedSupportRetention[locale]))) {
      issues.push(`privacy.${locale} must include the approved 12-month limit from case resolution`);
    }
    if (!completeDocument(labels?.support, requiredSections.support, 'contact')) issues.push(`support.${locale} must contain the complete FAQ and contact section`);
  }
  if (!provided(input.approvalReference)) issues.push('approvalReference must record human approval of both languages, contacts and provider evidence');
  if (!provided(input.assetRightsApprovalReference)) issues.push('assetRightsApprovalReference must record approval of the reviewed website photo modes and exact downloadable JPEGs');
  return issues;
}

function requireReleaseInputs(input, policy) {
  const issues = releaseIssues(input, policy);
  let photos;
  try {
    photos = loadExplorePhotos();
  } catch (error) {
    issues.push(error.message);
  }
  if (issues.length) throw new Error('Publication blocked:\n- ' + issues.join('\n- '));
  return photos;
}

const escape = (value) => value.replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function directory(locale, page) {
  const folder = { home: '.', credits: 'credits/explore' }[page] ?? page;
  return posix.join(locale === 'en' ? 'en' : '.', folder);
}

function route(locale, page) {
  const path = directory(locale, page);
  return path === '.' ? '/' : '/' + path + '/';
}

function renderPage(locale, page, release, publication, photos) {
  const labels = content.locales[locale];
  const credits = creditsCopy[locale];
  const { brand, product, operatorName, contactEmail } = content.identity;
  const brandName = `${product} by ${brand}`;
  const document = page === 'privacy' ? getPrivacyDocument(locale, publication) : page === 'credits' ? credits : labels[page];
  const here = directory(locale, page);
  const href = (targetLocale, targetPage) => (posix.relative(here, directory(targetLocale, targetPage)) || '.') + '/';
  const alternate = locale === 'en' ? 'zh-HK' : 'en';
  const languageName = alternate === 'en' ? 'English' : '繁體中文';
  const stylesheet = posix.relative(here, 'site.css');
  const canonical = release?.origin ? new URL(route(locale, page), release.origin).href : '';
  const date = publication?.updatedOn ?? content.reviewedOn;
  const dateLabel = release ? labels.reviewDate : labels.draftReviewDate;
  const updated = page === 'credits' ? '' : `<p class="date">${dateLabel} · <time datetime="${date}">${date}</time></p>`;
  const review = release ? '' : `<aside class="review"><strong>${labels.reviewStatus}</strong><p>${escape(labels.reviewNotice)}</p></aside>`;
  const sections = page === 'credits' ? renderExploreCredits(locale, photos, here, escape) : (document.sections ?? []).map(({ id, title, paragraphs, links }) => `<section aria-labelledby="${id}">
      <h2 id="${id}">${escape(title)}</h2>
      ${paragraphs.map((paragraph) => `<p>${escape(paragraph)}</p>`).join('\n      ')}
      ${links?.length ? `<ul class="sources">${links.map(({ label, url }) => `<li><a href="${escape(url)}">${escape(label)}</a></li>`).join('')}</ul>` : ''}
      ${id === document.contactSection ? `<p><a href="mailto:${escape(contactEmail)}">${escape(contactEmail)}</a></p>` : ''}
    </section>`).join('\n    ');
  const operator = release ? `<section class="operator">
      <h2>${locale === 'en' ? 'Legal operator' : '法定營運者'}</h2>
      <p>${escape(operatorName)}</p>
      ${page === 'privacy' ? `<p>${labels.effectiveDate} · <time datetime="${publication.effectiveOn}">${publication.effectiveOn}</time></p>
      <p>${labels.policyVersion} · ${escape(publication.version)}</p>` : ''}
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
      ${pages.slice(1).map((target) => `<a href="${href(locale, target)}"${target === page ? ' aria-current="page"' : ''}>${escape(target === 'credits' ? credits.title : labels[target].title)}</a>`).join('\n      ')}
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

function staticFiles(release, policy, photos) {
  const publication = release ? getPolicyPublication(policy.publication) : null;
  const files = new Map([['site.css', readFileSync(stylesheetPath)]]);
  for (const locale of locales) {
    for (const page of pages) {
      const path = posix.join(directory(locale, page), 'index.html');
      files.set(path, Buffer.from(renderPage(locale, page, release, publication, photos)));
    }
  }
  for (const { route, bytes, hosted } of photos) if (hosted) files.set(route, bytes);
  return files;
}

function inspectStaticOutput(output, files, retiredPhotos = []) {
  const directories = new Set();
  for (const path of files.keys()) {
    for (let folder = posix.dirname(path); folder !== '.'; folder = posix.dirname(folder)) directories.add(folder);
  }
  const retired = new Map(retiredPhotos.map(({ route, photo }) => [route, photo.sha256]));
  const found = new Set();
  const stale = [];
  function inspect(folder) {
    for (const entry of readdirSync(join(output, folder), { withFileTypes: true })) {
      const path = posix.join(folder, entry.name);
      if (entry.isDirectory() && directories.has(path)) {
        inspect(path);
      } else if (entry.isFile() && files.has(path)) {
        found.add(path);
      } else if (entry.isFile() && retired.has(path) && sha256(readFileSync(join(output, path))) === retired.get(path)) {
        stale.push(path);
      } else {
        throw new Error(`Unexpected static output entry: ${path}. Use a dedicated empty output directory.`);
      }
    }
  }
  const root = lstatSync(output, { throwIfNoEntry: false });
  if (root && !root.isDirectory()) throw new Error('The static output path must be a real directory.');
  if (root) inspect('.');
  return { found, stale };
}

function buildSite(output, release, policy = content) {
  const photos = release === undefined ? loadExplorePhotos() : requireReleaseInputs(release, policy);
  const files = staticFiles(release, policy, photos);
  const { stale } = inspectStaticOutput(output, files, photos.filter(({ hosted }) => !hosted));
  // Remove only exact previously generated copies of photos excluded by the website review.
  for (const path of stale) unlinkSync(join(output, path));
  for (const [path, bytes] of files) {
    mkdirSync(join(output, posix.dirname(path)), { recursive: true });
    writeFileSync(join(output, path), bytes);
  }
}

function verifyReleaseOutput(output, release, policy = content) {
  const files = staticFiles(release, policy, requireReleaseInputs(release, policy));
  const { found } = inspectStaticOutput(output, files);
  for (const [path, bytes] of files) {
    if (!found.has(path) || !readFileSync(join(output, path)).equals(bytes)) {
      throw new Error(`Static output is missing or differs from the approved file: ${path}`);
    }
  }
  return files.size;
}

function firstPublicDay(timestamp) {
  const isoTime = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
  if (typeof timestamp !== 'string' || !isoTime.test(timestamp)) return null;
  const dateOnly = timestamp.slice(0, 10);
  const inputDay = new Date(dateOnly);
  const instant = new Date(timestamp);
  if (!Number.isFinite(+instant) || !Number.isFinite(+inputDay) || !inputDay.toISOString().startsWith(dateOnly)) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instant);
  return ['year', 'month', 'day'].map((unit) => parts.find(({ type }) => type === unit).value).join('-');
}

async function verifyPublishedWebsite(release, fetchPage = fetch, policy = content) {
  if (!httpsOrigin(release?.origin)) throw new Error('Live verification requires the actual deployed HTTPS origin.');
  if (release.firstPublicDeploymentAt == null) throw new Error('Live verification requires firstPublicDeploymentAt, the actual public launch timestamp with its time zone.');
  const photos = requireReleaseInputs(release, policy);
  const publication = getPolicyPublication(policy.publication);
  const verified = [];
  const request = (path) => fetchPage(new URL(path, release.origin).href, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
  for (const locale of locales) {
    for (const page of pages) {
      const path = route(locale, page);
      const url = new URL(path, release.origin).href;
      const response = await request(path);
      if (response.status !== 200 || !/^text\/html(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
        throw new Error(`Live verification failed for ${url}: expected a public HTTP 200 HTML response on the exact route.`);
      }
      const html = await response.text();
      // The first deployment can precede any assigned origin and omit canonical tags.
      if (html !== renderPage(locale, page, release, publication, photos)
        && html !== renderPage(locale, page, { ...release, origin: null }, publication, photos)) {
        throw new Error(`Live verification failed for ${url}: HTML differs from the approved release.`);
      }
      verified.push(url);
      if (path !== '/') {
        const withoutSlash = path.slice(0, -1);
        const redirect = await request(withoutSlash);
        const location = redirect.headers.get('location');
        if (redirect.status !== 308 || !location || !URL.canParse(location, release.origin)
          || new URL(location, release.origin).href !== url) {
          throw new Error(`Live verification failed for ${withoutSlash}: expected a same-origin HTTP 308 to ${path}.`);
        }
        verified.push(`${new URL(withoutSlash, release.origin).href} (HTTP 308)`);
      }
    }
  }
  for (const { route: path, photo, hosted } of photos) {
    const url = new URL(path, release.origin).href;
    const response = await request(path);
    if (!hosted) {
      if (response.status !== 404) throw new Error(`Live verification failed for ${url}: expected HTTP 404 for a source-only photo.`);
      verified.push(`${url} (HTTP 404)`);
      continue;
    }
    if (response.status !== 200 || !/^image\/jpeg(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
      throw new Error(`Live verification failed for ${url}: expected a public HTTP 200 JPEG without redirection.`);
    }
    if (sha256(Buffer.from(await response.arrayBuffer())) !== photo.sha256) {
      throw new Error(`Live verification failed for ${url}: SHA-256 differs from the app JPEG.`);
    }
    verified.push(url);
  }
  const stylesheet = await request('/site.css');
  if (stylesheet.status !== 200 || !/^text\/css(?:\s*;|$)/i.test(stylesheet.headers.get('content-type') ?? '')
    || !Buffer.from(await stylesheet.arrayBuffer()).equals(readFileSync(stylesheetPath))) {
    throw new Error('Live verification failed for /site.css: expected the approved public stylesheet.');
  }
  verified.push(new URL('/site.css', release.origin).href);
  if ((await request(missingRoute)).status !== 404) {
    throw new Error(`Live verification failed for ${missingRoute}: expected HTTP 404 without redirection.`);
  }
  verified.push(`${new URL(missingRoute, release.origin).href} (HTTP 404)`);
  return verified;
}

async function main() {
  const [mode, ...extra] = process.argv.slice(2);
  if (mode === '--check-output' && extra.length === 1) {
    console.log(`Approved static output: ${verifyReleaseOutput(extra[0], releaseInputs)} files.`);
    return;
  }
  if (extra.length || (mode && !['--release', '--check-release', '--check-live'].includes(mode))) {
    throw new Error('Usage: node website/build.cjs [--release | --check-release | --check-output <directory> | --check-live]');
  }
  if (mode === '--check-release') {
    requireReleaseInputs(releaseInputs);
    console.log('Pre-deployment release inputs passed.');
  } else if (mode === '--check-live') {
    console.log((await verifyPublishedWebsite(releaseInputs)).join('\n'));
  } else {
    const output = join(__dirname, 'dist', mode ? 'release' : 'review');
    buildSite(output, mode ? releaseInputs : undefined);
    console.log(output);
  }
}

if (require.main === module) main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

module.exports = { buildSite, releaseIssues, verifyReleaseOutput, verifyPublishedWebsite };
