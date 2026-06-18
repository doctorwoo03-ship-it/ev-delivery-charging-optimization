import { FONT } from '../theme/themes'

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionTitle({ children, T }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: T.textSecondary,
      textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10,
    }}>
      {children}
    </div>
  )
}

function Divider({ T }) {
  return <div style={{ height: 1, background: T.border, margin: '14px 0' }} />
}

function Row({ label, value, valueColor, T }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '3px 0' }}>
      <span style={{ fontSize: 12, color: T.textSecondary }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: valueColor ?? T.text }}>{value ?? '확인 필요'}</span>
    </div>
  )
}

function PenaltyTag({ amount, label, T }) {
  const isNeg = amount < 0
  const isZero = amount === 0
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 8, marginBottom: 4,
      background: isNeg ? `${T.danger}14` : isZero ? `${T.textSecondary}0a` : `${T.success}14`,
      border: `1px solid ${isNeg ? T.danger + '30' : isZero ? T.border : T.success + '30'}`,
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: isNeg ? T.danger : isZero ? T.textSecondary : T.success, minWidth: 36 }}>
        {isNeg ? `${amount}점` : isZero ? '±0' : `+${amount}점`}
      </span>
      <span style={{ fontSize: 12, color: T.text }}>{label}</span>
    </div>
  )
}

