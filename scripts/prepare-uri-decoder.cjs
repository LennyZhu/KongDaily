const { readFileSync, writeFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { dirname, join } = require('node:path');

// Expo Router 57 keeps query-string 7, whose CommonJS importer expects a callable export.
// Use the upstream fixed ESM decoder and adapt only that import.
const routerRequire = createRequire(require.resolve('expo-router/package.json'));
const queryStringEntry = routerRequire.resolve('query-string');
const queryStringRequire = createRequire(queryStringEntry);
const decoderEntry = queryStringRequire.resolve('decode-uri-component');
const readVersion = (entry) => JSON.parse(readFileSync(join(dirname(entry), 'package.json'), 'utf8')).version;

if (readVersion(queryStringEntry) !== '7.1.3' || readVersion(decoderEntry) !== '0.5.1') {
  throw new Error('Unexpected URI decoder dependency versions. Review the Expo Router compatibility adapter.');
}

const original = "const decodeComponent = require('decode-uri-component');";
const adapted = "const decodeComponent = require('decode-uri-component').default;";
const source = readFileSync(queryStringEntry, 'utf8');
if (source.includes(original)) {
  writeFileSync(queryStringEntry, source.replace(original, adapted), 'utf8');
} else if (!source.includes(adapted)) {
  throw new Error('Could not locate the query-string decoder import. Review the compatibility adapter.');
}
