import { useState } from 'react'
import { FONT } from '../theme/themes'

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionTitle({ children, T }) {
  return (
    <div style={{
      fontSize: 16, fontWeight: 700, color: T.textSecondary,
      textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 18,
    }}>
      {children}
    </div>
  )
}

function Divider({ T }) {
  return <div style={{ height: 1, background: T.border, margin: '28px 0' }} />
}

function Row({ label, value, valueColor, T }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '9px 0' }}>
      <span style={{ fontSize: 17, color: T.textSecondary }}>{label}</span>
      <span style={{ fontSize: 17, fontWeight: 600, color: valueColor ?? T.text }}>{value ?? '확인 필요'}</span>
    </div>
  )
}

function PenaltyTag({ amount, label, T }) {
  const isNeg = amount < 0
  const isZero = amount === 0
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 16px', borderRadius: 12, marginBottom: 8,
      background: isNeg ? `${T.danger}14` : isZero ? `${T.textSecondary}0a` : `${T.success}14`,
      border: `1px solid ${isNeg ? T.danger + '30' : isZero ? T.border : T.success + '30'}`,
    }}>
      <span style={{ fontSize: 17, fontWeight: 700, color: isNeg ? T.danger : isZero ? T.textSecondary : T.success, minWidth: 52 }}>
        {isNeg ? `${amount}점` : isZero ? '±0' : `+${amount}점`}
      </span>
      <span style={{ fontSize: 17, color: T.text }}>{label}</span>
    </div>
  )
}

function TSPStep({ num, text, result, isLast, T }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: isLast ? 0 : 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: `${T.accent}20`, border: `1.5px solid ${T.accent}60`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, color: T.accent,
        }}>{num}</div>
        {!isLast && <div style={{ width: 1, height: 28, background: `${T.border}`, marginTop: 3 }} />}
      </div>
      <div style={{ flex: 1, paddingTop: 6 }}>
        <div style={{ fontSize: 17, color: T.text, fontWeight: 600 }}>{text}</div>
        {result && (
          <div style={{ fontSize: 15, color: T.textSecondary, marginTop: 4, lineHeight: 1.55 }}>{result}</div>
        )}
      </div>
    </div>
  )
}

// ── Charger quality label ─────────────────────────────────────────────────────
function chargerQualityLabel(c, recommendedChargerId) {
  if (c.id && c.id === recommendedChargerId) return { text: '권장 선택', color: '#2a9d8f' }
  if (c.status === 'maintenance') return { text: '정비 중', color: '#e9c46a' }
  if (!c.reachableFromStart) return { text: '도달 불가', color: '#e76f51' }
  if (c.insertionDetourKm != null && c.insertionDetourKm > 8) return { text: '우회 과다', color: '#e9c46a' }
  if (c.insertionDetourKm != null && c.insertionDetourKm <= 8) return { text: '후보', color: '#457b9d' }
  return { text: '후보', color: '#457b9d' }
}

