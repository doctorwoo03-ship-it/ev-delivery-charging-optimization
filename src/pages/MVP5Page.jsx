import { useState, useMemo, useRef, useEffect } from 'react'
import { BRANDS, VEHICLES } from '../data/vehicleData'
import { depot, deliveries as INITIAL_DELIVERIES } from '../data/sampleData'
import { CHARGERS } from '../data/chargerData'
import { calculateRouteDistance, haversineKm } from '../utils/routeUtils'
import { THEMES, getInitialTheme, FONT } from '../theme/themes'
import MapPanel from '../components/Map/MapPanel'
import { useBatteryCalculation } from '../hooks/useBatteryCalculation'
import { useChargerRecommendation } from '../hooks/useChargerRecommendation'
import { useChargingPlan } from '../hooks/useChargingPlan'

const EMPTY_CUSTOM = { name: '', batteryCapacityKwh: '', maxRangeKm: '', efficiencyKmPerKwh: '' }
const EMPTY_DEST_FORM = { name: '', lat: '', lng: '' }

const HDR = 56
const BAR = 84
const OUTER_HDR = 52

// ── HMI Typography & Touch Scale ─────────────────────────────────────────────
// Viewport-relative sizes for in-vehicle IVI/HMI readability at distance.
const HMI = {
  text: {
    micro:      'clamp(11px, 1.1vh, 14px)',
    caption:    'clamp(12px, 1.3vh, 16px)',
    body:       'clamp(14px, 1.55vh, 19px)',
    bodyStrong: 'clamp(16px, 1.8vh, 22px)',
    title:      'clamp(18px, 2.1vh, 26px)',
    metric:     'clamp(60px, 7.0vh, 88px)',
    metricUnit: 'clamp(20px, 2.6vh, 32px)',
  },
  touch: {
    small:  40,
    normal: 48,
    large:  56,
  },
}

// ── Sub-components ────────────────────────────────────────────────────────────

function VehicleImage({ src, alt, height, bg, fallback, T }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    if (fallback !== undefined) return fallback
    if (!T) return null
    return (
      <div style={{ height, background: bg || T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <svg viewBox="0 0 240 88" fill="none" style={{ width: '100%', maxWidth: 216, height: 'auto' }}>
          <rect x="15" y="18" width="155" height="50" rx="6" fill={T.surfaceSecondary} stroke={T.border} strokeWidth="1.5"/>
          <path d="M170 18 L205 18 L215 38 L215 68 L170 68 Z" fill={T.surfaceSecondary} stroke={T.border} strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M173 21 L202 21 L211 37 L173 37 Z" fill={T.surface} opacity="0.7"/>
          <rect x="22" y="24" width="42" height="24" rx="3" fill={T.surface} opacity="0.5"/>
          <rect x="70" y="24" width="42" height="24" rx="3" fill={T.surface} opacity="0.5"/>
          <rect x="118" y="24" width="42" height="24" rx="3" fill={T.surface} opacity="0.5"/>
          <line x1="0" y1="68" x2="240" y2="68" stroke={T.border} strokeWidth="0.5" opacity="0.25"/>
          <circle cx="50" cy="68" r="15" fill={T.border}/>
          <circle cx="50" cy="68" r="9" fill={T.surfaceSecondary}/>
          <circle cx="50" cy="68" r="4" fill={T.border} opacity="0.5"/>
          <circle cx="190" cy="68" r="15" fill={T.border}/>
          <circle cx="190" cy="68" r="9" fill={T.surfaceSecondary}/>
          <circle cx="190" cy="68" r="4" fill={T.border} opacity="0.5"/>
          <polygon points="96,26 88,46 95,46 86,62 106,40 98,40 107,26" fill={T.textSecondary} opacity="0.6"/>
        </svg>
      </div>
    )
  }
  return (
    <div style={{
      height, background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <img
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
      />
    </div>
  )
}

function BatteryBar({ percent, T }) {
  return (
    <div style={{ background: T.border, borderRadius: 3, height: 5, overflow: 'hidden' }}>
      <div style={{
        width: `${percent}%`,
        background: percent >= 30 ? T.success : T.danger,
        height: '100%',
        transition: 'width 0.3s',
      }} />
    </div>
  )
}

function BrandChip({ brand, selected, onClick, T }) {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        border: `1px solid ${selected ? T.accent : T.border}`,
        background: selected ? `${T.accent}1A` : 'transparent',
        borderRadius: 6,
        padding: '8px 4px',
        textAlign: 'center',
        transition: 'all 0.15s',
        userSelect: 'none',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: selected ? T.accent : T.surfaceSecondary,
        color: selected ? '#fff' : T.textSecondary,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: brand.logoText.length > 3 ? 8 : brand.logoText.length > 1 ? 10 : 13,
        fontWeight: 600, margin: '0 auto 6px',
      }}>
        {brand.logoText}
      </div>
      <div style={{ fontSize: 11, fontWeight: selected ? 600 : 400, color: selected ? T.accent : T.textSecondary }}>
        {brand.name}
      </div>
    </div>
  )
}

function ModelCard({ vehicle, selected, onClick, T }) {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        border: `1px solid ${selected ? T.accent : T.border}`,
        background: selected ? `${T.accent}12` : T.surfaceSecondary,
        borderRadius: 8,
        overflow: 'hidden',
        transition: 'all 0.15s',
        userSelect: 'none',
      }}
    >
      <VehicleImage
        src={vehicle.image}
        alt={vehicle.name}
        height={96}
        bg={selected ? `${T.accent}08` : T.bg}
        T={T}
      />
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: selected ? T.accent : T.text, marginBottom: 6, lineHeight: 1.3 }}>
          {vehicle.name}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 11, color: T.textSecondary }}>{vehicle.batteryCapacityKwh} kWh</span>
          <span style={{ fontSize: 11, color: T.textSecondary }}>{vehicle.efficiencyKmPerKwh?.toFixed(1)} km/kWh</span>
          <span style={{ fontSize: 11, color: T.textSecondary }}>최대 {vehicle.maxRangeKm} km</span>
        </div>
      </div>
    </div>
  )
}

