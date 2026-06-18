import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { VEHICLES } from '../data/vehicleData'
import { analyzeRoute } from '../services/routeIntelligenceService'
import { getUserDrivingProfile } from '../services/drivingDataService'
import { loadRouteIntelligence } from '../state/routeIntelligenceStore'
import { THEMES, getInitialTheme, FONT } from '../theme/themes'

const OUTER_HDR = 52
const HDR       = 56
const BAR       = 72

const DEMO_VEHICLE = VEHICLES.find(v => v.id === 'porter2') ?? VEHICLES[0]
const DEMO_CHARGING_RESULT = {
  chargeNeeded: true,
  chargerReachable: true,
  recommendedCharger: {
    id: 'ch5', name: '강남 급속충전소', operator: 'GS칼텍스',
    powerKw: 100, pricePerKwh: 347, distKm: 2.3,
    waitMin: 0, availableSlots: 2, totalSlots: 4,
    recommendationReason: '경로 인근 · 급속충전',
  },
  chargePlan: { targetSoc: 80, chargeAmountKwh: 27.2, chargeTimeMin: 16, totalExtraCost: 9436 },
  recommendationMode: 'route-optimal',
  mockCoverageWarning: false,
}
const DEMO_SNAPSHOT = {
  userId: 'demo-driver-001',
  vehicle: DEMO_VEHICLE,
  batterySOC: 35,
  startPoint: { name: '강남 물류센터' },
  deliveries: [
    { name: '선릉역' }, { name: '역삼역' }, { name: '교대역' }, { name: '양재역' }, { name: '매봉역' },
  ],
  routePathResult: { distanceKm: 24.5, durationMin: 45, isFallback: false, source: 'kakao-directions' },
  recommendedCharger: DEMO_CHARGING_RESULT.recommendedCharger,
  chargePlan: DEMO_CHARGING_RESULT.chargePlan,
  optimizationResult: { originalDistanceKm: 27.8, optimizedDistanceKm: 24.5, savedDistanceKm: 3.3, savedPercent: 11.9 },
  recommendationMode: 'route-optimal',
  mockCoverageWarning: false,
  chargerReachable: true,
  drivableRangeKm: 45,
  estimatedRangeKm: 45,
  deliveryRouteStatus: 'ready',
  chargerRouteStatus: 'ready',
  isCurrentlyOptimal: false,
}

// ─── Decision configuration ───────────────────────────────────────────────────
function getDecisionCfg(status, T) {
  return {
    ok:                { title: '배송 가능',               icon: '✓', color: T.success },
    'low-margin':      { title: '배송 가능 · 여유 부족',   icon: '⚠', color: T.warning },
    'reserve-warning': { title: '배송 가능 · 충전 권장',   icon: '⚡', color: T.warning },
    'charge-required': { title: '먼저 충전',               icon: '⚡', color: T.warning },
    unreachable:       { title: '충전소 도달 불가',         icon: '!', color: T.danger  },
    'no-local-data':   { title: '주변 충전소 데이터 없음',  icon: '?', color: T.warning },
    critical:          { title: 'SOC 확인 필요',            icon: '⟳', color: T.warning },
  }[status] ?? { title: '분석 중...', icon: 'ℹ', color: T.textSecondary }
}

const DECISION_REASON = {
  ok:                '현재 배터리로 전체 배송 경로를 완주할 수 있습니다.',
  'low-margin':      '완주는 가능하지만 잔여 배터리 여유가 매우 낮습니다.',
  'reserve-warning': '배송은 가능하지만 설정한 최소 도착 SOC 기준보다 낮게 도착합니다.',
  'charge-required': '충전 없이는 전체 배송을 완주할 수 없습니다. 출발지 인근 충전소를 먼저 경유하세요.',
  unreachable:       '주행 가능 거리 내 도달할 수 있는 충전소가 없습니다.',
  'no-local-data':   '현재 지역의 충전소 샘플 데이터가 없습니다. 배송 경로는 표시됩니다.',
  critical:          '배터리 상태 또는 경로 신뢰도를 점검하세요.',
}

