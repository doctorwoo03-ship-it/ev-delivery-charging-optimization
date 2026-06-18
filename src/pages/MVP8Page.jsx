import { useState, useMemo, useEffect, useRef } from 'react'
import { BRANDS, VEHICLES } from '../data/vehicleData'
import { depot, deliveries as INITIAL_DELIVERIES } from '../data/sampleData'
import { fetchPublicChargers } from '../services/chargerService'
import { calculateRouteDistance, haversineKm } from '../utils/routeUtils'
import { optimizeDeliveryOrder } from '../utils/routeOptimizationUtils'
import { THEMES, getInitialTheme, FONT } from '../theme/themes'
import MapPanel from '../components/Map/MapPanel'
import { loadKakaoServices } from '../utils/kakaoMapLoader'
import { useBatteryCalculation } from '../hooks/useBatteryCalculation'
import { useChargerRecommendation } from '../hooks/useChargerRecommendation'
import { useChargingPlan } from '../hooks/useChargingPlan'
import { analyzeRoute } from '../services/routeIntelligenceService'
import { getDeliveryRoute, getChargerRoute } from '../services/kakaoDirectionsService'
import { saveUserMinReserveSoc, loadUserMinReserveSoc } from '../state/driverSessionStore'
import { saveMvp8Session, loadMvp8Session, clearMvp8Session } from '../services/mvp8SessionStore'
import { isValidRoadRouteResult } from '../utils/routeValidation'
import EVIntelligencePanel from '../components/EVIntelligencePanel'

// ── Public charger cache (MVP-8 only, 10-min TTL, sessionStorage) ─────────────
const CHARGER_CACHE_KEY = 'ev-mvp8-public-charger-cache'
const CHARGER_CACHE_TTL_MS = 10 * 60 * 1000

function loadChargerCache(lat, lng) {
  try {
    const raw = sessionStorage.getItem(CHARGER_CACHE_KEY)
    if (!raw) return null
    const c = JSON.parse(raw)
    if (!c.fetchedAt || Date.now() - c.fetchedAt > CHARGER_CACHE_TTL_MS) return null
    if (Math.abs(c.lat - lat) > 1.0 || Math.abs(c.lng - lng) > 1.0) return null
    return c
  } catch { return null }
}

function saveChargerCache(result, lat, lng) {
  try {
    sessionStorage.setItem(CHARGER_CACHE_KEY, JSON.stringify({
      chargers: result.chargers, endpoint: result.endpoint ?? null,
      source: result.source, fetchedAt: Date.now(), lat, lng,
    }))
  } catch {}
}

function clearChargerCache() {
  try { sessionStorage.removeItem(CHARGER_CACHE_KEY) } catch {}
}

// Simulate per-leg SOC across the full delivery route using haversine distances.
// Returns array of { fromIndex, toIndex, legKm, departureSoc, arrivalSoc } or null.
// fromIndex=-1 means startPoint; toIndex=i means deliveries[i].
function simulateLegSOCs(vehicle, socPct, startPoint, deliveries, safetyThreshold = 5, minReserveSoc = 10) {
  if (!vehicle?.batteryCapacityKwh || !vehicle?.efficiencyKmPerKwh || !deliveries?.length) return null
  const waypoints = [startPoint, ...deliveries]
  const legs = []
  let currentSoc = socPct
  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i], to = waypoints[i + 1]
    const legKm = haversineKm(from.lat, from.lng, to.lat, to.lng)
    const energyUsedKwh = legKm / vehicle.efficiencyKmPerKwh
    const socDrop = (energyUsedKwh / vehicle.batteryCapacityKwh) * 100
    const arrivalSoc = currentSoc - socDrop
    const clampedArrival = Math.max(0, arrivalSoc)
    legs.push({
      fromIndex: i - 1, toIndex: i, legKm,
      departureSoc: currentSoc, arrivalSoc,
      energyUsedKwh: parseFloat(energyUsedKwh.toFixed(2)),
      remainingRangeKm: parseFloat((clampedArrival / 100 * vehicle.batteryCapacityKwh * vehicle.efficiencyKmPerKwh).toFixed(1)),
      belowMinReserve: arrivalSoc < minReserveSoc,
      belowSafetySoc:  arrivalSoc < safetyThreshold,
    })
    currentSoc = clampedArrival
  }
  return legs
}

const SAFETY_SOC = 5

const defaultStartPoint = { id: 'depot', name: depot.name, lat: depot.lat, lng: depot.lng, address: '' }
const EMPTY_CUSTOM = { name: '', batteryCapacityKwh: '', maxRangeKm: '', efficiencyKmPerKwh: '' }
const EMPTY_FORM = { name: '', lat: '', lng: '', address: '' }

const OUTER_HDR = 52
const HDR = 56
const BAR = 72
const HMI = {
  text: {
    micro:      'clamp(11px, 1.1vh, 14px)',
    caption:    'clamp(12px, 1.3vh, 16px)',
    body:       'clamp(14px, 1.55vh, 19px)',
    bodyStrong: 'clamp(16px, 1.8vh, 22px)',
    title:      'clamp(18px, 2.1vh, 26px)',
    metric:     'clamp(52px, 6.0vh, 76px)',
    metricUnit: 'clamp(18px, 2.2vh, 28px)',
  },
  touch: { small: 40, normal: 48 },
}

// ── Helper components ─────────────────────────────────────────────────────────

function BatteryBar({ percent, T }) {
  return (
    <div style={{ background: T.border, borderRadius: 3, height: 5, overflow: 'hidden' }}>
      <div style={{ width: `${percent}%`, background: percent >= 30 ? T.success : T.danger, height: '100%', transition: 'width 0.3s' }} />
    </div>
  )
}

function VehicleSvg({ T }) {
  return (
    <svg viewBox="0 0 240 88" fill="none" style={{ width: '100%', maxWidth: 200, height: 'auto' }}>
      <rect x="15" y="18" width="155" height="50" rx="6" fill={T.surfaceSecondary} stroke={T.border} strokeWidth="1.5"/>
      <path d="M170 18 L205 18 L215 38 L215 68 L170 68 Z" fill={T.surfaceSecondary} stroke={T.border} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M173 21 L202 21 L211 37 L173 37 Z" fill={T.surface} opacity="0.7"/>
      <rect x="22" y="24" width="42" height="24" rx="3" fill={T.surface} opacity="0.5"/>
      <rect x="70" y="24" width="42" height="24" rx="3" fill={T.surface} opacity="0.5"/>
      <rect x="118" y="24" width="42" height="24" rx="3" fill={T.surface} opacity="0.5"/>
      <line x1="0" y1="68" x2="240" y2="68" stroke={T.border} strokeWidth="0.5" opacity="0.25"/>
      <circle cx="50" cy="68" r="15" fill={T.border}/><circle cx="50" cy="68" r="9" fill={T.surfaceSecondary}/><circle cx="50" cy="68" r="4" fill={T.border} opacity="0.5"/>
      <circle cx="190" cy="68" r="15" fill={T.border}/><circle cx="190" cy="68" r="9" fill={T.surfaceSecondary}/><circle cx="190" cy="68" r="4" fill={T.border} opacity="0.5"/>
      <polygon points="96,26 88,46 95,46 86,62 106,40 98,40 107,26" fill={T.textSecondary} opacity="0.6"/>
    </svg>
  )
}

function VehicleImage({ src, alt, T, maxWidth, maxHeight }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <VehicleSvg T={T} />
  return (
    <img
      src={src}
      alt={alt ?? ''}
      onError={() => setFailed(true)}
      style={{ maxWidth: maxWidth ?? 200, maxHeight: maxHeight ?? 88, objectFit: 'contain', display: 'block' }}
    />
  )
}

