// routeIntelligenceService.js
// Unifies route, vehicle, battery, charger, and optimization results
// into a single HMI-ready intelligence output.
//
// Designed to be the authoritative decision layer:
//   route info      → from kakaoDirectionsService.getVehicleRoute()
//   charger info    → from useChargerRecommendation hook
//   charging plan   → from useChargingPlan hook
//   optimization    → from optimizeDeliveryOrder util
//   user efficiency → from drivingDataService (personalized or vehicle default)

import { getUserDrivingProfile, estimatePersonalizedEfficiency } from './drivingDataService'

// Temporary road-type ratios used until Kakao Mobility API provides per-road classification.
// When real route road-type data is available, pass it in via routeResult.roadTypeRatios.
const DEFAULT_CITY_RATIO = 0.7
const DEFAULT_HIGHWAY_RATIO = 0.3

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function buildRouteSection(routeResult) {
  if (!routeResult) {
    return {
      distanceKm: 0,
      estimatedDriveTimeMin: null,
      routeSource: 'none',
      isRoadRoute: false,
      cityRoadRatio: DEFAULT_CITY_RATIO,
      highwayRatio: DEFAULT_HIGHWAY_RATIO,
    }
  }

  const isRoadRoute = routeResult.isFallback === false
  // Future: extract from routeResult.roadTypeRatios when Kakao Mobility provides it
  const cityRoadRatio = routeResult.roadTypeRatios?.cityRatio ?? DEFAULT_CITY_RATIO
  const highwayRatio = routeResult.roadTypeRatios?.highwayRatio ?? DEFAULT_HIGHWAY_RATIO

  return {
    distanceKm: routeResult.distanceKm ?? 0,
    estimatedDriveTimeMin: routeResult.durationMin ?? null,
    routeSource: routeResult.source ?? 'fallback-polyline',
    isRoadRoute,
    cityRoadRatio,
    highwayRatio,
  }
}

function deriveConfidenceLevel({ userProfile, isFallback }) {
  if (!userProfile || userProfile.sampleCount === 0) {
    return isFallback ? 'none' : 'low'
  }
  const profileConf = userProfile.confidenceLevel ?? 'low'
  // Downgrade one level when route is fallback (straight-line distance is less accurate)
  if (isFallback) {
    if (profileConf === 'high') return 'medium'
    if (profileConf === 'medium') return 'low'
    return 'low'
  }
  return profileConf
}

function buildEnergySection({ distanceKm, vehicle, batterySOC, userProfile, isFallback, routeMeta }) {
  const profileEfficiency = estimatePersonalizedEfficiency(userProfile, routeMeta)
  const baseEfficiency = vehicle?.combinedEfficiencyKmPerKwh ?? vehicle?.efficiencyKmPerKwh ?? null
  const effectiveEfficiency = profileEfficiency ?? baseEfficiency

  const confidenceLevel = deriveConfidenceLevel({ userProfile, isFallback })

  if (!effectiveEfficiency || !distanceKm) {
    return {
      estimatedConsumptionKwh: null,
      estimatedSOCUsage: null,
      remainingSOC: null,
      rangeAfterRouteKm: null,
      effectiveEfficiencyKmPerKwh: effectiveEfficiency,
      confidenceLevel,
    }
  }

  const estimatedConsumptionKwh = parseFloat((distanceKm / effectiveEfficiency).toFixed(2))
  const capacityKwh = vehicle?.batteryCapacityKwh ?? null

  const estimatedSOCUsage = capacityKwh
    ? parseFloat(((estimatedConsumptionKwh / capacityKwh) * 100).toFixed(1))
    : null

  const remainingSOC =
    estimatedSOCUsage != null
      ? parseFloat(Math.max(0, batterySOC - estimatedSOCUsage).toFixed(1))
      : null

  const rangeAfterRouteKm =
    remainingSOC != null && capacityKwh
      ? parseFloat(((remainingSOC / 100) * capacityKwh * effectiveEfficiency).toFixed(1))
      : null

  return {
    estimatedConsumptionKwh,
    estimatedSOCUsage,
    remainingSOC,
    rangeAfterRouteKm,
    effectiveEfficiencyKmPerKwh: effectiveEfficiency,
    confidenceLevel,
  }
}