// ─── Decision reason builder ──────────────────────────────────────────────────
function buildDecisionReasons(result, snapshot, decisionStatus) {
  const reasons = []
  const route    = result?.route
  const energy   = result?.energy
  const charging = result?.charging
  const opt      = result?.optimization
  const charger  = charging?.recommendedCharger ?? snapshot?.recommendedCharger
  const isCurrentlyOptimal = snapshot?.isCurrentlyOptimal
  const userProfile = getUserDrivingProfile(
    snapshot?.userId ?? 'demo-driver-001',
    snapshot?.vehicle?.id
  )

  // Route basis
  if (route?.isRoadRoute) {
    reasons.push({ icon: '✓', ok: true,  text: '실도로 경로 기반 계산 (카카오모빌리티)' })
  } else if (route?.routeSource !== 'none') {
    reasons.push({ icon: '⚠', ok: false, text: '직선 거리 기반 예측 — 실도로 API 미연결' })
  }

  // Main decision reason
  const userMinReserveSoc = snapshot?.userMinReserveSoc ?? 10

  if (decisionStatus === 'ok') {
    const rem = energy?.remainingSOC
    reasons.push({ icon: '✓', ok: true, text: rem != null
      ? `현재 배터리(SOC ${snapshot?.batterySOC ?? '-'}%)로 배송 완주 가능 — 예상 도착 SOC ${rem}%`
      : '현재 배터리로 전체 배송 완주 가능' })
  }
  if (decisionStatus === 'low-margin') {
    const rem = energy?.remainingSOC
    const surplus = energy?.rangeAfterRouteKm
    reasons.push({ icon: '⚠', ok: null, text: rem != null
      ? `완주 가능 — 예상 도착 SOC ${rem.toFixed(1)}% (안전 기준 5% 미만)`
      : surplus != null
        ? `완주 가능하지만 여유 거리 ${surplus} km로 안전 기준(3 km) 미만입니다.`
        : '배터리 여유가 매우 낮습니다. 출발 전 충전 여부를 확인하세요.' })
  }
  if (decisionStatus === 'reserve-warning') {
    const rem = energy?.remainingSOC
    reasons.push({ icon: '⚡', ok: null, text: rem != null
      ? `예상 도착 SOC ${rem.toFixed(1)}% — 설정 기준 ${userMinReserveSoc}%보다 ${(userMinReserveSoc - rem).toFixed(1)}%p 부족`
      : `예상 도착 SOC가 설정한 최소 도착 SOC ${userMinReserveSoc}% 기준에 미달합니다.` })
    const reserveCharger = snapshot?.recommendedCharger
    if (reserveCharger) {
      const distText = reserveCharger.distKm != null ? `${reserveCharger.distKm}km` : reserveCharger.distanceFromStartKm != null ? `${reserveCharger.distanceFromStartKm}km` : null
      reasons.push({ icon: '⚡', ok: null, text: distText
        ? `권장 충전소: ${reserveCharger.name} · ${distText} — 선택 경유 시 최소 도착 SOC 기준을 만족할 수 있습니다.`
        : `권장 충전소: ${reserveCharger.name} — 선택 경유 시 최소 도착 SOC 기준을 만족할 수 있습니다.` })
    } else {
      reasons.push({ icon: 'ℹ', ok: null, text: `최소 도착 SOC 설정 ${userMinReserveSoc}% — 운전 화면에서 조정 가능` })
    }
  }
  if (decisionStatus === 'charge-required' && charger) {
    reasons.push({ icon: '⚡', ok: null, text: `충전 없이는 전체 배송 완주 불가 — 추천 충전소 ${charger.name}까지 ${charger.distKm ?? charger.distanceFromStartKm ?? '-'} km` })
    const finalSOC = snapshot?.chargePlan?.finalDeliverySOC
    if (finalSOC != null) {
      reasons.push({ icon: '✓', ok: true, text: `충전 후 예상 도착 SOC ${finalSOC}% — 최소 도착 SOC ${userMinReserveSoc}% 기준 충족` })
    }
  }
  if (decisionStatus === 'charge-required' && !charger) {
    reasons.push({ icon: '⚡', ok: null, text: '충전 없이는 전체 배송 완주 불가 — 출발지 근처 충전소에 먼저 경유하세요.' })
  }
  if (decisionStatus === 'unreachable') {
    const nearest  = snapshot?.nearestUnreachable
    const dist     = nearest?.distanceFromStartKm ?? null
    const range    = snapshot?.drivableRangeKm ?? snapshot?.estimatedRangeKm ?? null
    const shortage = (dist != null && range != null) ? Math.max(0, dist - range).toFixed(1) : null
    reasons.push({ icon: '✕', ok: false, text: shortage != null && parseFloat(shortage) > 0.05
      ? `현재 SOC로 충전소까지 도달 불가 — ${shortage} km 부족`
      : '현재 SOC로 도달 가능한 충전소 없음' })
  }
  if (decisionStatus === 'no-local-data') {
    reasons.push({ icon: '?',  ok: null, text: '현재 출발 지역 충전소 샘플 데이터 없음 (반경 40 km 이내)' })
    reasons.push({ icon: '✓', ok: true,  text: '배송 경로는 정상 표시됩니다' })
  }
  if (decisionStatus === 'critical') {
    reasons.push({ icon: '⚠', ok: false, text: 'SOC가 매우 낮거나 경로 신뢰도가 부족합니다. 출발 전 확인하세요.' })
  }

  // Efficiency
  const hasProfile = userProfile && userProfile.sampleCount > 0
  const confOk = energy?.confidenceLevel === 'high' || energy?.confidenceLevel === 'medium'
  if (hasProfile && confOk) {
    reasons.push({ icon: '✓', ok: true,  text: `개인화 전비 적용 — ${userProfile.sampleCount}샘플 기반` })
  } else {
    reasons.push({ icon: 'ℹ', ok: null,  text: '개인화 전비 미적용 — 차량 기본값 사용 (주행 기록 부족)' })
  }

  // Route optimization
  if (opt?.savedDistanceKm != null && opt.savedDistanceKm > 0) {
    if (isCurrentlyOptimal) {
      reasons.push({ icon: '✓', ok: true,  text: `최적 배송 순서 적용됨 — ${opt.savedDistanceKm} km 단축` })
    } else {
      reasons.push({ icon: 'ℹ', ok: null,  text: `배송 순서 최적화 미적용 — ${opt.savedDistanceKm} km 추가 단축 가능` })
    }
  }

  return reasons.slice(0, 6)
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ReasonRow({ icon, ok, text, T }) {
  const iconColor = ok === true ? T.success : ok === false ? T.danger : T.textSecondary
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: `1px solid ${T.border}44` }}>
      <span style={{ fontSize: 14, color: iconColor, flexShrink: 0, lineHeight: 1.5, width: 18, textAlign: 'center' }}>{icon}</span>
      <span style={{ fontSize: 13, color: T.text, lineHeight: 1.55 }}>{text}</span>
    </div>
  )
}

