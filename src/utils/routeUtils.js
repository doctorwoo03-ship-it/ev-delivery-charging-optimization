export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Calculates total straight-line route distance from startPoint through destinations in order.
// Replace the internals with Kakao Directions API calls in MVP-4+.
export function calculateRouteDistance(startPoint, destinations) {
  if (!destinations || destinations.length === 0) return 0
  let total = 0
  let prev = startPoint
  for (const dest of destinations) {
    total += haversineKm(prev.lat, prev.lng, dest.lat, dest.lng)
    prev = dest
  }
  return total
}
