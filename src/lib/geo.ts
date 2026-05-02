const R_KM = 6371;

export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R_KM * c;
}

export function formatDistance(km: number, lang: "en" | "hi"): string {
  if (km < 1) {
    const m = Math.round(km * 1000);
    return lang === "hi" ? `${m} मीटर` : `${m} m`;
  }
  return lang === "hi" ? `${km.toFixed(1)} किमी` : `${km.toFixed(1)} km`;
}