function buildChargingSection({ chargeNeeded, recommendedCharger, chargePlan }) {
  if (!chargeNeeded || !recommendedCharger) {
    return {
      chargingRequired: false,
      recommendedCharger: null,
      chargeAmountKwh: null,
      targetSOC: null,
      estimatedChargeTimeMin: null,
      estimatedCost: null,
    }
  }
  return {
    chargingRequired: true,
    recommendedCharger,
    chargeAmountKwh: chargePlan?.chargeAmountKwh ?? null,
    targetSOC: chargePlan?.targetSoc ?? null,
    estimatedChargeTimeMin: chargePlan?.chargeTimeMin ?? null,
    estimatedCost: chargePlan?.totalExtraCost ?? null,
  }
}

function buildOptimizationSection(optimizationResult) {
  if (!optimizationResult) {
    return {
      originalDistanceKm: null,
      optimizedDistanceKm: null,
      savedDistanceKm: null,
      savedPercent: null,
    }
  }
  return {
    originalDistanceKm: optimizationResult.originalDistanceKm ?? null,
    optimizedDistanceKm: optimizationResult.optimizedDistanceKm ?? null,
    savedDistanceKm: optimizationResult.savedDistanceKm ?? null,
    savedPercent: optimizationResult.savedPercent ?? null,
  }
}

const SYSTEM_SAFETY_SOC_THRESHOLD = 5

// low-margin: vehicle CAN complete delivery, but remaining SOC < 5% or surplus range < 3 km.
function isLowMarginRoute({ chargeNeeded, energySection }) {
  if (chargeNeeded) return false
  const remainingSOC = energySection?.remainingSOC ?? null
  const rangeAfterRouteKm = energySection?.rangeAfterRouteKm ?? null
  return (
    (remainingSOC != null && remainingSOC < SYSTEM_SAFETY_SOC_THRESHOLD) ||
    (rangeAfterRouteKm != null && rangeAfterRouteKm < 3)
  )
}

// reserve-warning: delivery is physically possible, but predicted arrival SOC is below
// the driver's userMinReserveSoc preference (and above the hard safety threshold).
function isReserveWarningRoute({ chargeNeeded, energySection, userMinReserveSoc }) {
  if (chargeNeeded) return false
  if (isLowMarginRoute({ chargeNeeded, energySection })) return false
  const remainingSOC = energySection?.remainingSOC ?? null
  if (remainingSOC == null || userMinReserveSoc == null) return false
  return remainingSOC < userMinReserveSoc
}

