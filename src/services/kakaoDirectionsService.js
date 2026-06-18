// Vehicle road-route service
// Priority 1: backend proxy at VITE_DIRECTIONS_API_BASE_URL  (recommended for production)
// Priority 2: direct Kakao Mobility REST API with VITE_KAKAO_REST_API_KEY  (dev convenience only)
//
// Environment variables (set in .env, never hardcoded here):
//   VITE_DIRECTIONS_API_BASE_URL  — backend proxy base URL (production)
//   VITE_KAKAO_REST_API_KEY       — Kakao REST API key (dev only; not recommended for production)
//
// Recovery stack (applied in order, real-road only — fallback polylines never re-enabled):
//   1. Grouped split       — up to KAKAO_WAYPOINT_LIMIT waypoints per request
//   2. Pairwise direct     — each adjacent pair, no waypoints
//   3. Snap retry          — small coordinate offsets for access-sensitive places (역, 환승센터, …)
//   4. Multi-anchor chain  — sequential highway anchor chain for legs > 80 km
//   5. Sub-leg split       — geographic midpoint bisection up to 2 levels
//   Error shown only after every real-road strategy fails.

import { devWarn } from '../utils/devLog'

const PROXY_BASE = (import.meta.env.VITE_DIRECTIONS_API_BASE_URL ?? '').replace(/\/$/, '')
const REST_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY ?? ''

const KAKAO_WAYPOINT_LIMIT = 5
const NEAR_DUPLICATE_METERS = 30
const CORRIDOR_RECOVERY_THRESHOLD_M = 80_000

// Place-name keywords indicating a building/station center that may be inside a
// pedestrian-only area. Coordinates returned by Kakao Maps search for these places
// often need a small offset to reach the nearest drivable road entry point.
const ACCESS_SENSITIVE_KEYWORDS = ['역', '환승센터', '터미널', 'KINTEX', '킨텍스', '공항', '역사']

// Coordinate offsets for access-point snapping.
// ~0.00045°lat ≈ 50 m  |  ~0.0009° ≈ 100 m  |  ~0.0018° ≈ 200 m
// ~0.0027° ≈ 300 m     |  ~0.0045° ≈ 500 m
const SNAP_OFFSETS_STANDARD = [
  { dlat:  0.00045, dlng:  0      },  // N  ~50 m
  { dlat:  0,       dlng:  0.0005 },  // E  ~45 m
  { dlat: -0.00045, dlng:  0      },  // S  ~50 m
  { dlat:  0,       dlng: -0.0005 },  // W  ~45 m
  { dlat:  0.0009,  dlng:  0      },  // N  ~100 m
  { dlat:  0,       dlng:  0.001  },  // E  ~90 m
  { dlat:  0.0009,  dlng:  0.001  },  // NE ~135 m
  { dlat: -0.0009,  dlng:  0.001  },  // SE ~135 m
  { dlat:  0.0018,  dlng:  0      },  // N  ~200 m
  { dlat:  0,       dlng: -0.001  },  // W  ~90 m
]

const SNAP_OFFSETS_ACCESS_SENSITIVE = [
  ...SNAP_OFFSETS_STANDARD,
  { dlat:  0.0027,  dlng:  0      },  // N  ~300 m
  { dlat: -0.0027,  dlng:  0      },  // S  ~300 m
  { dlat:  0,       dlng:  0.0045 },  // E  ~410 m
  { dlat:  0,       dlng: -0.0045 },  // W  ~410 m
  { dlat:  0.0018,  dlng:  0.002  },  // NE ~270 m
  { dlat: -0.0018,  dlng:  0.002  },  // SE ~270 m
  { dlat:  0.0018,  dlng: -0.002  },  // NW ~270 m
]