// ── Recommendation explanation builder ───────────────────────────────────────
function buildRecommendationExplanation({
  overlayState, recommendedCharger, recommendationMode, recommendationSource,
  insertionExplanation, remainingSocAfterDelivery, userMinReserveSoc,
  nearestRejectedDepartureChargerName, nearestRejectedDepartureDistanceKm,
  hasNearbyReachableCharger, effectiveChargeNeeded, isReserveWarning,
  firstViolationLabel, chargePlan, minRouteSocPct,
}) {
  const lines = []
  let situationText = null

  if (overlayState === 'reserveWarning') {
    const rem = remainingSocAfterDelivery
    const shortage = rem != null ? parseFloat((userMinReserveSoc - rem).toFixed(1)) : null
    lines.push({ icon: '✓', color: null, text: '현재 배터리로 배송 경로를 완주할 수 있습니다.' })
    if (rem != null && shortage != null) {
      lines.push({ icon: '⚠', color: 'warning', text: `충전 없이 배송 완료 예상 SOC ${rem.toFixed(1)}%는 안전 하한 SOC ${userMinReserveSoc}%보다 ${shortage}%p 낮습니다.` })
    }
    if (firstViolationLabel) {
      lines.push({ icon: '⚠', color: 'warning', text: `안전 하한 SOC 위반 구간: ${firstViolationLabel}` })
    }
    if (recommendedCharger) {
      const distText = recommendedCharger.originToChargerKm != null ? `약 ${recommendedCharger.originToChargerKm}km` : recommendedCharger.distanceFromStartKm != null ? `약 ${recommendedCharger.distanceFromStartKm}km` : null
      const pwrText = recommendedCharger.powerKw ? `${recommendedCharger.powerKw}kW` : null
      lines.push({ icon: '⚡', color: 'accent', text: `권장 충전소: ${recommendedCharger.name}${distText ? ' · ' + distText : ''}${pwrText ? ' · ' + pwrText : ''}` })
      lines.push({ icon: 'ℹ', color: null, text: '위치·출력·등록 충전기 수 기준 추천 · 실시간 사용 여부 확인 필요' })
      lines.push({ icon: 'ℹ', color: null, text: '배송 완주는 충전 없이도 가능합니다. 이 충전소를 선택 경유하면 안전 하한 SOC 기준을 충족할 수 있습니다.' })
    }
  } else if (overlayState === 'chargeNeeded') {
    situationText = recommendationSource === 'mid-route'
      ? '현재 배터리로 앞 배송지는 진행할 수 있지만, 다음 배송 구간에서 안전 하한 SOC 아래로 떨어질 수 있어 중간 충전을 권장해요.'
      : '현재 배터리로 첫 배송을 시작하기 전에 안전 하한 SOC를 만족하기 어렵기 때문에 출발 전 충전을 권장해요.'
    lines.push({ icon: '!', color: 'danger', text: '현재 배터리로는 전체 배송을 완주할 수 없습니다.' })
    if (firstViolationLabel) {
      lines.push({ icon: '⚠', color: 'danger', text: `안전 하한 SOC 위반 구간: ${firstViolationLabel}` })
    }
    if (insertionExplanation) {
      lines.push({ icon: '⚡', color: 'accent', text: `충전 시점: ${insertionExplanation}` })
    }
    if (recommendedCharger) {
      const distText = recommendedCharger.originToChargerKm != null ? `약 ${recommendedCharger.originToChargerKm}km` : null
      const detourText = recommendedCharger.insertionDetourKm != null ? `우회 ${recommendedCharger.insertionDetourKm.toFixed(1)}km` : null
      lines.push({ icon: '⚡', color: 'accent', text: `권장 충전소: ${recommendedCharger.name}${distText ? ' · ' + distText : ''}${detourText ? ' · ' + detourText : ''}` })
      lines.push({ icon: 'ℹ', color: null, text: '위치·출력·등록 충전기 수 기준 추천 · 실시간 사용 여부 확인 필요' })
    }
    if (chargePlan) {
      const arrSoc = chargePlan.batteryAtChargerSoc
      const tgtSoc = chargePlan.targetSoc
      const powerKw = recommendedCharger?.powerKw
      lines.push({ icon: '⚡', color: 'accent', text: `권장 충전량: ${arrSoc}% → ${tgtSoc}% (약 ${chargePlan.chargeAmountKwh}kWh)` })
      lines.push({ icon: 'ℹ', color: null, text: `예상 충전 시간: ${powerKw ? `${powerKw}kW 기준 ` : ''}약 ${chargePlan.chargeTimeMin}분` })
      lines.push({ icon: '✓', color: 'success', text: `충전 후 배송 완료 예상 SOC: ${chargePlan.finalDeliverySOC}% (안전 하한 이상)` })
    } else {
      lines.push({ icon: '✓', color: 'success', text: '충전 후 배송을 안전하게 완주할 수 있습니다.' })
    }
  } else if (overlayState === 'review-candidate') {
    situationText = '충전 후보는 있지만 우회 거리나 위치 확인이 필요해요. 출발 전 실제 운영 상태를 확인해 주세요.'
    const isMidRoute = recommendationSource === 'mid-route'
    if (isMidRoute) {
      lines.push({ icon: 'ℹ', color: null, text: '배송 경로 중 충전이 필요할 수 있습니다.' })
      if (insertionExplanation) {
        lines.push({ icon: '⚡', color: 'accent', text: `예상 충전 시점: ${insertionExplanation}` })
      }
      if (recommendedCharger) {
        const detourText = recommendedCharger.insertionDetourKm != null ? `우회 ${recommendedCharger.insertionDetourKm.toFixed(1)}km` : null
        lines.push({ icon: '⚠', color: 'warning', text: `후보 충전소: ${recommendedCharger.name}${detourText ? ' · ' + detourText : ''}` })
        lines.push({ icon: '⚠', color: 'warning', text: '우회 거리가 있어 자동으로 경유가 확정되지 않습니다.' })
      }
      lines.push({ icon: 'ℹ', color: null, text: '지도에서 충전소 위치를 직접 확인 후 결정하세요.' })
    } else if (hasNearbyReachableCharger && recommendedCharger) {
      lines.push({ icon: 'ℹ', color: null, text: '출발지 인근에 충전 후보가 있습니다.' })
      const distText = recommendedCharger.originToChargerKm != null ? `약 ${recommendedCharger.originToChargerKm}km` : null
      lines.push({ icon: '⚠', color: 'warning', text: `후보 충전소: ${recommendedCharger.name}${distText ? ' · ' + distText : ''}` })
      lines.push({ icon: '⚠', color: 'warning', text: '출발 전 운영 상태와 빈 자리를 직접 확인하세요.' })
    }
  } else if (overlayState === 'no-suitable-charger') {
    lines.push({ icon: '⚠', color: 'warning', text: '출발지 3km 이내에 바로 권장할 수 있는 충전소가 없습니다.' })
    if (nearestRejectedDepartureChargerName && nearestRejectedDepartureDistanceKm != null) {
      lines.push({ icon: 'ℹ', color: null, text: `가장 가까운 후보: ${nearestRejectedDepartureChargerName} (약 ${nearestRejectedDepartureDistanceKm}km)` })
      lines.push({ icon: '⚠', color: 'warning', text: `3km 기준 초과로 자동 권장에서 제외되었습니다.` })
    }
    lines.push({ icon: 'ℹ', color: null, text: '다른 출발 지점이나 충전 시점을 검토하거나, 후보 충전소를 직접 확인하세요.' })
  } else if (overlayState === 'predeparture-charge') {
    situationText = '현재 배터리로 첫 배송을 시작하기 전에 안전 하한 SOC를 만족하기 어렵기 때문에 출발 전 충전을 권장해요.'
    lines.push({ icon: '!', color: 'danger', text: '현재 배터리가 안전 하한 SOC보다 낮습니다.' })
    if (firstViolationLabel) {
      lines.push({ icon: '⚠', color: 'danger', text: firstViolationLabel })
    }
    lines.push({ icon: '⚡', color: 'accent', text: '충전 시점: 출발 전 충전' })
    if (recommendedCharger) {
      const distText = recommendedCharger.originToChargerKm != null ? `약 ${recommendedCharger.originToChargerKm}km` : recommendedCharger.distanceFromStartKm != null ? `약 ${recommendedCharger.distanceFromStartKm}km` : null
      const pwrText = recommendedCharger.powerKw ? `${recommendedCharger.powerKw}kW` : null
      lines.push({ icon: '⚡', color: 'accent', text: `권장 충전소: ${recommendedCharger.name}${distText ? ' · ' + distText : ''}${pwrText ? ' · ' + pwrText : ''}` })
      lines.push({ icon: 'ℹ', color: null, text: '위치·출력·등록 충전기 수 기준 추천 · 실시간 사용 여부 확인 필요' })
    }
    lines.push({ icon: 'ℹ', color: null, text: `현재 SOC를 안전 하한 SOC ${userMinReserveSoc}% 이상으로 충전한 후 출발하세요.` })
  } else if (overlayState === 'canDeliver') {
    situationText = '현재 배터리로 전체 배송을 완료해도 안전 하한 SOC 이상을 유지할 수 있어요.'
    lines.push({ icon: '✓', color: 'success', text: '현재 배터리로 전체 배송 경로를 완주할 수 있습니다.' })
    lines.push({ icon: '✓', color: 'success', text: '별도 충전 없이 모든 배송을 완료할 수 있습니다.' })
  } else if (overlayState === 'lowMargin') {
    lines.push({ icon: '⚠', color: 'warning', text: '배송을 완주할 수 있지만 잔여 배터리 여유가 매우 낮습니다.' })
    lines.push({ icon: 'ℹ', color: null, text: '안전 여유(5% 이상)를 확보하려면 출발 전 충전을 검토하세요.' })
  } else {
    lines.push({ icon: 'ℹ', color: null, text: '현재 상태를 확인하는 중입니다.' })
  }

  return { lines, situationText }
}

