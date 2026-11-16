import type { Coordinates } from '@/nearby-bus-data';

// Lands Department GeoInfo Map location results, converted from HK1980 Grid using the LandsD transformation API.
export const nearbyBusLandmarks = {
  yuenLong: { latitude: 22.446072302, longitude: 114.035165304 },
  hungShuiKiu: { latitude: 22.43364495, longitude: 113.99736184 },
  tuenMun: { latitude: 22.392938957, longitude: 113.977079236 },
  shaTin: { latitude: 22.381502855, longitude: 114.188264527 },
  tsimShaTsui: { latitude: 22.293626612, longitude: 114.17038225 },
  causewayBay: { latitude: 22.278292642, longitude: 114.182114037 },
  central: { latitude: 22.286329259, longitude: 114.16138727 },
} satisfies Record<string, Coordinates>;

export type NearbyLandmark = keyof typeof nearbyBusLandmarks;
