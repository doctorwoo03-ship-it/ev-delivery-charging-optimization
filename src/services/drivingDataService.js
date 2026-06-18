// drivingDataService.js
// Manages user-specific driving profiles and personalized efficiency estimation.
// Currently uses local mock data only — no login or database persistence.
// Architecture is prepared for real DB persistence in a future MVP.

import { USER_DRIVING_PROFILES } from '../data/userDrivingProfileData'

/**
 * Returns the driving profile for a given user + vehicle combination.
 * Falls back to null when no profile exists.
 *
 * @param {string} userId
 * @param {string|null} vehicleId — optional; when omitted matches any vehicle for the user
 * @returns {Object|null}
 */
export function getUserDrivingProfile(userId, vehicleId = null) {
  if (!userId) return null
  return (
    USER_DRIVING_PROFILES.find(
      p => p.userId === userId && (!vehicleId || p.vehicleId === vehicleId)
    ) ?? null
  )
}

/**
 * Estimate personalized efficiency (km/kWh) given a driving profile and road-type metadata.
 *
 * When road type data becomes available from the Kakao Mobility Directions API,
 * pass real cityRoadRatio / highwayRatio from the route response.
 * Until then the caller should use the DEFAULT_CITY_RATIO / DEFAULT_HIGHWAY_RATIO
 * constants defined in routeIntelligenceService.js.
 *
 * @param {Object} profile     — user driving profile from getUserDrivingProfile()
 * @param {Object} routeMeta   — { cityRoadRatio: 0–1, highwayRatio: 0–1 }
 * @returns {number|null}
 */
export function estimatePersonalizedEfficiency(profile, routeMeta = {}) {
  if (!profile || profile.sampleCount === 0) return null
  if (!profile.cityEfficiencyKmPerKwh || !profile.highwayEfficiencyKmPerKwh) return null

  const { cityRoadRatio = 0.7, highwayRatio = 0.3 } = routeMeta
  const blended =
    profile.cityEfficiencyKmPerKwh * cityRoadRatio +
    profile.highwayEfficiencyKmPerKwh * highwayRatio

  return parseFloat(blended.toFixed(2))
}

/**
 * Create a draft driving record after a delivery route is completed.
 * In a future MVP this record would be sent to a backend and persisted.
 *
 * @param {Object} routeIntelligenceResult — from routeIntelligenceService.analyzeRoute()
 * @returns {Object|null}
 */
export function createDrivingRecordDraft(routeIntelligenceResult) {
  const r = routeIntelligenceResult
  if (!r?.route || !r?.energy) return null

  const { distanceKm, isRoadRoute, cityRoadRatio, highwayRatio } = r.route
  const { estimatedConsumptionKwh } = r.energy

  const observedEfficiencyKmPerKwh =
    distanceKm && estimatedConsumptionKwh
      ? parseFloat((distanceKm / estimatedConsumptionKwh).toFixed(2))
      : null

  return {
    timestamp: new Date().toISOString(),
    distanceKm,
    isRoadRoute,
    cityRoadRatio,
    highwayRatio,
    consumptionKwh: estimatedConsumptionKwh,
    observedEfficiencyKmPerKwh,
    source: 'draft',
  }
}

/**
 * Update a user driving profile from a completed driving record.
 * Uses exponential moving average to blend the new observation into the existing profile.
 * Does NOT mutate the input profile — returns a new object.
 *
 * In a future MVP the returned profile would be persisted to a database.
 *
 * @param {Object} profile       — current user driving profile
 * @param {Object} drivingRecord — from createDrivingRecordDraft()
 * @returns {Object} Updated profile
 */
export function updateDrivingProfileFromRecord(profile, drivingRecord) {
  if (!profile || !drivingRecord?.observedEfficiencyKmPerKwh) return profile

  // Blend weight: higher early on, tapers as sample count grows
  const alpha = Math.min(0.3, 1 / (profile.sampleCount + 1))
  const prev = profile.mixedEfficiencyKmPerKwh ?? drivingRecord.observedEfficiencyKmPerKwh
  const updatedMixed = parseFloat(
    (prev * (1 - alpha) + drivingRecord.observedEfficiencyKmPerKwh * alpha).toFixed(2)
  )

  const newCount = profile.sampleCount + 1
  const confidence = newCount >= 30 ? 'high' : newCount >= 10 ? 'medium' : 'low'

  return {
    ...profile,
    mixedEfficiencyKmPerKwh: updatedMixed,
    sampleCount: newCount,
    confidenceLevel: confidence,
    lastUpdated: new Date().toISOString(),
  }
}