// ── EV-TSP flow steps builder ─────────────────────────────────────────────────
function buildTSPSteps({ optimizationResult, isCurrentlyOptimal, deliveryRouteStatus, scoredChargers, intel, recommendedCharger, overlayState, minRouteSocPct }) {
  const routeReady = deliveryRouteStatus === 'ready'
  const distanceKm = intel?.route?.distanceKm
  const isRoadRoute = intel?.route?.isRoadRoute

  const chargerCount = scoredChargers?.filter(c => c.reachableFromStart && c.status !== 'maintenance').length ?? 0

  let step3Result = null
  const remainingSOC = intel?.energy?.remainingSOC
  if (remainingSOC != null) {
    const minSocTxt = minRouteSocPct != null
      ? ` · 운행 중 최저 ${Math.max(0, minRouteSocPct).toFixed(1)}%`
      : ''
    step3Result = `예상 소비 ${intel.energy.estimatedConsumptionKwh ?? '?'}kWh → 도착 ${remainingSOC.toFixed(1)}%${minSocTxt}`
  }

  let step4Result = null
  if (overlayState === 'canDeliver') step4Result = '위험 구간 없음 — 충전 없이 완주 가능'
  else if (overlayState === 'chargeNeeded') step4Result = '충전 없이 완주 불가 구간 탐지됨'
  else if (overlayState === 'reserveWarning') step4Result = '최소 SOC 기준 미달 구간 탐지됨'
  else if (overlayState === 'predeparture-charge') step4Result = '출발 SOC가 안전 하한 미만 — 출발 전 충전 필요'
  else if (overlayState === 'review-candidate') step4Result = '충전 고려 구간 탐지 — 후보 평가 중'
  else if (overlayState === 'no-suitable-charger') step4Result = '충전 필요 구간 탐지 — 적합한 후보 없음'
  else step4Result = '구간 분석 완료'

  let step5Result = null
  if (chargerCount > 0) step5Result = `${chargerCount}개 충전소 후보 평가 완료`
  else if (scoredChargers?.length > 0) step5Result = `${scoredChargers.length}개 후보 조회 — 조건 충족 없음`
  else step5Result = '충전소 데이터 확인 중'

  let step6Result = null
  if (overlayState === 'chargeNeeded' && recommendedCharger) step6Result = `출발 전 경유 확정: ${recommendedCharger.name}`
  else if (overlayState === 'reserveWarning' && recommendedCharger) step6Result = `선택 충전 권장: ${recommendedCharger.name}`
  else if (overlayState === 'predeparture-charge') step6Result = recommendedCharger ? `출발 전 충전 권장: ${recommendedCharger.name}` : '출발 전 충전 필요 — 안전 하한 SOC 기준 미달'
  else if (overlayState === 'review-candidate' && recommendedCharger) step6Result = `검토 후보 제시: ${recommendedCharger.name}`
  else if (overlayState === 'no-suitable-charger') step6Result = '적합한 충전소 없음 — 확인 필요'
  else if (overlayState === 'canDeliver') step6Result = '충전 불필요 — 배송 진행 가능'
  else if (!routeReady) step6Result = '충전 판단을 계산하는 중…'
  else step6Result = '충전 판단 분석 중'

  return [
    {
      text: 'TSP 배송 순서 최적화',
      result: optimizationResult
        ? (isCurrentlyOptimal
            ? `최적 순서 적용됨 (${optimizationResult.savedDistanceKm ?? 0}km 단축)`
            : `단축 가능 +${optimizationResult.savedDistanceKm ?? 0}km — 현재 미적용`)
        : '단일 배송지 또는 최적화 불필요',
    },
    {
      text: '실도로 경로 계산',
      result: routeReady
        ? (isRoadRoute
            ? `카카오모빌리티 실도로 기반 · 총 ${distanceKm != null ? distanceKm + 'km' : '?'}`
            : `직선 거리 기반 예측 · 총 ${distanceKm != null ? distanceKm + 'km' : '?'}`)
        : '실제 도로 경로를 불러오는 중…',
    },
    {
      text: '구간별 SOC 시뮬레이션',
      result: step3Result ?? '데이터 없음',
    },
    {
      text: '위험 구간 탐지',
      result: step4Result,
    },
    {
      text: '충전 후보 평가 (EV-TSP 스코어링)',
      result: step5Result,
    },
    {
      text: '최적 충전 전략 선택',
      result: step6Result,
    },
  ]
}

