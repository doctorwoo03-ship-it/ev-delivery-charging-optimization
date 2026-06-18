import { useMemo } from 'react'
import { CHARGERS } from '../data/chargerData'
import { depot as defaultDepot } from '../data/sampleData'
import { haversineKm, calculateRouteDistance } from '../utils/routeUtils'
import { devLog } from '../utils/devLog'

const SAFETY_FACTOR = 0.85
const MIN_REACHABLE_KM = 0.5
const LOCAL_COVERAGE_RADIUS_KM         = 40
const LOCAL_COVERAGE_RADIUS_LOW_SOC_KM = 20
// Segment-detour filtering thresholds
const MAX_DETOUR_KM          = 5.0   // preferred zone
const MAX_DETOUR_KM_EXPANDED = 10.0  // expanded zone — above this: hard reject
const MAX_DETOUR_KM_HARD     = 10.0  // absolute hard gate: never recommend above this
const MAX_ORIGIN_DIST_KM     = 10.0
const MAX_ORIGIN_DIST_KM_EXP = 15.0

function pointToSegmentKm(p, a, b) {
  const cosLat = Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180))
  const ax = a.lng * cosLat, ay = a.lat
  const bx = b.lng * cosLat, by = b.lat
  const px = p.lng * cosLat, py = p.lat
  const dx = bx - ax, dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq < 1e-18) return haversineKm(p.lat, p.lng, a.lat, a.lng)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
  return haversineKm(p.lat, p.lng, a.lat + t * (b.lat - a.lat), a.lng + t * (b.lng - a.lng))
}

function minDistToPath(charger, path) {
  if (path.length === 0) return Infinity
  if (path.length === 1) return haversineKm(charger.lat, charger.lng, path[0].lat, path[0].lng)
  let min = Infinity
  for (let i = 0; i < path.length - 1; i++) {
    const d = pointToSegmentKm(charger, path[i], path[i + 1])
    if (d < min) min = d
  }
  return min
}

function deviationPenalty(deviationKm) {
  const m = deviationKm * 1000
  if (m <= 100) return 0
  if (m <= 300) return (m - 100) / 200
  if (m <= 500) return 1 + (m - 300) / 100
  if (m <= 1000) return 3 + (m - 500) / 100
  return 8 + (m - 1000) / 200
}

const ROUTE_BANDS_KM    = [0.01, 0.02, 0.03, 0.05, 0.1, 0.3, 0.5, 1.0]
const ROUTE_BAND_LABELS = ['10m', '20m', '30m', '50m', '100m', '300m', '500m', '1km']

function getRouteBandLabel(deviationKm) {
  for (let i = 0; i < ROUTE_BANDS_KM.length; i++) {
    if (deviationKm <= ROUTE_BANDS_KM[i]) return `경로 ${ROUTE_BAND_LABELS[i]} 이내`
  }
  return '경로 1km 초과'
}

function buildRecommendationReason(c, deviationKm, reachable) {
  const parts = [getRouteBandLabel(deviationKm)]
  if (!reachable) {
    parts.push('도달 불가')
  } else {
    parts.push('대기 정보 미확인')
  }
  if (c.powerKw >= 50) parts.push(`${c.powerKw}kW`)
  return parts.slice(0, 3).join(' · ')
}

function buildSegmentReason(c, detourKm, reachable) {
  const parts = []
  if (!reachable) {
    parts.push('도달 불가')
  } else {
    parts.push(`우회 ${detourKm.toFixed(1)}km`)
  }
  if (c.powerKw >= 50) parts.push(`${c.powerKw}kW`)
  if (c.connectorCount != null && c.connectorCount > 0) parts.push(`등록 ${c.connectorCount}기`)
  else parts.push('대기 정보 미확인')
  return parts.slice(0, 3).join(' · ')
}

function findNearestReachableChargerFromPoint(candidates) {
  return [...candidates].sort((a, b) => a.distanceFromStartKm - b.distanceFromStartKm)[0] ?? null
}

