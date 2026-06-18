import { useMemo } from 'react'

export function useBatteryCalculation({ vehicle, soc, totalRouteKm }) {
  return useMemo(() => {
    const isVehicleReady = !!(vehicle && vehicle.batteryCapacityKwh > 0 && vehicle.efficiencyKmPerKwh > 0)

    if (!isVehicleReady) {
      return {
        isVehicleReady: false,
        remainingKwh: null,
        estimatedRangeKm: null,
        drivableRangeKm: 0,
        canDeliver: false,
        chargeNeeded: false,
        shortageKm: null,
      }
    }

    const remainingKwh = ((vehicle.batteryCapacityKwh * soc) / 100).toFixed(1)
    const estimatedRangeKm = (parseFloat(remainingKwh) * vehicle.efficiencyKmPerKwh).toFixed(1)
    const drivableRangeKm = parseFloat(estimatedRangeKm)
    const canDeliver = parseFloat(estimatedRangeKm) >= totalRouteKm
    const chargeNeeded = !canDeliver
    const shortageKm = chargeNeeded ? (totalRouteKm - parseFloat(estimatedRangeKm)).toFixed(1) : null

    return {
      isVehicleReady,
      remainingKwh,
      estimatedRangeKm,
      drivableRangeKm,
      canDeliver,
      chargeNeeded,
      shortageKm,
    }
  }, [vehicle, soc, totalRouteKm])
}