// Highway and national-road corridor anchors spanning the Korean peninsula.
// Used to build sequential routing chains for long-distance legs that single-segment
// routing cannot handle. Covers Gyeongbu (서울↔부산), Honam (서울↔광주/여수),
// and Gyeongnam (창원/부산) corridors.
const LONG_DISTANCE_ANCHORS = [
  // Gyeonggi / northern Gyeongbu
  { name: '수원',  lat: 37.2636, lng: 127.0286 },
  { name: '오산',  lat: 37.1520, lng: 127.0769 },
  { name: '안성',  lat: 37.0078, lng: 127.2797 },
  { name: '평택',  lat: 36.9921, lng: 127.1128 },
  // Chungcheong
  { name: '천안',  lat: 36.8065, lng: 127.1527 },
  { name: '청주',  lat: 36.6424, lng: 127.4890 },
  { name: '대전',  lat: 36.3504, lng: 127.3845 },
  { name: '옥천',  lat: 36.3080, lng: 127.5708 },
  // Honam (서쪽)
  { name: '논산',  lat: 36.1879, lng: 127.0988 },
  { name: '전주',  lat: 35.8242, lng: 127.1479 },
  { name: '광주',  lat: 35.1595, lng: 126.8526 },
  { name: '순천',  lat: 34.9507, lng: 127.4872 },
  // Gyeongbu (동쪽)
  { name: '김천',  lat: 36.1395, lng: 128.1137 },
  { name: '구미',  lat: 36.1195, lng: 128.3442 },
  { name: '칠곡',  lat: 35.9873, lng: 128.4019 },
  // Gyeongnam / Busan
  { name: '창원',  lat: 35.2542, lng: 128.6543 },
  { name: '부산',  lat: 35.1796, lng: 129.0756 },
]

// Structured error for a pairwise leg that failed all recovery strategies.
// Carries the from/to point objects so callers can surface the point name to the driver.
class RouteLegError extends Error {
  constructor(fromPt, toPt) {
    super('route_leg_failed')
    this.fromPt = fromPt
    this.toPt   = toPt
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function haversineM(a, b) {
  const R = 6_371_000
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const c = sinLat * sinLat +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinLng * sinLng
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c))
}

function isAccessSensitivePoint(pt) {
  if (!pt?.name) return false
  return ACCESS_SENSITIVE_KEYWORDS.some(kw => pt.name.includes(kw))
}

function toKakaoCoord(p) {
  return `${p.lng},${p.lat}`
}

// ─── API layer ───────────────────────────────────────────────────────────────

async function callDirectionsAPI(origin, destination, waypoints) {
  const params = new URLSearchParams({
    origin: toKakaoCoord(origin),
    destination: toKakaoCoord(destination),
    priority: 'DISTANCE',
  })
  if (waypoints?.length) {
    params.set('waypoints', waypoints.map(toKakaoCoord).join('|'))
  }

  if (PROXY_BASE) {
    const res = await fetch(`${PROXY_BASE}/v1/directions?${params}`)
    if (!res.ok) throw new Error(`proxy_${res.status}`)
    return res.json()
  }

  if (REST_KEY) {
    // Dev only: direct call exposes key in network tab. Use VITE_DIRECTIONS_API_BASE_URL for production.
    const res = await fetch(
      `https://apis-navi.kakaomobility.com/v1/directions?${params}`,
      { headers: { Authorization: `KakaoAK ${REST_KEY}` } }
    )
    if (!res.ok) throw new Error(`kakao_${res.status}`)
    return res.json()
  }

  throw new Error('no_api_configured')
}

function parseRouteData(data, chargerPresent) {
  const route = data.routes?.[0]
  if (!route) throw new Error('empty_route')

  const rawSections = route.sections ?? []
  const sections = rawSections.map((section, idx) => {
    const path = []
    for (const road of (section.roads ?? [])) {
      const v = road.vertexes ?? []
      for (let i = 0; i + 1 < v.length; i += 2) {
        path.push({ lat: v[i + 1], lng: v[i] })
      }
    }
    const secSummary = section.summary ?? {}
    const type = chargerPresent
      ? (idx === 0 ? 'start-to-charger' : 'charger-to-delivery')
      : 'delivery-leg'
    return {
      type,
      path,
      distanceKm: secSummary.distance ? parseFloat((secSummary.distance / 1000).toFixed(1)) : null,
      durationMin: secSummary.duration ? Math.round(secSummary.duration / 60) : null,
    }
  })

  const allPath = sections.flatMap(s => s.path)
  if (allPath.length < 2) throw new Error('path_too_short')

  const summary = route.summary ?? {}
  return {
    path: allPath,
    sectionPaths: sections.map(s => s.path),
    sections,
    distanceKm: summary.distance ? parseFloat((summary.distance / 1000).toFixed(1)) : null,
    durationMin: summary.duration ? Math.round(summary.duration / 60) : null,
  }
}

