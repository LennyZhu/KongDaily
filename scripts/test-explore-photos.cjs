const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { mkdtempSync, readFileSync, readdirSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, join, resolve } = require('node:path');
const ts = require('typescript');

const { places } = require('../assets/data/explore-places.json');
const credits = require('../assets/explore/photos/attribution.json');
const root = resolve(__dirname, '..');
const registry = join(root, 'src/explore-place-images.ts');
const approvedIds = new Set(places.map(({ id }) => id));
const boundFiles = new Set();
const { outputText } = ts.transpileModule(readFileSync(registry, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
});
const moduleExports = {};
new Function('exports', 'require', outputText)(moduleExports, (id) => {
  if (id === '../assets/explore/photos/attribution.json') return credits;
  assert.match(id, /^\.\.\/assets\/explore\/photos\/[a-z0-9-]+\.jpg$/);
  const localFile = resolve(dirname(registry), id);
  boundFiles.add(localFile);
  return localFile;
});

const sha256 = /^[a-f0-9]{64}$/;
const sha1 = /^[a-f0-9]{40}$/;
const photoDirectory = join(root, 'assets/explore/photos');
const filenames = readdirSync(photoDirectory).filter((name) => name.endsWith('.jpg'));
assert.deepEqual(boundFiles, new Set(filenames.map((filename) => join(photoDirectory, filename))));
assert.equal(boundFiles.size, Object.keys(credits).length, 'Every photograph needs one credit record');
assert.equal(moduleExports.getExplorePhoto('unknown-id'), undefined);
const garden = credits['victoria-peak-garden'];
assert.equal(garden?.author, 'Wpcpey');
assert.equal(garden.licenseUrl, 'https://creativecommons.org/licenses/by/4.0/');
assert.equal(garden.authorUploadRevision, 202529515);
assert.equal(garden.creditTemplateRevision, 880186713);
assert.equal(garden.downloadUrl, garden.originalFileUrl);
assert.equal(garden.independentOriginalUrl, garden.originalFileUrl);
assert.equal(garden.downloadSha256, garden.originalSha256);
assert.deepEqual(moduleExports.getExplorePhoto('victoria-peak-garden').creditLine, {
  'zh-HK': '維基百科用戶-Wpcpey', en: 'Wikipedia user -Wpcpey',
});

const temporary = mkdtempSync(join(tmpdir(), 'kd-explore-photo-test-'));
const imageHashes = new Set();
try {
  for (const [id, record] of Object.entries(credits)) {
    assert.ok(approvedIds.has(id), `Unknown place credit ${id}`);
    const photo = moduleExports.getExplorePhoto(id);
    assert.equal(photo?.source, join(root, record.asset), `${id} mapping must match the credit`);
    assert.deepEqual(photo.description, record.description);
    assert.match(photo.description['zh-HK'], /\p{Script=Han}/u);
    assert.match(photo.description.en, /[a-z]/i);
    for (const key of ['title', 'author', 'license', 'commercialAppDistributionEvidence']) {
      assert.ok(record[key].trim(), `${id} missing ${key}`);
    }
    for (const key of ['sourcePage', 'originalFileUrl', 'downloadUrl', 'licenseUrl']) {
      assert.equal(new URL(record[key]).protocol, 'https:', `${id} ${key}`);
    }
    assert.equal(new Date(record.downloadedOn).toISOString().slice(0, 10), record.downloadedOn);
    assert.match(record.downloadSha256, sha256);
    if (record.originalSha256) assert.match(record.originalSha256, sha256);
    else {
      assert.match(record.originalSha1, sha1);
      assert.notEqual(record.downloadUrl, record.originalFileUrl);
    }
    const bytes = readFileSync(photo.source);
    assert.equal(bytes.length, record.bytes);
    const digest = createHash('sha256').update(bytes).digest('hex');
    assert.equal(digest, record.sha256);
    assert.ok(!imageHashes.has(digest), `Duplicate photograph for ${id}`);
    imageHashes.add(digest);

    // Converting to PNG forces a full JPEG decode in the iOS development environment.
    const decoded = join(temporary, `${id}.png`);
    execFileSync('sips', ['-s', 'format', 'png', photo.source, '--out', decoded]);
    const png = readFileSync(decoded);
    assert.equal(png.readUInt32BE(0), 0x89504e47, `${id} did not decode as PNG`);
    const actualSize = [png.readUInt32BE(16), png.readUInt32BE(20)];
    assert.deepEqual(actualSize, record.processing.pixels);
    assert.ok(Math.max(...actualSize) >= 1200 && Math.max(...actualSize) <= 1600);
    console.log(`PASS · ${id} · ${actualSize.join(' × ')} · ${record.license}`);
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

const missing = places.filter(({ id }) => !moduleExports.getExplorePhoto(id)).map(({ id }) => id);
if (missing.length) {
  console.error(`Incomplete Explore photos (${places.length - missing.length}/${places.length}): ${missing.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(`PASS: Explore real photo coverage ${places.length}/${places.length}`);
}