// ── Main component ────────────────────────────────────────────────────────────
export default function EVIntelligencePanel({
  open,
  onClose,
  overlayState,
  statusCfg,
  soc,
  estimatedRangeKm,
  remainingSocAfterDelivery,
  userMinReserveSoc,
  effectiveRouteKm,
  surplusRangeKm,
  effectiveChargeNeeded,
  isLowMargin,
  isReserveWarning,
  intel,
  recommendedCharger,
  recommendationMode,
  recommendationSource,
  insertionExplanation,
  scoredChargers,
  vehicle,
  optimizationResult,
  isCurrentlyOptimal,
  deliveryRouteStatus,
  nearestRejectedDepartureChargerName,
  nearestRejectedDepartureDistanceKm,
  hasNearbyReachableCharger,
  chargePlan,
  minRouteSocPct,
  firstViolationLabel,
  T,
  themeName,
}) {
  const [selectedChargerIdx, setSelectedChargerIdx] = useState(null)
  const [hoveredIdx, setHoveredIdx] = useState(null)

  if (!open) return null

  const bgColor = themeName === 'dark' ? 'rgba(17,19,23,0.98)' : 'rgba(255,255,255,0.99)'
  const healthScore    = intel?.summary?.routeHealthScore ?? null
  const scoreBreakdown = intel?.summary?.scoreBreakdown ?? []
  const healthGrade = healthScore == null ? null : healthScore >= 85 ? '안정' : healthScore >= 70 ? '양호' : healthScore >= 50 ? '주의' : '위험'
  const healthColor = healthScore == null ? T.textSecondary : healthScore >= 85 ? T.success : healthScore >= 70 ? T.accent : healthScore >= 50 ? T.warning : T.danger

  const top5 = (scoredChargers ?? []).slice(0, 5)

  const { lines: explanationLines, situationText: explanationSituationText } = buildRecommendationExplanation({
    overlayState, recommendedCharger, recommendationMode, recommendationSource,
    insertionExplanation, remainingSocAfterDelivery, userMinReserveSoc,
    nearestRejectedDepartureChargerName, nearestRejectedDepartureDistanceKm,
    hasNearbyReachableCharger, effectiveChargeNeeded, isReserveWarning,
    firstViolationLabel, chargePlan, minRouteSocPct,
  })

  const tspSteps = buildTSPSteps({
    optimizationResult, isCurrentlyOptimal, deliveryRouteStatus,
    scoredChargers, intel, recommendedCharger, overlayState, minRouteSocPct,
  })

  return (
    <div style={{
      width: '100%',
      flexShrink: 0,
      height: '100%',
      overflow: 'hidden',
      background: bgColor,
      borderLeft: `1px solid ${T.border}`,
      display: 'flex', flexDirection: 'column',
      fontFamily: FONT,
    }}>

        {/* Header */}
        <div style={{
          padding: '22px 30px', borderBottom: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, background: T.surface,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>
              EV 인텔리전스 상세
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: T.text }}>판단 근거 보기</div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 44, height: 44, borderRadius: '50%',
              border: `1px solid ${T.border}`, background: T.surfaceSecondary,
              color: T.textSecondary, fontSize: 20, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: FONT,
            }}
          >×</button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

            {/* Loading banner */}
          {deliveryRouteStatus === 'loading' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px', borderRadius: 10, marginBottom: 16,
              background: `${T.accent}12`, border: `1px solid ${T.accent}30`,
            }}>
              <span style={{ fontSize: 17, color: T.accent }}>⟳</span>
              <span style={{ fontSize: 15, color: T.accent, fontWeight: 500 }}>
                실제 도로 경로를 불러오는 중… 아래 수치는 임시 예측값입니다.
              </span>
            </div>
          )}

          {/* ── Section 1: 현재 결정 요약 ─────────────────────────────── */}
          <SectionTitle T={T}>현재 결정 요약</SectionTitle>

          {statusCfg && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '13px 24px', borderRadius: 28, marginBottom: 20,
              background: `${statusCfg.color}18`,
              border: `1px solid ${statusCfg.color}40`,
            }}>
              <span style={{ fontSize: 22 }}>{statusCfg.icon}</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: statusCfg.color }}>{statusCfg.label}</span>
            </div>
          )}

          <div style={{
            background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`,
            padding: '18px 22px', marginBottom: 4,
          }}>
            <Row label="현재 배터리" value={`${soc}%`} T={T} />
            <Row label="현재 주행 가능 거리" value={`${estimatedRangeKm}km`} T={T} />
            <Row label="전체 배송 경로" value={effectiveRouteKm != null ? `${effectiveRouteKm}km` : null} T={T} />
            {remainingSocAfterDelivery != null && (
              <Row
                label={
                  effectiveChargeNeeded || isReserveWarning || overlayState === 'review-candidate'
                    ? '충전 없이 배송 완료 예상 SOC'
                    : '배송 완료 예상 SOC'
                }
                value={`${remainingSocAfterDelivery.toFixed(1)}%`}
                valueColor={effectiveChargeNeeded ? T.danger : isLowMargin ? T.warning : isReserveWarning ? T.warning : T.success}
                T={T}
              />
            )}
            {minRouteSocPct != null && (
              <Row
                label="운행 중 예상 최저 SOC"
                value={`${Math.max(0, minRouteSocPct).toFixed(1)}%`}
                valueColor={minRouteSocPct < userMinReserveSoc ? T.danger : T.warning}
                T={T}
              />
            )}
            <Row label="안전 하한 SOC" value={`${userMinReserveSoc}%`} T={T} />
            {chargePlan && effectiveChargeNeeded && (
              <Row
                label="충전 후 배송 완료 예상 SOC"
                value={`${chargePlan.finalDeliverySOC}%`}
                valueColor={T.success}
                T={T}
              />
            )}
            {remainingSocAfterDelivery != null && (() => {
              const diff = parseFloat((remainingSocAfterDelivery - userMinReserveSoc).toFixed(1))
              return (
                <Row
                  label={diff >= 0 ? '안전 하한 대비 SOC 여유' : '안전 하한 대비 SOC 부족'}
                  value={diff >= 0 ? `+${diff}%p` : `${diff}%p`}
                  valueColor={diff >= 0 ? T.success : T.danger}
                  T={T}
                />
              )
            })()}
          </div>

          <Divider T={T} />

          {/* ── Section 2: 배송·충전 안정도 ──────────────────────────────── */}
          <SectionTitle T={T}>배송·충전 안정도</SectionTitle>

          {healthScore != null ? (
            <div style={{ background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, padding: '22px 26px', marginBottom: 4 }}>
              {/* Score bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 8 }}>
                <div style={{ flex: 1, height: 16, background: T.border, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${healthScore}%`, background: healthColor, height: '100%', borderRadius: 8 }} />
                </div>
                <span style={{ fontSize: 46, fontWeight: 700, color: healthColor, minWidth: 76, textAlign: 'right' }}>
                  {healthScore}
                </span>
              </div>
              <div style={{ fontSize: 16, color: T.textSecondary, marginBottom: 18 }}>
                {healthGrade} · 100점 만점 — 85점 이상: 안정 · 70–84점: 양호 · 50–69점: 주의 · 50점 미만: 위험
              </div>

              {/* Explanation */}
              <div style={{
                fontSize: 15, color: T.textSecondary, lineHeight: 1.7,
                padding: '12px 16px', borderRadius: 10,
                background: `${T.textSecondary}0a`, border: `1px solid ${T.border}`,
                marginBottom: 18,
              }}>
                배터리 여유, 충전 필요도, 우회거리, 충전소 신뢰도를 함께 반영한 점수예요.
              </div>

              {/* Breakdown title */}
              <div style={{ fontSize: 13, fontWeight: 700, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                운행 안정도 계산 기준
              </div>

              {/* Breakdown rows */}
              {scoreBreakdown.length > 0 ? scoreBreakdown.map((item, i) => {
                const ratio = item.max > 0 ? item.earned / item.max : 0
                const itemColor = ratio >= 0.85 ? T.success : ratio >= 0.6 ? T.accent : ratio >= 0.4 ? T.warning : T.danger
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 12, marginBottom: 12, borderBottom: i < scoreBreakdown.length - 1 ? `1px solid ${T.border}40` : 'none' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 500, color: T.text, marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</div>
                      <div style={{ height: 6, background: T.border, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${ratio * 100}%`, background: itemColor, height: '100%', borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 68, flexShrink: 0 }}>
                      <span style={{ fontSize: 17, fontWeight: 700, color: itemColor }}>+{item.earned}</span>
                      <span style={{ fontSize: 13, color: T.textSecondary }}> / {item.max}</span>
                    </div>
                  </div>
                )
              }) : (
                <div style={{ fontSize: 15, color: T.textSecondary }}>세부 항목을 계산하는 중이에요.</div>
              )}

              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 17, color: T.textSecondary }}>운행 안정도</span>
                  <span style={{ fontSize: 34, fontWeight: 700, color: healthColor }}>{healthScore}점</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 17, color: T.textSecondary, padding: '14px 0' }}>운행 안정도를 계산하는 중이에요.</div>
          )}

          <Divider T={T} />

          {/* ── Section 3: EV-TSP 판단 과정 ──────────────────────────────── */}
          <SectionTitle T={T}>EV-TSP 판단 과정</SectionTitle>
          <div style={{ background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, padding: '20px 24px', marginBottom: 4 }}>
            {tspSteps.map((step, i) => (
              <TSPStep
                key={i}
                num={i + 1}
                text={step.text}
                result={step.result}
                isLast={i === tspSteps.length - 1}
                T={T}
              />
            ))}
          </div>

          <Divider T={T} />

          {/* ── Section 4: 충전 판단 근거 ──────────────────────────────────── */}
          <SectionTitle T={T}>충전 판단 근거</SectionTitle>
          {explanationSituationText && (
            <div style={{ padding: '14px 18px', borderRadius: 12, background: `${T.accent}0f`, border: `1px solid ${T.accent}30`, fontSize: 17, color: T.text, lineHeight: 1.8, marginBottom: 16, fontWeight: 500 }}>
              {explanationSituationText}
            </div>
          )}
          <div style={{ background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, padding: '18px 22px', marginBottom: 4 }}>
            {explanationLines.map((line, i) => {
              const iconColor = line.color === 'success' ? T.success
                : line.color === 'warning' ? T.warning
                : line.color === 'danger' ? T.danger
                : line.color === 'accent' ? T.accent
                : T.textSecondary
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 0',
                  borderBottom: i < explanationLines.length - 1 ? `1px solid ${T.border}44` : 'none',
                }}>
                  <span style={{ fontSize: 18, color: iconColor, flexShrink: 0, minWidth: 22, textAlign: 'center', lineHeight: 1.5 }}>
                    {line.icon}
                  </span>
                  <span style={{ fontSize: 17, color: T.text, lineHeight: 1.7 }}>{line.text}</span>
                </div>
              )
            })}
          </div>

          <Divider T={T} />

          {/* ── Section 5: 충전소 후보 Top 5 ──────────────────────────────── */}
          <SectionTitle T={T}>충전소 후보 Top 5</SectionTitle>
          <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.6, marginBottom: 12 }}>
            ★ 표시는 EV-TSP 스코어링으로 선정된 최종 권장 충전소예요. 행을 클릭하면 상세 정보를 볼 수 있어요.
          </div>

          {top5.length > 0 ? (
            <>
              {/* 충전소 상세 팝업 (행 클릭 시 표시) */}
              {selectedChargerIdx !== null && top5[selectedChargerIdx] && (() => {
                const c = top5[selectedChargerIdx]
                const ql = chargerQualityLabel(c, recommendedCharger?.id)
                const distKm = c.originToChargerKm ?? c.distanceFromStartKm ?? null
                const detourKm = c.insertionDetourKm ?? null
                const isRec = c.id && c.id === recommendedCharger?.id
                return (
                  <div style={{
                    marginBottom: 14,
                    background: isRec ? `${T.accent}0d` : T.bg,
                    border: `2px solid ${isRec ? T.accent + '60' : ql.color + '50'}`,
                    borderRadius: 12,
                    padding: '14px 16px',
                    position: 'relative',
                  }}>
                    <button
                      onClick={() => setSelectedChargerIdx(null)}
                      style={{
                        position: 'absolute', top: 12, right: 12,
                        width: 34, height: 34, borderRadius: '50%',
                        border: `1px solid ${T.border}`, background: T.surfaceSecondary,
                        color: T.textSecondary, fontSize: 18, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: FONT, lineHeight: 1,
                      }}
                    >×</button>

                    <span style={{
                      display: 'inline-block',
                      fontSize: 14, fontWeight: 700,
                      padding: '5px 14px', borderRadius: 20, marginBottom: 12,
                      background: `${ql.color}18`,
                      border: `1px solid ${ql.color}40`,
                      color: ql.color,
                    }}>{ql.text}</span>

                    <div style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 3, paddingRight: 40, wordBreak: 'keep-all', lineHeight: 1.35 }}>
                      {c.name ?? '—'}
                    </div>
                    {c.operator && (
                      <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: isRec ? 10 : 12 }}>{c.operator}</div>
                    )}

                    {isRec && (
                      <div style={{ marginBottom: 16, padding: '14px 18px', background: `${T.accent}10`, border: `1px solid ${T.accent}30`, borderRadius: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>선정 이유</div>
                        <div style={{ fontSize: 15, color: T.text, lineHeight: 1.75 }}>
                          <div>현재 배터리와 안전 하한 SOC를 기준으로 충전이 필요한 상황이에요.</div>
                          <div style={{ marginTop: 6 }}>이 충전소는 현재 위치에서 도달 가능하고, 충전 후 남은 배송을 안전 하한 SOC 이상으로 이어갈 수 있어요.</div>
                          <div style={{ marginTop: 6 }}>단순 거리만이 아니라 우회 거리, 충전 시점, 안전 하한 SOC 충족 여부를 함께 고려했어요.</div>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                      {c.powerKw != null && (
                        <div style={{ background: T.surface, borderRadius: 10, padding: '10px 12px', border: `1px solid ${T.border}` }}>
                          <div style={{ fontSize: 11, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>충전 속도</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{c.powerKw} kW</div>
                        </div>
                      )}
                      {distKm != null && (
                        <div style={{ background: T.surface, borderRadius: 10, padding: '10px 12px', border: `1px solid ${T.border}` }}>
                          <div style={{ fontSize: 11, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>거리</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{distKm} km</div>
                        </div>
                      )}
                      {detourKm != null && (
                        <div style={{ background: T.surface, borderRadius: 10, padding: '10px 12px', border: `1px solid ${T.border}` }}>
                          <div style={{ fontSize: 11, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>우회 거리</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{detourKm.toFixed(1)} km</div>
                        </div>
                      )}
                      {c.pricePerKwh != null && (
                        <div style={{ background: T.surface, borderRadius: 10, padding: '10px 12px', border: `1px solid ${T.border}` }}>
                          <div style={{ fontSize: 11, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>단가</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{c.pricePerKwh.toLocaleString('ko-KR')}원/kWh</div>
                        </div>
                      )}
                    </div>

                    <div style={{
                      padding: '13px 18px', background: `${ql.color}14`,
                      borderRadius: 10, border: `1px solid ${ql.color}30`,
                      fontSize: 16, fontWeight: 700, color: ql.color, textAlign: 'center',
                    }}>
                      판단: {ql.text}
                    </div>
                  </div>
                )
              })()}

              <div style={{ background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
                {/* Table header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '26px 1fr 52px 44px 68px',
                  gap: 0, padding: '9px 14px',
                  background: `${T.textSecondary}10`,
                  borderBottom: `1px solid ${T.border}`,
                }}>
                  {['#', '충전소', '거리', 'kW', '판단'].map(h => (
                    <div key={h} style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {h}
                    </div>
                  ))}
                </div>

                {top5.map((c, i) => {
                  const ql = chargerQualityLabel(c, recommendedCharger?.id)
                  const distKm = c.originToChargerKm ?? c.distanceFromStartKm ?? null
                  const isRec = c.id && c.id === recommendedCharger?.id
                  const isSelected = selectedChargerIdx === i
                  const isHovered = hoveredIdx === i
                  return (
                    <div
                      key={c.id ?? i}
                      onClick={() => setSelectedChargerIdx(prev => prev === i ? null : i)}
                      onMouseEnter={() => setHoveredIdx(i)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '26px 1fr 52px 44px 68px',
                        gap: 0, padding: '10px 14px', alignItems: 'start',
                        borderBottom: i < top5.length - 1 ? `1px solid ${T.border}44` : 'none',
                        background: isSelected
                          ? `${T.accent}18`
                          : isHovered
                            ? `${T.textSecondary}08`
                            : isRec ? `${T.accent}1c` : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.12s',
                        outline: isSelected ? `2px solid ${T.accent}50` : isRec ? `1px solid ${T.accent}40` : 'none',
                        outlineOffset: '-2px',
                        boxShadow: isRec ? `inset 4px 0 0 ${T.accent}` : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, paddingTop: 2 }}>
                        {isRec && (
                          <span style={{ fontSize: 9, color: T.accent, lineHeight: 1 }}>★</span>
                        )}
                        <span style={{ fontSize: 13, fontWeight: 700, color: isRec ? T.accent : T.textSecondary }}>
                          {i + 1}
                        </span>
                      </div>
                      <div style={{ overflow: 'hidden', paddingRight: 4 }}>
                        <div style={{
                          fontSize: 13, fontWeight: isRec || isSelected ? 700 : 500,
                          color: isSelected ? T.accent : T.text,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                          overflow: 'hidden', lineHeight: 1.4, wordBreak: 'keep-all',
                        }}>{c.name ?? '확인 필요'}</div>
                        {c.operator && (
                          <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2, lineHeight: 1.3 }}>{c.operator}</div>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: T.textSecondary, paddingTop: 2 }}>
                        {distKm != null ? `${distKm}km` : '—'}
                      </div>
                      <div style={{ fontSize: 12, color: T.text, fontWeight: 600, paddingTop: 2 }}>
                        {c.powerKw != null ? c.powerKw : '—'}
                      </div>
                      <div style={{ paddingTop: 1 }}>
                        <span style={{
                          fontSize: 11, padding: '3px 7px', borderRadius: 8,
                          background: `${ql.color}18`,
                          border: `1px solid ${ql.color}40`,
                          color: ql.color, fontWeight: 600, whiteSpace: 'nowrap',
                          display: 'inline-block',
                        }}>
                          {ql.text}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 17, color: T.textSecondary, padding: '14px 0' }}>
              {scoredChargers == null ? '충전소 데이터를 불러오는 중입니다.' : '표시할 충전소 후보가 없습니다.'}
            </div>
          )}

          <div style={{ height: 20 }} />
        </div>
      </div>
  )
}