// ---------------------------------------------------------------------------
// 운행 안정도 복합 점수 모델 (100점 만점, 6개 항목)
// A: 배송 완주 가능성 25 · B: 안전 하한 SOC 여유 25
// C: 충전 전략 적합성 20 · D: 우회거리·시간 효율 10
// E: 충전소 후보 품질 10 · F: 데이터 신뢰도 10
// ---------------------------------------------------------------------------
function computeOperationStabilityScore({
  chargeNeeded, chargerReachable, isFallback, confidenceLevel,
  recommendationMode, energySection, batterySOC, userMinReserveSoc,
  minRouteSocPct, recommendedCharger,
}) {
  const remainingSOC = energySection?.remainingSOC ?? null
  const socToCheck   = minRouteSocPct ?? remainingSOC
  const detourKm     = recommendedCharger?.insertionDetourKm ?? null

  // ── A. 배송 완주 가능성 (25 pts) ─────────────────────────────────────
  let scoreA
  if (!chargeNeeded) {
    if (remainingSOC == null) {
      scoreA = 15
    } else if (remainingSOC >= 20) {
      scoreA = 25
    } else if (remainingSOC >= SYSTEM_SAFETY_SOC_THRESHOLD) {
      scoreA = Math.round(12 + (remainingSOC - SYSTEM_SAFETY_SOC_THRESHOLD) / (20 - SYSTEM_SAFETY_SOC_THRESHOLD) * 13)
    } else {
      scoreA = Math.max(0, Math.round(remainingSOC / SYSTEM_SAFETY_SOC_THRESHOLD * 12))
    }
  } else if (chargerReachable && recommendationMode !== 'no-local-data') {
    scoreA = 15
  } else if (chargerReachable === false || recommendationMode === 'no-local-data') {
    scoreA = 3
  } else {
    scoreA = 8
  }
  scoreA = Math.max(0, Math.min(25, scoreA))

  // ── B. 안전 하한 SOC 여유 (25 pts) ───────────────────────────────────
  let scoreB
  if (socToCheck == null) {
    scoreB = 12
  } else if (socToCheck >= userMinReserveSoc + 15) {
    scoreB = 25
  } else if (socToCheck >= userMinReserveSoc) {
    scoreB = Math.round(15 + (socToCheck - userMinReserveSoc) / 15 * 10)
  } else if (socToCheck >= SYSTEM_SAFETY_SOC_THRESHOLD) {
    const range = Math.max(1, userMinReserveSoc - SYSTEM_SAFETY_SOC_THRESHOLD)
    scoreB = Math.max(5, Math.round(5 + (socToCheck - SYSTEM_SAFETY_SOC_THRESHOLD) / range * 10))
  } else {
    scoreB = Math.max(0, Math.round(socToCheck / SYSTEM_SAFETY_SOC_THRESHOLD * 5))
  }
  scoreB = Math.max(0, Math.min(25, scoreB))

  // ── C. 충전 전략 적합성 (20 pts) ─────────────────────────────────────
  let scoreC
  if (!chargeNeeded && remainingSOC != null && remainingSOC >= userMinReserveSoc) {
    scoreC = 20
  } else if (!chargeNeeded) {
    scoreC = 14
  } else if (recommendationMode === 'no-local-data') {
    scoreC = 4
  } else if (chargerReachable === false) {
    scoreC = 2
  } else if (recommendationMode === 'review-candidate') {
    scoreC = 8
  } else if (chargeNeeded && chargerReachable) {
    scoreC = recommendationMode === 'mid-route' ? 14 : 16
  } else {
    scoreC = 7
  }
  scoreC = Math.max(0, Math.min(20, scoreC))

  // ── D. 우회거리·시간 효율 (10 pts) ───────────────────────────────────
  let scoreD
  if (!chargeNeeded) {
    scoreD = 10
  } else if (chargerReachable === false) {
    scoreD = 1
  } else if (detourKm == null) {
    scoreD = 7
  } else if (detourKm <= 1) {
    scoreD = 10
  } else if (detourKm <= 3) {
    scoreD = 8
  } else if (detourKm <= 5) {
    scoreD = 6
  } else if (detourKm < 8) {
    scoreD = 3
  } else {
    scoreD = 1
  }
  scoreD = Math.max(0, Math.min(10, scoreD))

  // ── E. 충전소 후보 품질 (10 pts) ──────────────────────────────────────
  let scoreE
  if (!chargeNeeded) {
    scoreE = 10
  } else if (chargerReachable === false || recommendationMode === 'no-local-data') {
    scoreE = 1
  } else if (recommendationMode === 'review-candidate') {
    scoreE = 4
  } else if (recommendedCharger) {
    const kw = recommendedCharger.powerKw ?? recommendedCharger.maxPowerKw ?? 0
    scoreE = kw >= 100 ? 10 : kw >= 50 ? 8 : kw >= 30 ? 6 : kw >= 7 ? 4 : 2
  } else {
    scoreE = 6
  }
  scoreE = Math.max(0, Math.min(10, scoreE))

  // ── F. 데이터 신뢰도 (10 pts) ─────────────────────────────────────────
  let scoreF = 10
  if (isFallback) scoreF -= 4
  if (confidenceLevel === 'none') scoreF -= 4
  else if (confidenceLevel === 'low') scoreF -= 2
  if (recommendationMode === 'no-local-data') scoreF -= 3
  scoreF = Math.max(0, Math.min(10, scoreF))

  const total = Math.max(0, Math.min(100, scoreA + scoreB + scoreC + scoreD + scoreE + scoreF))
  return {
    score: total,
    breakdown: [
      { label: '배송 완주 가능성',   earned: scoreA, max: 25 },
      { label: '안전 하한 SOC 여유', earned: scoreB, max: 25 },
      { label: '충전 전략 적합성',   earned: scoreC, max: 20 },
      { label: '우회거리·시간 효율', earned: scoreD, max: 10 },
      { label: '충전소 후보 품질',   earned: scoreE, max: 10 },
      { label: '데이터 신뢰도',      earned: scoreF, max: 10 },
    ],
  }
}

