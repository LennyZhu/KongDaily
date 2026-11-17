import { isNearHongKong } from '@/nearby-bus-data';

const radians = Math.PI / 180;
const gridRadius = 6378388;
const gridEcc = 2 / 297 - (1 / 297) ** 2;
const meridianScale = 1 - gridEcc / 4 - 3 * gridEcc ** 2 / 64 - 5 * gridEcc ** 3 / 256;
const origin = 22.3121333333333 * radians;
const originArc = gridRadius * (
  meridianScale * origin
  - (3 * gridEcc / 8 + 3 * gridEcc ** 2 / 32 + 45 * gridEcc ** 3 / 1024) * Math.sin(2 * origin)
  + (15 * gridEcc ** 2 / 256 + 45 * gridEcc ** 3 / 1024) * Math.sin(4 * origin)
  - 35 * gridEcc ** 3 / 3072 * Math.sin(6 * origin)
);

export function hkGridToWgs84(easting: unknown, northing: unknown) {
  if (typeof easting !== 'number' || typeof northing !== 'number'
    || !Number.isFinite(easting) || !Number.isFinite(northing)
    || easting < 799500 || easting > 867500 || northing < 799000 || northing > 848000) return;

  // Inverse Transverse Mercator for Hong Kong 1980 Grid (EPSG:2326).
  const mu = (originArc + northing - 819069.80) / (gridRadius * meridianScale);
  const e = (1 - Math.sqrt(1 - gridEcc)) / (1 + Math.sqrt(1 - gridEcc));
  const foot = mu + (3 * e / 2 - 27 * e ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e ** 2 / 16 - 55 * e ** 4 / 32) * Math.sin(4 * mu)
    + 151 * e ** 3 / 96 * Math.sin(6 * mu) + 1097 * e ** 4 / 512 * Math.sin(8 * mu);
  const tangent = Math.tan(foot);
  const t = tangent ** 2;
  const secondEcc = gridEcc / (1 - gridEcc);
  const c = secondEcc * Math.cos(foot) ** 2;
  const curvature = 1 - gridEcc * Math.sin(foot) ** 2;
  const normal = gridRadius / Math.sqrt(curvature);
  const meridian = gridRadius * (1 - gridEcc) / curvature ** 1.5;
  const d = (easting - 836694.05) / normal;
  const gridLat = foot - normal * tangent / meridian * (d ** 2 / 2
    - (5 + 3 * t + 10 * c - 4 * c ** 2 - 9 * secondEcc) * d ** 4 / 24
    + (61 + 90 * t + 298 * c + 45 * t ** 2 - 252 * secondEcc - 3 * c ** 2) * d ** 6 / 720);
  const gridLon = 114.178555555556 * radians + (d - (1 + 2 * t + c) * d ** 3 / 6
    + (5 - 2 * c + 28 * t - 3 * c ** 2 + 8 * secondEcc + 24 * t ** 2) * d ** 5 / 120) / Math.cos(foot);

  // EPSG:1825 coordinate-frame transform. Location Search has no height field.
  const gridNormal = gridRadius / Math.sqrt(1 - gridEcc * Math.sin(gridLat) ** 2);
  const x = gridNormal * Math.cos(gridLat) * Math.cos(gridLon);
  const y = gridNormal * Math.cos(gridLat) * Math.sin(gridLon);
  const z = gridNormal * (1 - gridEcc) * Math.sin(gridLat);
  const [rx, ry, rz] = [-0.067753, 2.243648, 1.158828].map((arcSeconds) => arcSeconds * radians / 3600);
  const scale = 1 - 1.094246e-6;
  const wgsX = -162.619 + scale * (x + rz * y - ry * z);
  const wgsY = -276.959 + scale * (-rz * x + y + rx * z);
  const wgsZ = -161.764 + scale * (ry * x - rx * y + z);
  const wgsEcc = 2 / 298.257223563 - (1 / 298.257223563) ** 2;
  const horizontal = Math.hypot(wgsX, wgsY);
  let latitude = Math.atan2(wgsZ, horizontal * (1 - wgsEcc));
  for (let step = 0; step < 5; step += 1) {
    const sin = Math.sin(latitude);
    latitude = Math.atan2(wgsZ + wgsEcc * 6378137 * sin / Math.sqrt(1 - wgsEcc * sin ** 2), horizontal);
  }
  const point = { latitude: latitude / radians, longitude: Math.atan2(wgsY, wgsX) / radians };
  return isNearHongKong(point) ? point : undefined;
}
