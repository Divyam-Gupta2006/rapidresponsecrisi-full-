/**
 * Haversine distance calculator + location utilities
 * Used for automatic staff assignment based on proximity
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate the Haversine distance between two lat/lng points.
 * @returns distance in kilometers
 */
export function getDistanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);

  const halfChordSq =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      Math.sin(dLng / 2) ** 2;

  const angularDistance = 2 * Math.atan2(Math.sqrt(halfChordSq), Math.sqrt(1 - halfChordSq));

  return EARTH_RADIUS_KM * angularDistance;
}

/**
 * Format a distance in km to a human-readable string.
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

/**
 * Estimate ETA in minutes based on distance.
 * Assumes average response speed of 30 km/h in urban areas.
 */
export function estimateEtaMinutes(km: number): number {
  const SPEED_KMH = 30;
  return Math.max(1, Math.round((km / SPEED_KMH) * 60));
}

/**
 * Format ETA in minutes to a human-readable string.
 */
export function formatEta(minutes: number): string {
  if (minutes < 1) return "< 1 min";
  if (minutes === 1) return "1 min";
  return `${minutes} mins`;
}

// Default demo location center (e.g. Nagpur, India)
export const DEFAULT_CENTER: LatLng = { lat: 21.1458, lng: 79.0882 };

/**
 * Generate a random location within a given radius (km) from a center point.
 * Useful for demo/hackathon purposes.
 */
export function randomLocationNear(center: LatLng, radiusKm: number): LatLng {
  const radiusInDeg = radiusKm / 111.32;
  const u = Math.random();
  const v = Math.random();
  const w = radiusInDeg * Math.sqrt(u);
  const t = 2 * Math.PI * v;
  const x = w * Math.cos(t);
  const y = w * Math.sin(t);

  return {
    lat: center.lat + y,
    lng: center.lng + x / Math.cos(toRadians(center.lat)),
  };
}
