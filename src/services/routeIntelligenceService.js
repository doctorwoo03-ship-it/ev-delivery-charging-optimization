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

function computeHealthScore({ chargeNeeded, chargerReachable, isFallback, confidenceLevel, recommendationMode, energySection, batterySOC, userMinReserveSoc }) {
  let score = 100
  if (isFallback) score -= 15
  if (confidenceLevel === 'low') score -= 10
  else if (confidenceLevel === 'none') score -= 20
  // no-local-data: data gap, not a charger failure — don't apply the -40 unreachable penalty
  if (recommendationMode !== 'no-local-data') {
    if (chargeNeeded && chargerReachable === false) score -= 40
    else if (chargeNeeded && chargerReachable) score -= 5
  } else {
    score -= 10  // mild penalty: charger data missing
  }
  // Low-margin deductions
  const remainingSOC = energySection?.remainingSOC ?? null
  const rangeAfterRouteKm = energySection?.rangeAfterRouteKm ?? null
  if (remainingSOC != null && remainingSOC < SYSTEM_SAFETY_SOC_THRESHOLD) score -= 20
  if (rangeAfterRouteKm != null && rangeAfterRouteKm < 3 && !chargeNeeded) score -= 15
  if (batterySOC != null && batterySOC <= 5) score -= 15
  // Reserve warning deduction: user's minimum SOC preference not met (but above safety threshold)
  if (isReserveWarningRoute({ chargeNeeded, energySection, userMinReserveSoc })) score -= 10
  return Math.max(0, Math.min(100, score))
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
  // Low-margin deductions
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
  // Reserve warning deduction: user's minimum SOC preference not met
  if (isReserveWarningRoute({ chargeNeeded, energySection, userMinReserveSoc })) {
    items.push({ amount: -10, label: `최소 SOC 기준 미달 (설정 ${userMinReserveSoc}%)` })
  }
  return items
}

function buildSummarySection({ chargeNeeded, chargerReachable, isFallback, confidenceLevel, userProfile, recommendationMode, mockCoverageWarning, energySection, batterySOC, userMinReserveSoc }) {
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

  return {
    routeHealthScore: computeHealthScore(healthParams),
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
  })

  return {
    route: routeSection,
    energy: energySection,
    charging: chargingSection,
    optimization: optimizationSection,
    summary: summarySection,
  }
}