function BottomStat({ label, value, T }) {
  return (
    <div style={{ padding: '0 8px' }}>
      <div style={{ fontSize: HMI.text.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ fontSize: HMI.text.title, fontWeight: 600, color: T.text, letterSpacing: '-0.01em' }}>{value}</div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MVP5Page() {
  // Theme
  const [themeName, setThemeName] = useState(getInitialTheme)
  const T = THEMES[themeName]
  const toggleTheme = () => {
    setThemeName(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      try { localStorage.setItem('ev-theme', next) } catch {}
      return next
    })
  }

  // View state
  const [view, setView] = useState('setup')           // 'setup' | 'cockpit'
  const [setupStep, setSetupStep] = useState('vehicle') // 'vehicle' | 'soc'

  // Vehicle state
  const [selectedBrand, setSelectedBrand] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [custom, setCustom] = useState(EMPTY_CUSTOM)
  const [soc, setSoc] = useState(80)

  // SOC edit modal (cockpit)
  const [showSocModal, setShowSocModal] = useState(false)
  const [socDraft, setSocDraft] = useState(80)

  // UI toggles
  const [routeExpanded, setRouteExpanded] = useState(false)
  const [calcExpanded, setCalcExpanded] = useState(false)
  const [showChargePlanDetail, setShowChargePlanDetail] = useState(false)

  // Delivery destinations
  const [deliveries, setDeliveries] = useState(INITIAL_DELIVERIES)

  // Destination management modal
  const [showDestModal, setShowDestModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [destForm, setDestForm] = useState(EMPTY_DEST_FORM)

  const isCustomBrand = selectedBrand === 'custom'

  const filteredVehicles = useMemo(() => {
    if (!selectedBrand || isCustomBrand) return []
    const brandName = BRANDS.find(b => b.id === selectedBrand)?.name
    return VEHICLES.filter(v => v.brand === brandName)
  }, [selectedBrand, isCustomBrand])

  const vehicle = useMemo(() => {
    if (!selectedBrand) return null
    if (isCustomBrand) {
      const capacity = parseFloat(custom.batteryCapacityKwh) || 0
      const range = parseFloat(custom.maxRangeKm) || 0
      const enteredEff = parseFloat(custom.efficiencyKmPerKwh)
      const efficiency = enteredEff > 0
        ? enteredEff
        : (capacity > 0 && range > 0) ? parseFloat((range / capacity).toFixed(1)) : 0
      return { id: 'custom', fullName: custom.name || '커스텀 차량', grade: '직접 입력', batteryCapacityKwh: capacity, maxRangeKm: range, efficiencyKmPerKwh: efficiency }
    }
    if (!selectedId) return null
    return VEHICLES.find(v => v.id === selectedId) ?? null
  }, [selectedBrand, isCustomBrand, selectedId, custom])

  const totalRouteKm = useMemo(() => parseFloat(calculateRouteDistance(depot, deliveries).toFixed(1)), [deliveries])
  const { isVehicleReady, remainingKwh, estimatedRangeKm, drivableRangeKm, canDeliver, chargeNeeded, shortageKm } = useBatteryCalculation({ vehicle, soc, totalRouteKm })

  const { recommendedCharger, depotToRecommendedChargerKm, chargerReachable, displayRouteKm, chargerWaypoint, warnChargerId } = useChargerRecommendation({ deliveries, chargeNeeded, drivableRangeKm, totalRouteKm })

  const chargePlan = useChargingPlan({ chargeNeeded, chargerReachable, recommendedCharger, depotToRecommendedChargerKm, displayRouteKm, remainingKwh, vehicle, isVehicleReady })

  // ── Map Overlay state/data ────────────────────────────────────────────────
  const overlayState = !isVehicleReady ? null
    : canDeliver ? 'canDeliver'
    : chargerReachable === true ? 'chargeNeeded'
    : chargerReachable === false ? 'unreachable'
    : null

  const overlayData = useMemo(() => {
    if (overlayState === 'canDeliver') {
      const nextSegKm = deliveries.length > 0
        ? parseFloat(haversineKm(depot.lat, depot.lng, deliveries[0].lat, deliveries[0].lng).toFixed(1))
        : 0
      return {
        nextDeliveryName: deliveries[0]?.name ?? '-',
        nextSegmentKm: nextSegKm,
        displayRouteKm,
        deliveryCount: deliveries.length,
      }
    }
    if (overlayState === 'chargeNeeded') {
      return {
        chargerName: recommendedCharger?.name ?? '',
        distKm: depotToRecommendedChargerKm,
        chargePlan,
      }
    }
    if (overlayState === 'unreachable') {
      const shortageKmVal = parseFloat((depotToRecommendedChargerKm - estimatedRangeKm).toFixed(1))
      return {
        chargerDistKm: depotToRecommendedChargerKm,
        drivableKm: estimatedRangeKm,
        shortageKm: shortageKmVal > 0 ? shortageKmVal : 0,
        currentSoc: soc,
      }
    }
    return null
  }, [overlayState, deliveries, displayRouteKm, estimatedRangeKm, soc, recommendedCharger, depotToRecommendedChargerKm, chargePlan])

  // SOC step preview (uses local soc state)
  const socStepRange = isVehicleReady
    ? (((vehicle.batteryCapacityKwh * soc) / 100) * vehicle.efficiencyKmPerKwh).toFixed(1)
    : null

  // SOC modal draft preview
  const socDraftRange = isVehicleReady
    ? (((vehicle.batteryCapacityKwh * socDraft) / 100) * vehicle.efficiencyKmPerKwh).toFixed(1)
    : null

  function handleBrandChange(brandId) {
    setSelectedBrand(brandId)
    setSelectedId('')
    setCustom(EMPTY_CUSTOM)
  }

  function handleReset() {
    setSelectedBrand('')
    setSelectedId('')
    setCustom(EMPTY_CUSTOM)
    setSoc(80)
    setView('setup')
    setSetupStep('vehicle')
    setShowSocModal(false)
    setSocDraft(80)
    setRouteExpanded(false)
    setCalcExpanded(false)
    setShowChargePlanDetail(false)
    setDeliveries(INITIAL_DELIVERIES)
    setShowDestModal(false)
    setEditingId(null)
    setDestForm(EMPTY_DEST_FORM)
  }

  // ── Destination CRUD ──────────────────────────────────────────────────────

  function handleOpenDestModal() { setShowDestModal(true) }

  function handleCloseDestModal() {
    setShowDestModal(false)
    setEditingId(null)
    setDestForm(EMPTY_DEST_FORM)
  }

  function handleDestStartEdit(dest) {
    setEditingId(dest.id)
    setDestForm({ name: dest.name, lat: String(dest.lat), lng: String(dest.lng) })
  }

  function handleDestStartAdd() {
    setEditingId('new')
    setDestForm(EMPTY_DEST_FORM)
  }

  function handleDestSave() {
    const lat = parseFloat(destForm.lat)
    const lng = parseFloat(destForm.lng)
    if (!destForm.name.trim() || isNaN(lat) || isNaN(lng)) return
    if (editingId === 'new') {
      setDeliveries(prev => [...prev, { id: Date.now(), name: destForm.name.trim(), lat, lng }])
    } else {
      setDeliveries(prev => prev.map(d =>
        d.id === editingId ? { ...d, name: destForm.name.trim(), lat, lng } : d
      ))
    }
    setEditingId(null)
    setDestForm(EMPTY_DEST_FORM)
  }

  function handleDestDelete(id) {
    setDeliveries(prev => prev.filter(d => d.id !== id))
    if (editingId === id) { setEditingId(null); setDestForm(EMPTY_DEST_FORM) }
  }

  function handleDestCancel() { setEditingId(null); setDestForm(EMPTY_DEST_FORM) }

  const isDestFormValid = destForm.name.trim() !== '' &&
    !isNaN(parseFloat(destForm.lat)) &&
    !isNaN(parseFloat(destForm.lng))

  // ── SOC modal ─────────────────────────────────────────────────────────────

  function openSocModal() { setSocDraft(soc); setShowSocModal(true) }
  function saveSoc() { setSoc(socDraft); setShowSocModal(false) }

  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (document.getElementById('ev-pretendard')) return
    const link = document.createElement('link')
    link.id = 'ev-pretendard'
    link.rel = 'stylesheet'
    link.href = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css'
    document.head.appendChild(link)
  }, [])

  const zoneH = `calc(100vh - ${OUTER_HDR}px - ${HDR}px - ${BAR}px)`
  const battColor = soc >= 30 ? T.success : T.danger

  // ── Step indicator label ──────────────────────────────────────────────────
  const stepLabel = setupStep === 'soc' ? '3 / 3 단계' : (!selectedBrand ? '1 / 3 단계' : '2 / 3 단계')

  return (
    <div style={{
      position: 'fixed',
      top: OUTER_HDR,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: FONT,
      background: T.bg,
      color: T.text,
      overflow: 'hidden',
    }}>

      {/* ── PAGE HEADER ── */}
      <div style={{
        height: HDR, padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${T.border}`,
        background: T.surface, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: T.accent, letterSpacing: '0.1em', textTransform: 'uppercase' }}>MVP-5</span>
          <span style={{ width: 1, height: 14, background: T.border, display: 'inline-block' }} />
          <span style={{ fontSize: 14, fontWeight: 500, color: T.textSecondary }}>충전소 추천</span>
        </div>
        <button
          onClick={toggleTheme}
          style={{
            padding: '7px 16px', border: `1px solid ${T.border}`, borderRadius: 6,
            background: 'transparent', color: T.textSecondary, cursor: 'pointer',
            fontSize: 13, fontWeight: 500, fontFamily: FONT,
          }}
        >
          {themeName === 'dark' ? '☀ 라이트' : '🌙 다크'}
        </button>
      </div>

      {/* ── VIEW: SETUP ── */}
      {view === 'setup' ? (
        <div style={{
          height: zoneH, minHeight: 460,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: T.bg, overflow: 'hidden',
        }}>
          <div style={{ width: 480, maxWidth: 'calc(100% - 48px)' }}>

            {/* ── STEP 3: SOC Setup ── */}
            {setupStep === 'soc' ? (
              <>
                <div style={{ marginBottom: 6 }}>
                  <button
                    onClick={() => setSetupStep('vehicle')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', background: 'transparent',
                      border: `1px solid ${T.border}`, borderRadius: 6,
                      fontSize: 12, fontWeight: 500, color: T.textSecondary,
                      cursor: 'pointer', fontFamily: FONT,
                    }}
                  >
                    ← 차량 다시 선택
                  </button>
                </div>

                <div style={{ marginBottom: 20, marginTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: T.textSecondary, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                    {stepLabel} · 출발 전 설정
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 400, color: T.text, letterSpacing: '-0.01em' }}>현재 배터리 잔량을 설정하세요</div>
                </div>

                {/* Vehicle summary (compact) */}
                <div style={{
                  padding: '12px 16px', marginBottom: 20,
                  background: T.surface, borderRadius: 10,
                  border: `1px solid ${T.accent}50`,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: T.success, flexShrink: 0,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{vehicle?.fullName}</div>
                    <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>
                      {vehicle?.batteryCapacityKwh} kWh · {vehicle?.efficiencyKmPerKwh?.toFixed(1)} km/kWh
                    </div>
                  </div>
                </div>

                {/* SOC display */}
                <div style={{
                  background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`,
                  padding: '20px 20px 16px', marginBottom: 16,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                    현재 배터리 잔량 (SOC)
                  </div>

                  {/* Large SOC number */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 2, marginBottom: 14 }}>
                    <span style={{
                      fontSize: 72, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.03em',
                      color: soc >= 30 ? T.success : T.danger,
                    }}>{soc}</span>
                    <span style={{ fontSize: 24, color: T.textSecondary, marginBottom: 8 }}>%</span>
                  </div>

                  {/* Battery bar */}
                  <BatteryBar percent={soc} T={T} />

                  {/* Slider + number input */}
                  <div style={{ marginTop: 12 }}>
                    <input
                      type="range" min="0" max="100" value={soc}
                      onChange={e => setSoc(Number(e.target.value))}
                      style={{ width: '100%', accentColor: T.accent, cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: T.textSecondary }}>0%</span>
                      <input
                        type="number" min="0" max="100" value={soc}
                        onChange={e => setSoc(Math.min(100, Math.max(0, Number(e.target.value))))}
                        style={{
                          width: 60, padding: '5px 8px', border: `1px solid ${T.border}`, borderRadius: 5,
                          fontSize: 14, textAlign: 'center', background: T.surfaceSecondary, color: T.text, fontFamily: FONT,
                        }}
                      />
                      <span style={{ fontSize: 10, color: T.textSecondary }}>100%</span>
                    </div>
                  </div>

                  {/* Range preview */}
                  {socStepRange && (
                    <div style={{
                      marginTop: 14,
                      padding: '10px 14px',
                      background: T.surfaceSecondary, borderRadius: 8,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span style={{ fontSize: 11, color: T.textSecondary }}>예상 주행 가능 거리</span>
                      <span style={{ fontSize: 15, fontWeight: 600, color: soc >= 30 ? T.success : T.danger }}>
                        {socStepRange} km
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setView('cockpit')}
                  style={{
                    width: '100%', padding: '15px 20px',
                    background: T.accent, color: '#fff',
                    border: `1px solid ${T.accent}`,
                    borderRadius: 10, fontSize: 15, fontWeight: 600,
                    cursor: 'pointer', fontFamily: FONT, transition: 'background 0.15s',
                  }}
                >
                  경로 분석 시작 →
                </button>
              </>

            ) : !selectedBrand ? (

              /* ── STEP 1: Brand selection ── */
              <>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: T.textSecondary, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                    {stepLabel} · 출발 전 설정
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 400, color: T.text, letterSpacing: '-0.01em' }}>브랜드를 선택하세요</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {BRANDS.map(brand => (
                    <BrandChip key={brand.id} brand={brand} selected={false} onClick={() => handleBrandChange(brand.id)} T={T} />
                  ))}
                </div>
              </>

            ) : (

              /* ── STEP 2: Model / Custom ── */
              <>
                <div style={{ marginBottom: 20 }}>
                  <button
                    onClick={() => handleBrandChange('')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', background: 'transparent',
                      border: `1px solid ${T.border}`, borderRadius: 6,
                      fontSize: 12, fontWeight: 500, color: T.textSecondary,
                      cursor: 'pointer', fontFamily: FONT,
                    }}
                  >
                    ← 브랜드 다시 선택
                  </button>
                </div>

                {isCustomBrand ? (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: T.textSecondary, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                        {stepLabel} · 직접 입력
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 400, color: T.text, letterSpacing: '-0.01em' }}>차량 정보를 입력하세요</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 14 }}>
                      {[
                        { field: 'name', label: '차량명', type: 'text', placeholder: '예) 테슬라 세미' },
                        { field: 'batteryCapacityKwh', label: '배터리 용량 (kWh)', type: 'number', placeholder: '예) 100' },
                        { field: 'maxRangeKm', label: '1충전 주행거리 (km)', type: 'number', placeholder: '예) 300' },
                        { field: 'efficiencyKmPerKwh', label: '전비 (km/kWh)', type: 'number', placeholder: '자동 계산' },
                      ].map(({ field, label, type, placeholder }) => (
                        <label key={field} style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: T.textSecondary, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {label}
                          <input
                            type={type} placeholder={placeholder} value={custom[field]}
                            onChange={e => setCustom(prev => ({ ...prev, [field]: e.target.value }))}
                            style={{
                              padding: '9px 13px', border: `1px solid ${T.border}`, borderRadius: 8,
                              fontSize: 14, background: T.surfaceSecondary, color: T.text,
                              fontFamily: FONT, textTransform: 'none', letterSpacing: 'normal',
                            }}
                          />
                        </label>
                      ))}
                      {custom.batteryCapacityKwh && custom.maxRangeKm && !custom.efficiencyKmPerKwh && (
                        <div style={{ fontSize: 12, color: T.accent, padding: '6px 11px', background: `${T.accent}18`, borderRadius: 6 }}>
                          자동 전비: {(parseFloat(custom.maxRangeKm) / parseFloat(custom.batteryCapacityKwh)).toFixed(1)} km/kWh
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: T.textSecondary, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                        {stepLabel} · {BRANDS.find(b => b.id === selectedBrand)?.name}
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 400, color: T.text, letterSpacing: '-0.01em' }}>모델을 선택하세요</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                      {filteredVehicles.map(v => (
                        <ModelCard key={v.id} vehicle={v} selected={selectedId === v.id} onClick={() => setSelectedId(v.id)} T={T} />
                      ))}
                    </div>
                  </>
                )}

                {vehicle && (
                  <div style={{
                    marginBottom: 18,
                    background: T.surface, borderRadius: 10,
                    border: `1px solid ${isVehicleReady ? T.accent + '60' : T.border}`,
                    overflow: 'hidden',
                  }}>
                    <VehicleImage
                      src={vehicle.image}
                      alt={vehicle.fullName}
                      height={80}
                      bg={T.surface}
                      T={T}
                    />
                    <div style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                        <div style={{ width: 9, height: 9, borderRadius: '50%', background: isVehicleReady ? T.success : T.warning, flexShrink: 0 }} />
                        <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{vehicle.fullName}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 24 }}>
                        <div>
                          <div style={{ fontSize: 10, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>배터리</div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{vehicle.batteryCapacityKwh} kWh</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>전비</div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{vehicle.efficiencyKmPerKwh?.toFixed(1)} km/kWh</div>
                        </div>
                        {vehicle.maxRangeKm > 0 && (
                          <div>
                            <div style={{ fontSize: 10, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>최대 항속</div>
                            <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{vehicle.maxRangeKm} km</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setSetupStep('soc')}
                  disabled={!isVehicleReady}
                  style={{
                    width: '100%', padding: '15px 20px',
                    background: isVehicleReady ? T.accent : T.surfaceSecondary,
                    color: isVehicleReady ? '#fff' : T.textSecondary,
                    border: `1px solid ${isVehicleReady ? T.accent : T.border}`,
                    borderRadius: 10, fontSize: 15, fontWeight: 600,
                    cursor: isVehicleReady ? 'pointer' : 'not-allowed',
                    fontFamily: FONT, transition: 'background 0.15s',
                  }}
                >
                  {isVehicleReady ? '다음: 배터리 설정 →' : '차량을 선택하세요'}
                </button>
              </>
            )}
          </div>
        </div>

      ) : (

        /* ── VIEW: COCKPIT ── */
        <div style={{
          display: 'grid',
          gridTemplateColumns: '30% 70%',
          height: zoneH,
          minHeight: 500,
          overflow: 'hidden',
        }}>

          {/* ══════════════════════════════════════════════
              LEFT: Integrated Vehicle Status Cluster
          ══════════════════════════════════════════════ */}
          <div style={{
            borderRight: `1px solid ${T.border}`,
            overflowY: 'auto',
            background: T.surface,
            display: 'flex',
            flexDirection: 'column',
          }}>

            {/* ── INTEGRATED CLUSTER PANEL ── */}
            <div style={{
              margin: '16px 16px 0',
              borderRadius: 12,
              background: T.bg,
              border: `1px solid ${T.border}`,
              overflow: 'hidden',
              flexShrink: 0,
            }}>

              {/* Panel header: vehicle name + status badge */}
              <div style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${T.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: HMI.text.title, fontWeight: 600, color: T.text, lineHeight: 1.2 }}>{vehicle?.fullName}</div>
                  <div style={{ fontSize: HMI.text.caption, color: T.textSecondary, marginTop: 2 }}>{vehicle?.grade}</div>
                </div>
                <div style={{
                  padding: '4px 11px', borderRadius: 20,
                  background: canDeliver ? `${T.success}18` : chargerReachable ? `${T.warning}18` : `${T.danger}18`,
                  border: `1px solid ${canDeliver ? T.success + '40' : chargerReachable ? T.warning + '40' : T.danger + '40'}`,
                  fontSize: HMI.text.caption, fontWeight: 600,
                  color: canDeliver ? T.success : chargerReachable ? T.warning : T.danger,
                  flexShrink: 0, marginLeft: 8,
                }}>
                  {canDeliver ? '배송 가능' : chargerReachable ? '충전 경유 필요' : '충전소 도달 불가'}
                </div>
              </div>

              {/* Gauge row: Battery % | Remaining range km */}
              <div style={{ padding: '16px 16px 0' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: HMI.text.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 6 }}>배터리</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                      <span style={{
                        fontSize: HMI.text.metric, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.03em',
                        color: soc >= 30 ? T.success : T.danger,
                      }}>{soc}</span>
                      <span style={{ fontSize: HMI.text.metricUnit, color: T.textSecondary, marginBottom: 7 }}>%</span>
                    </div>
                  </div>
                  <div style={{ width: 1, background: T.border, alignSelf: 'stretch', margin: '4px 0' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: HMI.text.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 6 }}>주행 가능</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                      <span style={{
                        fontSize: HMI.text.metric, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.03em',
                        color: canDeliver ? T.success : T.danger,
                      }}>{estimatedRangeKm}</span>
                      <span style={{ fontSize: HMI.text.metricUnit, color: T.textSecondary, marginBottom: 7 }}>km</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vehicle image / silhouette */}
              <div style={{ padding: '8px 16px 4px' }}>
                <VehicleImage
                  src={vehicle?.image}
                  alt={vehicle?.fullName}
                  height={72}
                  bg={T.bg}
                  fallback={
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <svg viewBox="0 0 240 88" fill="none" style={{ width: '100%', maxWidth: 216, height: 'auto' }}>
                        <rect x="15" y="18" width="155" height="50" rx="6" fill={T.surfaceSecondary} stroke={T.border} strokeWidth="1.5"/>
                        <path d="M170 18 L205 18 L215 38 L215 68 L170 68 Z" fill={T.surfaceSecondary} stroke={T.border} strokeWidth="1.5" strokeLinejoin="round"/>
                        <path d="M173 21 L202 21 L211 37 L173 37 Z" fill={T.surface} opacity="0.7"/>
                        <rect x="22" y="24" width="42" height="24" rx="3" fill={T.surface} opacity="0.5"/>
                        <rect x="70" y="24" width="42" height="24" rx="3" fill={T.surface} opacity="0.5"/>
                        <rect x="118" y="24" width="42" height="24" rx="3" fill={T.surface} opacity="0.5"/>
                        <line x1="0" y1="68" x2="240" y2="68" stroke={T.border} strokeWidth="0.5" opacity="0.25"/>
                        <circle cx="50" cy="68" r="15" fill={T.border}/>
                        <circle cx="50" cy="68" r="9" fill={T.surfaceSecondary}/>
                        <circle cx="50" cy="68" r="4" fill={T.border} opacity="0.5"/>
                        <circle cx="190" cy="68" r="15" fill={T.border}/>
                        <circle cx="190" cy="68" r="9" fill={T.surfaceSecondary}/>
                        <circle cx="190" cy="68" r="4" fill={T.border} opacity="0.5"/>
                        <polygon points="96,26 88,46 95,46 86,62 106,40 98,40 107,26" fill={battColor} opacity="0.85"/>
                      </svg>
                    </div>
                  }
                />
              </div>

              {/* Battery progress strip */}
              <div style={{ padding: '2px 16px 8px' }}>
                <BatteryBar percent={soc} T={T} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                  <span style={{ fontSize: HMI.text.caption, color: T.textSecondary }}>{remainingKwh} kWh 남음</span>
                  <span style={{ fontSize: HMI.text.caption, color: chargeNeeded ? T.danger : T.success }}>
                    {chargeNeeded
                      ? `${shortageKm} km 부족`
                      : `+${(parseFloat(estimatedRangeKm) - totalRouteKm).toFixed(1)} km 여유`}
                  </span>
                </div>
              </div>

              {/* Battery edit button — replaces the permanent SOC slider */}
              <div style={{ padding: '8px 16px 12px', borderTop: `1px solid ${T.border}` }}>
                <button
                  onClick={openSocModal}
                  style={{
                    width: '100%',
                    minHeight: HMI.touch.small,
                    border: `1px solid ${T.border}`, borderRadius: 6,
                    background: 'transparent', color: T.textSecondary,
                    fontSize: HMI.text.body, fontWeight: 500, cursor: 'pointer', fontFamily: FONT,
                    letterSpacing: '0.02em',
                  }}
                >
                  배터리 수정
                </button>
              </div>
            </div>
            {/* ── END INTEGRATED CLUSTER PANEL ── */}

            {/* ── CHARGING NOTICE ── */}
            {chargeNeeded && (
              <div style={{
                margin: '8px 16px 0',
                padding: '8px 12px',
                background: chargerReachable ? `${T.warning}18` : `${T.danger}18`,
                border: `1px solid ${chargerReachable ? T.warning + '40' : T.danger + '40'}`,
                borderRadius: 8,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 16 }}>⚡</span>
                <div>
                  <div style={{ fontSize: HMI.text.body, fontWeight: 600, color: chargerReachable ? T.warning : T.danger }}>
                    {chargerReachable ? '충전소 경유 필요' : '충전소 도달 불가'}
                  </div>
                  <div style={{ fontSize: HMI.text.caption, color: T.textSecondary, marginTop: 1 }}>
                    {chargerReachable ? '추천 충전소 경유 후 배송 가능' : '현재 배터리로 추천 충전소까지 도달하기 어렵습니다.'}
                  </div>
                </div>
              </div>
            )}

            {/* ── CHARGER CARD ── */}
            {recommendedCharger && (
              <div style={{
                margin: '10px 16px 0',
                borderRadius: 10,
                background: T.bg,
                border: `1px solid ${!chargeNeeded ? T.border : chargerReachable ? T.accent + '80' : T.danger + '60'}`,
              }}>
                <div style={{
                  padding: '9px 14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexWrap: 'wrap', gap: 4,
                  borderBottom: `1px solid ${T.border}`,
                }}>
                  <div style={{ fontSize: HMI.text.caption, fontWeight: 600, color: !chargeNeeded ? T.textSecondary : chargerReachable ? T.accent : T.danger, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {!chargeNeeded ? '주변 충전소' : chargerReachable ? '추천 충전소' : '충전소 도달 불가'}
                  </div>
                  <div style={{
                    padding: '3px 9px', borderRadius: 20, fontSize: HMI.text.caption, fontWeight: 600,
                    flexShrink: 0,
                    background: !chargeNeeded ? T.surfaceSecondary : chargerReachable ? T.warning + '1A' : T.danger + '1A',
                    border: `1px solid ${!chargeNeeded ? T.border : chargerReachable ? T.warning + '50' : T.danger + '50'}`,
                    color: !chargeNeeded ? T.textSecondary : chargerReachable ? T.warning : T.danger,
                  }}>
                    {!chargeNeeded ? '여유 있음' : chargerReachable ? '충전 필요' : '도달 불가'}
                  </div>
                </div>
                <div style={{ padding: '10px 14px' }}>
                  <div style={{ fontSize: HMI.text.title, fontWeight: 600, color: !chargeNeeded ? T.textSecondary : chargerReachable ? T.text : T.danger, marginBottom: 8, lineHeight: 1.3 }}>
                    {recommendedCharger.name}
                  </div>
                  <div style={{ display: 'flex', gap: 14, marginBottom: 7 }}>
                    {[
                      { label: '속도', value: recommendedCharger.powerKw + 'kW', color: T.text },
                      { label: '대기', value: recommendedCharger.waitMin === 0 ? '즉시' : recommendedCharger.waitMin + '분', color: recommendedCharger.waitMin === 0 ? T.success : T.text },
                      { label: '거리', value: recommendedCharger.distKm + 'km', color: T.text },
                      { label: '슬롯', value: recommendedCharger.availableSlots + '/' + recommendedCharger.totalSlots, color: recommendedCharger.availableSlots > 0 ? T.success : T.danger },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <div style={{ fontSize: HMI.text.caption, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3, fontWeight: 500 }}>{label}</div>
                        <div style={{ fontSize: HMI.text.bodyStrong, fontWeight: 500, color }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  {!chargeNeeded && (
                    <div style={{ fontSize: HMI.text.caption, color: T.textSecondary }}>경로 인근 · 필요 시 이용</div>
                  )}
                </div>
              </div>
            )}

            {/* ── CHARGING PLAN CARD (MVP-5C) ── */}
            {chargeNeeded && chargerReachable === true && chargePlan && (
              <div style={{
                margin: '10px 16px 0',
                borderRadius: 10,
                background: T.bg,
                border: `1px solid ${T.accent}60`,
              }}>
                <div style={{
                  padding: '9px 14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  borderBottom: `1px solid ${T.border}`,
                }}>
                  <div style={{ fontSize: HMI.text.caption, fontWeight: 600, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    충전 계획
                  </div>
                  <button
                    onClick={() => setShowChargePlanDetail(e => !e)}
                    style={{
                      fontSize: HMI.text.caption, color: T.textSecondary, background: 'transparent',
                      border: 'none', cursor: 'pointer', fontFamily: FONT, padding: '2px 0',
                    }}
                  >
                    {showChargePlanDetail ? '계산 상세 숨기기 ↑' : '계산 상세 보기 ↓'}
                  </button>
                </div>

                <div style={{ padding: '12px 14px' }}>
                  {/* Key values */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
                    {[
                      { label: '목표', value: chargePlan.targetSoc, unit: '%', color: T.accent },
                      { label: '충전량', value: chargePlan.chargeAmountKwh, unit: 'kWh', color: T.text },
                      { label: '충전', value: chargePlan.chargeTimeMin, unit: '분', color: T.text },
                    ].map(({ label, value, unit, color }) => (
                      <div key={label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: HMI.text.caption, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: HMI.text.bodyStrong, fontWeight: 500, color, lineHeight: 1 }}>
                          {value}<span style={{ fontSize: HMI.text.caption, color: T.textSecondary }}>{unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Wait + total cost */}
                  <div style={{
                    padding: '8px 10px',
                    background: T.surfaceSecondary,
                    borderRadius: 6,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: HMI.text.caption, color: T.textSecondary }}>
                      대기 {recommendedCharger.waitMin}분
                    </span>
                    <span style={{ fontSize: HMI.text.body, fontWeight: 600, color: T.text }}>
                      예상 {chargePlan.totalExtraCost.toLocaleString('ko-KR')}원
                    </span>
                  </div>

                  {/* Detailed calculation (collapsed by default) */}
                  {showChargePlanDetail && (
                    <div style={{
                      marginTop: 8,
                      fontSize: HMI.text.caption, color: T.textSecondary, lineHeight: 1.9,
                      background: T.surfaceSecondary, borderRadius: 6, padding: '8px 10px',
                    }}>
                      <div>충전소까지: <span style={{ color: T.text, fontWeight: 500 }}>{depotToRecommendedChargerKm} km</span></div>
                      <div>도착 배터리: <span style={{ color: T.text, fontWeight: 500 }}>{chargePlan.batteryAtChargerKwh} kWh ({chargePlan.batteryAtChargerSoc}%)</span></div>
                      <div>충전 후 잔여 경로: <span style={{ color: T.text, fontWeight: 500 }}>{chargePlan.remainingRouteAfterChargeKm} km</span></div>
                      <div>배송 필요 에너지: <span style={{ color: T.text, fontWeight: 500 }}>{chargePlan.energyNeededAfterChargeKwh} kWh</span></div>
                      <div>안전 여유: <span style={{ color: T.text, fontWeight: 500 }}>{chargePlan.safetyBufferKwh} kWh (10 km)</span></div>
                      <div>목표 에너지: <span style={{ color: T.text, fontWeight: 500 }}>{chargePlan.targetEnergyKwh} kWh</span></div>
                      <div>충전 비용: <span style={{ color: T.text, fontWeight: 500 }}>{chargePlan.chargingCost.toLocaleString('ko-KR')}원</span></div>
                      {chargePlan.waitingCost > 0 && (
                        <div>대기 비용: <span style={{ color: T.text, fontWeight: 500 }}>{chargePlan.waitingCost.toLocaleString('ko-KR')}원</span></div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ height: 1, background: T.border, margin: '12px 0' }} />

            {/* Route list */}
            <div style={{ padding: '0 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: HMI.text.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  배송 경로 ({deliveries.length}개)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={handleOpenDestModal}
                    style={{
                      fontSize: HMI.text.caption, color: T.accent, background: 'transparent',
                      border: `1px solid ${T.accent}50`, borderRadius: 4,
                      cursor: 'pointer', padding: '4px 10px', fontFamily: FONT,
                      minHeight: HMI.touch.small,
                    }}
                  >
                    배송지 관리
                  </button>
                  {deliveries.length > 1 && (
                    <button
                      onClick={() => setRouteExpanded(e => !e)}
                      style={{
                        fontSize: HMI.text.caption, color: T.textSecondary, background: 'transparent',
                        border: 'none', cursor: 'pointer', fontFamily: FONT, padding: '2px 0',
                      }}
                    >
                      {routeExpanded ? '접기 ↑' : `+${deliveries.length - 1}개 더 ↓`}
                    </button>
                  )}
                </div>
              </div>

              {chargeNeeded && chargerReachable && recommendedCharger && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 0',
                  borderBottom: `1px solid ${T.border}`,
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: T.warning, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, flexShrink: 0,
                  }}>⚡</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: HMI.text.body, fontWeight: 500, color: T.warning, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      충전 경유 · {recommendedCharger.name}
                    </div>
                    <div style={{ fontSize: HMI.text.caption, color: T.textSecondary, marginTop: 1 }}>출발지에서</div>
                  </div>
                  <div style={{ fontSize: HMI.text.body, fontWeight: 500, color: T.warning, flexShrink: 0 }}>
                    {depotToRecommendedChargerKm} km
                  </div>
                </div>
              )}
              {deliveries.length === 0 ? (
                <div style={{ padding: '12px 0', fontSize: 12, color: T.textSecondary, textAlign: 'center' }}>
                  배송지 없음 — 배송지 관리에서 추가하세요
                </div>
              ) : (
                deliveries.slice(0, routeExpanded ? deliveries.length : 1).map((d, i) => {
                  const prev = i === 0 ? depot : deliveries[i - 1]
                  const segDist = haversineKm(prev.lat, prev.lng, d.lat, d.lng).toFixed(2)
                  const visibleCount = routeExpanded ? deliveries.length : 1
                  return (
                    <div key={d.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '6px 0',
                      borderBottom: i < visibleCount - 1 ? `1px solid ${T.border}` : 'none',
                    }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: T.accent, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 600, flexShrink: 0,
                      }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: HMI.text.body, fontWeight: 500, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {d.name}
                        </div>
                        <div style={{ fontSize: HMI.text.caption, color: T.textSecondary, marginTop: 1 }}>
                          {i === 0 ? depot.name : deliveries[i - 1].name}에서
                        </div>
                      </div>
                      <div style={{ fontSize: HMI.text.body, fontWeight: 500, color: T.text, flexShrink: 0 }}>{segDist} km</div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Calculation toggle */}
            {isVehicleReady && (
              <>
                <div style={{ height: 1, background: T.border, margin: '12px 0' }} />
                <div style={{ padding: '0 20px 16px' }}>
                  <button
                    onClick={() => setCalcExpanded(e => !e)}
                    style={{
                      width: '100%', padding: '8px 12px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      background: 'transparent',
                      border: `1px solid ${T.border}`, borderRadius: 6,
                      fontSize: HMI.text.caption, fontWeight: 500, color: T.textSecondary,
                      cursor: 'pointer', fontFamily: FONT,
                      transition: 'border-color 0.15s, color 0.15s',
                      minHeight: HMI.touch.small,
                    }}
                  >
                    {calcExpanded ? '계산식 숨기기 ↑' : '계산식 보기 ↓'}
                  </button>

                  {calcExpanded && (
                    <div style={{
                      marginTop: 8,
                      fontSize: HMI.text.caption, color: T.textSecondary, lineHeight: 1.85,
                      background: T.surfaceSecondary, borderRadius: 6, padding: '8px 10px',
                    }}>
                      <div>
                        {vehicle.batteryCapacityKwh}kWh × {soc}% ={' '}
                        <span style={{ color: T.text, fontWeight: 500 }}>{remainingKwh}kWh</span>
                      </div>
                      <div>
                        {remainingKwh}kWh × {vehicle.efficiencyKmPerKwh?.toFixed(1)} ={' '}
                        <span style={{ color: canDeliver ? T.success : T.danger, fontWeight: 500 }}>{estimatedRangeKm}km</span>
                        {' '}
                        <span style={{ color: canDeliver ? T.success : T.danger }}>
                          ({canDeliver
                            ? `+${(parseFloat(estimatedRangeKm) - totalRouteKm).toFixed(1)}km`
                            : `−${shortageKm}km`})
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── RIGHT: Wide Navigation Map Panel ── */}
          <div style={{
            display: 'flex', flexDirection: 'column',
            padding: '10px 10px 10px 6px',
            background: T.bg, overflow: 'hidden',
          }}>
            <div style={{ padding: '0 4px 8px' }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: T.textSecondary, letterSpacing: '0.08em', textTransform: 'uppercase' }}>경로 지도</span>
            </div>
            <MapPanel
              T={T} themeName={themeName}
              deliveries={deliveries} chargers={CHARGERS}
              recommendedChargerId={chargeNeeded && chargerReachable ? (recommendedCharger?.id ?? null) : null}
              chargerWaypoint={chargerWaypoint}
              warnChargerId={warnChargerId}
              overlayState={overlayState}
              overlayData={overlayData}
              onOpenSocModal={openSocModal}
              hmi={HMI}
            />
          </div>
        </div>
      )}

      {/* ── BOTTOM UTILITY BAR ── */}
      <div style={{
        height: BAR, padding: '0 24px',
        display: 'flex', alignItems: 'center', gap: 0,
        background: T.surface,
        borderTop: `1px solid ${T.border}`,
        boxShadow: `inset 0 1px 0 ${T.accent}35`,
        flexShrink: 0,
      }}>
        {view === 'setup' ? (
          <>
            <span style={{ fontSize: HMI.text.body, color: T.textSecondary }}>경로: {totalRouteKm} km · 배송지 {deliveries.length}개</span>
            <div style={{ flex: 1 }} />
            {setupStep === 'soc' ? (
              <button
                onClick={() => setView('cockpit')}
                style={{
                  padding: '0 28px', border: 'none', borderRadius: 6,
                  background: T.accent, color: '#fff',
                  fontSize: HMI.text.bodyStrong, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
                  minHeight: HMI.touch.normal,
                }}
              >
                경로 분석 시작 →
              </button>
            ) : (
              <button
                onClick={() => setSetupStep('soc')}
                disabled={!isVehicleReady}
                style={{
                  padding: '0 28px', border: 'none', borderRadius: 6,
                  background: isVehicleReady ? T.accent : T.surfaceSecondary,
                  color: isVehicleReady ? '#fff' : T.textSecondary,
                  fontSize: HMI.text.bodyStrong, fontWeight: 600,
                  cursor: isVehicleReady ? 'pointer' : 'not-allowed', fontFamily: FONT,
                  minHeight: HMI.touch.normal,
                }}
              >
                {isVehicleReady ? '다음: 배터리 설정 →' : '차량을 선택하세요'}
              </button>
            )}
          </>
        ) : (
          <>
            <BottomStat label="총 경로" value={`${displayRouteKm} km`} T={T} />
            <div style={{ width: 1, height: 40, background: T.border, margin: '0 12px' }} />
            <BottomStat label="배송지" value={`${deliveries.length}개`} T={T} />
            <div style={{ width: 1, height: 40, background: T.border, margin: '0 12px' }} />
            <BottomStat label="주행 가능" value={`${estimatedRangeKm} km`} T={T} />
            <div style={{ width: 1, height: 40, background: T.border, margin: '0 16px' }} />
            <div style={{
              padding: '8px 18px', borderRadius: 20,
              background: canDeliver ? `${T.success}18` : chargerReachable ? `${T.warning}18` : `${T.danger}18`,
              border: `1px solid ${canDeliver ? T.success + '60' : chargerReachable ? T.warning + '60' : T.danger + '60'}`,
              fontSize: HMI.text.bodyStrong, fontWeight: 600,
              color: canDeliver ? T.success : chargerReachable ? T.warning : T.danger,
            }}>
              {canDeliver ? '배송 가능' : chargerReachable ? '충전 경유 필요' : '충전소 도달 불가'}
            </div>
            <div style={{ flex: 1 }} />
            <button
              disabled
              title="MVP-6에서 구현 예정"
              style={{
                padding: '0 22px', border: `1px solid ${T.border}`, borderRadius: 6,
                background: 'transparent', color: T.textSecondary,
                fontSize: HMI.text.body, fontWeight: 500, cursor: 'not-allowed', opacity: 0.4, fontFamily: FONT,
                marginRight: 8, minHeight: HMI.touch.normal,
              }}
            >
              경로 최적화
            </button>
            <button
              onClick={handleReset}
              style={{
                padding: '0 22px', border: `1px solid ${T.border}`, borderRadius: 6,
                background: T.surface, color: T.text,
                fontSize: HMI.text.body, fontWeight: 500, cursor: 'pointer', fontFamily: FONT,
                minHeight: HMI.touch.normal,
              }}
            >
              초기화
            </button>
          </>
        )}
      </div>

      {/* ── DESTINATION MANAGEMENT MODAL ── */}
      {showDestModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) handleCloseDestModal() }}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{
            width: 440, maxHeight: '82vh',
            background: T.surface, borderRadius: 16,
            border: `1px solid ${T.border}`,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '18px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: `1px solid ${T.border}`, flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>배송지 관리</div>
                <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>
                  {deliveries.length}개 배송지 · 총 {displayRouteKm} km
                </div>
              </div>
              <button
                onClick={handleCloseDestModal}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: T.surfaceSecondary, border: `1px solid ${T.border}`,
                  fontSize: 20, color: T.textSecondary, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT,
                  lineHeight: 1,
                }}
              >×</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {deliveries.length === 0 && editingId !== 'new' && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: T.textSecondary, fontSize: 13 }}>
                  배송지가 없습니다
                </div>
              )}

              {deliveries.map((d, i) => (
                <div key={d.id} style={{
                  background: T.bg, borderRadius: 10,
                  border: `1px solid ${editingId === d.id ? T.accent : T.border}`,
                  marginBottom: 8, overflow: 'hidden', transition: 'border-color 0.15s',
                }}>
                  {editingId === d.id ? (
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                        배송지 {i + 1} 편집
                      </div>
                      {[
                        { key: 'name', label: '배송지 이름', type: 'text', placeholder: '예) 강남역' },
                        { key: 'lat', label: '위도 (Lat)', type: 'number', placeholder: '예) 37.4979' },
                        { key: 'lng', label: '경도 (Lng)', type: 'number', placeholder: '예) 127.0276' },
                      ].map(({ key, label, type, placeholder }) => (
                        <div key={key} style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 10, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, fontWeight: 500 }}>{label}</div>
                          <input
                            type={type} value={destForm[key]}
                            onChange={e => setDestForm(prev => ({ ...prev, [key]: e.target.value }))}
                            placeholder={placeholder}
                            style={{
                              width: '100%', padding: '10px 12px', borderRadius: 6, boxSizing: 'border-box',
                              border: `1px solid ${T.border}`, background: T.surfaceSecondary,
                              color: T.text, fontSize: 14, fontFamily: FONT,
                            }}
                          />
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button onClick={handleDestSave} disabled={!isDestFormValid} style={{
                          flex: 1, padding: '11px 0', borderRadius: 6, border: 'none',
                          background: isDestFormValid ? T.accent : T.surfaceSecondary,
                          color: isDestFormValid ? '#fff' : T.textSecondary,
                          fontSize: 13, fontWeight: 600,
                          cursor: isDestFormValid ? 'pointer' : 'not-allowed', fontFamily: FONT,
                        }}>저장</button>
                        <button onClick={handleDestCancel} style={{
                          padding: '11px 18px', borderRadius: 6,
                          border: `1px solid ${T.border}`, background: 'transparent',
                          color: T.textSecondary, fontSize: 13, cursor: 'pointer', fontFamily: FONT,
                        }}>취소</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: T.accent, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 600, flexShrink: 0,
                      }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: T.text, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {d.name}
                        </div>
                        <div style={{ fontSize: 11, color: T.textSecondary }}>{d.lat.toFixed(4)}, {d.lng.toFixed(4)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => handleDestStartEdit(d)} style={{
                          padding: '7px 14px', borderRadius: 6,
                          border: `1px solid ${T.border}`, background: 'transparent',
                          color: T.textSecondary, fontSize: 12, cursor: 'pointer', fontFamily: FONT,
                        }}>편집</button>
                        <button onClick={() => handleDestDelete(d.id)} style={{
                          padding: '7px 12px', borderRadius: 6,
                          border: `1px solid ${T.danger}40`, background: `${T.danger}10`,
                          color: T.danger, fontSize: 12, cursor: 'pointer', fontFamily: FONT,
                        }}>삭제</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {editingId === 'new' ? (
                <div style={{ background: T.bg, borderRadius: 10, border: `1px solid ${T.accent}`, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>새 배송지</div>
                    {[
                      { key: 'name', label: '배송지 이름', type: 'text', placeholder: '예) 강남역' },
                      { key: 'lat', label: '위도 (Lat)', type: 'number', placeholder: '예) 37.4979' },
                      { key: 'lng', label: '경도 (Lng)', type: 'number', placeholder: '예) 127.0276' },
                    ].map(({ key, label, type, placeholder }) => (
                      <div key={key} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, fontWeight: 500 }}>{label}</div>
                        <input
                          type={type} value={destForm[key]}
                          onChange={e => setDestForm(prev => ({ ...prev, [key]: e.target.value }))}
                          placeholder={placeholder}
                          style={{
                            width: '100%', padding: '10px 12px', borderRadius: 6, boxSizing: 'border-box',
                            border: `1px solid ${T.border}`, background: T.surfaceSecondary,
                            color: T.text, fontSize: 14, fontFamily: FONT,
                          }}
                        />
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button onClick={handleDestSave} disabled={!isDestFormValid} style={{
                        flex: 1, padding: '11px 0', borderRadius: 6, border: 'none',
                        background: isDestFormValid ? T.accent : T.surfaceSecondary,
                        color: isDestFormValid ? '#fff' : T.textSecondary,
                        fontSize: 13, fontWeight: 600,
                        cursor: isDestFormValid ? 'pointer' : 'not-allowed', fontFamily: FONT,
                      }}>추가</button>
                      <button onClick={handleDestCancel} style={{
                        padding: '11px 18px', borderRadius: 6,
                        border: `1px solid ${T.border}`, background: 'transparent',
                        color: T.textSecondary, fontSize: 13, cursor: 'pointer', fontFamily: FONT,
                      }}>취소</button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleDestStartAdd}
                  style={{
                    width: '100%', padding: '14px',
                    border: `1px dashed ${T.border}`, borderRadius: 10,
                    background: 'transparent', color: T.textSecondary,
                    fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: FONT,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxSizing: 'border-box',
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
                  배송지 추가
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SOC EDIT MODAL ── */}
      {showSocModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowSocModal(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{
            width: 320,
            background: T.surface, borderRadius: 16,
            border: `1px solid ${T.border}`,
            overflow: 'hidden',
          }}>
            {/* Modal header */}
            <div style={{
              padding: '16px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: `1px solid ${T.border}`,
            }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>배터리 잔량 수정</div>
              <button
                onClick={() => setShowSocModal(false)}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: T.surfaceSecondary, border: `1px solid ${T.border}`,
                  fontSize: 18, color: T.textSecondary, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: FONT, lineHeight: 1,
                }}
              >×</button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '20px' }}>
              {/* Large SOC number */}
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <span style={{
                  fontSize: 60, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.03em',
                  color: socDraft >= 30 ? T.success : T.danger,
                }}>{socDraft}</span>
                <span style={{ fontSize: 20, color: T.textSecondary, verticalAlign: 'bottom', lineHeight: '2.2' }}>%</span>
              </div>

              {/* Battery bar */}
              <BatteryBar percent={socDraft} T={T} />

              {/* Slider + number input */}
              <div style={{ marginTop: 12 }}>
                <input
                  type="range" min="0" max="100" value={socDraft}
                  onChange={e => setSocDraft(Number(e.target.value))}
                  style={{ width: '100%', accentColor: T.accent, cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: T.textSecondary }}>0%</span>
                  <input
                    type="number" min="0" max="100" value={socDraft}
                    onChange={e => setSocDraft(Math.min(100, Math.max(0, Number(e.target.value))))}
                    style={{
                      width: 60, padding: '5px 8px', border: `1px solid ${T.border}`, borderRadius: 5,
                      fontSize: 14, textAlign: 'center', background: T.surfaceSecondary, color: T.text, fontFamily: FONT,
                    }}
                  />
                  <span style={{ fontSize: 10, color: T.textSecondary }}>100%</span>
                </div>
              </div>

              {/* Range preview */}
              {isVehicleReady && (
                <div style={{
                  marginTop: 14, padding: '10px 14px',
                  background: T.surfaceSecondary, borderRadius: 8,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 11, color: T.textSecondary }}>예상 주행 가능</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: socDraft >= 30 ? T.success : T.danger }}>
                    {socDraftRange} km
                  </span>
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  onClick={saveSoc}
                  style={{
                    flex: 1, padding: '12px 0', border: 'none', borderRadius: 8,
                    background: T.accent, color: '#fff',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
                  }}
                >
                  저장
                </button>
                <button
                  onClick={() => setShowSocModal(false)}
                  style={{
                    padding: '12px 20px', borderRadius: 8,
                    border: `1px solid ${T.border}`, background: 'transparent',
                    color: T.textSecondary, fontSize: 14, cursor: 'pointer', fontFamily: FONT,
                  }}
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