// Compact place search used in modals
function PlaceSearch({ T, value, onChange, onSearch, status, results, selected, onSelect, onClear, form, onFormChange, showAdvanced, onToggleAdvanced, isFormValid, onConfirm, onCancel, confirmLabel }) {
  const debounceRef = useRef(null)
  const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 6, boxSizing: 'border-box', border: `1px solid ${T.border}`, background: T.surfaceSecondary, color: T.text, fontSize: 13, fontFamily: FONT }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim() || value.trim().length < 2) return
    debounceRef.current = setTimeout(() => onSearch(value), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [value])

  return (
    <>
      <div style={{ display: 'flex', gap: 7, marginBottom: 8 }}>
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSearch(value)}
          placeholder="장소명 또는 주소 검색" style={{ ...inputStyle, flex: 1 }} autoFocus autoComplete="off" />
        <button onClick={() => onSearch(value)} disabled={!value.trim() || status === 'searching'}
          style={{ padding: '9px 14px', borderRadius: 6, border: 'none', background: value.trim() ? T.accent : T.surfaceSecondary, color: value.trim() ? '#fff' : T.textSecondary, fontSize: 12, fontWeight: 600, cursor: value.trim() && status !== 'searching' ? 'pointer' : 'not-allowed', fontFamily: FONT }}>
          {status === 'searching' ? '...' : '검색'}
        </button>
      </div>

      {status === 'searching' && <div style={{ fontSize: 12, color: T.textSecondary, padding: '6px 10px', background: T.surfaceSecondary, borderRadius: 6, marginBottom: 7 }}>검색 중...</div>}
      {status === 'no-results' && <div style={{ fontSize: 12, color: T.textSecondary, padding: '6px 10px', background: T.surfaceSecondary, borderRadius: 6, marginBottom: 7 }}>검색 결과가 없습니다.</div>}
      {status === 'error' && <div style={{ fontSize: 12, color: T.danger, padding: '6px 10px', background: `${T.danger}14`, borderRadius: 6, marginBottom: 7 }}>장소 검색 서비스를 불러오지 못했습니다.</div>}

      {status === 'done' && results.length > 0 && !selected && (
        <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto' }}>
          {results.map(r => (
            <div key={r.id} onClick={() => onSelect(r)}
              style={{ padding: '8px 11px', background: T.surfaceSecondary, borderRadius: 7, border: `1px solid ${T.border}`, cursor: 'pointer' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{r.name}</div>
              {r.roadAddress && <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 1 }}>{r.roadAddress}</div>}
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div style={{ marginBottom: 8, padding: '8px 11px', background: `${T.accent}12`, borderRadius: 7, border: `1px solid ${T.accent}50`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: T.accent, marginBottom: 2 }}>선택된 장소</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{selected.name}</div>
            {selected.roadAddress && <div style={{ fontSize: 11, color: T.textSecondary }}>{selected.roadAddress}</div>}
          </div>
          <button onClick={onClear} style={{ width: 24, height: 24, borderRadius: '50%', background: T.surfaceSecondary, border: `1px solid ${T.border}`, color: T.textSecondary, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, lineHeight: 1 }}>×</button>
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <button onClick={onToggleAdvanced} style={{ fontSize: 11, color: T.textSecondary, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: FONT, padding: '2px 0' }}>
          {showAdvanced ? '▲ 좌표 입력 숨기기' : '▼ 좌표 직접 입력'}
        </button>
        {showAdvanced && (
          <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {[{ key: 'name', label: '이름', type: 'text', placeholder: '예) 강남역' }, { key: 'lat', label: '위도', type: 'number', placeholder: '예) 37.4979' }, { key: 'lng', label: '경도', type: 'number', placeholder: '예) 127.0276' }].map(({ key, label, type, placeholder }) => (
              <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, color: T.textSecondary, fontWeight: 500, textTransform: 'uppercase' }}>
                {label}
                <input type={type} value={form[key]} onChange={e => onFormChange(prev => ({ ...prev, [key]: e.target.value }))} placeholder={placeholder} style={inputStyle} />
              </label>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 7 }}>
        <button onClick={onConfirm} disabled={!isFormValid}
          style={{ flex: 1, padding: '10px 0', borderRadius: 6, border: 'none', background: isFormValid ? T.accent : T.surfaceSecondary, color: isFormValid ? '#fff' : T.textSecondary, fontSize: 13, fontWeight: 600, cursor: isFormValid ? 'pointer' : 'not-allowed', fontFamily: FONT }}>
          {confirmLabel}
        </button>
        <button onClick={onCancel}
          style={{ padding: '10px 16px', borderRadius: 6, border: `1px solid ${T.border}`, background: 'transparent', color: T.textSecondary, fontSize: 13, cursor: 'pointer', fontFamily: FONT }}>
          취소
        </button>
      </div>
    </>
  )
}

// ── Decision status helpers ───────────────────────────────────────────────────

function getStatusCfg(overlayState, T) {
  return {
    canDeliver:           { color: T.success, label: '배송 가능',              icon: '✓' },
    lowMargin:            { color: T.warning, label: '배송 가능 · 여유 부족',    icon: '⚠' },
    reserveWarning:       { color: T.warning, label: '배송 가능 - 충전 권장',    icon: '⚡' },
    'predeparture-charge':{ color: T.danger,  label: '출발 전 충전 필요',         icon: '!' },
    chargeNeeded:         { color: T.warning, label: '출발 전 충전 필요',         icon: '⚡' },
    'review-candidate':   { color: T.warning, label: '충전 후보 검토 필요',       icon: '⚠' },
    'review-mid-route':   { color: T.warning, label: '경로 중 충전 검토 필요',   icon: '⚠' },
    'no-suitable-charger':{ color: T.warning, label: '출발지 인근 적합한 충전소 없음', icon: '⚠' },
    unreachable:          { color: T.danger,  label: '충전소 도달 불가',         icon: '!' },
    'api-error':          { color: T.danger,  label: '충전소 정보 재확인 필요',   icon: '!' },
    'api-empty':          { color: T.warning, label: '주변 실시간 데이터 없음',   icon: '?' },
    'no-local-data':      { color: T.warning, label: '주변 충전소 데이터 없음',   icon: '?' },
    critical:             { color: T.warning, label: 'SOC 확인 필요',            icon: '⟳' },
  }[overlayState] ?? { color: T.textSecondary, label: '분석 중', icon: 'ℹ' }
}

const INTEL_REASON = {
  ok:                    '현재 배터리로 전체 배송 경로를 완주할 수 있습니다.',
  'low-margin':          '완주 가능하지만 잔여 배터리 여유가 매우 낮습니다.',
  'reserve-warning':     '배송은 가능하지만 안전 하한 SOC 기준보다 낮게 도착합니다.',
  'charge-required':     '충전 없이는 전체 배송을 완주할 수 없습니다. 출발지 인근 충전소를 먼저 경유하세요.',
  'review-candidate':    '출발지 인근에 가까운 충전 후보가 있습니다. 출발 전 위치와 이용 가능 여부를 직접 확인하세요.',
  'review-mid-route':    '경로 중 충전 후보가 있지만 우회 거리를 직접 확인하세요.',
  'no-suitable-charger': '출발지 인근에 적합한 충전소가 없습니다. 다른 출발지 또는 운행 경로를 검토하세요.',
  unreachable:           '주행 가능 거리 내 도달할 수 있는 충전소가 없습니다.',
  'api-error':           '충전소 최신 정보를 확인하지 못했습니다. 배송 경로는 정상 표시됩니다.',
  'api-empty':           '현재 출발지 주변에 공공 API로 확인 가능한 충전소 데이터가 없습니다.',
  'no-local-data':       '현재 위치 주변에 충전소 데이터가 없습니다.',
  critical:              '배터리 상태 또는 경로 신뢰도를 점검하세요.',
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MVP8Page() {
  const [themeName, setThemeName] = useState(getInitialTheme)
  const T = THEMES[themeName]
  const toggleTheme = () => setThemeName(prev => {
    const next = prev === 'dark' ? 'light' : 'dark'
    try { localStorage.setItem('ev-theme', next) } catch {}
    return next
  })

  // ── View mode ──────────────────────────────────────────────────────────────
  const [view, setView] = useState(() => {
    const s = loadMvp8Session()
    if (!s) return 'setup'
    const hasVehicle = s.selectedBrand && (s.selectedId || s.selectedBrand === 'custom')
    if (s.view === 'cockpit' && hasVehicle && s.deliveries?.length > 0) return 'cockpit'
    return 'setup'
  })
  const [step, setStep] = useState(() => {
    const s = loadMvp8Session()
    if (!s || s.view === 'cockpit') return 1
    const n = Number(s.step)
    return n >= 1 && n <= 5 ? n : 1
  })

  // ── Vehicle ────────────────────────────────────────────────────────────────
  const [selectedBrand, setSelectedBrand] = useState(() => loadMvp8Session()?.selectedBrand ?? '')
  const [selectedId, setSelectedId] = useState(() => loadMvp8Session()?.selectedId ?? '')
  const [custom, setCustom] = useState(() => loadMvp8Session()?.custom ?? EMPTY_CUSTOM)
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
      const eff = enteredEff > 0 ? enteredEff : (capacity > 0 && range > 0) ? parseFloat((range / capacity).toFixed(1)) : 0
      return { id: 'custom', fullName: custom.name || '커스텀 차량', grade: '직접 입력', batteryCapacityKwh: capacity, maxRangeKm: range, efficiencyKmPerKwh: eff }
    }
    if (!selectedId) return null
    return VEHICLES.find(v => v.id === selectedId) ?? null
  }, [selectedBrand, isCustomBrand, selectedId, custom])

  // ── Battery ────────────────────────────────────────────────────────────────
  const [soc, setSoc] = useState(() => {
    const s = loadMvp8Session()
    const v = Number(s?.soc)
    return !isNaN(v) && v >= 0 && v <= 100 ? v : 80
  })
  const [userMinReserveSoc, setUserMinReserveSoc] = useState(() => {
    const s = loadMvp8Session()
    if (s?.userMinReserveSoc != null) {
      const v = parseInt(s.userMinReserveSoc, 10)
      if (!isNaN(v) && v >= 5 && v <= 30) return v
    }
    return loadUserMinReserveSoc()
  })

  // ── Start point ────────────────────────────────────────────────────────────
  const [startPoint, setStartPoint] = useState(() => {
    const s = loadMvp8Session()
    if (s?.startPoint?.name && s.startPoint.lat != null && s.startPoint.lng != null) return s.startPoint
    return defaultStartPoint
  })
  const [showStartModal, setShowStartModal] = useState(false)
  const [startSearch, setStartSearch] = useState('')
  const [startResults, setStartResults] = useState([])
  const [startStatus, setStartStatus] = useState('idle')
  const [startSelected, setStartSelected] = useState(null)
  const [startShowAdv, setStartShowAdv] = useState(false)
  const [startForm, setStartForm] = useState(EMPTY_FORM)
  const startSeqRef = useRef(0)

  // ── Deliveries ─────────────────────────────────────────────────────────────
  const [deliveries, setDeliveries] = useState(() => {
    const s = loadMvp8Session()
    if (Array.isArray(s?.deliveries) && s.deliveries.length > 0) return s.deliveries
    return INITIAL_DELIVERIES
  })
  const [showDestModal, setShowDestModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [destSearch, setDestSearch] = useState('')
  const [destResults, setDestResults] = useState([])
  const [destStatus, setDestStatus] = useState('idle')
  const [destSelected, setDestSelected] = useState(null)
  const [destShowAdv, setDestShowAdv] = useState(false)
  const [destForm, setDestForm] = useState(EMPTY_FORM)
  const destSeqRef = useRef(0)

  // ── Route state ────────────────────────────────────────────────────────────
  const [deliveryRoutePathResult, setDeliveryRoutePathResult] = useState(null)
  const [deliveryRouteStatus, setDeliveryRouteStatus] = useState('loading')
  const [chargerRoutePathResult, setChargerRoutePathResult] = useState(null)
  const [chargerRouteStatus, setChargerRouteStatus] = useState('idle')
  const [routeRetryCount, setRouteRetryCount] = useState(0)
  const [routeFailedLeg, setRouteFailedLeg] = useState(null)
  const [intelligenceResult, setIntelligenceResult] = useState(null)

  // ── Charger list (real public API only — no mock fallback in MVP-8) ─────────
  const [chargerList, setChargerList] = useState([])
  const [chargerLoading, setChargerLoading] = useState(false)
  const [chargerError, setChargerError] = useState(null)
  const [chargerProvider, setChargerProvider] = useState('idle')
  const [showIntelPanel, setShowIntelPanel] = useState(true)
  const [showDetailsPanel, setShowDetailsPanel] = useState(false)

  // Trigger Kakao Map relayout when EV Intelligence panel opens/closes
  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 60)
    return () => clearTimeout(t)
  }, [showDetailsPanel])
  const [chargerRetryCount, setChargerRetryCount] = useState(0)

  // ── Derived calculations ──────────────────────────────────────────────────
  const totalRouteKm = useMemo(() => parseFloat(calculateRouteDistance(startPoint, deliveries).toFixed(1)), [startPoint, deliveries])
  const { isVehicleReady, remainingKwh, estimatedRangeKm, drivableRangeKm, canDeliver, chargeNeeded } = useBatteryCalculation({ vehicle, soc, totalRouteKm })

  const roadDistanceAvailable = !deliveryRoutePathResult?.isFallback && deliveryRoutePathResult?.distanceKm != null
  const roadDeliveryKm = roadDistanceAvailable ? deliveryRoutePathResult.distanceKm : null
  const effectiveCanDeliver = roadDistanceAvailable
    ? (isVehicleReady && parseFloat(estimatedRangeKm) >= deliveryRoutePathResult.distanceKm)
    : canDeliver
  const effectiveChargeNeeded = isVehicleReady && !effectiveCanDeliver

  // ── Route-based SOC simulation & charging insertion point ─────────────────
  // Simulate per-leg SOC to find WHERE in the delivery route charging is needed,
  // rather than always defaulting to "charge before departure".
  const legSOCSimulation = useMemo(() => {
    if (!isVehicleReady || !effectiveChargeNeeded) return null
    return simulateLegSOCs(vehicle, soc, startPoint, deliveries, SAFETY_SOC, userMinReserveSoc)
  }, [isVehicleReady, effectiveChargeNeeded, vehicle, soc, startPoint, deliveries, userMinReserveSoc])

  // Compute ordered list of candidate insertion segments for pull-forward.
  // Order: [first-failing-leg, …, before-departure] — hook tries each and returns first with suitable charger.
  const insertionCandidates = useMemo(() => {
    if (!effectiveChargeNeeded || !isVehicleReady || !legSOCSimulation) return []
    const threshold = userMinReserveSoc

    const computeDrivable = (socVal) => {
      if (!vehicle?.batteryCapacityKwh || !vehicle?.efficiencyKmPerKwh) return drivableRangeKm
      return parseFloat((Math.max(0, socVal) / 100 * vehicle.batteryCapacityKwh * vehicle.efficiencyKmPerKwh).toFixed(1))
    }

    const makeCandidate = (i) => {
      if (i === 0) {
        return {
          insertionType: 'before-departure', afterDeliveryIndex: null, beforeDeliveryIndex: 0,
          originPoint: startPoint, nextPoint: deliveries[0] ?? null,
          insertionSoc: soc, drivableRangeKm: computeDrivable(soc),
          label: '출발 전 충전 권장', type: 'before-departure', afterIndex: null,
        }
      }
      const afterDeliveryIndex  = i - 1
      const beforeDeliveryIndex = i
      const afterDeliveryNum    = i
      const beforeDeliveryNum   = i + 1
      const isLast = i === legSOCSimulation.length - 1
      const label = isLast
        ? `배송지 ${afterDeliveryNum} 이후 · 마지막 배송 전 충전 권장`
        : `배송지 ${afterDeliveryNum} 이후 · 배송지 ${beforeDeliveryNum} 전 충전 권장`
      const insertionSocVal = legSOCSimulation[i].departureSoc
      return {
        insertionType: isLast ? 'before-final' : 'after-delivery',
        afterDeliveryIndex, beforeDeliveryIndex,
        originPoint: deliveries[afterDeliveryIndex] ?? startPoint,
        nextPoint:   deliveries[beforeDeliveryIndex] ?? null,
        insertionSoc: insertionSocVal, drivableRangeKm: computeDrivable(insertionSocVal),
        label, type: isLast ? 'before-final' : 'after-delivery', afterIndex: afterDeliveryIndex,
      }
    }

    let failIdx = -1
    for (let i = 0; i < legSOCSimulation.length; i++) {
      if (legSOCSimulation[i].arrivalSoc < threshold) { failIdx = i; break }
    }

    const result = []
    if (failIdx === -1) {
      // effectiveChargeNeeded but no leg crossed threshold → before-departure only
      result.push(makeCandidate(0))
    } else {
      // From first failure back to before-departure (pull-forward order)
      for (let i = failIdx; i >= 0; i--) result.push(makeCandidate(i))
    }
    return result
  }, [effectiveChargeNeeded, isVehicleReady, legSOCSimulation, userMinReserveSoc, startPoint, deliveries, soc, vehicle, drivableRangeKm])
  // ──────────────────────────────────────────────────────────────────────────

  const chargeTargetRangeKm = useMemo(() => {
    if (!vehicle?.batteryCapacityKwh || !vehicle?.efficiencyKmPerKwh) return null
    return parseFloat((vehicle.batteryCapacityKwh * vehicle.efficiencyKmPerKwh * 0.8).toFixed(1))
  }, [vehicle])

  const minReserveRangeKm = useMemo(() => {
    if (!vehicle?.batteryCapacityKwh || !vehicle?.efficiencyKmPerKwh) return null
    return parseFloat((vehicle.batteryCapacityKwh * vehicle.efficiencyKmPerKwh * (userMinReserveSoc / 100)).toFixed(1))
  }, [vehicle, userMinReserveSoc])

  const { recommendedCharger, depotToRecommendedChargerKm, chargerReachable, displayRouteKm, chargerWaypoint, warnChargerId, scoredChargers, nearestUnreachable, recommendationMode, unreachableReason, mockCoverageWarning, selectedInsertionCandidate, beforeDepartureQuality, beforeDepartureDiagnostics, recommendationSource, insertionExplanation, midRouteQuality, hasNearbyReachableCharger, nearestRejectedDepartureCharger, nearestRejectedDepartureChargerName, nearestRejectedDepartureDistanceKm, nearestRejectedDepartureReason } = useChargerRecommendation({
    deliveries, chargeNeeded: effectiveChargeNeeded,
    // Primary candidate's drivableRangeKm for legacy scoring; each candidate carries its own
    drivableRangeKm: insertionCandidates[0]?.drivableRangeKm ?? drivableRangeKm,
    totalRouteKm, startPoint, chargers: chargerList, allowMockFallback: false,
    chargerSearchPoint: insertionCandidates[0]?.originPoint ?? startPoint,
    insertionCandidates,
    insertionOriginPoint: insertionCandidates[0]?.originPoint ?? null,
    insertionNextPoint:   insertionCandidates[0]?.nextPoint   ?? null,
    chargeTargetRangeKm,
    minReserveRangeKm,
  })

  // The actually selected insertion point after pull-forward resolution
  const chargingInsertionPoint = selectedInsertionCandidate ?? insertionCandidates[0] ?? null

  // Route distance from recommended charger through remaining deliveries (after insertion point)
  const remainingRouteFromChargerKm = useMemo(() => {
    if (!recommendedCharger || !chargingInsertionPoint) return null
    const beforeIdx = chargingInsertionPoint.beforeDeliveryIndex ?? 0
    const remainingDels = deliveries.slice(beforeIdx)
    if (remainingDels.length === 0) return 0
    const toFirst = haversineKm(recommendedCharger.lat, recommendedCharger.lng, remainingDels[0].lat, remainingDels[0].lng)
    const restKm  = remainingDels.length > 1 ? calculateRouteDistance(remainingDels[0], remainingDels.slice(1)) : 0
    return parseFloat((toFirst + restKm).toFixed(1))
  }, [recommendedCharger, chargingInsertionPoint, deliveries])
  const effectiveRouteKm = roadDeliveryKm ?? displayRouteKm

  const surplusRangeKm = parseFloat((parseFloat(estimatedRangeKm) - effectiveRouteKm).toFixed(1))
  const remainingSocAfterDelivery = (isVehicleReady && vehicle?.batteryCapacityKwh > 0 && vehicle?.efficiencyKmPerKwh > 0)
    ? parseFloat(Math.max(0, (Math.max(0, surplusRangeKm) / vehicle.efficiencyKmPerKwh / vehicle.batteryCapacityKwh) * 100).toFixed(1))
    : null

  const isLowMargin = effectiveCanDeliver && isVehicleReady && (
    (remainingSocAfterDelivery != null && remainingSocAfterDelivery < SAFETY_SOC) || surplusRangeKm < 3
  )
  const isReserveWarning = effectiveCanDeliver && isVehicleReady && !isLowMargin && (
    remainingSocAfterDelivery != null && remainingSocAfterDelivery < userMinReserveSoc
  )
  // Hard safety rule: current SOC already below safety threshold — driver must charge before departure.
  const isPreDepartureCharge = isVehicleReady && effectiveCanDeliver && soc < userMinReserveSoc

  // Safety SOC simulation for display — reuses legSOCSimulation when chargeNeeded,
  // runs separately for reserveWarning/lowMargin/predeparture-charge (vehicle can deliver but threshold violated).
  const safetySOCSimulation = useMemo(() => {
    if (legSOCSimulation) return legSOCSimulation
    if (!isVehicleReady || deliveries.length === 0) return null
    if (!isReserveWarning && !isLowMargin && !isPreDepartureCharge) return null
    return simulateLegSOCs(vehicle, soc, startPoint, deliveries, SAFETY_SOC, userMinReserveSoc)
  }, [legSOCSimulation, isVehicleReady, isReserveWarning, isLowMargin, isPreDepartureCharge, vehicle, soc, startPoint, deliveries, userMinReserveSoc])

  // Minimum SOC reached during the route.
  // Includes: current departure SOC, all haversine-based leg arrival SOCs,
  // and the road-distance-based final delivery SOC (remainingSocAfterDelivery).
  // The road-distance calc is more accurate than haversine so including it prevents
  // the minimum from being overstated when road distance > straight-line distance.
  const minRouteSocPct = useMemo(() => {
    const candidates = []
    if (soc != null) candidates.push(soc)
    if (safetySOCSimulation && safetySOCSimulation.length > 0) {
      safetySOCSimulation.forEach(l => candidates.push(l.arrivalSoc))
    }
    if (remainingSocAfterDelivery != null) candidates.push(remainingSocAfterDelivery)
    if (candidates.length === 0) return null
    return parseFloat(Math.min(...candidates).toFixed(1))
  }, [safetySOCSimulation, soc, remainingSocAfterDelivery])

  // First leg that violates userMinReserveSoc (안전 하한 SOC)
  const firstViolationLeg = useMemo(() => {
    if (!safetySOCSimulation) return null
    return safetySOCSimulation.find(l => l.belowMinReserve) ?? null
  }, [safetySOCSimulation])

  // Human-readable label for the first safety threshold violation segment.
  // When current SOC is already below threshold, violation starts at departure.
  const firstViolationLabel = useMemo(() => {
    if (soc < userMinReserveSoc) return '출발 전부터 안전 하한 SOC 미달'
    if (!firstViolationLeg) return null
    const fromIdx = firstViolationLeg.fromIndex
    const toIdx   = firstViolationLeg.toIndex
    if (fromIdx === -1) return `1번 배송 이동 중 안전 하한 SOC 미달 예상`
    return `${fromIdx + 1}번 배송 후 ${toIdx + 1}번 배송 이동 구간에서 안전 하한 SOC 미달 예상`
  }, [firstViolationLeg, soc, userMinReserveSoc])

  // Urgency mode: mandatory-charge when the vehicle cannot physically complete the route;
  // reserve-warning when it can but arrival SOC is below the user-set minimum.
  const chargingUrgencyMode = effectiveChargeNeeded
    ? 'mandatory-charge'
    : isReserveWarning
      ? 'reserve-warning'
      : null

  const chargePlan = useChargingPlan({
    chargeNeeded: effectiveChargeNeeded, chargerReachable, recommendedCharger,
    depotToRecommendedChargerKm, displayRouteKm: effectiveRouteKm,
    remainingKwh, vehicle, isVehicleReady, userMinReserveSoc,
    insertionSocPct:              chargingInsertionPoint?.insertionSoc ?? null,
    insertionToChargerKm:         recommendedCharger?.originToChargerKm ?? null,
    remainingRouteFromChargerKm,
  })

  const optimizationResult = useMemo(() => {
    if (deliveries.length < 2) return null
    return optimizeDeliveryOrder(startPoint, deliveries)
  }, [startPoint, deliveries])

  const isCurrentlyOptimal = useMemo(() => {
    if (!optimizationResult || optimizationResult.savedDistanceKm === 0) return true
    return optimizationResult.optimizedDeliveries.map(d => d.id).join(',') === deliveries.map(d => d.id).join(',')
  }, [optimizationResult, deliveries])

  const overlayState = !isVehicleReady ? null
    : isPreDepartureCharge ? 'predeparture-charge'
    : (effectiveCanDeliver && !isLowMargin && !isReserveWarning) ? 'canDeliver'
    : isLowMargin ? 'lowMargin'
    : isReserveWarning ? 'reserveWarning'
    : (effectiveChargeNeeded && chargerReachable === true && recommendationMode === 'review-candidate') ? 'review-candidate'
    : chargerReachable === true ? 'chargeNeeded'
    : recommendationMode === 'no-suitable-charger' ? 'no-suitable-charger'
    : recommendationMode === 'no-local-data'
        ? (chargerProvider === 'api-error' ? 'api-error'
          : chargerProvider === 'api-empty' ? 'api-empty'
          : 'no-local-data')
    : chargerReachable === false ? 'unreachable'
    : 'critical'

  const intel = intelligenceResult
  const intlHealthScore = intel?.summary?.routeHealthScore ?? null
  const intlConsumption = intel?.energy?.estimatedConsumptionKwh ?? null
  const intlConfidence = intel?.energy?.confidenceLevel ?? null
  const intlDecisionStatus = intel?.summary?.decisionStatus ?? null
  const battColor = soc >= 30 ? T.success : T.danger

  const overlayData = useMemo(() => {
    if (overlayState === 'canDeliver' || overlayState === 'lowMargin' || overlayState === 'reserveWarning' || overlayState === 'predeparture-charge') {
      const nextSegKm = deliveries.length > 0 ? parseFloat(haversineKm(startPoint.lat, startPoint.lng, deliveries[0].lat, deliveries[0].lng).toFixed(1)) : 0
      const gap = (overlayState === 'reserveWarning' || overlayState === 'predeparture-charge') && remainingSocAfterDelivery != null ? parseFloat((userMinReserveSoc - remainingSocAfterDelivery).toFixed(1)) : null
      const currentSocGap = overlayState === 'predeparture-charge' ? parseFloat((userMinReserveSoc - soc).toFixed(1)) : null
      return { nextDeliveryName: deliveries[0]?.name ?? '-', nextSegmentKm: nextSegKm, displayRouteKm: effectiveRouteKm, deliveryCount: deliveries.length, surplusRangeKm: Math.max(0, surplusRangeKm), remainingSocAfterDelivery, userMinReserveSoc, gap, currentSoc: soc, currentSocGap, firstViolationLabel, recommendedCharger, chargerDistKm: depotToRecommendedChargerKm }
    }
    if (overlayState === 'chargeNeeded') return {
      chargerName: recommendedCharger?.name ?? '', distKm: depotToRecommendedChargerKm,
      chargePlan, chargerOperator: recommendedCharger?.operator ?? '',
      chargerPricePerKwh: recommendedCharger?.pricePerKwh ?? null,
      recommendationReason: recommendedCharger?.recommendationReason ?? null,
      remainingSocAfterDelivery,
      firstViolationLabel,
      insertionLabel: chargingInsertionPoint?.label ?? null,
      insertionType:  chargingInsertionPoint?.insertionType ?? null,
      insertionOriginName: chargingInsertionPoint?.originPoint?.name ?? null,
      insertionNextName:   chargingInsertionPoint?.nextPoint?.name ?? null,
      detourKm:            recommendedCharger?.insertionDetourKm ?? null,
      originToChargerKm:   recommendedCharger?.originToChargerKm ?? depotToRecommendedChargerKm,
      insertionExplanation,
      recommendationSource,
      midRouteQuality,
    }
    if (overlayState === 'review-candidate') return {
      chargerName: recommendedCharger?.name ?? '',
      distKm: depotToRecommendedChargerKm,
      detourKm: recommendedCharger?.insertionDetourKm ?? null,
      originToChargerKm: recommendedCharger?.originToChargerKm ?? depotToRecommendedChargerKm,
      beforeDepartureQuality,
      beforeDepartureDiagnostics,
      hasNearbyReachableCharger,
      insertionExplanation,
      recommendationSource,
    }
    if (overlayState === 'no-suitable-charger') return {
      drivableKm: estimatedRangeKm, currentSoc: soc,
      insertionLabel: chargingInsertionPoint?.label ?? null,
      triedCandidateCount: insertionCandidates.length,
      chargerLoading,
      nearestRejectedDepartureCharger,
      nearestRejectedDepartureChargerName,
      nearestRejectedDepartureDistanceKm,
      nearestRejectedDepartureReason,
    }
    if (overlayState === 'unreachable') {
      const nearestDistKm = nearestUnreachable?.distanceFromStartKm ?? null
      return { chargerDistKm: nearestDistKm, drivableKm: estimatedRangeKm, shortageKm: nearestDistKm != null ? parseFloat(Math.max(0, nearestDistKm - parseFloat(estimatedRangeKm)).toFixed(1)) : null, currentSoc: soc }
    }
    if (overlayState === 'api-error' || overlayState === 'api-empty' || overlayState === 'no-local-data' || overlayState === 'critical')
      return { drivableKm: estimatedRangeKm, currentSoc: soc, chargerProvider, chargerLoading }
    return null
  }, [overlayState, deliveries, effectiveRouteKm, estimatedRangeKm, soc, recommendedCharger, depotToRecommendedChargerKm, chargePlan, surplusRangeKm, remainingSocAfterDelivery, nearestUnreachable, startPoint, userMinReserveSoc, chargingInsertionPoint, insertionCandidates, chargerLoading, nearestRejectedDepartureCharger, nearestRejectedDepartureChargerName, nearestRejectedDepartureDistanceKm, nearestRejectedDepartureReason, firstViolationLabel])

  const enrichedOverlayData = useMemo(() => {
    if (!overlayData || !intel) return overlayData
    if (['canDeliver', 'lowMargin', 'reserveWarning', 'predeparture-charge', 'chargeNeeded', 'review-candidate'].includes(overlayState)) {
      return { ...overlayData, estimatedConsumptionKwh: intel.energy?.estimatedConsumptionKwh ?? null, confidenceLevel: intel.energy?.confidenceLevel ?? null }
    }
    return overlayData
  }, [overlayData, overlayState, intel])

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (document.getElementById('ev-pretendard')) return
    const link = document.createElement('link')
    link.id = 'ev-pretendard'; link.rel = 'stylesheet'
    link.href = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css'
    document.head.appendChild(link)
  }, [])

  useEffect(() => { saveUserMinReserveSoc(userMinReserveSoc) }, [userMinReserveSoc])

  useEffect(() => {
    saveMvp8Session({ view, step, selectedBrand, selectedId, custom, soc, userMinReserveSoc, startPoint, deliveries })
  }, [view, step, selectedBrand, selectedId, custom, soc, userMinReserveSoc, startPoint, deliveries])

  // Charger list fetch — fires on cockpit entry, startPoint change, or manual retry.
  // On API failure, falls back to recent public API cache (10-min TTL, same region).
  // Never falls back to sample CHARGERS.
  useEffect(() => {
    if (view !== 'cockpit') return
    let cancelled = false
    setChargerLoading(true)
    setChargerError(null)
    fetchPublicChargers({ lat: startPoint.lat, lng: startPoint.lng, radiusKm: 15 })
      .then(result => {
        if (cancelled) return
        if (!result.error && result.chargers.length > 0) {
          saveChargerCache(result, startPoint.lat, startPoint.lng)
          setChargerList(result.chargers)
          if (result.source === 'safemap-api' || result.source === 'safemap+ke') {
            setChargerProvider('safemap-api')
          } else if (result.endpoint === 'getChargerInfo') {
            setChargerProvider('public-api-info')
          } else if (result.endpoint === 'getChargerStatus') {
            setChargerProvider('public-api')
          } else {
            setChargerProvider('public-api')
          }
          setChargerError(null)
        } else if (!result.error) {
          // API succeeded but returned 0 chargers
          setChargerList([])
          setChargerProvider('api-empty')
          setChargerError(null)
        } else {
          // API error — try recent public API cache
          const cache = loadChargerCache(startPoint.lat, startPoint.lng)
          if (cache?.chargers?.length > 0) {
            setChargerList(cache.chargers)
            setChargerProvider('cached-api')
            setChargerError(null)
          } else {
            setChargerList([])
            setChargerProvider('api-error')
            setChargerError(result.reason ?? 'unknown')
          }
        }
        setChargerLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        const cache = loadChargerCache(startPoint.lat, startPoint.lng)
        if (cache?.chargers?.length > 0) {
          setChargerList(cache.chargers)
          setChargerProvider('cached-api')
          setChargerError(null)
        } else {
          setChargerList([])
          setChargerProvider('api-error')
          setChargerError('network_error')
        }
        setChargerLoading(false)
      })
    return () => { cancelled = true }
  }, [view, startPoint.lat, startPoint.lng, chargerRetryCount])

  // Intelligence analysis
  useEffect(() => {
    if (!isVehicleReady || view !== 'cockpit') { setIntelligenceResult(null); return }
    let cancelled = false
    analyzeRoute({
      userId: 'mvp8-driver',
      vehicle,
      batterySOC: soc,
      routeResult: { distanceKm: effectiveRouteKm, durationMin: deliveryRoutePathResult?.durationMin ?? null, isFallback: deliveryRoutePathResult?.isFallback ?? true, source: deliveryRoutePathResult?.source ?? 'fallback' },
      chargingResult: { chargeNeeded: effectiveChargeNeeded, chargerReachable: effectiveChargeNeeded ? (chargerReachable ?? false) : (chargerReachable ?? null), recommendedCharger: effectiveChargeNeeded && chargerReachable ? recommendedCharger : null, chargePlan: effectiveChargeNeeded && chargerReachable && chargePlan ? { targetSoc: chargePlan.targetSoc, finalDeliverySOC: chargePlan.finalDeliverySOC, chargeAmountKwh: chargePlan.chargeAmountKwh, chargeTimeMin: chargePlan.chargeTimeMin, totalExtraCost: chargePlan.totalExtraCost } : null, recommendationMode, mockCoverageWarning: mockCoverageWarning ?? false, isLowMargin, isReserveWarning, userMinReserveSoc },
      optimizationResult: optimizationResult ?? null,
      userMinReserveSoc,
    }).then(r => { if (!cancelled) setIntelligenceResult(r) })
    return () => { cancelled = true }
  }, [view, vehicle?.id, soc, effectiveRouteKm, effectiveChargeNeeded, chargerReachable, recommendedCharger?.id, chargePlan?.chargeTimeMin, isVehicleReady, deliveryRouteStatus, userMinReserveSoc, isReserveWarning])

  // Effect A — delivery route
  useEffect(() => {
    if (view !== 'cockpit' || !isVehicleReady) { setDeliveryRoutePathResult(null); setDeliveryRouteStatus('loading'); return }
    setDeliveryRouteStatus('loading')
    let cancelled = false
    getDeliveryRoute({ startPoint, deliveries })
      .then(r => {
        if (cancelled) return
        if (isValidRoadRouteResult(r)) {
          setDeliveryRoutePathResult(r)
          setDeliveryRouteStatus('ready')
          setRouteFailedLeg(null)
        } else {
          setDeliveryRoutePathResult(null)
          setDeliveryRouteStatus('error')
          setRouteFailedLeg(r.failedLegInfo ?? null)
        }
      })
      .catch(() => { if (!cancelled) { setDeliveryRoutePathResult(null); setDeliveryRouteStatus('error'); setRouteFailedLeg(null) } })
    return () => { cancelled = true }
  }, [view, isVehicleReady, startPoint, deliveries, routeRetryCount])

  // Effect B — charger route.
  // Route starts from the selected insertion origin (may differ from primary candidate after pull-forward).
  // Do not fetch route for review-candidate: the charger is not a confirmed recommendation.
  useEffect(() => {
    if (view !== 'cockpit' || !effectiveChargeNeeded || !chargerReachable || !recommendedCharger || recommendationMode === 'review-candidate') { setChargerRoutePathResult(null); setChargerRouteStatus('idle'); return }
    setChargerRouteStatus('loading')
    const routeOrigin = chargingInsertionPoint?.originPoint ?? startPoint
    let cancelled = false
    getChargerRoute({ startPoint: routeOrigin, charger: recommendedCharger })
      .then(r => { if (cancelled) return; if (isValidRoadRouteResult(r)) { setChargerRoutePathResult(r); setChargerRouteStatus('ready') } else { setChargerRoutePathResult(null); setChargerRouteStatus('error') } })
      .catch(() => { if (!cancelled) { setChargerRoutePathResult(null); setChargerRouteStatus('error') } })
    return () => { cancelled = true }
  }, [view, effectiveChargeNeeded, chargerReachable, recommendedCharger?.id, chargingInsertionPoint, startPoint, routeRetryCount, recommendationMode])

  // ── Event handlers ─────────────────────────────────────────────────────────

  function handleBrandChange(id) { setSelectedBrand(id); setSelectedId(''); setCustom(EMPTY_CUSTOM) }

  async function doPlaceSearch(query, seqRef, setStatus, setResults, setSelected) {
    if (!query.trim()) return
    const seq = ++seqRef.current
    setStatus('searching'); setResults([]); setSelected(null)
    try {
      await loadKakaoServices()
      if (!window.kakao?.maps?.services) throw new Error('services_unavailable')
    } catch { if (seq !== seqRef.current) return; setStatus('error'); return }
    if (seq !== seqRef.current) return
    const services = window.kakao.maps.services
    const ps = new services.Places()
    ps.keywordSearch(query.trim(), (data, status) => {
      if (seq !== seqRef.current) return
      if (status === services.Status.OK && data.length > 0) {
        setResults(data.slice(0, 6).map(p => ({ id: p.id, name: p.place_name, roadAddress: p.road_address_name || '', lotAddress: p.address_name || '', address: p.road_address_name || p.address_name, lat: parseFloat(p.y), lng: parseFloat(p.x) })))
        setStatus('done')
      } else {
        const gc = new services.Geocoder()
        gc.addressSearch(query.trim(), (gData, gStatus) => {
          if (seq !== seqRef.current) return
          if (gStatus === services.Status.OK && gData.length > 0) {
            setResults(gData.slice(0, 4).map(a => ({ id: a.address_name, name: a.address_name, roadAddress: a.road_address?.address_name || '', lotAddress: a.address_name, address: a.road_address?.address_name || a.address_name, lat: parseFloat(a.y), lng: parseFloat(a.x) })))
            setStatus('done')
          } else { setResults([]); setStatus('no-results') }
        })
      }
    })
  }

  // Start point handlers
  function handleStartSearch(q) { doPlaceSearch(q, startSeqRef, setStartStatus, setStartResults, setStartSelected) }
  function handleStartSelect(r) { setStartSelected(r); setStartForm({ name: r.name, lat: String(r.lat), lng: String(r.lng), address: r.address || '' }) }
  function handleStartClear() { setStartSelected(null) }
  const isStartFormValid = startForm.name.trim() !== '' && !isNaN(parseFloat(startForm.lat)) && !isNaN(parseFloat(startForm.lng))
  function handleSetStart() {
    const lat = parseFloat(startForm.lat), lng = parseFloat(startForm.lng)
    if (!startForm.name.trim() || isNaN(lat) || isNaN(lng)) return
    setStartPoint({ id: startSelected?.id || 'custom', name: startForm.name.trim(), lat, lng, address: startForm.address || '' })
    setShowStartModal(false); setStartSearch(''); setStartResults([]); setStartStatus('idle'); setStartSelected(null); setStartShowAdv(false); setStartForm(EMPTY_FORM)
  }
  function handleResetStart() { setStartPoint(defaultStartPoint); setShowStartModal(false); setStartSearch(''); setStartResults([]); setStartStatus('idle'); setStartSelected(null); setStartShowAdv(false); setStartForm(EMPTY_FORM) }

  // Delivery handlers
  function handleDestSearch(q) { doPlaceSearch(q, destSeqRef, setDestStatus, setDestResults, setDestSelected) }
  function handleDestSelect(r) { setDestSelected(r); setDestForm({ name: r.name, lat: String(r.lat), lng: String(r.lng), address: r.address || '' }) }
  function handleDestClear() { setDestSelected(null) }
  const isDestFormValid = destForm.name.trim() !== '' && !isNaN(parseFloat(destForm.lat)) && !isNaN(parseFloat(destForm.lng))
  function openAddDest() { setEditingId('new'); setDestForm(EMPTY_FORM); setDestSearch(''); setDestResults([]); setDestStatus('idle'); setDestSelected(null); setDestShowAdv(false); setShowDestModal(true) }
  function openEditDest(d) { setEditingId(d.id); setDestForm({ name: d.name, lat: String(d.lat), lng: String(d.lng), address: d.address || '' }); setDestSearch(''); setDestResults([]); setDestStatus('idle'); setDestSelected(null); setDestShowAdv(false); setShowDestModal(true) }
  function handleDestSave() {
    const lat = parseFloat(destForm.lat), lng = parseFloat(destForm.lng)
    if (!destForm.name.trim() || isNaN(lat) || isNaN(lng)) return
    if (editingId === 'new') setDeliveries(prev => [...prev, { id: Date.now(), name: destForm.name.trim(), lat, lng, address: destForm.address || '' }])
    else setDeliveries(prev => prev.map(d => d.id === editingId ? { ...d, name: destForm.name.trim(), lat, lng, address: destForm.address || '' } : d))
    setShowDestModal(false); setEditingId(null); setDestForm(EMPTY_FORM); setDestSearch(''); setDestResults([]); setDestStatus('idle'); setDestSelected(null); setDestShowAdv(false)
  }
  function handleDestDelete(id) { setDeliveries(prev => prev.filter(d => d.id !== id)) }
  function handleDestCancel() { setShowDestModal(false); setEditingId(null); setDestForm(EMPTY_FORM); setDestSearch(''); setDestResults([]); setDestStatus('idle'); setDestSelected(null); setDestShowAdv(false) }

  function handleApplyOptimization() {
    if (!optimizationResult || isCurrentlyOptimal) return
    setDeliveries([...optimizationResult.optimizedDeliveries])
  }

  const stepCanProceed = [
    isVehicleReady,
    true,
    true,
    deliveries.length > 0,
    isVehicleReady && deliveries.length > 0,
  ]

  function handleEnterCockpit() {
    if (!isVehicleReady || deliveries.length === 0) return
    setView('cockpit')
    setDeliveryRouteStatus('loading')
  }

  function handleReset() {
    clearMvp8Session()
    clearChargerCache()
    setView('setup'); setStep(1); setSelectedBrand(''); setSelectedId(''); setCustom(EMPTY_CUSTOM); setSoc(80)
    setStartPoint(defaultStartPoint); setDeliveries(INITIAL_DELIVERIES)
    setDeliveryRoutePathResult(null); setDeliveryRouteStatus('loading'); setChargerRoutePathResult(null); setChargerRouteStatus('idle')
    setRouteFailedLeg(null)
    setIntelligenceResult(null)
    setChargerList([]); setChargerLoading(false); setChargerError(null); setChargerProvider('idle')
    setChargerRetryCount(0)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const zoneH = `calc(100vh - ${OUTER_HDR}px - ${HDR}px - ${BAR}px)`
  const statusCfg = overlayState ? getStatusCfg(overlayState, T) : null

  return (
    <div style={{ position: 'fixed', top: OUTER_HDR, left: 0, right: 0, bottom: 0, zIndex: 10, display: 'flex', flexDirection: 'column', fontFamily: FONT, background: T.bg, color: T.text, overflow: 'hidden' }}>

      {/* PAGE HEADER */}
      <div style={{ height: HDR, padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}`, background: T.surface, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: T.accent, letterSpacing: '0.1em', textTransform: 'uppercase' }}>MVP-8</span>
          <span style={{ width: 1, height: 14, background: T.border }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary }}>통합 드라이버 플로우</span>
          {view === 'cockpit' && statusCfg && (
            <>
              <span style={{ width: 1, height: 14, background: T.border }} />
              <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: `${statusCfg.color}18`, border: `1px solid ${statusCfg.color}40`, color: statusCfg.color }}>
                {statusCfg.label}
              </span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {view === 'cockpit' && (
            <button onClick={() => { setView('setup'); setStep(5) }} style={{ padding: '6px 14px', border: `1px solid ${T.border}`, borderRadius: 6, background: 'transparent', color: T.textSecondary, cursor: 'pointer', fontSize: 12, fontFamily: FONT }}>
              ← 설정
            </button>
          )}
          <button onClick={toggleTheme} style={{ padding: '6px 14px', border: `1px solid ${T.border}`, borderRadius: 6, background: 'transparent', color: T.textSecondary, cursor: 'pointer', fontSize: 12, fontFamily: FONT }}>
            {themeName === 'dark' ? '☀ 라이트' : '🌙 다크'}
          </button>
        </div>
      </div>

      {/* ── SETUP VIEW — 5-step wizard ─────────────────────────────────────── */}
      {view === 'setup' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.bg }}>

          {/* Step progress stepper */}
          <StepperBar step={step} T={T} />

          {/* Scrollable step content */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ maxWidth: 840, margin: '0 auto', padding: '24px 20px 32px' }}>

              {/* ── STEP 1: Vehicle selection ──────────────────────────────── */}
              {step === 1 && (
                <SetupCard title="차량 선택" T={T} done={isVehicleReady}>
                  {!selectedBrand ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      {BRANDS.map(brand => (
                        <div key={brand.id} onClick={() => handleBrandChange(brand.id)}
                          style={{ cursor: 'pointer', border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 6px', textAlign: 'center', userSelect: 'none' }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: T.surfaceSecondary, color: T.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: brand.logoText.length > 3 ? 8 : 11, fontWeight: 600, margin: '0 auto 6px' }}>{brand.logoText}</div>
                          <div style={{ fontSize: 11, color: T.textSecondary }}>{brand.name}</div>
                        </div>
                      ))}
                    </div>
                  ) : isCustomBrand ? (
                    <>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <button onClick={() => handleBrandChange('')} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 5, border: `1px solid ${T.border}`, background: 'transparent', color: T.textSecondary, cursor: 'pointer', fontFamily: FONT }}>← 다시 선택</button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[{ field: 'name', label: '차량명', type: 'text', placeholder: '예) 테슬라 세미' }, { field: 'batteryCapacityKwh', label: '배터리 (kWh)', type: 'number', placeholder: '예) 100' }, { field: 'maxRangeKm', label: '최대 항속 (km)', type: 'number', placeholder: '예) 300' }, { field: 'efficiencyKmPerKwh', label: '전비 (km/kWh)', type: 'number', placeholder: '자동 계산' }].map(({ field, label, type, placeholder }) => (
                          <label key={field} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: T.textSecondary, fontWeight: 500, textTransform: 'uppercase' }}>
                            {label}
                            <input type={type} placeholder={placeholder} value={custom[field]} onChange={e => setCustom(p => ({ ...p, [field]: e.target.value }))} style={{ padding: '8px 12px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 13, background: T.surfaceSecondary, color: T.text, fontFamily: FONT, textTransform: 'none' }} />
                          </label>
                        ))}
                        {custom.batteryCapacityKwh && custom.maxRangeKm && !custom.efficiencyKmPerKwh && (
                          <div style={{ fontSize: 11, color: T.accent, padding: '5px 10px', background: `${T.accent}14`, borderRadius: 5 }}>자동 전비: {(parseFloat(custom.maxRangeKm) / parseFloat(custom.batteryCapacityKwh)).toFixed(1)} km/kWh</div>
                        )}
                      </div>
                      {vehicle && (
                        <div style={{ marginTop: 12, padding: '12px 14px', background: `${T.accent}10`, border: `1px solid ${T.accent}40`, borderRadius: 9, display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: T.accent, marginBottom: 2 }}>✓ 선택됨</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{vehicle.fullName}</div>
                            <div style={{ fontSize: 11, color: T.textSecondary }}>{vehicle.batteryCapacityKwh} kWh · {vehicle.efficiencyKmPerKwh?.toFixed(1)} km/kWh · 최대 {vehicle.maxRangeKm} km</div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <button onClick={() => handleBrandChange('')} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 5, border: `1px solid ${T.border}`, background: 'transparent', color: T.textSecondary, cursor: 'pointer', fontFamily: FONT }}>← 다시 선택</button>
                        <span style={{ fontSize: 12, color: T.textSecondary, alignSelf: 'center' }}>{BRANDS.find(b => b.id === selectedBrand)?.name}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {filteredVehicles.map(v => (
                          <div key={v.id} onClick={() => setSelectedId(v.id)}
                            style={{ cursor: 'pointer', border: `1px solid ${selectedId === v.id ? T.accent : T.border}`, background: selectedId === v.id ? `${T.accent}10` : T.surfaceSecondary, borderRadius: 8, overflow: 'hidden', userSelect: 'none' }}>
                            <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, padding: 6 }}>
                              {v.image ? <img src={v.image} alt={v.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <VehicleSvg T={T} />}
                            </div>
                            <div style={{ padding: '8px 10px' }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: selectedId === v.id ? T.accent : T.text, marginBottom: 4 }}>{v.name}</div>
                              <div style={{ fontSize: 10, color: T.textSecondary }}>{v.batteryCapacityKwh} kWh · {v.efficiencyKmPerKwh?.toFixed(1)} km/kWh</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {vehicle && (
                        <div style={{ marginTop: 12, padding: '12px 14px', background: `${T.accent}10`, border: `1px solid ${T.accent}40`, borderRadius: 9, display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 80, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: T.bg, borderRadius: 6 }}>
                            <VehicleImage src={vehicle.image} alt={vehicle.fullName} T={T} maxWidth={76} maxHeight={48} />
                          </div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: T.accent, marginBottom: 2 }}>✓ 선택됨</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{vehicle.fullName}</div>
                            <div style={{ fontSize: 11, color: T.textSecondary }}>{vehicle.batteryCapacityKwh} kWh · {vehicle.efficiencyKmPerKwh?.toFixed(1)} km/kWh · 최대 {vehicle.maxRangeKm} km</div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </SetupCard>
              )}

              {/* ── STEP 2: Battery settings ───────────────────────────────── */}
              {step === 2 && (
                <>
                  <SetupCard title="현재 배터리 (SOC)" T={T} done={true}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 2, marginBottom: 10 }}>
                      <span style={{ fontSize: 56, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.03em', color: soc >= 30 ? T.success : T.danger }}>{soc}</span>
                      <span style={{ fontSize: 20, color: T.textSecondary, marginBottom: 6 }}>%</span>
                    </div>
                    <BatteryBar percent={soc} T={T} />
                    <div style={{ marginTop: 10 }}>
                      <input type="range" min="0" max="100" value={soc} onChange={e => setSoc(Number(e.target.value))} style={{ width: '100%', accentColor: T.accent, cursor: 'pointer' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <span style={{ fontSize: 10, color: T.textSecondary }}>0%</span>
                        <input type="number" min="0" max="100" value={soc} onChange={e => setSoc(Math.min(100, Math.max(0, Number(e.target.value))))} style={{ width: 56, padding: '4px 8px', border: `1px solid ${T.border}`, borderRadius: 5, fontSize: 13, textAlign: 'center', background: T.surfaceSecondary, color: T.text, fontFamily: FONT }} />
                        <span style={{ fontSize: 10, color: T.textSecondary }}>100%</span>
                      </div>
                    </div>
                    {isVehicleReady && (
                      <div style={{ marginTop: 10, padding: '8px 12px', background: T.surfaceSecondary, borderRadius: 7, display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: T.textSecondary }}>예상 주행 가능 거리</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: soc >= 30 ? T.success : T.danger }}>{estimatedRangeKm} km</span>
                      </div>
                    )}
                  </SetupCard>

                  <SetupCard title="안전 하한 SOC" T={T} done={true}>
                    <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 12, lineHeight: 1.55 }}>
                      운행 중 이 기준 아래로 내려가지 않도록 설정하는 안전 하한입니다. 이 기준을 위반할 구간이 예상되면 충전을 권장합니다.
                      <span style={{ fontWeight: 700, color: T.accent, marginLeft: 6 }}>현재: {userMinReserveSoc}%</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[5, 10, 15, 20, 25, 30].map(v => (
                        <button key={v} onClick={() => setUserMinReserveSoc(v)}
                          style={{ flex: 1, padding: '9px 0', borderRadius: 7, border: `1px solid ${userMinReserveSoc === v ? T.accent : T.border}`, background: userMinReserveSoc === v ? `${T.accent}18` : T.surfaceSecondary, color: userMinReserveSoc === v ? T.accent : T.textSecondary, fontSize: 12, fontWeight: userMinReserveSoc === v ? 700 : 400, cursor: 'pointer', fontFamily: FONT }}>
                          {v}%
                        </button>
                      ))}
                    </div>
                  </SetupCard>
                </>
              )}

              {/* ── STEP 3: Start point ───────────────────────────────────── */}
              {step === 3 && (
                <SetupCard title="출발지" T={T} done={true}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{startPoint.name}</div>
                      {startPoint.address && <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 1 }}>{startPoint.address}</div>}
                      <div style={{ fontSize: 10, color: T.border, marginTop: 1 }}>{startPoint.lat.toFixed(4)}, {startPoint.lng.toFixed(4)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setShowStartModal(true)} style={{ padding: '5px 12px', border: `1px solid ${T.accent}50`, borderRadius: 5, background: `${T.accent}14`, color: T.accent, fontSize: 12, cursor: 'pointer', fontFamily: FONT }}>변경</button>
                    </div>
                  </div>
                </SetupCard>
              )}

              {/* ── STEP 4: Deliveries ────────────────────────────────────── */}
              {step === 4 && (
                <SetupCard title={`배송지 (${deliveries.length}개)`} T={T} done={deliveries.length > 0}>
                  {optimizationResult && !isCurrentlyOptimal && optimizationResult.savedDistanceKm > 0 && (
                    <div style={{ marginBottom: 10, padding: '8px 12px', background: `${T.warning}14`, border: `1px solid ${T.warning}40`, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 12, color: T.warning }}>최적 순서로 {optimizationResult.savedDistanceKm} km ({optimizationResult.savedPercent}%) 단축 가능</span>
                      <button onClick={handleApplyOptimization} style={{ padding: '4px 10px', border: 'none', borderRadius: 5, background: T.warning, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, flexShrink: 0 }}>적용</button>
                    </div>
                  )}
                  {deliveries.length === 0 ? (
                    <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 12, color: T.textSecondary }}>배송지가 없습니다</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                      {deliveries.map((d, i) => (
                        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7 }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: T.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>{i + 1}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                            {d.address && <div style={{ fontSize: 10, color: T.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.address}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            <button onClick={() => openEditDest(d)} style={{ padding: '3px 8px', border: `1px solid ${T.border}`, borderRadius: 4, background: 'transparent', color: T.textSecondary, fontSize: 11, cursor: 'pointer', fontFamily: FONT }}>편집</button>
                            <button onClick={() => handleDestDelete(d.id)} style={{ padding: '3px 8px', border: `1px solid ${T.danger}50`, borderRadius: 4, background: 'transparent', color: T.danger, fontSize: 11, cursor: 'pointer', fontFamily: FONT }}>삭제</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={openAddDest} style={{ width: '100%', padding: '9px 0', border: `1px dashed ${T.accent}60`, borderRadius: 7, background: `${T.accent}08`, color: T.accent, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: FONT }}>
                    + 배송지 추가
                  </button>
                </SetupCard>
              )}

              {/* ── STEP 5: Review & start ────────────────────────────────── */}
              {step === 5 && (
                <>
                  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
                    <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>운행 계획 확인</div>
                      <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>아래 내용을 확인하고 운전 화면을 시작하세요</div>
                    </div>

                    {/* Vehicle */}
                    <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 88, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: T.bg, borderRadius: 7 }}>
                        <VehicleImage src={vehicle?.image} alt={vehicle?.fullName ?? ''} T={T} maxWidth={84} maxHeight={52} />
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{vehicle?.fullName ?? '—'}</div>
                        <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>{vehicle?.grade} · {vehicle?.batteryCapacityKwh} kWh · {vehicle?.efficiencyKmPerKwh?.toFixed(1)} km/kWh</div>
                      </div>
                      <button onClick={() => setStep(1)} style={{ marginLeft: 'auto', fontSize: 11, color: T.accent, background: 'transparent', border: `1px solid ${T.accent}40`, borderRadius: 5, cursor: 'pointer', padding: '3px 9px', fontFamily: FONT, flexShrink: 0 }}>변경</button>
                    </div>

                    {/* Battery */}
                    <div style={{ padding: '12px 18px', borderBottom: `1px solid ${T.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 10, color: T.textSecondary, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>현재 배터리</div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: soc >= 30 ? T.success : T.danger }}>{soc}%</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: T.textSecondary, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>예상 주행 거리</div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>{estimatedRangeKm} km</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: T.textSecondary, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>안전 하한 SOC</div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>{userMinReserveSoc}%</div>
                      </div>
                    </div>

                    {/* Start point */}
                    <div style={{ padding: '12px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 10, color: T.textSecondary, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>출발지</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{startPoint.name}</div>
                        {startPoint.address && <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 1 }}>{startPoint.address}</div>}
                      </div>
                      <button onClick={() => setStep(3)} style={{ fontSize: 11, color: T.accent, background: 'transparent', border: `1px solid ${T.accent}40`, borderRadius: 5, cursor: 'pointer', padding: '3px 9px', fontFamily: FONT, flexShrink: 0 }}>변경</button>
                    </div>

                    {/* Deliveries */}
                    <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 10, color: T.textSecondary, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>배송 경로</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{deliveries.length}개 배송지 · 예상 {totalRouteKm} km</div>
                        {isVehicleReady && (
                          <div style={{ fontSize: 11, color: effectiveCanDeliver ? T.success : T.danger, marginTop: 2 }}>
                            {effectiveCanDeliver ? `여유 ${Math.max(0, surplusRangeKm).toFixed(1)} km` : '충전 경유 필요'}
                          </div>
                        )}
                      </div>
                      <button onClick={() => setStep(4)} style={{ fontSize: 11, color: T.accent, background: 'transparent', border: `1px solid ${T.accent}40`, borderRadius: 5, cursor: 'pointer', padding: '3px 9px', fontFamily: FONT, flexShrink: 0 }}>편집</button>
                    </div>
                  </div>

                  <button onClick={handleEnterCockpit} disabled={!isVehicleReady || deliveries.length === 0}
                    style={{ width: '100%', padding: '18px 0', border: 'none', borderRadius: 10, background: isVehicleReady && deliveries.length > 0 ? T.accent : T.surfaceSecondary, color: isVehicleReady && deliveries.length > 0 ? '#fff' : T.textSecondary, fontSize: 17, fontWeight: 600, cursor: isVehicleReady && deliveries.length > 0 ? 'pointer' : 'not-allowed', fontFamily: FONT }}>
                    {isVehicleReady && deliveries.length > 0 ? '운전 화면 시작 →' : !isVehicleReady ? '차량을 선택하세요 (1단계)' : '배송지를 추가하세요 (4단계)'}
                  </button>
                </>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ── COCKPIT VIEW ───────────────────────────────────────────────────── */}
      {view === 'cockpit' && (
        <div style={{ display: 'flex', height: zoneH, minHeight: 500, overflow: 'hidden' }}>

          {/* LEFT PANEL */}
          <div style={{ width: '30%', flexShrink: 0, borderRight: `1px solid ${T.border}`, overflowY: 'auto', background: T.surface, display: 'flex', flexDirection: 'column' }}>

            {/* Vehicle cluster */}
            <div style={{ margin: '12px 12px 0', borderRadius: 10, background: T.bg, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: HMI.text.title, fontWeight: 600, color: T.text, lineHeight: 1.2 }}>{vehicle?.fullName}</div>
                  <div style={{ fontSize: HMI.text.caption, color: T.textSecondary, marginTop: 2 }}>{vehicle?.grade}</div>
                </div>
                {statusCfg && (
                  <div style={{ padding: '3px 10px', borderRadius: 20, background: `${statusCfg.color}18`, border: `1px solid ${statusCfg.color}40`, fontSize: HMI.text.caption, fontWeight: 600, color: statusCfg.color, flexShrink: 0, marginLeft: 6 }}>
                    {statusCfg.label}
                  </div>
                )}
              </div>

              <div style={{ padding: '12px 14px 0' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: HMI.text.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 4 }}>배터리</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, justifyContent: 'center' }}>
                      <span style={{ fontSize: HMI.text.metric, fontWeight: 400, lineHeight: 1, color: soc >= 30 ? T.success : T.danger }}>{soc}</span>
                      <span style={{ fontSize: HMI.text.metricUnit, color: T.textSecondary, marginBottom: 5 }}>%</span>
                    </div>
                  </div>
                  <div style={{ width: 1, background: T.border, alignSelf: 'stretch', margin: '2px 0' }} />
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: HMI.text.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 4 }}>주행 가능</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, justifyContent: 'center' }}>
                      <span style={{ fontSize: HMI.text.metric, fontWeight: 400, lineHeight: 1, color: effectiveCanDeliver ? T.success : T.danger }}>{estimatedRangeKm}</span>
                      <span style={{ fontSize: HMI.text.metricUnit, color: T.textSecondary, marginBottom: 5 }}>km</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ padding: '6px 14px 4px', display: 'flex', justifyContent: 'center', minHeight: 88, alignItems: 'center' }}>
                <VehicleImage src={vehicle?.image} alt={vehicle?.fullName ?? ''} T={T} />
              </div>
              <div style={{ padding: '2px 14px 8px' }}>
                <BatteryBar percent={soc} T={T} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: HMI.text.caption, color: T.textSecondary }}>{remainingKwh} kWh 남음</span>
                  <span style={{ fontSize: HMI.text.caption, color: effectiveChargeNeeded ? T.danger : T.success }}>
                    {effectiveChargeNeeded ? `${(effectiveRouteKm - parseFloat(estimatedRangeKm)).toFixed(1)} km 부족` : `+${Math.max(0, surplusRangeKm).toFixed(1)} km 여유`}
                  </span>
                </div>
              </div>

              {remainingSocAfterDelivery != null && isVehicleReady && (() => {
                const arrColor = effectiveChargeNeeded ? T.danger : isPreDepartureCharge ? T.danger : isLowMargin ? T.warning : isReserveWarning ? T.warning : T.success
                const gap = (isReserveWarning || isPreDepartureCharge) ? parseFloat((userMinReserveSoc - remainingSocAfterDelivery).toFixed(1)) : null
                const statusText = effectiveChargeNeeded ? '충전 없이 배송 시 기준' : isPreDepartureCharge ? '출발 전 충전 필요' : isLowMargin ? '안전 여유 부족' : isReserveWarning ? `기준보다 ${gap}%p 부족` : '기준 충족'
                return (
                  <div style={{ padding: '4px 14px 4px', borderTop: `1px solid ${T.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: HMI.text.caption, color: T.textSecondary }}>{effectiveChargeNeeded ? '충전 전 배송 완료 예상 SOC' : '배송 완료 예상 SOC'}</span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                        <span style={{ fontSize: HMI.text.body, fontWeight: 600, color: arrColor }}>{remainingSocAfterDelivery.toFixed(1)}</span>
                        <span style={{ fontSize: HMI.text.caption, color: T.textSecondary }}>%</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: arrColor, fontWeight: 600, marginTop: 1 }}>{statusText}</div>
                  </div>
                )
              })()}
              <div style={{ padding: '4px 14px 5px', borderTop: `1px solid ${T.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: HMI.text.caption, color: T.textSecondary }}>안전 하한 SOC</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                    <span style={{ fontSize: HMI.text.body, fontWeight: 600, color: isPreDepartureCharge ? T.danger : isReserveWarning ? T.warning : T.textSecondary }}>{userMinReserveSoc}</span>
                    <span style={{ fontSize: HMI.text.caption, color: T.textSecondary }}>%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Charger data source indicator */}
            <div style={{ margin: '6px 12px 0', display: 'flex', justifyContent: 'flex-end' }}>
              {chargerLoading ? (
                <span style={{ fontSize: 9, color: T.textSecondary }}>⟳ 충전소 확인 중…</span>
              ) : chargerProvider === 'safemap-api' ? (
                <span style={{ fontSize: 9, color: T.success, padding: '1px 7px', borderRadius: 8, background: `${T.success}12`, border: `1px solid ${T.success}30` }}>충전소 데이터: 생활안전정보 API · 위치 정보</span>
              ) : chargerProvider === 'public-api' ? (
                <span style={{ fontSize: 9, color: T.success, padding: '1px 7px', borderRadius: 8, background: `${T.success}12`, border: `1px solid ${T.success}30` }}>충전소 데이터: 실시간 API</span>
              ) : chargerProvider === 'public-api-info' ? (
                <span style={{ fontSize: 9, color: T.success, padding: '1px 7px', borderRadius: 8, background: `${T.success}12`, border: `1px solid ${T.success}30` }}>충전소 데이터: 공공 API · 위치 정보</span>
              ) : chargerProvider === 'cached-api' ? (
                <span style={{ fontSize: 9, color: T.warning, padding: '1px 7px', borderRadius: 8, background: `${T.warning}10`, border: `1px solid ${T.warning}30` }}>충전소 데이터: 최근 공공 API 정보</span>
              ) : chargerProvider === 'api-error' && chargerError === 'no_base_url' ? (
                <span style={{ fontSize: 9, color: T.danger, padding: '1px 7px', borderRadius: 8, background: `${T.danger}10`, border: `1px solid ${T.danger}30` }}>충전소 API 주소가 설정되지 않았습니다</span>
              ) : chargerProvider === 'api-error' ? (
                <span style={{ fontSize: 9, color: T.danger, padding: '1px 7px', borderRadius: 8, background: `${T.danger}10`, border: `1px solid ${T.danger}30` }}>충전소 최신 정보 재확인 필요</span>
              ) : chargerProvider === 'api-empty' ? (
                <span style={{ fontSize: 9, color: T.warning, padding: '1px 7px', borderRadius: 8, background: `${T.warning}10`, border: `1px solid ${T.warning}30` }}>주변 확인 가능한 충전소 없음</span>
              ) : null}
            </div>

            {/* Charger recommendation — confirmed or review-candidate */}
            {recommendedCharger && (() => {
              const isReview = recommendationMode === 'review-candidate'
              const isMidRoute = recommendationSource === 'mid-route'
              const borderColor = isReview
                ? T.warning + '70'
                : effectiveChargeNeeded && chargerReachable ? T.accent + '70'
                : effectiveChargeNeeded ? T.danger + '50'
                : isReserveWarning ? T.warning + '50'
                : T.border
              const headerColor = isReview
                ? T.warning
                : effectiveChargeNeeded ? (chargerReachable ? T.accent : T.danger)
                : isReserveWarning ? T.warning
                : T.textSecondary
              const headerLabel = isReview
                ? (isMidRoute ? '경로 중 충전 검토 필요' : (hasNearbyReachableCharger ? '출발 전 충전 필요' : '충전 후보 검토 필요'))
                : effectiveChargeNeeded && chargerReachable
                  ? (insertionExplanation ?? chargingInsertionPoint?.label ?? '충전 경유 필요')
                : effectiveChargeNeeded ? '도달 불가'
                : isReserveWarning ? '충전 권장' : '주변 충전소'
              const badgeLabel = isReview ? '검토 필요'
                : effectiveChargeNeeded ? (chargerReachable ? (isMidRoute ? '경로 중 충전' : '출발 전 충전 필요') : '도달 불가') : '선택'
              const badgeColor = isReview
                ? T.warning
                : effectiveChargeNeeded ? (chargerReachable ? T.warning : T.danger) : T.textSecondary
              return (
                <div style={{ margin: '8px 12px 0', borderRadius: 9, background: T.bg, border: `1px solid ${borderColor}` }}>
                  <div style={{ padding: '7px 12px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: HMI.text.caption, fontWeight: 600, color: headerColor, textTransform: 'none', letterSpacing: '0.03em' }}>
                      {headerLabel}
                    </span>
                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: `${badgeColor}18`, color: badgeColor, border: `1px solid ${badgeColor}50`, fontWeight: 600 }}>
                      {badgeLabel}
                    </span>
                  </div>
                  <div style={{ padding: '9px 12px' }}>
                    <div style={{ fontSize: HMI.text.bodyStrong, fontWeight: 600, color: T.text, marginBottom: 2 }}>{recommendedCharger.name}</div>
                    {recommendedCharger.operator && <div style={{ fontSize: HMI.text.caption, color: T.textSecondary, marginBottom: 6 }}>{recommendedCharger.operator}{recommendedCharger.pricePerKwh ? ` · ${recommendedCharger.pricePerKwh.toLocaleString('ko-KR')}원/kWh` : ''}</div>}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
                      {[
                        { l: '속도',   v: `${recommendedCharger.powerKw}kW` },
                        { l: '충전소까지', v: `${(recommendedCharger.originToChargerKm ?? recommendedCharger.distKm)}km` },
                        ...(recommendedCharger.insertionDetourKm != null ? [{ l: '우회거리', v: `${recommendedCharger.insertionDetourKm.toFixed(1)}km` }] : [{ l: '대기', v: recommendedCharger.waitMin === 0 ? '즉시' : `${recommendedCharger.waitMin}분` }]),
                      ].map(({ l, v }) => (
                        <div key={l}>
                          <div style={{ fontSize: 9, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{l}</div>
                          <div style={{ fontSize: HMI.text.body, fontWeight: 500, color: T.text }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {isReview ? (
                      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ padding: '4px 8px', borderRadius: 5, background: `${T.warning}12`, border: `1px solid ${T.warning}30`, fontSize: 10, color: T.warning, fontWeight: 600 }}>
                          {isMidRoute
                            ? '경로 중 우회 거리가 높아 직접 확인이 필요합니다'
                            : hasNearbyReachableCharger
                              ? '가까운 충전 후보가 있습니다. 출발 전 위치와 이용 가능 여부를 직접 확인하세요.'
                              : '출발지에서 거리가 멀어 직접 확인이 필요합니다'}
                        </div>
                        {insertionExplanation && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: HMI.text.caption }}>
                            <span style={{ color: T.textSecondary }}>충전 시점</span>
                            <span style={{ color: T.text, fontWeight: 500 }}>{insertionExplanation}</span>
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: T.textSecondary, lineHeight: 1.5 }}>
                          {isMidRoute
                            ? '배송 경로 중 충전소 위치를 지도에서 직접 확인하세요.'
                            : hasNearbyReachableCharger
                              ? '충전소에 도착하기 전, 운영 상태와 빈 자리를 미리 확인하세요.'
                              : '출발 전 충전소 위치를 지도에서 직접 확인하세요.'}
                        </div>
                      </div>
                    ) : (
                      chargingInsertionPoint && effectiveChargeNeeded && chargerReachable && (() => {
                        const ip = chargingInsertionPoint
                        const originName = ip.originPoint?.name ?? null
                        const nextName   = ip.nextPoint?.name ?? null
                        return (
                          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {insertionExplanation && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: HMI.text.caption }}>
                                <span style={{ color: T.textSecondary }}>충전 시점</span>
                                <span style={{ color: isMidRoute ? T.accent : T.text, fontWeight: 600 }}>{insertionExplanation}</span>
                              </div>
                            )}
                            {originName && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: HMI.text.caption }}>
                                <span style={{ color: T.textSecondary }}>충전 출발 지점</span>
                                <span style={{ color: T.text, fontWeight: 500 }}>{originName}</span>
                              </div>
                            )}
                            {nextName && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: HMI.text.caption }}>
                                <span style={{ color: T.textSecondary }}>충전 후 다음 목적지</span>
                                <span style={{ color: T.text, fontWeight: 500 }}>{nextName}</span>
                              </div>
                            )}
                            {recommendedCharger.insertionDetourKm != null && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: HMI.text.caption }}>
                                <span style={{ color: T.textSecondary }}>예상 우회거리</span>
                                <span style={{ color: T.text, fontWeight: 500 }}>{recommendedCharger.insertionDetourKm.toFixed(1)} km</span>
                              </div>
                            )}
                            <div style={{ marginTop: 3, padding: '3px 8px', borderRadius: 5, background: `${T.success}14`, border: `1px solid ${T.success}30`, fontSize: 10, color: T.success, fontWeight: 600, textAlign: 'center' }}>
                              충전 후 배송 계속 가능
                            </div>
                          </div>
                        )
                      })()
                    )}
                  </div>
                </div>
              )
            })()}

            {/* No-suitable-charger state — real charger data loaded but no candidate passes quality gate */}
            {!recommendedCharger && effectiveChargeNeeded && recommendationMode === 'no-suitable-charger' && (
              <div style={{ margin: '8px 12px 0', padding: '12px 14px', background: T.bg, border: `1px solid ${T.warning}50`, borderRadius: 9 }}>
                <div style={{ fontSize: HMI.text.caption, fontWeight: 600, color: T.warning, marginBottom: 4 }}>
                  {hasNearbyReachableCharger
                    ? '출발 전 충전 필요'
                    : beforeDepartureQuality === 'reject'
                      ? '출발지 인근 적합한 충전소 없음'
                      : '충전 후보 재확인 필요'}
                </div>
                <div style={{ fontSize: 10, color: T.textSecondary, marginBottom: 8, lineHeight: 1.55 }}>
                  {unreachableReason
                    ?? (beforeDepartureQuality === 'reject'
                        ? '출발지에서 가까운 충전소가 확인되지 않습니다. 다른 출발 지점이나 운행 경로를 검토하세요.'
                        : (chargingInsertionPoint?.label
                            ? `${chargingInsertionPoint.label.replace(' 충전 권장', '')} 구간 포함`
                            : '검토한 모든 충전 구간') +
                          (insertionCandidates.length > 1 ? ` (${insertionCandidates.length}개 구간 검토 완료)` : '') +
                          ' 주변에 적합한 충전소가 없습니다.')}
                </div>
                <button onClick={() => setChargerRetryCount(n => n + 1)}
                  style={{ padding: '5px 12px', border: `1px solid ${T.border}`, borderRadius: 5, background: T.surfaceSecondary, color: T.textSecondary, fontSize: 11, cursor: 'pointer', fontFamily: FONT, display: 'block', width: '100%' }}>
                  충전소 다시 조회
                </button>
              </div>
            )}

            {/* No-charger state — shown when charging is needed but no real API data available */}
            {!recommendedCharger && effectiveChargeNeeded && recommendationMode !== 'no-suitable-charger' && (
              <div style={{ margin: '8px 12px 0', padding: '12px 14px', background: T.bg, border: `1px solid ${chargerProvider === 'api-error' ? T.danger + '40' : T.warning + '40'}`, borderRadius: 9 }}>
                <div style={{ fontSize: HMI.text.caption, fontWeight: 600, color: chargerProvider === 'api-error' ? T.danger : T.warning, marginBottom: 3 }}>
                  {chargerLoading
                    ? '충전소 정보 확인 중…'
                    : chargerProvider === 'api-error' && chargerError === 'no_base_url'
                      ? '충전소 API 주소가 설정되지 않았습니다.'
                      : chargerProvider === 'api-error'
                        ? '충전소 정보를 불러올 수 없습니다.'
                        : chargerProvider === 'api-empty'
                          ? '주변 확인 가능한 충전소 없음'
                          : '충전소 정보를 확인하는 중입니다'}
                </div>
                {!chargerLoading && chargerProvider !== 'idle' && (
                  <div style={{ fontSize: 10, color: T.textSecondary, marginBottom: chargerProvider === 'api-error' && chargerError !== 'no_base_url' ? 8 : 0 }}>
                    {chargerProvider === 'api-error' && chargerError === 'no_base_url'
                      ? '충전소 정보를 불러올 수 없습니다. 서비스 환경 설정을 확인하세요.'
                      : chargerProvider === 'api-error'
                        ? '현재 확인 가능한 충전소 정보가 없습니다. 배송 경로는 정상 표시됩니다.'
                        : chargerProvider === 'api-empty'
                          ? '출발지 주변에 확인된 충전소가 없습니다. 배송 경로는 정상 표시됩니다.'
                          : '충전소 정보가 확인될 때까지 배송 경로와 차량 상태는 정상 표시됩니다.'}
                  </div>
                )}
                {!chargerLoading && chargerProvider === 'api-error' && chargerError !== 'no_base_url' && (
                  <button onClick={() => setChargerRetryCount(n => n + 1)}
                    style={{ padding: '5px 12px', border: `1px solid ${T.border}`, borderRadius: 5, background: T.surfaceSecondary, color: T.textSecondary, fontSize: 11, cursor: 'pointer', fontFamily: FONT, display: 'block', width: '100%' }}>
                    충전소 다시 조회
                  </button>
                )}
              </div>
            )}

            {/* Route health score */}
            {intlHealthScore != null && (
              <div style={{ margin: '8px 12px 0', padding: '10px 12px', background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                  <span style={{ fontSize: HMI.text.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>경로 건강 점수</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {intlConfidence && (
                      <span style={{ fontSize: 9, color: ({ none: T.textSecondary, low: T.warning, medium: T.accent, high: T.success })[intlConfidence], padding: '1px 6px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.surfaceSecondary }}>
                        신뢰도 {({ none: '없음', low: '낮음', medium: '보통', high: '높음' })[intlConfidence]}
                      </span>
                    )}
                    <button
                      onClick={() => setShowDetailsPanel(true)}
                      style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, border: `1px solid ${T.accent}50`, background: `${T.accent}12`, color: T.accent, cursor: 'pointer', fontFamily: FONT, fontWeight: 600 }}
                    >
                      판단 근거 보기
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: HMI.text.title, fontWeight: 700, color: intlHealthScore >= 80 ? T.success : intlHealthScore >= 60 ? T.warning : T.danger }}>{intlHealthScore}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 6, background: T.border, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${intlHealthScore}%`, background: intlHealthScore >= 80 ? T.success : intlHealthScore >= 60 ? T.warning : T.danger, transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ fontSize: 9, color: T.textSecondary, marginTop: 3 }}>{intlHealthScore >= 80 ? '양호' : intlHealthScore >= 60 ? '주의' : '위험'} / 100점</div>
                  </div>
                </div>
              </div>
            )}

            {/* EV Intelligence panel */}
            {intel && (
              <div style={{ margin: '8px 12px 0', background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, overflow: 'hidden' }}>
                <button onClick={() => setShowIntelPanel(v => !v)}
                  style={{ width: '100%', padding: '9px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT }}>
                  <span style={{ fontSize: HMI.text.caption, fontWeight: 600, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>EV 인텔리전스</span>
                  <span style={{ fontSize: 11, color: T.textSecondary }}>{showIntelPanel ? '▲ 접기' : '▼ 펼치기'}</span>
                </button>
                {showIntelPanel && (
                  <div style={{ borderTop: `1px solid ${T.border}`, padding: '10px 12px' }}>
                    {intlDecisionStatus && (() => {
                      const cfg = getStatusCfg(intlDecisionStatus === 'ok' ? 'canDeliver' : intlDecisionStatus === 'charge-required' ? 'chargeNeeded' : intlDecisionStatus === 'reserve-warning' ? 'reserveWarning' : intlDecisionStatus === 'low-margin' ? 'lowMargin' : intlDecisionStatus, T)
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, padding: '6px 10px', background: `${cfg.color}12`, borderRadius: 7, border: `1px solid ${cfg.color}30` }}>
                          <span style={{ fontSize: 14 }}>{cfg.icon}</span>
                          <span style={{ fontSize: HMI.text.caption, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                        </div>
                      )
                    })()}
                    {intlDecisionStatus && INTEL_REASON[intlDecisionStatus] && (
                      <div style={{ fontSize: HMI.text.caption, color: T.textSecondary, lineHeight: 1.55, marginBottom: 6 }}>
                        {INTEL_REASON[intlDecisionStatus]}
                      </div>
                    )}
                    {intel.energy?.remainingSOC != null && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: `1px solid ${T.border}` }}>
                        <span style={{ fontSize: HMI.text.caption, color: T.textSecondary }}>배송 완료 예상 SOC</span>
                        <span style={{ fontSize: HMI.text.caption, fontWeight: 600, color: T.text }}>{intel.energy.remainingSOC.toFixed(1)}%</span>
                      </div>
                    )}
                    {intlConsumption != null && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: `1px solid ${T.border}` }}>
                        <span style={{ fontSize: HMI.text.caption, color: T.textSecondary }}>예상 소비</span>
                        <span style={{ fontSize: HMI.text.caption, fontWeight: 600, color: T.text }}>{intlConsumption} kWh</span>
                      </div>
                    )}
                    {!isCurrentlyOptimal && optimizationResult && optimizationResult.savedDistanceKm > 0 && (
                      <div style={{ marginTop: 7, padding: '6px 9px', background: `${T.warning}12`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontSize: HMI.text.caption, color: T.warning }}>순서 최적화 시 {optimizationResult.savedDistanceKm} km 단축</span>
                        <button onClick={handleApplyOptimization} style={{ padding: '3px 8px', border: 'none', borderRadius: 4, background: T.warning, color: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>적용</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Delivery list */}
            <div style={{ margin: '8px 12px 0', padding: '10px 12px', background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                <span style={{ fontSize: HMI.text.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>배송 경로 ({deliveries.length}개)</span>
                <button onClick={() => { setView('setup'); setStep(4) }} style={{ fontSize: 10, color: T.accent, background: 'transparent', border: `1px solid ${T.accent}40`, borderRadius: 4, cursor: 'pointer', padding: '3px 8px', fontFamily: FONT }}>배송지 편집</button>
              </div>
              <div style={{ fontSize: HMI.text.caption, color: T.textSecondary, marginBottom: 5 }}>출발: {startPoint.name}</div>
              {deliveries.slice(0, 3).map((d, i) => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 0', borderTop: `1px solid ${T.border}40` }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: T.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, flexShrink: 0 }}>{i + 1}</div>
                  <span style={{ fontSize: HMI.text.caption, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                </div>
              ))}
              {deliveries.length > 3 && <div style={{ fontSize: 10, color: T.textSecondary, marginTop: 3 }}>+{deliveries.length - 3}개 더...</div>}
            </div>

            <div style={{ height: 12 }} />
          </div>

          {/* RIGHT PANEL — Map */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
            {deliveryRouteStatus === 'loading' && (
              <div style={{ position: 'absolute', top: 8, left: 8, right: 8, zIndex: 10, padding: '7px 12px', background: themeName === 'dark' ? 'rgba(10,11,13,0.90)' : 'rgba(255,255,255,0.95)', border: `1px solid ${T.border}`, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 8, backdropFilter: 'blur(4px)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.textSecondary, flexShrink: 0, opacity: 0.7 }} />
                <span style={{ fontSize: 12, color: T.textSecondary, fontWeight: 500, fontFamily: FONT }}>실제 도로 경로를 불러오는 중...</span>
              </div>
            )}
            {deliveryRouteStatus === 'error' && (
              <div style={{ position: 'absolute', top: 8, left: 8, right: 8, zIndex: 10, padding: '8px 12px', background: themeName === 'dark' ? 'rgba(10,11,13,0.92)' : 'rgba(255,255,255,0.97)', border: `1px solid ${T.warning}50`, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, backdropFilter: 'blur(4px)' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: T.warning }}>일부 배송지가 차량 경로로 연결되지 않습니다.</span>
                  {routeFailedLeg?.to?.name && (
                    <span style={{ fontSize: 10, fontWeight: 500, color: T.warning }}>문제 지점: {routeFailedLeg.to.name}</span>
                  )}
                  <span style={{ fontSize: 10, color: T.textSecondary }}>배송지 위치를 도로 접근 가능한 지점으로 조정하거나, 경로를 다시 계산해 주세요.</span>
                </div>
                <button onClick={() => { setRouteRetryCount(n => n + 1); setRouteFailedLeg(null) }} style={{ padding: '5px 12px', background: T.accent, color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, flexShrink: 0 }}>다시 시도</button>
              </div>
            )}
            <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <MapPanel
                T={T} themeName={themeName}
                deliveries={deliveries} chargers={scoredChargers ?? []}
                recommendedChargerId={
                  ((effectiveChargeNeeded && chargerReachable && recommendationMode !== 'review-candidate') || isReserveWarning)
                    ? (recommendedCharger?.id ?? null)
                    : null
                }
                chargerWaypoint={recommendationMode === 'review-candidate' ? null : chargerWaypoint}
                warnChargerId={warnChargerId}
                overlayState={overlayState}
                overlayData={enrichedOverlayData}
                onOpenSocModal={() => { setView('setup'); setStep(2) }}
                hmi={HMI}
                startPoint={startPoint}
                routePathResult={deliveryRoutePathResult}
                chargerRoutePathResult={recommendationMode === 'review-candidate' ? null : chargerRoutePathResult}
              />
            </div>
          </div>
          {showDetailsPanel && (
            <EVIntelligencePanel
              open={true}
              onClose={() => setShowDetailsPanel(false)}
              overlayState={overlayState}
              statusCfg={statusCfg}
              soc={soc}
              estimatedRangeKm={estimatedRangeKm}
              remainingSocAfterDelivery={remainingSocAfterDelivery}
              userMinReserveSoc={userMinReserveSoc}
              effectiveRouteKm={effectiveRouteKm}
              surplusRangeKm={surplusRangeKm}
              effectiveChargeNeeded={effectiveChargeNeeded}
              isLowMargin={isLowMargin}
              isReserveWarning={isReserveWarning}
              intel={intel}
              recommendedCharger={recommendedCharger}
              recommendationMode={recommendationMode}
              recommendationSource={recommendationSource}
              insertionExplanation={insertionExplanation}
              scoredChargers={scoredChargers}
              vehicle={vehicle}
              optimizationResult={optimizationResult}
              isCurrentlyOptimal={isCurrentlyOptimal}
              deliveryRouteStatus={deliveryRouteStatus}
              nearestRejectedDepartureChargerName={nearestRejectedDepartureChargerName}
              nearestRejectedDepartureDistanceKm={nearestRejectedDepartureDistanceKm}
              hasNearbyReachableCharger={hasNearbyReachableCharger}
              chargePlan={chargePlan}
              minRouteSocPct={minRouteSocPct}
              firstViolationLabel={firstViolationLabel}
              T={T}
              themeName={themeName}
            />
          )}
        </div>
      )}

      {/* BOTTOM BAR */}
      <div style={{ height: BAR, padding: '0 20px', display: 'flex', alignItems: 'center', gap: 0, background: T.surface, borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
        {view === 'setup' ? (
          <>
            <span style={{ fontSize: HMI.text.caption, color: T.textSecondary }}>
              {step === 1 && '차량 선택'}
              {step === 2 && `SOC ${soc}% · 최소 ${userMinReserveSoc}%`}
              {step === 3 && `출발: ${startPoint.name}`}
              {step === 4 && `배송지 ${deliveries.length}개 · ${totalRouteKm} km`}
              {step === 5 && `${totalRouteKm} km · 배송지 ${deliveries.length}개`}
            </span>
            <div style={{ flex: 1 }} />
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)}
                style={{ padding: '0 18px', border: `1px solid ${T.border}`, borderRadius: 6, background: 'transparent', color: T.text, fontSize: HMI.text.body, fontWeight: 500, cursor: 'pointer', fontFamily: FONT, minHeight: HMI.touch.normal, marginRight: 8 }}>
                ← 이전
              </button>
            )}
            {step < 5 ? (
              <button onClick={() => setStep(s => s + 1)} disabled={!stepCanProceed[step - 1]}
                style={{ padding: '0 24px', border: 'none', borderRadius: 6, background: stepCanProceed[step - 1] ? T.accent : T.surfaceSecondary, color: stepCanProceed[step - 1] ? '#fff' : T.textSecondary, fontSize: HMI.text.bodyStrong, fontWeight: 600, cursor: stepCanProceed[step - 1] ? 'pointer' : 'not-allowed', fontFamily: FONT, minHeight: HMI.touch.normal }}>
                다음 →
              </button>
            ) : (
              <button onClick={handleEnterCockpit} disabled={!isVehicleReady || deliveries.length === 0}
                style={{ padding: '0 24px', border: 'none', borderRadius: 6, background: isVehicleReady && deliveries.length > 0 ? T.accent : T.surfaceSecondary, color: isVehicleReady && deliveries.length > 0 ? '#fff' : T.textSecondary, fontSize: HMI.text.bodyStrong, fontWeight: 600, cursor: isVehicleReady && deliveries.length > 0 ? 'pointer' : 'not-allowed', fontFamily: FONT, minHeight: HMI.touch.normal }}>
                {isVehicleReady && deliveries.length > 0 ? '운전 화면 시작 →' : !isVehicleReady ? '차량을 선택하세요' : '배송지를 추가하세요'}
              </button>
            )}
          </>
        ) : (
          <>
            <div style={{ padding: '0 8px' }}>
              <div style={{ fontSize: HMI.text.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>총 경로</div>
              <div style={{ fontSize: HMI.text.title, fontWeight: 600, color: T.text }}>{effectiveRouteKm} km</div>
            </div>
            <div style={{ width: 1, height: 36, background: T.border, margin: '0 12px' }} />
            <div style={{ padding: '0 8px' }}>
              <div style={{ fontSize: HMI.text.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>배송지</div>
              <div style={{ fontSize: HMI.text.title, fontWeight: 600, color: T.text }}>{deliveries.length}개</div>
            </div>
            <div style={{ width: 1, height: 36, background: T.border, margin: '0 12px' }} />
            <div style={{ padding: '0 8px' }}>
              <div style={{ fontSize: HMI.text.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>주행 가능</div>
              <div style={{ fontSize: HMI.text.title, fontWeight: 600, color: T.text }}>{estimatedRangeKm} km</div>
            </div>
            {intlHealthScore != null && (
              <>
                <div style={{ width: 1, height: 36, background: T.border, margin: '0 12px' }} />
                <div style={{ padding: '0 8px' }}>
                  <div style={{ fontSize: HMI.text.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>경로 건강</div>
                  <div style={{ fontSize: HMI.text.title, fontWeight: 600, color: intlHealthScore >= 80 ? T.success : intlHealthScore >= 60 ? T.warning : T.danger }}>{intlHealthScore}</div>
                </div>
              </>
            )}
            <div style={{ width: 1, height: 36, background: T.border, margin: '0 14px' }} />
            {statusCfg && (
              <div style={{ padding: '7px 16px', borderRadius: 20, background: `${statusCfg.color}18`, border: `1px solid ${statusCfg.color}50`, fontSize: HMI.text.body, fontWeight: 600, color: statusCfg.color }}>
                {statusCfg.label}
              </div>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={handleReset} style={{ padding: '0 18px', border: `1px solid ${T.border}`, borderRadius: 6, background: T.surface, color: T.text, fontSize: HMI.text.body, fontWeight: 500, cursor: 'pointer', fontFamily: FONT, minHeight: HMI.touch.normal }}>
              초기화
            </button>
          </>
        )}
      </div>

      {/* ── MODALS ─────────────────────────────────────────────────────────── */}

      {/* Start point modal */}
      {showStartModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowStartModal(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 420, maxHeight: '80vh', background: T.surface, borderRadius: 14, border: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>출발지 변경</div>
              <button onClick={() => setShowStartModal(false)} style={{ width: 32, height: 32, borderRadius: '50%', background: T.surfaceSecondary, border: `1px solid ${T.border}`, fontSize: 18, color: T.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
              <PlaceSearch
                T={T} value={startSearch} onChange={setStartSearch} onSearch={handleStartSearch}
                status={startStatus} results={startResults} selected={startSelected}
                onSelect={handleStartSelect} onClear={handleStartClear}
                form={startForm} onFormChange={setStartForm}
                showAdvanced={startShowAdv} onToggleAdvanced={() => setStartShowAdv(v => !v)}
                isFormValid={isStartFormValid}
                onConfirm={handleSetStart} onCancel={() => setShowStartModal(false)} confirmLabel="출발지 설정"
              />
              <div style={{ marginTop: 10, borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
                <button onClick={handleResetStart} style={{ width: '100%', padding: '8px 0', border: `1px solid ${T.border}`, borderRadius: 6, background: 'transparent', color: T.textSecondary, fontSize: 12, cursor: 'pointer', fontFamily: FONT }}>
                  기본 출발지로 초기화 ({defaultStartPoint.name})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delivery modal */}
      {showDestModal && (
        <div onClick={e => { if (e.target === e.currentTarget) handleDestCancel() }}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 420, maxHeight: '80vh', background: T.surface, borderRadius: 14, border: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{editingId === 'new' ? '배송지 추가' : '배송지 편집'}</div>
              <button onClick={handleDestCancel} style={{ width: 32, height: 32, borderRadius: '50%', background: T.surfaceSecondary, border: `1px solid ${T.border}`, fontSize: 18, color: T.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
              <PlaceSearch
                T={T} value={destSearch} onChange={setDestSearch} onSearch={handleDestSearch}
                status={destStatus} results={destResults} selected={destSelected}
                onSelect={handleDestSelect} onClear={handleDestClear}
                form={destForm} onFormChange={setDestForm}
                showAdvanced={destShowAdv} onToggleAdvanced={() => setDestShowAdv(v => !v)}
                isFormValid={isDestFormValid}
                onConfirm={handleDestSave} onCancel={handleDestCancel} confirmLabel={editingId === 'new' ? '배송지 추가' : '저장'}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── SetupCard helper ──────────────────────────────────────────────────────────

function SetupCard({ title, done, T, children }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '16px 18px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{title}</span>
        {done && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 10, background: `${T.success}16`, border: `1px solid ${T.success}40`, color: T.success }}>✓</span>}
      </div>
      {children}
    </div>
  )
}

// ── StepperBar ────────────────────────────────────────────────────────────────

function StepperBar({ step, T }) {
  const LABELS = ['차량', '배터리', '출발지', '배송지', '확인']
  const items = []
  LABELS.forEach((label, i) => {
    const num = i + 1
    const isCurrent = num === step
    const isDone = num < step
    if (i > 0) {
      items.push(
        <div key={`l${i}`} style={{ flex: 1, height: 2, background: isDone ? T.accent : T.border, maxWidth: 40, minWidth: 10 }} />
      )
    }
    items.push(
      <div key={num} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: isDone ? T.success : isCurrent ? T.accent : T.surfaceSecondary,
          color: isDone || isCurrent ? '#fff' : T.textSecondary,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 600, flexShrink: 0,
          border: `1px solid ${isDone ? T.success : isCurrent ? T.accent : T.border}`,
        }}>
          {isDone ? '✓' : num}
        </div>
        <span style={{ fontSize: 10, color: isCurrent ? T.accent : isDone ? T.success : T.textSecondary, fontWeight: isCurrent ? 600 : 400, whiteSpace: 'nowrap' }}>
          {label}
        </span>
      </div>
    )
  })
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 28px', background: T.surface, borderBottom: `1px solid ${T.border}`, flexShrink: 0, gap: 0 }}>
      {items}
    </div>
  )
}