function MetricCard({ label, value, unit, context, accent, T }) {
  return (
    <div style={{
      flex: 1, padding: '12px 14px',
      background: T.surface, borderRadius: 10,
      border: `1px solid ${accent ? accent + '40' : T.border}`,
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: accent ?? T.text, lineHeight: 1, letterSpacing: '-0.02em' }}>
          {value ?? '-'}
        </span>
        {unit && <span style={{ fontSize: 11, color: T.textSecondary }}>{unit}</span>}
      </div>
      {context && (
        <div style={{ fontSize: 10, color: T.textSecondary, lineHeight: 1.4 }}>{context}</div>
      )}
    </div>
  )
}

function HealthBar({ score, deductions, T }) {
  const color = score >= 80 ? T.success : score >= 60 ? T.warning : T.danger
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
        <div style={{ flex: 1, height: 10, background: T.border, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ width: `${score}%`, background: color, height: '100%', borderRadius: 6, transition: 'width 0.6s ease' }} />
        </div>
        <span style={{ fontSize: 20, fontWeight: 700, color, minWidth: 64, textAlign: 'right', letterSpacing: '-0.01em' }}>
          {score} / 100
        </span>
      </div>
      {deductions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {deductions.map((d, i) => (
            <span key={i} style={{
              fontSize: 11, padding: '3px 9px', borderRadius: 10,
              background: d.amount < 0 ? T.danger + '15' : T.textSecondary + '12',
              border: `1px solid ${d.amount < 0 ? T.danger + '30' : T.border}`,
              color: d.amount < 0 ? T.danger : T.textSecondary,
              fontWeight: d.amount < 0 ? 600 : 400,
            }}>
              {d.amount < 0 ? `${d.amount}점  ` : ''}{d.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function SectionLabel({ children, T }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 700, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
      {children}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MVP7Page() {
  const navigate = useNavigate()
  const [themeName, setThemeName] = useState(getInitialTheme)
  const T = THEMES[themeName]

  const [result,   setResult]   = useState(null)
  const [snapshot, setSnapshot] = useState(null)
  const [isDemo,   setIsDemo]   = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    if (document.getElementById('ev-pretendard')) return
    const link = document.createElement('link')
    link.id   = 'ev-pretendard'
    link.rel  = 'stylesheet'
    link.href = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css'
    document.head.appendChild(link)
  }, [])

  useEffect(() => {
    const stored = loadRouteIntelligence()
    if (stored?.routeIntelligenceResult) {
      setResult(stored.routeIntelligenceResult)
      setSnapshot(stored)
      setIsDemo(false)
      setLoading(false)
      return
    }
    setIsDemo(true)
    let cancelled = false
    analyzeRoute({
      userId: DEMO_SNAPSHOT.userId,
      vehicle: DEMO_VEHICLE,
      batterySOC: DEMO_SNAPSHOT.batterySOC,
      routeResult: DEMO_SNAPSHOT.routePathResult,
      chargingResult: DEMO_CHARGING_RESULT,
      optimizationResult: DEMO_SNAPSHOT.optimizationResult,
    }).then(r => {
      if (!cancelled) {
        setResult(r)
        setSnapshot(DEMO_SNAPSHOT)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  function toggleTheme() {
    setThemeName(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      try { localStorage.setItem('ev-theme', next) } catch {}
      return next
    })
  }

  // ── Derived values ──
  const summary  = result?.summary
  const energy   = result?.energy
  const charging = result?.charging
  const route    = result?.route
  const opt      = result?.optimization

  const vehicle     = snapshot?.vehicle ?? DEMO_VEHICLE
  const batterySOC  = snapshot?.batterySOC ?? DEMO_SNAPSHOT.batterySOC
  const defaultEff  = vehicle?.combinedEfficiencyKmPerKwh ?? vehicle?.efficiencyKmPerKwh ?? null
  const appliedEff  = energy?.effectiveEfficiencyKmPerKwh ?? null
  const isPersonalized = appliedEff != null && defaultEff != null && Math.abs(appliedEff - defaultEff) >= 0.01
  const userProfile = getUserDrivingProfile(snapshot?.userId ?? 'demo-driver-001', vehicle?.id)

  // Decision status — prefer snapshot.recommendationMode for no-local-data
  const decisionStatus = loading ? 'loading'
    : snapshot?.recommendationMode === 'no-local-data' ? 'no-local-data'
    : summary?.status ?? 'ok'

  const cfg        = getDecisionCfg(decisionStatus, T)
  const reasonText = DECISION_REASON[decisionStatus] ?? ''
  const healthScore = summary?.routeHealthScore ?? 0
  const deductions  = summary?.healthDeductions ?? []

  const reasons = loading ? [] : buildDecisionReasons(result, snapshot, decisionStatus)

  const charger = charging?.recommendedCharger ?? snapshot?.recommendedCharger ?? null
  const chargePlanData = snapshot?.chargePlan ?? null

  const zoneH = `calc(100vh - ${OUTER_HDR}px - ${HDR}px - ${BAR}px)`

  // ── Next action buttons ──
  const nextActions = {
    ok:                [{ label: '운전 화면으로 돌아가기', primary: true }],
    'low-margin':      [{ label: '충전 여유 확인 — 운전 화면으로', primary: true }],
    'reserve-warning': [{ label: '충전 여유 확인 — 운전 화면으로', primary: true }],
    'charge-required': [{ label: '충전소 먼저 경유 — 운전 화면으로', primary: true }],
    unreachable:       [{ label: 'SOC 조정 — 운전 화면으로', primary: true }],
    'no-local-data':   [{ label: '배송 경로 확인 — 운전 화면으로', primary: true }],
    critical:          [{ label: 'SOC 재설정 후 운전 화면으로', primary: true }],
    loading:           [],
  }[decisionStatus] ?? [{ label: '운전 화면으로 돌아가기', primary: true }]

  return (
    <div style={{
      position: 'fixed', top: OUTER_HDR, left: 0, right: 0, bottom: 0, zIndex: 10,
      display: 'flex', flexDirection: 'column',
      fontFamily: FONT, background: T.bg, color: T.text, overflow: 'hidden',
    }}>

      {/* ── HEADER ───────────────────────────────────────────────── */}
      <div style={{
        height: HDR, padding: '0 20px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${T.border}`, background: T.surface,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate('/mvp-6')}
            style={{ padding: '6px 14px', border: `1px solid ${T.border}`, borderRadius: 6, background: 'transparent', color: T.textSecondary, cursor: 'pointer', fontSize: 12, fontFamily: FONT }}
          >
            ← 운전 화면으로
          </button>
          <span style={{ width: 1, height: 14, background: T.border }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: T.accent, letterSpacing: '0.1em', textTransform: 'uppercase' }}>MVP-7</span>
          <span style={{ width: 1, height: 14, background: T.border }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary }}>경로 결정 설명</span>
          {isDemo && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8, background: T.warning + '22', color: T.warning, border: `1px solid ${T.warning}44` }}>
              데모 데이터
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, color: T.textSecondary }}>
            {vehicle.fullName} · SOC {batterySOC}%
          </span>
          <button onClick={toggleTheme} style={{ padding: '6px 14px', border: `1px solid ${T.border}`, borderRadius: 6, background: 'transparent', color: T.textSecondary, cursor: 'pointer', fontSize: 12, fontFamily: FONT }}>
            {themeName === 'dark' ? '☀ 라이트' : '🌙 다크'}
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
      <div style={{ height: zoneH, overflowY: 'auto', padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* A. DECISION HERO */}
        <div style={{
          padding: '20px 24px',
          background: cfg.color + '0e',
          border: `1.5px solid ${cfg.color}40`,
          borderRadius: 14,
          display: 'flex', alignItems: 'flex-start', gap: 20,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            background: cfg.color + '22', border: `2px solid ${cfg.color}50`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, color: cfg.color, lineHeight: 1,
          }}>
            {cfg.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5 }}>
              결정 결과
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: cfg.color, lineHeight: 1.1, marginBottom: 8, letterSpacing: '-0.02em' }}>
              {loading ? '분석 중...' : cfg.title}
            </div>
            {!loading && (
              <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.55 }}>{reasonText}</div>
            )}
          </div>
          {!loading && summary?.warningMessage && (
            <div style={{
              fontSize: 10, color: T.warning, lineHeight: 1.5, maxWidth: 220, flexShrink: 0,
              padding: '8px 12px', background: T.warning + '10',
              border: `1px solid ${T.warning}30`, borderRadius: 8,
            }}>
              ⚠ {summary.warningMessage}
            </div>
          )}
        </div>

        {/* B. DECISION REASONS */}
        {!loading && reasons.length > 0 && (
          <div style={{ background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, padding: '14px 18px' }}>
            <SectionLabel T={T}>결정 근거</SectionLabel>
            <div>
              {reasons.map((r, i) => (
                <ReasonRow key={i} icon={r.icon} ok={r.ok} text={r.text} T={T} />
              ))}
            </div>
          </div>
        )}

        {/* C. KEY METRICS */}
        {!loading && (
          <div style={{ display: 'flex', gap: 10 }}>
            <MetricCard
              label="총 경로 거리"
              value={route?.distanceKm ?? '-'}
              unit="km"
              context={route?.isRoadRoute ? '실도로 기준' : '직선 거리 추정'}
              accent={T.accent}
              T={T}
            />
            <MetricCard
              label="예상 소비량"
              value={energy?.estimatedConsumptionKwh ?? '-'}
              unit="kWh"
              context={appliedEff != null ? `전비 ${appliedEff} km/kWh 기준` : '기본 전비 기준'}
              T={T}
            />
            <MetricCard
              label={decisionStatus === 'charge-required' ? '충전 전 예상 도착 SOC' : '예상 도착 SOC'}
              value={energy?.remainingSOC != null ? `${energy.remainingSOC}` : '-'}
              unit="%"
              context={decisionStatus === 'charge-required' ? '충전 없이 배송 시 기준' : vehicle?.batteryCapacityKwh ? `배터리 ${vehicle.batteryCapacityKwh} kWh 기준` : null}
              accent={energy?.remainingSOC != null && energy.remainingSOC < 20 ? T.danger : null}
              T={T}
            />
            {decisionStatus === 'charge-required' && chargePlanData ? (
              <MetricCard
                label="필요 충전량"
                value={chargePlanData.chargeAmountKwh ?? '-'}
                unit="kWh"
                context={chargePlanData.chargeTimeMin ? `약 ${chargePlanData.chargeTimeMin}분 충전` : null}
                accent={T.warning}
                T={T}
              />
            ) : (
              <MetricCard
                label="주행 가능 거리"
                value={snapshot?.estimatedRangeKm ?? snapshot?.drivableRangeKm ?? '-'}
                unit="km"
                context={`현재 SOC ${batterySOC}% 기준`}
                T={T}
              />
            )}
            {decisionStatus === 'charge-required' && chargePlanData?.finalDeliverySOC != null && (
              <MetricCard
                label="충전 후 예상 도착 SOC"
                value={chargePlanData.finalDeliverySOC}
                unit="%"
                context="최소 도착 SOC 기준 충족"
                accent={T.success}
                T={T}
              />
            )}
          </div>
        )}

        {/* D. ROUTE HEALTH */}
        {!loading && (
          <div style={{ background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, padding: '14px 18px' }}>
            <SectionLabel T={T}>경로 건강 점수</SectionLabel>
            <HealthBar score={healthScore} deductions={deductions} T={T} />
          </div>
        )}

        {/* E. NEXT ACTION */}
        {!loading && (
          <div style={{ background: T.surface, borderRadius: 12, border: `1px solid ${cfg.color}30`, padding: '14px 18px' }}>
            <SectionLabel T={T}>다음 액션</SectionLabel>
            <div style={{ display: 'flex', gap: 10 }}>
              {nextActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => navigate('/mvp-6')}
                  style={{
                    flex: 1, minHeight: 52, padding: '0 18px',
                    borderRadius: 10, border: action.primary ? 'none' : `1px solid ${T.border}`,
                    background: action.primary ? cfg.color : 'transparent',
                    color: action.primary ? '#fff' : T.textSecondary,
                    fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* F. COLLAPSIBLE DETAILS */}
        <div>
          <button
            onClick={() => setShowDetails(v => !v)}
            style={{
              width: '100%', padding: '9px 14px', border: `1px solid ${T.border}`,
              borderRadius: 8, background: 'transparent', color: T.textSecondary,
              cursor: 'pointer', fontSize: 11, fontFamily: FONT,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <span>상세 분석 (전비 · 신뢰도 · 배송 최적화)</span>
            <span>{showDetails ? '▲ 숨기기' : '▼ 펼치기'}</span>
          </button>

          {showDetails && (
            <div style={{
              marginTop: 8, background: T.surface,
              border: `1px solid ${T.border}`, borderRadius: 10,
              padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 16,
            }}>

              {/* Efficiency */}
              <div>
                <SectionLabel T={T}>전비 비교</SectionLabel>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontSize: 9, color: T.textSecondary, marginBottom: 3 }}>차량 기본 전비</div>
                    <div style={{ fontSize: 18, fontWeight: 400, color: T.textSecondary }}>{defaultEff ?? '-'}</div>
                    <div style={{ fontSize: 9, color: T.textSecondary }}>km/kWh</div>
                  </div>
                  <span style={{ fontSize: 14, color: T.border, marginBottom: 4 }}>→</span>
                  <div>
                    <div style={{ fontSize: 9, color: T.accent, marginBottom: 3 }}>적용 전비</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: T.accent }}>{appliedEff ?? '-'}</div>
                    <div style={{ fontSize: 9, color: T.textSecondary }}>km/kWh</div>
                  </div>
                  {isPersonalized && (
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, marginBottom: 2, alignSelf: 'flex-end', background: T.success + '18', border: `1px solid ${T.success}40`, color: T.success, fontWeight: 600 }}>개인화</span>
                  )}
                </div>
                {userProfile && userProfile.sampleCount > 0 ? (
                  <div style={{ marginTop: 6, fontSize: 10, color: T.textSecondary }}>
                    도시 {userProfile.cityEfficiencyKmPerKwh ?? '-'} · 고속 {userProfile.highwayEfficiencyKmPerKwh ?? '-'} · 혼합 {userProfile.mixedEfficiencyKmPerKwh ?? '-'} km/kWh · {userProfile.sampleCount}샘플
                  </div>
                ) : (
                  <div style={{ marginTop: 6, fontSize: 10, color: T.textSecondary }}>학습 데이터 없음 — 차량 기본값 사용</div>
                )}
              </div>

              {/* Confidence */}
              <div>
                <SectionLabel T={T}>신뢰도</SectionLabel>
                <div style={{ fontSize: 12, color: T.text }}>
                  {{
                    none:   '데이터 없음 — 주행 기록 후 신뢰도가 높아집니다.',
                    low:    '낮음 — 샘플 수가 부족합니다.',
                    medium: '보통 — 어느 정도 학습된 데이터가 있습니다.',
                    high:   '높음 — 개인화 전비를 신뢰할 수 있습니다.',
                  }[energy?.confidenceLevel] ?? '-'}
                </div>
              </div>

              {/* Charger detail */}
              {charger && decisionStatus === 'charge-required' && (
                <div>
                  <SectionLabel T={T}>추천 충전소</SectionLabel>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 4 }}>{charger.name}</div>
                  <div style={{ fontSize: 11, color: T.textSecondary }}>
                    {charger.operator} · {charger.powerKw}kW · {charger.distKm ?? '-'} km
                    {charger.pricePerKwh != null && ` · ${charger.pricePerKwh.toLocaleString('ko-KR')}원/kWh`}
                  </div>
                  {chargePlanData && (
                    <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      {[
                        { label: '충전 시간', value: chargePlanData.chargeTimeMin, unit: '분' },
                        { label: '충전 후 도착 SOC', value: chargePlanData.finalDeliverySOC ?? chargePlanData.targetSoc, unit: '%' },
                        { label: '예상 비용', value: chargePlanData.totalExtraCost?.toLocaleString('ko-KR'), unit: '원' },
                      ].map(({ label, value, unit }) => (
                        <div key={label} style={{ padding: '8px 10px', background: T.bg, borderRadius: 6, border: `1px solid ${T.border}` }}>
                          <div style={{ fontSize: 8, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{value ?? '-'} <span style={{ fontSize: 9, color: T.textSecondary }}>{unit}</span></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Optimization */}
              {opt?.savedDistanceKm != null && (
                <div>
                  <SectionLabel T={T}>배송 순서 최적화</SectionLabel>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 9, color: T.textSecondary, marginBottom: 2 }}>최적화 전</div>
                      <div style={{ fontSize: 17, color: T.textSecondary }}>{opt.originalDistanceKm} km</div>
                    </div>
                    <span style={{ color: T.success, fontSize: 14 }}>→</span>
                    <div>
                      <div style={{ fontSize: 9, color: T.textSecondary, marginBottom: 2 }}>최적화 후</div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: T.success }}>{opt.optimizedDistanceKm} km</div>
                    </div>
                    <div style={{ padding: '6px 12px', borderRadius: 6, background: T.success + '14', border: `1px solid ${T.success}30` }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.success }}>-{opt.savedDistanceKm} km</div>
                      <div style={{ fontSize: 9, color: T.success }}>-{opt.savedPercent}%</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM BAR ───────────────────────────────────────────── */}
      <div style={{
        height: BAR, flexShrink: 0,
        borderTop: `1px solid ${T.border}`, background: T.surface,
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 14,
        overflow: 'hidden',
      }}>
        {/* Decision badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '7px 16px', borderRadius: 10, flexShrink: 0,
          background: cfg.color + '14', border: `2px solid ${cfg.color}44`,
          minWidth: 120,
        }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>{cfg.icon}</span>
          <div>
            <div style={{ fontSize: 8, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.1em' }}>결정</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: cfg.color, lineHeight: 1.2 }}>{cfg.title}</div>
          </div>
        </div>

        <div style={{ width: 1, height: 36, background: T.border, flexShrink: 0 }} />

        {/* Key stats */}
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', overflow: 'hidden' }}>
          {[
            { label: '총 거리',   value: route?.distanceKm    != null ? `${route.distanceKm} km`         : '-' },
            { label: '예상 소비', value: energy?.estimatedConsumptionKwh != null ? `${energy.estimatedConsumptionKwh} kWh` : '-' },
            { label: '잔여 SOC', value: energy?.remainingSOC  != null ? `${energy.remainingSOC}%`         : '-',
              color: energy?.remainingSOC != null && energy.remainingSOC < 20 ? T.danger : T.text },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ flexShrink: 0 }}>
              <div style={{ fontSize: 8, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: color ?? T.text }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => navigate('/mvp-6')}
          style={{
            padding: '0 22px', border: `1px solid ${cfg.color}`,
            borderRadius: 8, background: cfg.color, color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: FONT, minHeight: 44, flexShrink: 0,
          }}
        >
          운전 화면으로 돌아가기
        </button>
      </div>
    </div>
  )
}
