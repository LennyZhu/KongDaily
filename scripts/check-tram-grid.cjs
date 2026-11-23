// Build-time cross-check using the app's existing HK1980 Grid conversion.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const ts = require('typescript');
const gridFile = join(__dirname, '..', 'src', 'hk-grid.ts');
const code = ts.transpileModule(readFileSync(gridFile, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const grid = {};
new Function('exports', 'require', code)(grid, (id) => {
  if (id !== '@/nearby-bus-data') throw new Error('Unexpected grid dependency: ' + id);
  // App bounds are also checked before this cross-check in the generator.
  return { isNearHongKong: ({ latitude, longitude }) => latitude >= 22.12 && latitude <= 22.59
    && longitude >= 113.82 && longitude <= 114.46 };
});
const metresPerDegree = 6_371_008.8 * Math.PI / 180;
for (const [id, x, y, latitude, longitude] of JSON.parse(readFileSync(0, 'utf8'))) {
  const point = grid.hkGridToWgs84(x, y);
  if (!point) throw new Error('Invalid HK1980 Grid point for tram stop ' + id);
  const discrepancy = Math.hypot(latitude - point.latitude,
    (longitude - point.longitude) * Math.cos(latitude * Math.PI / 180)) * metresPerDegree;
  if (discrepancy > 2) throw new Error('GeoJSON and HK1980 Grid differ by over 2 m at tram stop ' + id);
}