function buildFallback(startPoint, deliveries, chargerWaypoint) {
  const points = chargerWaypoint
    ? [startPoint, chargerWaypoint, ...deliveries]
    : [startPoint, ...deliveries]
  return points.map(({ lat, lng }) => ({ lat, lng }))
}

function buildFallbackSections(startPoint, deliveries, chargerWaypoint) {
  if (chargerWaypoint) {
    return [
      {
        type: 'start-to-charger',
        path: [startPoint, chargerWaypoint].map(({ lat, lng }) => ({ lat, lng })),
        distanceKm: null,
        durationMin: null,
      },
      {
        type: 'charger-to-delivery',
        path: [chargerWaypoint, ...deliveries].map(({ lat, lng }) => ({ lat, lng })),
        distanceKm: null,
        durationMin: null,
      },
    ]
  }
  return [{
    type: 'delivery-leg',
    path: [startPoint, ...deliveries].map(({ lat, lng }) => ({ lat, lng })),
    distanceKm: null,
    durationMin: null,
  }]
}

// Split an ordered point list into overlapping API-compatible segments.
export function buildRouteSegments(points, maxWaypoints = KAKAO_WAYPOINT_LIMIT) {
  const step = maxWaypoints + 1
  const segments = []
  let i = 0
  while (i < points.length - 1) {
    const end = Math.min(i + step + 1, points.length)
    const chunk = points.slice(i, end)
    segments.push({
      origin:      chunk[0],
      waypoints:   chunk.slice(1, -1),
      destination: chunk[chunk.length - 1],
    })
    i += step
    if (i >= points.length - 1) break
  }
  return segments
}