function TSPStep({ num, text, result, isLast, T }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: isLast ? 0 : 6 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: `${T.accent}20`, border: `1.5px solid ${T.accent}60`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: T.accent,
        }}>{num}</div>
        {!isLast && <div style={{ width: 1, height: 14, background: `${T.border}`, marginTop: 2 }} />}
      </div>
      <div style={{ flex: 1, paddingTop: 2 }}>
        <div style={{ fontSize: 12, color: T.text, fontWeight: 500 }}>{text}</div>
        {result && (
          <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 1, lineHeight: 1.4 }}>{result}</div>
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
      lines.push({ icon: 'ℹ', color: null, text: `예상 충전 시간: ${powerKw ? `${powerKw}kW 기준 ` : ''}약 ${chargePlan.chargeTimeMin}분 (대기 시간 미포함)` })
      lines.push({ icon: '✓', color: 'success', text: `충전 후 배송 완료 예상 SOC: ${chargePlan.finalDeliverySOC}% (안전 하한 이상)` })
    } else {
      lines.push({ icon: '✓', color: 'success', text: '충전 후 배송을 안전하게 완주할 수 있습니다.' })
    }
  } else if (overlayState === 'review-candidate') {
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
    lines.push({ icon: 'ℹ', color: null, text: '예상 충전 시간에 대기 시간은 미포함 · 대기 정보 미확인' })
  } else if (overlayState === 'canDeliver') {
    lines.push({ icon: '✓', color: 'success', text: '현재 배터리로 전체 배송 경로를 완주할 수 있습니다.' })
    lines.push({ icon: '✓', color: 'success', text: '별도 충전 없이 모든 배송을 완료할 수 있습니다.' })
  } else if (overlayState === 'lowMargin') {
    lines.push({ icon: '⚠', color: 'warning', text: '배송을 완주할 수 있지만 잔여 배터리 여유가 매우 낮습니다.' })
    lines.push({ icon: 'ℹ', color: null, text: '안전 여유(5% 이상)를 확보하려면 출발 전 충전을 검토하세요.' })
  } else {
    lines.push({ icon: 'ℹ', color: null, text: '현재 상태를 확인하는 중입니다.' })
  }

  return lines
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
  if (!open) return null

  const bgColor = themeName === 'dark' ? 'rgba(17,19,23,0.98)' : 'rgba(255,255,255,0.99)'
  const healthScore = intel?.summary?.routeHealthScore ?? null
  const deductions = intel?.summary?.healthDeductions ?? []
  const healthGrade = healthScore == null ? null : healthScore >= 80 ? '양호' : healthScore >= 60 ? '주의' : '위험'
  const healthColor = healthScore == null ? T.textSecondary : healthScore >= 80 ? T.success : healthScore >= 60 ? T.warning : T.danger

  const top5 = (scoredChargers ?? []).slice(0, 5)

  const explanationLines = buildRecommendationExplanation({
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
      width: 440,
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
          padding: '14px 16px', borderBottom: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, background: T.surface,
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
              EV 인텔리전스 상세
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>판단 근거 보기</div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              border: `1px solid ${T.border}`, background: T.surfaceSecondary,
              color: T.textSecondary, fontSize: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: FONT,
            }}
          >×</button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

            {/* Loading banner */}
          {deliveryRouteStatus === 'loading' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 8, marginBottom: 12,
              background: `${T.accent}12`, border: `1px solid ${T.accent}30`,
            }}>
              <span style={{ fontSize: 13, color: T.accent }}>⟳</span>
              <span style={{ fontSize: 12, color: T.accent, fontWeight: 500 }}>
                실제 도로 경로를 불러오는 중… 아래 수치는 임시 예측값입니다.
              </span>
            </div>
          )}

          {/* ── Section 1: 현재 결정 요약 ─────────────────────────────── */}
          <SectionTitle T={T}>현재 결정 요약</SectionTitle>

          {statusCfg && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 20, marginBottom: 12,
              background: `${statusCfg.color}18`,
              border: `1px solid ${statusCfg.color}40`,
            }}>
              <span style={{ fontSize: 14 }}>{statusCfg.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: statusCfg.color }}>{statusCfg.label}</span>
            </div>
          )}

          <div style={{
            background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`,
            padding: '10px 12px', marginBottom: 4,
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

          {/* ── Section 2: 경로 건강 점수 ───────────────────────────────── */}
          <SectionTitle T={T}>경로 건강 점수</SectionTitle>

          {healthScore != null ? (
            <div style={{ background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`, padding: '12px 12px', marginBottom: 4 }}>
              {/* Score bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ flex: 1, height: 8, background: T.border, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${healthScore}%`, background: healthColor, height: '100%', borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 20, fontWeight: 700, color: healthColor, minWidth: 48, textAlign: 'right' }}>
                  {healthScore}
                </span>
              </div>
              <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 10 }}>
                {healthGrade} 등급 / 100점 만점
              </div>

              {/* Formula */}
              <div style={{
                fontSize: 11, color: T.textSecondary, lineHeight: 1.6,
                padding: '7px 10px', borderRadius: 7,
                background: `${T.textSecondary}0a`, border: `1px solid ${T.border}`,
                marginBottom: 10,
              }}>
                <strong style={{ color: T.text }}>점수 구성:</strong>{' '}
                기본점수 100 — 배터리 위험 패널티 — 충전 필요 패널티 — 경로 신뢰도 패널티
              </div>

              {/* Base */}
              <PenaltyTag amount={100} label="기본 점수" T={T} />
              {deductions.map((d, i) => (
                <PenaltyTag key={i} amount={d.amount} label={d.label} T={T} />
              ))}
              {deductions.length === 0 && (
                <div style={{ fontSize: 12, color: T.textSecondary }}>감점 없음 — 최적 상태</div>
              )}

              <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12, color: T.textSecondary }}>최종 점수</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: healthColor }}>{healthScore}점</span>
                </div>
                <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>
                  80점 이상: 양호 · 60–79점: 주의 · 60점 미만: 위험
                </div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: T.textSecondary, padding: '8px 0' }}>경로 건강 점수를 계산하는 중입니다.</div>
          )}

          <Divider T={T} />

          {/* ── Section 3: EV-TSP 판단 과정 ──────────────────────────────── */}
          <SectionTitle T={T}>EV-TSP 판단 과정</SectionTitle>
          <div style={{ background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`, padding: '12px 12px', marginBottom: 4 }}>
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
          <div style={{ background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`, padding: '10px 12px', marginBottom: 4 }}>
            {explanationLines.map((line, i) => {
              const iconColor = line.color === 'success' ? T.success
                : line.color === 'warning' ? T.warning
                : line.color === 'danger' ? T.danger
                : line.color === 'accent' ? T.accent
                : T.textSecondary
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '5px 0',
                  borderBottom: i < explanationLines.length - 1 ? `1px solid ${T.border}44` : 'none',
                }}>
                  <span style={{ fontSize: 13, color: iconColor, flexShrink: 0, minWidth: 16, textAlign: 'center', lineHeight: 1.5 }}>
                    {line.icon}
                  </span>
                  <span style={{ fontSize: 12, color: T.text, lineHeight: 1.55 }}>{line.text}</span>
                </div>
              )
            })}
          </div>

          <Divider T={T} />

          {/* ── Section 5: 충전소 후보 Top 5 ──────────────────────────────── */}
          <SectionTitle T={T}>충전소 후보 Top 5</SectionTitle>

          {top5.length > 0 ? (
            <div style={{ background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '28px 1fr 56px 56px 40px 64px',
                gap: 0, padding: '6px 10px',
                background: `${T.textSecondary}10`,
                borderBottom: `1px solid ${T.border}`,
              }}>
                {['순위', '충전소', '거리', '우회', 'kW', '판단'].map(h => (
                  <div key={h} style={{ fontSize: 9, fontWeight: 700, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {h}
                  </div>
                ))}
              </div>

              {top5.map((c, i) => {
                const ql = chargerQualityLabel(c, recommendedCharger?.id)
                const distKm = c.originToChargerKm ?? c.distanceFromStartKm ?? null
                const detourKm = c.insertionDetourKm ?? null
                const isRec = c.id && c.id === recommendedCharger?.id
                return (
                  <div
                    key={c.id ?? i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '28px 1fr 56px 56px 40px 64px',
                      gap: 0, padding: '7px 10px', alignItems: 'center',
                      borderBottom: i < top5.length - 1 ? `1px solid ${T.border}44` : 'none',
                      background: isRec ? `${T.accent}0a` : 'transparent',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: isRec ? T.accent : T.textSecondary }}>
                      {i + 1}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{
                        fontSize: 12, fontWeight: isRec ? 700 : 500, color: T.text,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{c.name ?? '확인 필요'}</div>
                      {c.operator && (
                        <div style={{ fontSize: 10, color: T.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.operator}</div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: T.textSecondary }}>
                      {distKm != null ? `${distKm}km` : '—'}
                    </div>
                    <div style={{ fontSize: 11, color: T.textSecondary }}>
                      {detourKm != null ? `${detourKm.toFixed(1)}km` : '—'}
                    </div>
                    <div style={{ fontSize: 11, color: T.text, fontWeight: 600 }}>
                      {c.powerKw != null ? c.powerKw : '—'}
                    </div>
                    <div>
                      <span style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 8,
                        background: `${ql.color}18`,
                        border: `1px solid ${ql.color}40`,
                        color: ql.color, fontWeight: 600, whiteSpace: 'nowrap',
                      }}>
                        {ql.text}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: T.textSecondary, padding: '8px 0' }}>
              {scoredChargers == null ? '충전소 데이터를 불러오는 중입니다.' : '표시할 충전소 후보가 없습니다.'}
            </div>
          )}

          <div style={{ height: 20 }} />
        </div>
      </div>
  )
}