// Classify the quality of a before-departure charger recommendation.
// Returns one of: 'confirmed-recommendation', 'strong-candidate', 'review-candidate', 'reject'.
function classifyBeforeDepartureQuality(originToChargerKm, detourKm) {
  if (originToChargerKm <= 1.0 && detourKm <= 3.0) return 'confirmed-recommendation'
  if (originToChargerKm <= 3.0 && detourKm <= 5.0) return 'strong-candidate'
  if (originToChargerKm <= 5.0 && detourKm <= 8.0) return 'review-candidate'
  return 'reject'
}

// Build diagnostics for the before-departure charger search around the origin point.
function buildBeforeDepartureDiagnostics(chargers, originPoint) {
  const withDist = chargers.map(c => ({
    name: c.name, id: c.id,
    _d: haversineKm(originPoint.lat, originPoint.lng, c.lat, c.lng),
  })).sort((a, b) => a._d - b._d)
  const nearest = withDist[0] ?? null
  return {
    queryCenterName:            originPoint.name ?? null,
    queryLat:                   originPoint.lat,
    queryLng:                   originPoint.lng,
    searchRadiusKm:             null,
    rawNearbyCount:             chargers.length,
    groupedNearbyCount:         chargers.length,
    nearestCandidateDistanceKm: nearest ? parseFloat(nearest._d.toFixed(3)) : null,
    nearestCandidateName:       nearest?.name ?? null,
    candidatesWithin100m:       withDist.filter(c => c._d <= 0.1).length,
    candidatesWithin300m:       withDist.filter(c => c._d <= 0.3).length,
    candidatesWithin500m:       withDist.filter(c => c._d <= 0.5).length,
    candidatesWithin1Km:        withDist.filter(c => c._d <= 1.0).length,
    candidatesWithin3Km:        withDist.filter(c => c._d <= 3.0).length,
    candidatesWithin5Km:        withDist.filter(c => c._d <= 5.0).length,
  }
}

function classifyMidRouteQuality(detourKm, chargerReachable, reserveSatisfied) {
  if (!chargerReachable || !reserveSatisfied) return 'reject-mid-route'
  if (detourKm <= 3.0) return 'confirmed-mid-route'
  if (detourKm <= 8.0) return 'review-mid-route'
  return 'reject-mid-route'
}

function computeEvTspScore({ detourKm, originToChargerKm, powerKw = 50, reserveSatisfied = true }) {
  const detourPenalty       = detourKm * 2.0
  const chargingTimePenalty = powerKw > 0 ? (100 / powerKw) * 0.5 : 5.0
  const arrivalSocReward    = reserveSatisfied ? -2.0 : 0
  const reserveSocReward    = reserveSatisfied ? -1.0 : 2.0
  return detourPenalty + originToChargerKm * 0.5 + chargingTimePenalty + arrivalSocReward + reserveSocReward
}