// Single segment fetch: backend proxy preferred, REST_KEY fallback.
// Throws on any API error or backend-side fallback — caller handles failure.
async function fetchRouteSegment(origin, destination, waypoints, segChargerPresent) {
  if (PROXY_BASE) {
    const res = await fetch(`${PROXY_BASE}/api/directions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin,
        destination,
        waypoints,
        charger_present: segChargerPresent,
      }),
    })
    if (!res.ok) {
      try {
        const errBody = await res.json()
        devWarn('[directions] backend error detail:', errBody?.detail ?? errBody)
      } catch { /* body not JSON */ }
      throw new Error(`proxy_${res.status}`)
    }
    const data = await res.json()
    if (data.isFallback) {
      const err = new Error(data.message ?? 'proxy_fallback')
      err.snapTried   = data.routeError?.snapRecoveryTried ?? false
      err.routeError  = data.routeError ?? null
      throw err
    }
    return {
      path:         data.path ?? [],
      sectionPaths: data.sectionPaths ?? [],
      sections:     data.sections ?? [],
      distanceKm:   data.distanceKm ?? 0,
      durationMin:  data.durationMin ?? 0,
    }
  }

  if (REST_KEY) {
    const raw = await callDirectionsAPI(origin, destination, waypoints.length ? waypoints : null)
    return parseRouteData(raw, segChargerPresent)
  }

  throw new Error('no_api_configured')
}

function mergeRouteResults(segmentResults, chargerPresent) {
  const allSections = segmentResults.flatMap(r => r.sections ?? [])

  const sections = allSections.map((sec, idx) => ({
    ...sec,
    type: chargerPresent
      ? (idx === 0 ? 'start-to-charger' : 'charger-to-delivery')
      : 'delivery-leg',
  }))

  const path = segmentResults.flatMap((r, i) => {
    const p = r.path ?? []
    return i === 0 ? p : p.slice(1)
  })

  const totalDistanceKm  = segmentResults.reduce((sum, r) => sum + (r.distanceKm  ?? 0), 0)
  const totalDurationMin = segmentResults.reduce((sum, r) => sum + (r.durationMin ?? 0), 0)

  return {
    path,
    sectionPaths: sections.map(s => s.path),
    sections,
    distanceKm:  parseFloat(totalDistanceKm.toFixed(1)),
    durationMin: Math.round(totalDurationMin),
  }
}

// ─── Recovery strategies ─────────────────────────────────────────────────────

// Strategy B: Snap the origin or destination coordinate for access-sensitive places
// (역, 환승센터, 터미널, etc.) whose coordinates land in pedestrian-only areas.
// Tries small offsets around the sensitive endpoint; returns first success or null.
async function trySnapRetryLeg(fromPt, toPt) {
  const fromSensitive = isAccessSensitivePoint(fromPt)
  const toSensitive   = isAccessSensitivePoint(toPt)
  if (!fromSensitive && !toSensitive) return null

  const offsets = (fromSensitive && toSensitive)
    ? SNAP_OFFSETS_ACCESS_SENSITIVE
    : SNAP_OFFSETS_STANDARD

  if (fromSensitive) {
    for (const { dlat, dlng } of offsets) {
      const snapped = { ...fromPt, lat: fromPt.lat + dlat, lng: fromPt.lng + dlng }
      try {
        const r = await fetchRouteSegment(snapped, toPt, [], false)
        return { ...r, accessPointAdjusted: true }
      } catch { /* next offset */ }
    }
  }

  if (toSensitive) {
    for (const { dlat, dlng } of offsets) {
      const snapped = { ...toPt, lat: toPt.lat + dlat, lng: toPt.lng + dlng }
      try {
        const r = await fetchRouteSegment(fromPt, snapped, [], false)
        return { ...r, accessPointAdjusted: true }
      } catch { /* next offset */ }
    }
  }

  return null
}

// Strategy C: Multi-anchor corridor chain for long-distance legs (>80 km).
// Selects highway anchors inside the geographic corridor between fromPt and toPt,
// sorts them in direction-of-travel order, then routes each sub-segment sequentially.
// Falls back to fewer anchors when the full chain fails.
async function tryMultiAnchorChain(fromPt, toPt) {
  const latMin = Math.min(fromPt.lat, toPt.lat) - 0.5
  const latMax = Math.max(fromPt.lat, toPt.lat) + 0.5
  const lngMin = Math.min(fromPt.lng, toPt.lng) - 0.8
  const lngMax = Math.max(fromPt.lng, toPt.lng) + 0.8

  const dLat  = toPt.lat - fromPt.lat
  const dLng  = toPt.lng - fromPt.lng
  const lenSq = dLat * dLat + dLng * dLng

  const inCorridor = LONG_DISTANCE_ANCHORS
    .filter(a => a.lat >= latMin && a.lat <= latMax && a.lng >= lngMin && a.lng <= lngMax)
    .map(a => {
      const t = lenSq > 0
        ? ((a.lat - fromPt.lat) * dLat + (a.lng - fromPt.lng) * dLng) / lenSq
        : 0.5
      return { ...a, t }
    })
    .filter(a => a.t > 0.08 && a.t < 0.92)  // exclude anchors too close to either endpoint
    .sort((a, b) => a.t - b.t)               // sort in direction of travel

  if (inCorridor.length === 0) return null

  const maxAnchors = Math.min(inCorridor.length, 4)

  // Try from most anchors down to single, to maximise chance of success
  for (let nAnchors = maxAnchors; nAnchors >= 1; nAnchors--) {
    let selected
    if (nAnchors === 1) {
      selected = [inCorridor[Math.floor(inCorridor.length / 2)]]
    } else {
      const step = (inCorridor.length - 1) / (nAnchors - 1)
      selected = Array.from({ length: nAnchors }, (_, i) => inCorridor[Math.round(i * step)])
    }

    const chain = [fromPt, ...selected, toPt]
    try {
      const segResults = []
      for (let i = 0; i < chain.length - 1; i++) {
        segResults.push(await fetchRouteSegment(chain[i], chain[i + 1], [], false))
      }
      const merged = mergeRouteResults(segResults, false)
      return merged
    } catch { /* try fewer anchors */ }
  }

  return null
}

// Strategy D: Recursive geographic midpoint bisection.
// maxDepth=2 → up to 4 sub-segments (2²).
async function trySubLegSplit(fromPt, toPt, maxDepth = 2) {
  if (maxDepth <= 0) return null

  const midPt = {
    name: `mid(${fromPt.name ?? '?'}→${toPt.name ?? '?'})`,
    lat: (fromPt.lat + toPt.lat) / 2,
    lng: (fromPt.lng + toPt.lng) / 2,
  }

  try {
    const [leg1, leg2] = await Promise.all([
      fetchRouteSegment(fromPt, midPt, [], false),
      fetchRouteSegment(midPt, toPt, [], false),
    ])
    return mergeRouteResults([leg1, leg2], false)
  } catch {
    if (maxDepth <= 1) return null
    try {
      const r1 = await trySubLegSplit(fromPt, midPt, maxDepth - 1)
      if (!r1) return null
      const r2 = await trySubLegSplit(midPt, toPt, maxDepth - 1)
      if (!r2) return null
      return mergeRouteResults([r1, r2], false)
    } catch { return null }
  }
}

// Full pairwise recovery: A → B → C → D → error for each leg.
// failedPairCache: Set of "lat,lng|lat,lng" keys where backend snap was already exhausted.
// Skips frontend snap (strategy B) for pairs already confirmed unsnappable by the backend.
async function runPairwiseRecovery(allPoints, chargerPresent, failedPairCache = new Set()) {
  const results = []

  for (let i = 0; i < allPoints.length - 1; i++) {
    const fromPt = allPoints[i]
    const toPt   = allPoints[i + 1]
    const distM  = haversineM(fromPt, toPt)

    if (distM < NEAR_DUPLICATE_METERS) {
      results.push({
        path:         [{ lat: fromPt.lat, lng: fromPt.lng }],
        sectionPaths: [[{ lat: fromPt.lat, lng: fromPt.lng }]],
        sections:     [{ type: 'delivery-leg', path: [{ lat: fromPt.lat, lng: fromPt.lng }], distanceKm: 0, durationMin: 0 }],
        distanceKm:   0,
        durationMin:  0,
      })
      continue
    }

    const pairKey = `${fromPt.lat.toFixed(5)},${fromPt.lng.toFixed(5)}|${toPt.lat.toFixed(5)},${toPt.lng.toFixed(5)}`

    // A: Direct
    let backendSnapExhausted = false
    try {
      results.push(await fetchRouteSegment(fromPt, toPt, [], chargerPresent && i === 0))
      continue
    } catch (directErr) {
      devWarn(`  leg${i} direct failed:`, directErr.message)
      // If backend already ran snap recovery and gave up, record this pair.
      if (directErr.snapTried) {
        backendSnapExhausted = true
        failedPairCache.add(pairKey)
      }
    }

    // B: Snap retry (access-sensitive places).
    // Skip when backend snap was already exhausted for this exact pair to avoid
    // re-generating dozens of Kakao API calls for coordinates already confirmed unroutable.
    const skipFrontendSnap = backendSnapExhausted || failedPairCache.has(pairKey)
    if (!skipFrontendSnap) {
      const snapResult = await trySnapRetryLeg(fromPt, toPt)
      if (snapResult) { results.push(snapResult); continue }
    }

    // C: Multi-anchor corridor chain (long legs only)
    if (distM >= CORRIDOR_RECOVERY_THRESHOLD_M) {
      const chainResult = await tryMultiAnchorChain(fromPt, toPt)
      if (chainResult) {
        results.push(chainResult)
        continue
      }
    }

    // D: Sub-leg split (geographic midpoint bisection)
    const subResult = await trySubLegSplit(fromPt, toPt, 2)
    if (subResult) {
      results.push(subResult)
      continue
    }

    throw new RouteLegError(fromPt, toPt)
  }

  return mergeRouteResults(results, chargerPresent)
}

// ─── Public route functions ───────────────────────────────────────────────────

export async function getVehicleRoute({ startPoint, deliveries, chargerWaypoint }) {
  if (!startPoint || !deliveries?.length) {
    return {
      path: [], sectionPaths: [], sections: [],
      distanceKm: 0, durationMin: 0,
      isFallback: true, source: 'fallback-polyline', message: 'no_deliveries',
    }
  }

  const chargerPresent = !!chargerWaypoint

  if (chargerWaypoint) {
    const chargerDistFromStart   = haversineM(startPoint, chargerWaypoint)
    const deliveryCentroid       = {
      lat: deliveries.reduce((s, d) => s + d.lat, 0) / deliveries.length,
      lng: deliveries.reduce((s, d) => s + d.lng, 0) / deliveries.length,
    }
    const chargerDistFromCentroid = haversineM(chargerWaypoint, deliveryCentroid)
    if (chargerDistFromStart > 100_000 && chargerDistFromCentroid < chargerDistFromStart * 0.6) {
      devWarn(
        '[directions] charger insertion may create a long backtrack loop.',
        `charger "${chargerWaypoint.name}" is ${(chargerDistFromStart / 1000).toFixed(0)} km from start`,
        `but only ${(chargerDistFromCentroid / 1000).toFixed(0)} km from delivery centroid.`
      )
    }
  }

  const origin        = startPoint
  const destination   = deliveries[deliveries.length - 1]
  const midDeliveries = deliveries.slice(0, -1)
  const waypoints     = chargerWaypoint ? [chargerWaypoint, ...midDeliveries] : midDeliveries
  const useSplit      = waypoints.length > KAKAO_WAYPOINT_LIMIT

  const allPoints = chargerWaypoint
    ? [startPoint, chargerWaypoint, ...deliveries]
    : [startPoint, ...deliveries]

  const pairwiseSource = PROXY_BASE ? 'backend-proxy-pairwise' : 'kakao-mobility-pairwise'

  // Shared across grouped split and pairwise recovery so that when the backend
  // already ran snap on a (origin, dest) pair and gave up, pairwise skips the
  // frontend snap layer for the same pair.
  const failedPairCache = new Set()

  try {
    // ── Strategy 1: Grouped split (> 5 waypoints) ────────────────────────────
    if (useSplit) {
      try {
        const segments = buildRouteSegments(allPoints, KAKAO_WAYPOINT_LIMIT)
        const segmentResults = await Promise.all(
          segments.map((seg, i) =>
            fetchRouteSegment(
              seg.origin, seg.destination, seg.waypoints, chargerPresent && i === 0
            ).catch(err => {
              if (err.snapTried) {
                const k = `${seg.origin.lat.toFixed(5)},${seg.origin.lng.toFixed(5)}|${seg.destination.lat.toFixed(5)},${seg.destination.lng.toFixed(5)}`
                failedPairCache.add(k)
              }
              devWarn(`[directions] grouped seg${i} failed:`, err.message)
              throw new Error(`segment_${i}: ${err.message}`)
            })
          )
        )

        const merged = mergeRouteResults(segmentResults, chargerPresent)
        const source = PROXY_BASE ? 'backend-proxy-split' : 'kakao-mobility-directions-split'
        return {
          ...merged,
          isFallback: false,
          source,
          message: null,
          split: { enabled: true, segmentCount: segments.length, maxWaypoints: KAKAO_WAYPOINT_LIMIT },
        }
      } catch (groupedErr) {
        devWarn('[directions] grouped split failed, trying pairwise recovery:', groupedErr.message)
      }

      // ── Strategy 2: Pairwise + recovery (after grouped split failure) ───────
      const pairwiseMerged = await runPairwiseRecovery(allPoints, chargerPresent, failedPairCache)
      return {
        ...pairwiseMerged,
        isFallback: false,
        source: pairwiseSource,
        message: null,
        split: { enabled: true, segmentCount: allPoints.length - 1, strategy: 'pairwise', maxWaypoints: 0 },
      }
    }

    // ── Single-segment request (≤ 5 waypoints) ───────────────────────────────
    // On failure, fall through to pairwise decomposition — never return fallback here.
    try {
      if (PROXY_BASE) {
        const res = await fetch(`${PROXY_BASE}/api/directions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ origin, destination, waypoints, charger_present: chargerPresent }),
        })
        if (!res.ok) throw new Error(`proxy_${res.status}`)
        const data = await res.json()
        if (data.isFallback) {
          if (data.routeError?.snapRecoveryTried) {
            const k = `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}|${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}`
            failedPairCache.add(k)
          }
          throw new Error(data.message ?? 'proxy_fallback')
        }
        return { ...data, message: data.message ?? null }
      }

      if (REST_KEY) {
        const raw = await callDirectionsAPI(origin, destination, waypoints.length ? waypoints : null)
        const result = parseRouteData(raw, chargerPresent)
        return { ...result, isFallback: false, source: 'kakao-mobility-directions', message: null }
      }

      throw new Error('no_api_configured')
    } catch (singleErr) {
      devWarn('[directions] single request failed, pairwise decomposition:', singleErr.message)
    }

    // ── Pairwise + recovery (single-segment failure fallthrough) ─────────────
    const pairwiseMerged = await runPairwiseRecovery(allPoints, chargerPresent, failedPairCache)
    return {
      ...pairwiseMerged,
      isFallback: false,
      source: pairwiseSource,
      message: null,
      split: { enabled: true, segmentCount: allPoints.length - 1, strategy: 'pairwise-recovery', maxWaypoints: 0 },
    }

  } catch (err) {
    devWarn('[kakaoDirectionsService] route fetch failed:', err.message)
    const failedLegInfo = (err instanceof RouteLegError)
      ? { from: err.fromPt, to: err.toPt }
      : null
    return {
      path:         buildFallback(startPoint, deliveries, chargerWaypoint),
      sectionPaths: [],
      sections:     buildFallbackSections(startPoint, deliveries, chargerWaypoint),
      distanceKm:   null,
      durationMin:  null,
      isFallback:   true,
      source:       'fallback-polyline',
      message:      err.message ?? 'unknown',
      failedLegInfo,
    }
  }
}

