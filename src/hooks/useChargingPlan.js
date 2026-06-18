import { useMemo } from 'react'

// insertionSocPct:           SOC (%) at the charging insertion point (delivery stop before charging)
// insertionToChargerKm:      haversine km from insertion origin to charger
// remainingRouteFromChargerKm: km from charger through remaining deliveries to end
export function useChargingPlan({
  chargeNeeded, chargerReachable, recommendedCharger,
  depotToRecommendedChargerKm,
  displayRouteKm, remainingKwh, vehicle, isVehicleReady, userMinReserveSoc = 10,
  insertionSocPct,
  insertionToChargerKm,
  remainingRouteFromChargerKm,
}) {
  return useMemo(() => {
    if (!chargeNeeded || !recommendedCharger || chargerReachable !== true || !isVehicleReady) return null

    const eff = vehicle.efficiencyKmPerKwh

    // Battery at the insertion point: use insertionSocPct when available (mid-route charge)
    // otherwise fall back to current remaining battery (depot charge)
    const batteryAtInsertionKwh = insertionSocPct != null
      ? (insertionSocPct / 100) * vehicle.batteryCapacityKwh
      : parseFloat(remainingKwh)

    const distToCharger = insertionToChargerKm ?? depotToRecommendedChargerKm
    const energyToChargerKwh  = distToCharger / eff
    const batteryAtChargerKwh = batteryAtInsertionKwh - energyToChargerKwh

    const afterChargeRouteKm = remainingRouteFromChargerKm ?? (displayRouteKm - depotToRecommendedChargerKm)
    const energyNeededAfterChargeKwh = afterChargeRouteKm / eff
    const reserveEnergyKwh = vehicle.batteryCapacityKwh * ((userMinReserveSoc ?? 10) / 100)
    const targetEnergyKwh  = Math.min(energyNeededAfterChargeKwh + reserveEnergyKwh, vehicle.batteryCapacityKwh)
    const chargeAmountKwh  = Math.max(0, targetEnergyKwh - batteryAtChargerKwh)
    const targetSoc = Math.min(100, Math.ceil((targetEnergyKwh / vehicle.batteryCapacityKwh) * 100))
    const finalDeliverySOC = Math.max(0, Math.round(
      ((targetEnergyKwh - energyNeededAfterChargeKwh) / vehicle.batteryCapacityKwh) * 100
    ))
    const chargeTimeMin  = Math.ceil((chargeAmountKwh / recommendedCharger.powerKw) * 60)
    const chargingCost   = Math.round(chargeAmountKwh * recommendedCharger.pricePerKwh)
    const waitingCost    = Math.round((recommendedCharger.waitMin / 60) * 15000)
    const totalExtraCost = chargingCost + waitingCost

    return {
      energyToChargerKwh:          parseFloat(energyToChargerKwh.toFixed(1)),
      batteryAtChargerKwh:         parseFloat(batteryAtChargerKwh.toFixed(1)),
      batteryAtChargerSoc:         Math.max(0, Math.round((batteryAtChargerKwh / vehicle.batteryCapacityKwh) * 100)),
      remainingRouteAfterChargeKm: parseFloat(afterChargeRouteKm.toFixed(1)),
      energyNeededAfterChargeKwh:  parseFloat(energyNeededAfterChargeKwh.toFixed(1)),
      reserveEnergyKwh:            parseFloat(reserveEnergyKwh.toFixed(1)),
      targetEnergyKwh:             parseFloat(targetEnergyKwh.toFixed(1)),
      chargeAmountKwh:             parseFloat(chargeAmountKwh.toFixed(1)),
      targetSoc,
      finalDeliverySOC,
      chargeTimeMin,
      chargingCost,
      waitingCost,
      totalExtraCost,
    }
  }, [
    chargeNeeded, recommendedCharger, chargerReachable, isVehicleReady,
    remainingKwh, depotToRecommendedChargerKm, displayRouteKm, vehicle, userMinReserveSoc,
    insertionSocPct, insertionToChargerKm, remainingRouteFromChargerKm,
  ])
}
