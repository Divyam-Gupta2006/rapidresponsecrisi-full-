// ── Haversine + Location Utilities ──────────────────────────────────────────

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/** Haversine distance between two lat/lng points in kilometers. */
export function getDistanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);

  const halfChordSq =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      Math.sin(dLng / 2) ** 2;

  const angularDistance =
    2 * Math.atan2(Math.sqrt(halfChordSq), Math.sqrt(1 - halfChordSq));

  return EARTH_RADIUS_KM * angularDistance;
}

/** ETA in minutes assuming 30 km/h urban response speed. */
export function estimateEtaMinutes(km: number): number {
  const SPEED_KMH = 30;
  return Math.max(1, Math.round((km / SPEED_KMH) * 60));
}

export function formatEta(minutes: number): string {
  if (minutes < 1) return "< 1 min";
  if (minutes === 1) return "1 min";
  return `${minutes} mins`;
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
