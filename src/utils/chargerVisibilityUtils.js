/**
 * Filters chargers to only those relevant to the current driving route.
 * Designed to be reusable when real charger API data is connected later.
 *
 * Chargers without routeDeviationMeters (pre-scored raw data) pass through unfiltered
 * so backward-compat callers (e.g. MVP5Page) are not affected.
 */
export function getVisibleChargersForRoute(chargers, {
  maxRouteDeviationMeters = 1000,
  includeRecommended = true,
  includeSelected = true,
  includeWarn = true,
  recommendedId = null,
  selectedId = null,
  warnId = null,
} = {}) {
  return chargers.filter(c => {
    // Always show exception IDs regardless of deviation
    if (includeRecommended && recommendedId && c.id === recommendedId) return true
    if (includeSelected && selectedId && c.id === selectedId) return true
    if (includeWarn && warnId && c.id === warnId) return true
    // No deviation data → backward compat, show all (MVP5 / raw CHARGERS array)
    if (c.routeDeviationMeters == null) return true
    // Filter by route proximity
    return c.routeDeviationMeters <= maxRouteDeviationMeters
  })
}
