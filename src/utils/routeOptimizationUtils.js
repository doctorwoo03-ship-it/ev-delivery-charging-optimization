import { haversineKm, calculateRouteDistance } from './routeUtils'

function permutations(arr) {
  if (arr.length <= 1) return [arr]
  const result = []
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)]
    for (const perm of permutations(rest)) {
      result.push([arr[i], ...perm])
    }
  }
  return result
}

function nearestNeighbor(startPoint, deliveries) {
  const remaining = [...deliveries]
  const ordered = []
  let current = startPoint
  while (remaining.length > 0) {
    let minDist = Infinity
    let minIdx = 0
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current.lat, current.lng, remaining[i].lat, remaining[i].lng)
      if (d < minDist) { minDist = d; minIdx = i }
    }
    ordered.push(remaining[minIdx])
    current = remaining[minIdx]
    remaining.splice(minIdx, 1)
  }
  return ordered
}

export function optimizeDeliveryOrder(startPoint, deliveries) {
  if (!deliveries || deliveries.length === 0) {
    return {
      originalDistanceKm: 0, optimizedDistanceKm: 0,
      savedDistanceKm: 0, savedPercent: 0,
      optimizedDeliveries: [], method: 'none',
    }
  }

  const originalDistanceKm = parseFloat(calculateRouteDistance(startPoint, deliveries).toFixed(1))

  if (deliveries.length === 1) {
    return {
      originalDistanceKm, optimizedDistanceKm: originalDistanceKm,
      savedDistanceKm: 0, savedPercent: 0,
      optimizedDeliveries: [...deliveries], method: 'trivial',
    }
  }

  let optimizedDeliveries
  let method

  if (deliveries.length <= 8) {
    method = 'brute-force'
    const perms = permutations(deliveries)
    let minDist = Infinity
    let bestPerm = deliveries
    for (const perm of perms) {
      const dist = calculateRouteDistance(startPoint, perm)
      if (dist < minDist) { minDist = dist; bestPerm = perm }
    }
    optimizedDeliveries = bestPerm
  } else {
    method = 'nearest-neighbor'
    optimizedDeliveries = nearestNeighbor(startPoint, deliveries)
  }

  const optimizedDistanceKm = parseFloat(calculateRouteDistance(startPoint, optimizedDeliveries).toFixed(1))
  const savedDistanceKm = parseFloat(Math.max(0, originalDistanceKm - optimizedDistanceKm).toFixed(1))
  const savedPercent = originalDistanceKm > 0
    ? parseFloat((savedDistanceKm / originalDistanceKm * 100).toFixed(1))
    : 0

  return { originalDistanceKm, optimizedDistanceKm, savedDistanceKm, savedPercent, optimizedDeliveries, method }
}