function buildHealthDeductions({ chargeNeeded, chargerReachable, isFallback, confidenceLevel, recommendationMode, energySection, batterySOC, userMinReserveSoc }) {
  const items = []
  if (isFallback)                  items.push({ amount: -15, label: '직선 경로 기반 예측' })
  if (confidenceLevel === 'none')  items.push({ amount: -20, label: '주행 학습 데이터 없음' })
  else if (confidenceLevel === 'low') items.push({ amount: -10, label: '주행 학습 샘플 부족' })
  if (chargeNeeded && chargerReachable === false && recommendationMode !== 'no-local-data') {
    items.push({ amount: -40, label: '충전소 도달 불가' })
  } else if (chargeNeeded && chargerReachable) {
    items.push({ amount: -5, label: '충전 경유 필요' })
  }
  if (recommendationMode === 'no-local-data') items.push({ amount: 0, label: '충전소 샘플 데이터 없음' })
  const remainingSOC = energySection?.remainingSOC ?? null
  const rangeAfterRouteKm = energySection?.rangeAfterRouteKm ?? null
  if (remainingSOC != null && remainingSOC < SYSTEM_SAFETY_SOC_THRESHOLD) {
    items.push({ amount: -20, label: '잔여 SOC 매우 낮음' })
  }
  if (rangeAfterRouteKm != null && rangeAfterRouteKm < 3 && !chargeNeeded) {
    items.push({ amount: -15, label: '주행 여유 부족' })
  }
  if (batterySOC != null && batterySOC <= 5) {
    items.push({ amount: -15, label: '출발 SOC 낮음' })
  }
  if (isReserveWarningRoute({ chargeNeeded, energySection, userMinReserveSoc })) {
    items.push({ amount: -10, label: `최소 SOC 기준 미달 (설정 ${userMinReserveSoc}%)` })
  }
  return items
}

