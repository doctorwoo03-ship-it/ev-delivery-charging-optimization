// Route result validation for the driver-facing map.
// Only a result that passes isValidRoadRouteResult is safe to render as a road polyline.
// A fallback straight-line result must never be drawn on the HMI map.

const LAT_MIN = 33.0, LAT_MAX = 39.0   // Korean peninsula latitude bounds
const LNG_MIN = 124.0, LNG_MAX = 132.0  // Korean peninsula longitude bounds
const MIN_PATH_POINTS = 10              // Real road route must exceed this threshold

function isValidCoord(pt) {
  return pt != null
    && typeof pt.lat === 'number' && isFinite(pt.lat)
    && typeof pt.lng === 'number' && isFinite(pt.lng)
    && pt.lat >= LAT_MIN && pt.lat <= LAT_MAX
    && pt.lng >= LNG_MIN && pt.lng <= LNG_MAX
}

/**
 * Returns true only when result is a real road route safe to render on the driver map.
 *
 * Checks:
 *  - result is a non-null object
 *  - isFallback === false  (API succeeded, not a straight-line approximation)
 *  - path is an array with at least MIN_PATH_POINTS entries
 *  - spot-checks first, middle, and last coordinates for valid Korean-peninsula range
 */
export function isValidRoadRouteResult(result) {
  if (!result || typeof result !== 'object') return false
  if (result.isFallback !== false) return false
  if (!Array.isArray(result.path) || result.path.length < MIN_PATH_POINTS) return false
  const mid = Math.floor(result.path.length / 2)
  return isValidCoord(result.path[0])
    && isValidCoord(result.path[mid])
    && isValidCoord(result.path[result.path.length - 1])
}
