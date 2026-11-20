const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { basename, join, posix } = require('node:path');

const attribution = require('../assets/explore/photos/attribution.json');
const publication = require('./explore-photo-publication.json');
const { places } = require('../assets/data/explore-places.json');
const { provided } = require('../content/compliance-policy');

const photoDirectory = 'credits/explore/photos';
const licenses = new Map([
  ['Public domain (U.S. Navy)', 'https://www.dvidshub.net/about/copyright'],
  ['Public domain (author dedication)', 'https://commons.wikimedia.org/wiki/Template:PD-user'],
  ['CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'],
  ['Unsplash License', 'https://unsplash.com/license'],
  ['CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'],
]);

const creditsCopy = {
  'zh-HK': {
    title: '探索照片署名',
    intro: '查閱港日常八張探索照片的來源、授權及修改紀錄。設有下載連結的照片與 App 隨附版本相同，各自適用所列的授權。署名不代表攝影者或來源機構認可或贊助港日常。',
    author: '攝影者',
    original: '原作品與來源',
    originalPublication: '原始發佈',
    originalFile: '全尺寸原圖',
    license: '授權或使用條件',
    download: '下載 App 版本 JPEG',
    sourceOnly: '請到原作品頁查看這張照片。',
    processed: (pixels, cropped, resized) => `以下載的圖片製作 App 版本。${cropped ? '裁切後再縮放。' : resized ? '保留原構圖並縮放。' : '保留下載檔的構圖及尺寸。'}輸出為 ${pixels} 的 sRGB JPEG，重新壓縮並移除原 EXIF。`,
  },
  en: {
    title: 'Explore Photo Credits',
    intro: 'Review the sources, terms and edits for KongDaily’s eight Explore photos. Where a download is offered, it is the same copy included in the app and is subject to the listed terms. Credits do not imply endorsement or sponsorship.',
    author: 'Photographer',
    original: 'Original work and source',
    originalPublication: 'Original publication',
    originalFile: 'Full-size original',
    license: 'Licence or terms of use',
    download: 'Download the app JPEG',
    sourceOnly: 'View this photo on its original source page.',
    processed: (pixels, cropped, resized) => `The downloaded image was ${cropped ? 'cropped and resized' : resized ? 'resized with its framing intact' : 'kept at its downloaded size and framing'}. The app copy is a recompressed ${pixels} sRGB JPEG with the source EXIF removed.`,
  },
};

function isHttps(value) {
  return URL.canParse(value) && new URL(value).protocol === 'https:';
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function loadExplorePhotos(records = attribution, decisions = publication) {
  if (places.length !== 8 || Object.keys(records).length !== places.length || Object.keys(decisions).length !== places.length) {
    throw new Error('The credits must cover all eight official Explore places.');
  }
  const hashes = new Set();
  const filenames = new Set();
  return places.map(({ id, title }) => {
    const photo = records[id];
    const fail = (reason) => { throw new Error(`Explore photo ${id}: ${reason}`); };
    if (!photo || !/^assets\/explore\/photos\/[a-z0-9-]+\.jpg$/.test(photo.asset)) fail('invalid asset mapping');
    const licenseUrl = licenses.get(photo.license);
    const expectedPixels = photo.processing?.pixels;
    const validDimensions = (pixels) => Array.isArray(pixels) && pixels.length === 2
      && pixels.every((value) => Number.isSafeInteger(value) && value > 0);
    if (!provided(photo.title) || !provided(photo.author) || !isHttps(photo.sourcePage)
      || !licenseUrl || photo.licenseUrl !== licenseUrl || !provided(photo.commercialAppDistributionEvidence)
      || photo.processing?.format !== 'JPEG' || photo.processing.colorSpace !== 'sRGB'
      || photo.processing.metadata !== 'Source EXIF omitted'
      || !validDimensions(expectedPixels) || !validDimensions(photo.downloadPixels)
      || !Object.keys(creditsCopy).every((locale) => provided(title[locale]) && provided(photo.description?.[locale]))
      || [photo.independentOriginalUrl, photo.originalPublication].some((link) => link != null && !isHttps(link))) {
      fail('incomplete source, licence or processing evidence');
    }
    if (photo.license === 'CC BY 4.0' && (!isHttps(photo.independentOriginalUrl)
      || !Object.keys(creditsCopy).every((locale) => provided(photo.creditLine?.[locale])
        && provided(photo.processing.summary?.[locale])))) fail('missing photo-side credit, modification notice or original');
    if (photo.license === 'Public domain (U.S. Navy)'
      && !Object.keys(creditsCopy).every((locale) => provided(photo.notice?.[locale]))) fail('missing non-endorsement notice');
    const filename = basename(photo.asset);
    const bytes = readFileSync(join(__dirname, '..', photo.asset));
    if (bytes.length < 4 || bytes.readUInt16BE(0) !== 0xffd8 || bytes.readUInt16BE(bytes.length - 2) !== 0xffd9
      || bytes.length !== photo.bytes || sha256(bytes) !== photo.sha256) fail('JPEG size or SHA-256 differs from the app attribution');
    const decision = decisions[id];
    if (decision?.license !== photo.license || decision.sha256 !== photo.sha256
      || !['preview-and-download', 'source-only'].includes(decision.website)) fail('missing or outdated website rights review');
    if (hashes.has(photo.sha256) || filenames.has(filename)) fail('duplicate JPEG resource');
    hashes.add(photo.sha256);
    filenames.add(filename);
    return { id, title, photo, bytes, route: posix.join(photoDirectory, filename), hosted: decision.website === 'preview-and-download' };
  });
}

function renderExploreCredits(locale, photos, here, escape) {
  const copy = creditsCopy[locale];
  return photos.map(({ id, title, photo, route, hosted }) => {
    const [width, height] = photo.processing.pixels;
    const image = escape(posix.relative(here, route));
    const author = photo.creditLine?.[locale] ?? photo.author;
    const resized = photo.downloadPixels[0] !== width || photo.downloadPixels[1] !== height;
    const processed = photo.processing.summary?.[locale]
      ?? copy.processed(`${width} × ${height}`, Boolean(photo.processing.cropPixels), resized);
    return `<section aria-labelledby="${id}">
      <h2 id="${id}">${escape(title[locale])}</h2>
      ${hosted ? `<figure class="credit-photo">
        <img src="${image}" alt="${escape(photo.description[locale])}" width="${width}" height="${height}" loading="lazy">
        <figcaption>${copy.author} · ${escape(author)}</figcaption>
      </figure>` : `<p>${copy.author} · ${escape(author)}</p>`}
      <p>${copy.original} · <a href="${escape(photo.sourcePage)}">${escape(photo.title)}</a></p>
      <p>${copy.license} · <a href="${escape(photo.licenseUrl)}">${escape(photo.license)}</a></p>
      <p>${escape(processed)}</p>
      ${photo.notice?.[locale] ? `<p>${escape(photo.notice[locale])}</p>` : ''}
      ${hosted ? `<ul class="sources">
        <li><a href="${image}" download>${copy.download}</a></li>
        ${photo.originalPublication ? `<li><a href="${escape(photo.originalPublication)}">${copy.originalPublication}</a></li>` : ''}
        ${photo.independentOriginalUrl ? `<li><a href="${escape(photo.independentOriginalUrl)}">${copy.originalFile}</a></li>` : ''}
      </ul>` : `<p>${copy.sourceOnly}</p>`}
    </section>`;
  }).join('\n    ');
}

module.exports = { creditsCopy, loadExplorePhotos, renderExploreCredits, sha256 };