function buildSummarySection({ chargeNeeded, chargerReachable, isFallback, confidenceLevel, userProfile, recommendationMode, mockCoverageWarning, energySection, batterySOC, userMinReserveSoc, minRouteSocPct, recommendedCharger }) {
  const lowMargin    = isLowMarginRoute({ chargeNeeded, energySection })
  const reserveWarn  = isReserveWarningRoute({ chargeNeeded, energySection, userMinReserveSoc })

  let status, primaryAction
  const warnings = []

  // Priority: no-local-data > unreachable > critical > low-margin > reserve-warning > charge-required > ok
  if (recommendationMode === 'no-local-data') {
    status = 'no-local-data'
    primaryAction = '주변 충전소 데이터 없음'
  } else if (chargeNeeded && chargerReachable === false) {
    status = 'unreachable'
    primaryAction = '충전소 도달 불가'
  } else if (chargeNeeded && chargerReachable == null) {
    status = 'critical'
    primaryAction = 'SOC 확인 필요'
  } else if (lowMargin) {
    status = 'low-margin'
    primaryAction = '배송 가능 · 여유 부족'
  } else if (reserveWarn) {
    status = 'reserve-warning'
    primaryAction = '배송 가능 · 충전 권장'
  } else if (chargeNeeded && chargerReachable) {
    status = 'charge-required'
    primaryAction = '먼저 충전'
  } else {
    status = 'ok'
    primaryAction = '배송 가능'
  }

  if (isFallback) warnings.push('임시 직선 경로 기반 예측입니다.')
  if (!userProfile || userProfile.sampleCount === 0) warnings.push('주행 데이터 부족 — 차량 기본 전비 사용.')
  if (mockCoverageWarning) warnings.push('현재 지역 충전소 샘플 데이터 없음.')

  const healthParams = { chargeNeeded, chargerReachable, isFallback, confidenceLevel, recommendationMode, energySection, batterySOC, userMinReserveSoc }
  const deductions = buildHealthDeductions(healthParams)
  const stabilityResult = computeOperationStabilityScore({
    chargeNeeded, chargerReachable, isFallback, confidenceLevel,
    recommendationMode, energySection, batterySOC, userMinReserveSoc,
    minRouteSocPct, recommendedCharger,
  })

  return {
    routeHealthScore: stabilityResult.score,
    scoreBreakdown: stabilityResult.breakdown,
    healthDeductions: deductions,
    status,
    primaryAction,
    warningMessage: warnings.length > 0 ? warnings.join(' ') : null,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze a complete delivery route and return a unified HMI-ready intelligence object.
 *
 * @param {Object} params
 * @param {string}  params.userId             — user identifier for driving profile lookup
 * @param {Object}  params.vehicle            — { id, batteryCapacityKwh, efficiencyKmPerKwh, ... }
 * @param {number}  params.batterySOC         — current state of charge (0–100)
 * @param {Object}  params.routeResult        — from kakaoDirectionsService.getVehicleRoute()
 * @param {Object}  params.chargingResult     — { chargeNeeded, chargerReachable, recommendedCharger, chargePlan, recommendationMode, mockCoverageWarning }
 * @param {Object}  params.optimizationResult — from optimizeDeliveryOrder(), or null
 * @returns {Object} { route, energy, charging, optimization, summary }
 */
export async function analyzeRoute({
  userId = 'demo-driver-001',
  vehicle,
  batterySOC = 100,
  routeResult,
  chargingResult,
  optimizationResult,
  userMinReserveSoc = 10,
  minRouteSocPct = null,
}) {
  const userProfile = getUserDrivingProfile(userId, vehicle?.id)

  const isFallback = routeResult?.isFallback ?? true
  const routeSection = buildRouteSection(routeResult)
  const routeMeta = {
    cityRoadRatio: routeSection.cityRoadRatio,
    highwayRatio: routeSection.highwayRatio,
  }
  const energySection = buildEnergySection({
    distanceKm: routeSection.distanceKm,
    vehicle,
    batterySOC,
    userProfile,
    isFallback,
    routeMeta,
  })
  const chargingSection = buildChargingSection({
    chargeNeeded: chargingResult?.chargeNeeded ?? false,
    recommendedCharger: chargingResult?.recommendedCharger ?? null,
    chargePlan: chargingResult?.chargePlan ?? null,
  })
  const optimizationSection = buildOptimizationSection(optimizationResult)
  const summarySection = buildSummarySection({
    chargeNeeded: chargingResult?.chargeNeeded ?? false,
    chargerReachable: chargingResult?.chargerReachable ?? null,
    isFallback,
    confidenceLevel: energySection.confidenceLevel,
    userProfile,
    recommendationMode: chargingResult?.recommendationMode ?? null,
    mockCoverageWarning: chargingResult?.mockCoverageWarning ?? false,
    energySection,
    batterySOC,
    userMinReserveSoc,
    minRouteSocPct,
    recommendedCharger: chargingResult?.recommendedCharger ?? null,
  })

  return {
    route: routeSection,
    energy: energySection,
    charging: chargingSection,
    optimization: optimizationSection,
    summary: summarySection,
  }
}
