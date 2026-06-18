// Shared Route Intelligence State
// MVP-6 writes here after analyzeRoute completes.
// MVP-7 reads here to show the same result the driver sees on MVP-6.
//
// Strategy: in-memory module singleton + sessionStorage backup.
// sessionStorage survives navigate() but not a hard page reload.
// If sessionStorage is empty on load, MVP-7 falls back to demo data.

const SESSION_KEY = 'ev-route-intelligence'
let _cache = null

/**
 * Save the current Route Intelligence snapshot from MVP-6.
 * @param {Object} snapshot
 * @param {Object}  snapshot.userId
 * @param {Object}  snapshot.vehicle
 * @param {number}  snapshot.batterySOC
 * @param {Object}  snapshot.startPoint
 * @param {Array}   snapshot.deliveries
 * @param {Object|null} snapshot.recommendedCharger
 * @param {Object|null} snapshot.routePathResult
 * @param {Object}  snapshot.routeIntelligenceResult  — output of analyzeRoute()
 * @param {Object|null} snapshot.chargePlan
 * @param {Object|null} snapshot.optimizationResult
 */
export function saveRouteIntelligence(snapshot) {
  _cache = { ...snapshot, updatedAt: new Date().toISOString() }
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(_cache)) } catch {}
}

/**
 * Load the latest Route Intelligence snapshot.
 * Returns null if no snapshot has been saved in this session.
 */
export function loadRouteIntelligence() {
  if (_cache) return _cache
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) { _cache = JSON.parse(raw); return _cache }
  } catch {}
  return null
}

export function clearRouteIntelligence() {
  _cache = null
  try { sessionStorage.removeItem(SESSION_KEY) } catch {}
}