// insertionCandidates: ordered array of candidate insertion segments for pull-forward.
//   Each entry: { originPoint, nextPoint, insertionSoc, drivableRangeKm, label, ... }
//   Ordered from the "first detected failure" back toward "before-departure".
//   All candidates are evaluated; winner chosen by EV-TSP score.
// insertionOriginPoint / insertionNextPoint: legacy single-point params (used for scoredChargers display).
export function useChargerRecommendation({
  deliveries, chargeNeeded, drivableRangeKm, totalRouteKm, startPoint, routePath,
  chargers: injectedChargers, allowMockFallback = true, chargerSearchPoint,
  insertionCandidates = [],
  insertionOriginPoint,
  insertionNextPoint,
  chargeTargetRangeKm = null,
  minReserveRangeKm   = null,
}) {
  const effectiveDepot = startPoint ?? defaultDepot
  const effectiveSearchCenter = chargerSearchPoint ?? effectiveDepot
  const chargers = injectedChargers ?? (allowMockFallback ? CHARGERS : [])

  // Use segment-detour scoring when insertion candidates (or legacy single-point) are provided.
  // Prefer the candidates array; fall back to legacy params for scoredChargers display.
  const primaryOriginPoint = insertionCandidates[0]?.originPoint ?? insertionOriginPoint ?? null
  const primaryNextPoint   = insertionCandidates[0]?.nextPoint   ?? insertionNextPoint   ?? null
  const useSegmentScoring = Boolean(
    chargeNeeded && primaryOriginPoint?.lat != null && primaryNextPoint?.lat != null
  )

  const effectivePath = useMemo(() => {
    if (routePath && routePath.length >= 2) return routePath
    const waypoints = [effectiveDepot, ...deliveries]
    if (waypoints.length < 2) return waypoints
    const pts = []
    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = waypoints[i], b = waypoints[i + 1]
      const steps = Math.max(2, Math.ceil(haversineKm(a.lat, a.lng, b.lat, b.lng) / 0.3))
      for (let j = 0; j < steps; j++) {
        const t = j / steps
        pts.push({ lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) })
      }
    }
    pts.push(waypoints[waypoints.length - 1])
    return pts
  }, [routePath, effectiveDepot, deliveries])

  const scoredChargers = useMemo(() => {
    return chargers.map(c => {
      // Distance from search center (= insertion origin when chargerSearchPoint is set correctly)
      const rawDistFromCenter = haversineKm(effectiveSearchCenter.lat, effectiveSearchCenter.lng, c.lat, c.lng)
      const distanceFromStartKm = parseFloat(rawDistFromCenter.toFixed(1))

      let originToChargerKm = distanceFromStartKm
      let insertionDetourKm = null
      let reachableFromStart, score, recommendationReason

      if (useSegmentScoring) {
        const oToC = haversineKm(primaryOriginPoint.lat, primaryOriginPoint.lng, c.lat, c.lng)
        const cToN = haversineKm(c.lat, c.lng, primaryNextPoint.lat, primaryNextPoint.lng)
        const baseLeg = haversineKm(
          primaryOriginPoint.lat, primaryOriginPoint.lng,
          primaryNextPoint.lat, primaryNextPoint.lng,
        )
        const detour = oToC + cToN - baseLeg

        originToChargerKm  = parseFloat(oToC.toFixed(1))
        insertionDetourKm  = parseFloat(detour.toFixed(1))

        reachableFromStart = drivableRangeKm != null
          ? (oToC <= MIN_REACHABLE_KM || drivableRangeKm * SAFETY_FACTOR >= oToC)
          : true

        const reachabilityPenalty = reachableFromStart ? 0 : 1000
        const statusPenalty = c.status === 'maintenance' ? 50 : c.status === 'occupied' ? 3 : 0

        // Tiered detour penalty: hard reject above MAX_DETOUR_KM_HARD
        let detourPenalty
        if (detour > MAX_DETOUR_KM_HARD) {
          detourPenalty = 10000 + detour * 100
        } else if (detour > MAX_DETOUR_KM) {
          detourPenalty = detour * 10.0
        } else {
          detourPenalty = detour * 3.0
        }
        score = detourPenalty + oToC * 0.3 - c.powerKw / 50 + statusPenalty + reachabilityPenalty
        recommendationReason = buildSegmentReason(c, detour, reachableFromStart)
      } else {
        const rawDeviationKm = minDistToPath(c, effectivePath)
        const routeDeviationKm = parseFloat(rawDeviationKm.toFixed(3))

        reachableFromStart = drivableRangeKm != null
          ? (rawDistFromCenter <= MIN_REACHABLE_KM || drivableRangeKm * SAFETY_FACTOR >= rawDistFromCenter)
          : true

        const reachabilityPenalty = reachableFromStart ? 0 : 1000
        const statusPenalty = c.status === 'maintenance' ? 50 : c.status === 'occupied' ? 3 : 0

        score = distanceFromStartKm * 0.15 + deviationPenalty(routeDeviationKm) * 3.0 +
          c.waitMin * 0.2 - c.powerKw / 50 + statusPenalty + reachabilityPenalty
        recommendationReason = buildRecommendationReason(c, rawDeviationKm, reachableFromStart)
      }

      const routeDeviationKm  = parseFloat(minDistToPath(c, effectivePath).toFixed(3))
      const shortageKm = !reachableFromStart && drivableRangeKm != null
        ? parseFloat(Math.max(0, originToChargerKm - drivableRangeKm).toFixed(1))
        : null

      return {
        ...c,
        score,
        distKm: distanceFromStartKm,
        distanceFromStartKm,
        originToChargerKm,
        insertionDetourKm,
        routeDeviationKm,
        routeDeviationMeters: Math.round(routeDeviationKm * 1000),
        routeBandLabel: getRouteBandLabel(routeDeviationKm),
        reachableFromStart,
        recommendationReason,
        shortageKm,
      }
    }).sort((a, b) => a.score - b.score)
  }, [
    deliveries, effectiveSearchCenter, drivableRangeKm, effectivePath, chargers,
    useSegmentScoring, primaryOriginPoint, primaryNextPoint,
  ])

  const { recommendedCharger, nearestUnreachable, recommendationMode, unreachableReason, mockCoverageWarning, selectedInsertionCandidate, beforeDepartureQuality, beforeDepartureDiagnostics, recommendationSource, insertionExplanation, midRouteQuality, hasNearbyReachableCharger, nearestRejectedDepartureCharger, nearestRejectedDepartureChargerName, nearestRejectedDepartureDistanceKm, nearestRejectedDepartureReason } = useMemo(() => {
    const needsNearestReachable = chargeNeeded || (drivableRangeKm != null && drivableRangeKm < 50)

    if (useSegmentScoring) {
      const candidates = insertionCandidates.length > 0
        ? insertionCandidates.filter(c => c?.originPoint?.lat != null && c?.nextPoint?.lat != null)
        : (primaryOriginPoint?.lat != null && primaryNextPoint?.lat != null)
          ? [{ originPoint: primaryOriginPoint, nextPoint: primaryNextPoint, drivableRangeKm }]
          : []

      // Collect results from ALL candidates — pick winner by EV-TSP score
      const collectedResults = []

      for (const candidate of candidates) {
        const candidateDrivableKm = candidate.drivableRangeKm ?? drivableRangeKm

        const candidateScored = chargers.map(c => {
          const oToC   = haversineKm(candidate.originPoint.lat, candidate.originPoint.lng, c.lat, c.lng)
          const cToN   = haversineKm(c.lat, c.lng, candidate.nextPoint.lat, candidate.nextPoint.lng)
          const base   = haversineKm(candidate.originPoint.lat, candidate.originPoint.lng, candidate.nextPoint.lat, candidate.nextPoint.lng)
          const detour = oToC + cToN - base

          const reachable = candidateDrivableKm != null
            ? (oToC <= MIN_REACHABLE_KM || candidateDrivableKm * SAFETY_FACTOR >= oToC)
            : true

          const reachabilityPenalty = reachable ? 0 : 1000
          const statusPenalty = c.status === 'maintenance' ? 50 : c.status === 'occupied' ? 3 : 0

          let detourPenalty
          if (detour > MAX_DETOUR_KM_HARD) {
            detourPenalty = 10000 + detour * 100
          } else if (detour > MAX_DETOUR_KM) {
            detourPenalty = detour * 10.0
          } else {
            detourPenalty = detour * 3.0
          }
          const score = detourPenalty + oToC * 0.3 - c.powerKw / 50 + statusPenalty + reachabilityPenalty

          return {
            ...c,
            _oToC: oToC, _cToN: cToN, _detour: detour, _reachable: reachable,
            originToChargerKm: parseFloat(oToC.toFixed(1)),
            insertionDetourKm: parseFloat(detour.toFixed(1)),
            score,
          }
        })
          .filter(c => c._reachable && c._detour <= MAX_DETOUR_KM_HARD)
          .sort((a, b) => a.score - b.score)

        let picks = candidateScored.filter(c =>
          c._detour <= MAX_DETOUR_KM && c._oToC <= MAX_ORIGIN_DIST_KM
        )
        if (picks.length === 0) {
          picks = candidateScored.filter(c =>
            c._detour <= MAX_DETOUR_KM_EXPANDED && c._oToC <= MAX_ORIGIN_DIST_KM_EXP
          )
        }

        if (picks.length === 0) continue

        const best = picks[0]

        if (candidate.insertionType === 'before-departure') {
          const quality     = classifyBeforeDepartureQuality(best._oToC, best._detour)
          const diagnostics = buildBeforeDepartureDiagnostics(chargers, candidate.originPoint)
          const evTspScore  = computeEvTspScore({ detourKm: best._detour, originToChargerKm: best._oToC, powerKw: best.powerKw, reserveSatisfied: quality !== 'reject' })
          collectedResults.push({
            best, candidate, quality, evTspScore,
            recommendationSource:       'before-departure',
            insertionExplanation:       '출발 전 충전 필요',
            beforeDepartureQuality:     quality,
            beforeDepartureDiagnostics: diagnostics,
            midRouteQuality:            null,
          })
        } else {
          const reserveSatisfied = (chargeTargetRangeKm != null && minReserveRangeKm != null)
            ? (chargeTargetRangeKm - best._cToN) >= minReserveRangeKm
            : true
          const quality    = classifyMidRouteQuality(best._detour, true, reserveSatisfied)
          const evTspScore = computeEvTspScore({ detourKm: best._detour, originToChargerKm: best._oToC, powerKw: best.powerKw, reserveSatisfied: quality !== 'reject-mid-route' })

          const afterNum  = candidate.afterDeliveryIndex != null ? candidate.afterDeliveryIndex + 1 : null
          const beforeNum = candidate.beforeDeliveryIndex != null ? candidate.beforeDeliveryIndex + 1 : null
          const insertionExpl = afterNum != null
            ? `${afterNum}번 배송 후 충전`
            : (beforeNum != null ? `${beforeNum}번 배송 전 충전` : '경로 중 충전')

          collectedResults.push({
            best, candidate, quality, evTspScore,
            recommendationSource:       'mid-route',
            insertionExplanation:       insertionExpl,
            beforeDepartureQuality:     null,
            beforeDepartureDiagnostics: null,
            midRouteQuality:            quality,
          })
        }
      }

      // Always surface before-departure diagnostics for driver messages
      const bdResult = collectedResults.find(r => r.candidate.insertionType === 'before-departure') ?? null

      // Detect if a non-maintenance charger exists within 3km of the before-departure origin.
      // Distance-only — no drivableRangeKm dependency: 3km from departure is always accessible.
      const bdCandidate = candidates.find(c => c.insertionType === 'before-departure') ?? null
      const bdOriginPoint = bdCandidate?.originPoint ?? null
      const bdDrivableKm  = bdCandidate?.drivableRangeKm ?? drivableRangeKm
      const hasNearbyReachableCharger = bdOriginPoint != null && chargers.some(c => {
        const d = haversineKm(bdOriginPoint.lat, bdOriginPoint.lng, c.lat, c.lng)
        return Number.isFinite(d) && d <= 3.0 && c.status !== 'maintenance'
      })

      // Valid = not rejected by quality gate
      const validResults = collectedResults.filter(r =>
        r.quality !== 'reject' && r.quality !== 'reject-mid-route'
      )

      if (validResults.length === 0) {
        // Pre-compute nearby candidates so the diagnostic log can include the fallback result.
        const nearbyFallbackCandidates = bdOriginPoint
          ? chargers
              .map(c => ({ ...c, _dist: haversineKm(bdOriginPoint.lat, bdOriginPoint.lng, c.lat, c.lng) }))
              .filter(c => Number.isFinite(c._dist) && c._dist <= 3.0 && c.status !== 'maintenance')
              .sort((a, b) => a._dist - b._dist)
          : []
        const nearbyFallback = nearbyFallbackCandidates[0] ?? null

        // Diagnostic log — only active with VITE_MVP8_DEBUG=true
        if (chargers.length === 0) {
          devLog('[MVP8-nearbyFallback] chargers=0 — charger API not loaded or failed')
        } else {
          const top3str = bdOriginPoint
            ? [...chargers]
                .map(c => ({ n: c.name, d: haversineKm(bdOriginPoint.lat, bdOriginPoint.lng, c.lat, c.lng) }))
                .sort((a, b) => a.d - b.d).slice(0, 3)
                .map(c => `${c.n}(${c.d.toFixed(2)}km)`).join(', ')
            : '(no origin)'
          devLog(
            `[MVP8-nearbyFallback] chargers=${chargers.length}` +
            ` hasNearby=${hasNearbyReachableCharger}` +
            ` bdOrigin="${bdOriginPoint?.name ?? 'null'}"` +
            ` bdDrivable=${bdDrivableKm != null ? bdDrivableKm.toFixed(1)+'km' : 'null'}` +
            ` fallback="${nearbyFallback?.name ?? 'none'}"` +
            ` fallbackDist=${nearbyFallback ? nearbyFallback._dist.toFixed(2)+'km' : 'N/A'}` +
            ` top3=[${top3str}]`
          )
        }

        // Nearby fallback: surface closest non-maintenance charger within 3km as review-candidate.
        // Condition is bdOriginPoint only — removes drivableRangeKm gate which can be 0 when
        // vehicle specs are missing, incorrectly blocking an otherwise accessible nearby charger.
        if (bdOriginPoint != null && nearbyFallback != null) {
          const distKm  = parseFloat(nearbyFallback._dist.toFixed(1))
          const bdDiags = bdResult?.beforeDepartureDiagnostics
            ?? buildBeforeDepartureDiagnostics(chargers, bdOriginPoint)
          return {
            recommendedCharger: {
              ...nearbyFallback,
              originToChargerKm:    distKm,
              distanceFromStartKm:  distKm,
              insertionDetourKm:    null,
              recommendationReason: '출발 전 확인 필요',
            },
            selectedInsertionCandidate: bdCandidate ?? null,
            nearestUnreachable:         null,
            recommendationMode:         'review-candidate',
            unreachableReason:          '가까운 충전 후보가 있습니다. 출발 전 위치와 이용 가능 여부를 직접 확인하세요.',
            mockCoverageWarning:        false,
            beforeDepartureQuality:     'review-candidate',
            beforeDepartureDiagnostics: bdDiags,
            recommendationSource:       'before-departure',
            insertionExplanation:       '출발 전 충전 필요',
            midRouteQuality:            null,
            hasNearbyReachableCharger:  true,
          }
        }

        const bdQuality     = bdResult?.beforeDepartureQuality ?? null
        const bdDiagnostics = bdResult?.beforeDepartureDiagnostics ?? null

        // Nearest charger from the departure origin (no 3 km gate) — used for rejection explanation.
        const nearestRejectedDep = bdOriginPoint
          ? [...chargers]
              .filter(c => c.status !== 'maintenance')
              .map(c => ({ ...c, _dist: haversineKm(bdOriginPoint.lat, bdOriginPoint.lng, c.lat, c.lng) }))
              .filter(c => Number.isFinite(c._dist))
              .sort((a, b) => a._dist - b._dist)[0] ?? null
          : null
        const nearestRejectedDistKm = nearestRejectedDep
          ? parseFloat(nearestRejectedDep._dist.toFixed(1))
          : null

        return {
          recommendedCharger:                    null,
          selectedInsertionCandidate:            null,
          nearestUnreachable:                    null,
          recommendationMode:                    'no-suitable-charger',
          unreachableReason:                     '출발지 3km 이내에 바로 권장할 수 있는 충전소가 없습니다.',
          mockCoverageWarning:                   false,
          beforeDepartureQuality:                bdQuality,
          beforeDepartureDiagnostics:            bdDiagnostics,
          recommendationSource:                  null,
          insertionExplanation:                  null,
          midRouteQuality:                       null,
          hasNearbyReachableCharger:             false,
          nearestRejectedDepartureCharger:       nearestRejectedDep,
          nearestRejectedDepartureChargerName:   nearestRejectedDep?.name ?? null,
          nearestRejectedDepartureDistanceKm:    nearestRejectedDistKm,
          nearestRejectedDepartureReason:        nearestRejectedDep ? '3km 이내 직접 권장 기준 초과' : null,
        }
      }

      // EV-TSP: winner = lowest score
      validResults.sort((a, b) => a.evTspScore - b.evTspScore)
      const winner  = validResults[0]
      const isReview = winner.quality === 'review-candidate' || winner.quality === 'review-mid-route'

      return {
        recommendedCharger:         { ...winner.best, recommendationReason: buildSegmentReason(winner.best, winner.best._detour, true) },
        selectedInsertionCandidate: winner.candidate,
        nearestUnreachable:         null,
        recommendationMode:         isReview ? 'review-candidate' : 'segment-optimal',
        unreachableReason:          null,
        mockCoverageWarning:        false,
        beforeDepartureQuality:     bdResult?.beforeDepartureQuality ?? null,
        beforeDepartureDiagnostics: bdResult?.beforeDepartureDiagnostics ?? null,
        recommendationSource:       winner.recommendationSource,
        insertionExplanation:       winner.insertionExplanation,
        midRouteQuality:            winner.midRouteQuality,
        hasNearbyReachableCharger:  false,
      }
    }

    // Original route-based logic
    const localRadius     = needsNearestReachable ? LOCAL_COVERAGE_RADIUS_LOW_SOC_KM : LOCAL_COVERAGE_RADIUS_KM
    const localCandidates = scoredChargers.filter(c => c.distanceFromStartKm <= localRadius)

    if (localCandidates.length === 0) {
      return {
        recommendedCharger:         null,
        nearestUnreachable:         null,
        recommendationMode:         'no-local-data',
        unreachableReason:          allowMockFallback
          ? `반경 ${localRadius}km 이내 충전소 샘플 데이터 없음`
          : `반경 ${localRadius}km 이내 실시간 충전소 데이터 없음`,
        mockCoverageWarning:        allowMockFallback,
        beforeDepartureQuality:     null,
        beforeDepartureDiagnostics: null,
        recommendationSource:       null,
        insertionExplanation:       null,
        midRouteQuality:            null,
        hasNearbyReachableCharger:  false,
      }
    }

    const reachable      = localCandidates.filter(c => c.reachableFromStart)
    const unreachable    = localCandidates.filter(c => !c.reachableFromStart)
    const nearestUnreach = unreachable.length > 0
      ? [...unreachable].sort((a, b) => a.distanceFromStartKm - b.distanceFromStartKm)[0]
      : null

    if (reachable.length === 0) {
      return {
        recommendedCharger:         null,
        nearestUnreachable:         nearestUnreach,
        recommendationMode:         'unreachable',
        unreachableReason:          drivableRangeKm != null
          ? `주행 가능 거리(${drivableRangeKm.toFixed(1)} km)로 도달 가능한 충전소 없음`
          : '도달 가능한 충전소 없음',
        mockCoverageWarning:        false,
        beforeDepartureQuality:     null,
        beforeDepartureDiagnostics: null,
        recommendationSource:       null,
        insertionExplanation:       null,
        midRouteQuality:            null,
        hasNearbyReachableCharger:  false,
      }
    }

    if (needsNearestReachable) {
      return {
        recommendedCharger:         findNearestReachableChargerFromPoint(reachable),
        nearestUnreachable:         nearestUnreach,
        recommendationMode:         'nearest-reachable',
        unreachableReason:          null,
        mockCoverageWarning:        false,
        beforeDepartureQuality:     null,
        beforeDepartureDiagnostics: null,
        recommendationSource:       null,
        insertionExplanation:       null,
        midRouteQuality:            null,
        hasNearbyReachableCharger:  false,
      }
    }

    return {
      recommendedCharger:         [...reachable].sort((a, b) => a.score - b.score)[0],
      nearestUnreachable:         nearestUnreach,
      recommendationMode:         'route-optimal',
      unreachableReason:          null,
      mockCoverageWarning:        false,
      beforeDepartureQuality:     null,
      beforeDepartureDiagnostics: null,
      recommendationSource:       null,
      insertionExplanation:       null,
      midRouteQuality:            null,
      hasNearbyReachableCharger:  false,
    }
  }, [scoredChargers, chargeNeeded, drivableRangeKm, useSegmentScoring, allowMockFallback,
      insertionCandidates, chargers, primaryOriginPoint, primaryNextPoint,
      chargeTargetRangeKm, minReserveRangeKm])

  // originToChargerKm: distance from insertion point (or depot) to recommended charger
  const depotToRecommendedChargerKm = recommendedCharger?.originToChargerKm ?? null

  const chargerReachable = chargeNeeded
    ? (recommendedCharger !== null ? true : false)
    : null

  const totalRouteWithChargerKm = useMemo(() => {
    if (!recommendedCharger || deliveries.length === 0) return null
    const depToCharger  = recommendedCharger.originToChargerKm ?? recommendedCharger.distanceFromStartKm
    const chargerToDels = calculateRouteDistance(
      { lat: recommendedCharger.lat, lng: recommendedCharger.lng }, deliveries
    )
    return parseFloat((depToCharger + chargerToDels).toFixed(1))
  }, [recommendedCharger, deliveries])

  const displayRouteKm = (chargeNeeded && chargerReachable && totalRouteWithChargerKm !== null)
    ? totalRouteWithChargerKm
    : totalRouteKm
  const chargerWaypoint = (chargeNeeded && chargerReachable) ? recommendedCharger : null
  const warnChargerId   = (chargeNeeded && chargerReachable === false)
    ? (nearestUnreachable?.id ?? null)
    : null

  return {
    recommendedCharger,
    depotToRecommendedChargerKm,
    chargerReachable,
    displayRouteKm,
    chargerWaypoint,
    warnChargerId,
    scoredChargers,
    nearestUnreachable,
    recommendationMode,
    unreachableReason,
    mockCoverageWarning,
    selectedInsertionCandidate:           selectedInsertionCandidate           ?? null,
    beforeDepartureQuality:               beforeDepartureQuality               ?? null,
    beforeDepartureDiagnostics:           beforeDepartureDiagnostics           ?? null,
    recommendationSource:                 recommendationSource                 ?? null,
    insertionExplanation:                 insertionExplanation                 ?? null,
    midRouteQuality:                      midRouteQuality                      ?? null,
    hasNearbyReachableCharger:            hasNearbyReachableCharger            ?? false,
    nearestRejectedDepartureCharger:      nearestRejectedDepartureCharger      ?? null,
    nearestRejectedDepartureChargerName:  nearestRejectedDepartureChargerName  ?? null,
    nearestRejectedDepartureDistanceKm:   nearestRejectedDepartureDistanceKm   ?? null,
    nearestRejectedDepartureReason:       nearestRejectedDepartureReason       ?? null,
  }
}