// Canonical alias — same shape as getVehicleRoute; kept for MVP-7 compatibility.
export async function getVehicleRoutePath({ startPoint, deliveries, chargerWaypoint }) {
  return getVehicleRoute({ startPoint, deliveries, chargerWaypoint })
}

// Delivery-only route (no charger waypoint).
// A charger detour failure never blocks this route.
export async function getDeliveryRoute({ startPoint, deliveries }) {
  return getVehicleRoute({ startPoint, deliveries, chargerWaypoint: null })
}

// Point-to-point route from startPoint to a single charger.
// Returns fallback (isFallback: true) instead of throwing — callers treat charger route as optional.
export async function getChargerRoute({ startPoint, charger }) {
  if (!startPoint || !charger) {
    return {
      path: [], sectionPaths: [], sections: [],
      distanceKm: 0, durationMin: 0,
      isFallback: true, source: 'fallback-polyline', message: 'no_charger',
    }
  }

  try {
    if (PROXY_BASE) {
      const res = await fetch(`${PROXY_BASE}/api/directions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin:          startPoint,
          destination:     charger,
          waypoints:       [],
          charger_present: true,
        }),
      })
      if (!res.ok) throw new Error(`proxy_${res.status}`)
      const data = await res.json()
      if (data.isFallback) throw new Error(data.message ?? 'proxy_fallback')
      return { ...data, message: data.message ?? null }
    }

    if (REST_KEY) {
      const raw = await callDirectionsAPI(startPoint, charger, null)
      const result = parseRouteData(raw, true)
      return { ...result, isFallback: false, source: 'kakao-mobility-directions', message: null }
    }

    throw new Error('no_api_configured')
  } catch (err) {
    devWarn('[directions] charger route failed:', err.message)
    return {
      path:         [startPoint, charger].map(({ lat, lng }) => ({ lat, lng })),
      sectionPaths: [[startPoint, charger].map(({ lat, lng }) => ({ lat, lng }))],
      sections:     [{ type: 'start-to-charger', path: [startPoint, charger].map(({ lat, lng }) => ({ lat, lng })), distanceKm: null, durationMin: null }],
      distanceKm:   null,
      durationMin:  null,
      isFallback:   true,
      source:       'fallback-polyline',
      message:      err.message ?? 'charger_route_failed',
    }
  }
}
