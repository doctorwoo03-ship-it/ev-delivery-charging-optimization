import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANDS, VEHICLES } from '../data/vehicleData'
import { depot, deliveries as INITIAL_DELIVERIES } from '../data/sampleData'
import { CHARGERS } from '../services/chargerService'

const defaultStartPoint = { id: 'depot', name: depot.name, lat: depot.lat, lng: depot.lng, address: '' }
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
import { saveRouteIntelligence } from '../state/routeIntelligenceStore'
import { saveDriverSession, loadDriverSession, clearDriverSession, saveUserMinReserveSoc, loadUserMinReserveSoc } from '../state/driverSessionStore'
import { isValidRoadRouteResult } from '../utils/routeValidation'

const EMPTY_CUSTOM = { name: '', batteryCapacityKwh: '', maxRangeKm: '', efficiencyKmPerKwh: '' }
const EMPTY_DEST_FORM = { name: '', lat: '', lng: '', address: '' }

const HDR = 56
const BAR = 84
const OUTER_HDR = 52

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
  touch: { small: 40, normal: 48, large: 56 },
}

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
    <div style={{ height, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <img src={src} alt={alt} onError={() => setFailed(true)} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />
    </div>
  )
}

function BatteryBar({ percent, T }) {
  return (
    <div style={{ background: T.border, borderRadius: 3, height: 5, overflow: 'hidden' }}>
      <div style={{ width: `${percent}%`, background: percent >= 30 ? T.success : T.danger, height: '100%', transition: 'width 0.3s' }} />
    </div>
  )
}

function BrandChip({ brand, onClick, T }) {
  return (
    <div onClick={onClick} style={{ cursor: 'pointer', border: `1px solid ${T.border}`, background: 'transparent', borderRadius: 6, padding: '8px 4px', textAlign: 'center', transition: 'all 0.15s', userSelect: 'none' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: T.surfaceSecondary, color: T.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: brand.logoText.length > 3 ? 8 : brand.logoText.length > 1 ? 10 : 13, fontWeight: 600, margin: '0 auto 6px' }}>
        {brand.logoText}
      </div>
      <div style={{ fontSize: 11, fontWeight: 400, color: T.textSecondary }}>{brand.name}</div>
    </div>
  )
}

function ModelCard({ vehicle, selected, onClick, T }) {
  return (
    <div onClick={onClick} style={{ cursor: 'pointer', border: `1px solid ${selected ? T.accent : T.border}`, background: selected ? `${T.accent}12` : T.surfaceSecondary, borderRadius: 8, overflow: 'hidden', transition: 'all 0.15s', userSelect: 'none' }}>
      <VehicleImage src={vehicle.image} alt={vehicle.name} height={96} bg={selected ? `${T.accent}08` : T.bg} T={T} />
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: selected ? T.accent : T.text, marginBottom: 6, lineHeight: 1.3 }}>{vehicle.name}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 11, color: T.textSecondary }}>{vehicle.batteryCapacityKwh} kWh</span>
          <span style={{ fontSize: 11, color: T.textSecondary }}>{vehicle.efficiencyKmPerKwh?.toFixed(1)} km/kWh</span>
          <span style={{ fontSize: 11, color: T.textSecondary }}>최대 {vehicle.maxRangeKm} km</span>
        </div>
      </div>
    </div>
  )
}

function DestSearchForm({
  T, FONT, searchQuery, setSearchQuery, searchStatus, setSearchStatus, searchResults,
  selectedSearchResult, showAdvancedInput, setShowAdvancedInput,
  destForm, setDestForm, isDestFormValid,
  onSearch, onSelectResult, onClearResult, onSave, onCancel, saveLabel,
}) {
  const debounceRef = useRef(null)
  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 6, boxSizing: 'border-box', border: `1px solid ${T.border}`, background: T.surfaceSecondary, color: T.text, fontSize: 14, fontFamily: FONT }

  // Debounced auto-search: fires 400ms after user stops typing (2+ chars)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!searchQuery.trim()) {
      setSearchStatus('idle')
      return
    }
    if (searchQuery.trim().length < 2) return
    debounceRef.current = setTimeout(() => { onSearch(searchQuery) }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery])

  function triggerSearch() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    onSearch(searchQuery)
  }

  const showIdleHint = searchStatus === 'idle' && !searchQuery.trim()
  const showAutoHint = searchQuery.trim().length >= 2 && searchStatus === 'idle'

  return (
    <>
      {/* Search input + button */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && triggerSearch()}
          placeholder="장소명 또는 주소 검색 (예: 선릉역, 강남 테헤란로)"
          style={{ ...inputStyle, flex: 1 }}
          autoFocus
          autoComplete="off"
        />
        <button
          onClick={triggerSearch}
          disabled={!searchQuery.trim() || searchStatus === 'searching'}
          style={{ padding: '10px 16px', borderRadius: 6, border: 'none', background: searchQuery.trim() ? T.accent : T.surfaceSecondary, color: searchQuery.trim() ? '#fff' : T.textSecondary, fontSize: 13, fontWeight: 600, cursor: searchQuery.trim() && searchStatus !== 'searching' ? 'pointer' : 'not-allowed', fontFamily: FONT, flexShrink: 0, transition: 'background 0.15s' }}
        >
          {searchStatus === 'searching' ? '...' : '검색'}
        </button>
      </div>

      {/* Status messages */}
      {showIdleHint && (
        <div style={{ padding: '8px 12px', background: T.surfaceSecondary, borderRadius: 6, fontSize: 12, color: T.textSecondary, marginBottom: 8 }}>
          장소명 또는 주소를 입력하세요.
        </div>
      )}
      {showAutoHint && (
        <div style={{ padding: '6px 12px', background: T.surfaceSecondary, borderRadius: 6, fontSize: 12, color: T.textSecondary, marginBottom: 8 }}>
          잠시 후 자동 검색됩니다...
        </div>
      )}
      {searchStatus === 'searching' && (
        <div style={{ padding: '8px 12px', background: T.surfaceSecondary, borderRadius: 6, fontSize: 12, color: T.textSecondary, marginBottom: 8 }}>검색 중...</div>
      )}
      {searchStatus === 'no-results' && (
        <div style={{ padding: '8px 12px', background: T.surfaceSecondary, borderRadius: 6, fontSize: 12, color: T.textSecondary, marginBottom: 8 }}>
          검색 결과가 없습니다. 더 구체적인 장소명이나 도로명 주소를 입력해 보세요.
        </div>
      )}
      {searchStatus === 'error' && (
        <div style={{ padding: '8px 12px', background: `${T.danger}15`, borderRadius: 6, fontSize: 12, color: T.danger, marginBottom: 8 }}>
          장소 검색을 불러올 수 없습니다. VITE_KAKAO_MAP_API_KEY 또는 VITE_KAKAO_MAP_KEY, 또는 카카오 개발자 콘솔의 서비스 설정을 확인해 주세요.
          아래 좌표 직접 입력을 임시 대안으로 사용할 수 있습니다.
        </div>
      )}

      {/* Search result cards */}
      {searchStatus === 'done' && searchResults.length > 0 && !selectedSearchResult && (
        <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
          {searchResults.map(result => (
            <div
              key={result.id}
              onClick={() => onSelectResult(result)}
              style={{ padding: '10px 12px', background: T.surfaceSecondary, borderRadius: 8, border: `1px solid ${T.border}`, cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 8 }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60%' }}>{result.name}</span>
                  {result.category && (
                    <span style={{ fontSize: 9, color: T.textSecondary, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 3, padding: '1px 5px', flexShrink: 0, whiteSpace: 'nowrap' }}>{result.category}</span>
                  )}
                </div>
                {result.roadAddress && (
                  <div style={{ fontSize: 11, color: T.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 1 }}>{result.roadAddress}</div>
                )}
                {result.lotAddress && result.lotAddress !== result.roadAddress && (
                  <div style={{ fontSize: 10, color: T.border, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 1 }}>{result.lotAddress}</div>
                )}
                <div style={{ fontSize: 10, color: T.border, marginTop: 1 }}>{result.lat.toFixed(5)}, {result.lng.toFixed(5)}</div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); onSelectResult(result) }}
                style={{ padding: '5px 12px', borderRadius: 5, border: `1px solid ${T.accent}50`, background: `${T.accent}18`, color: T.accent, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, flexShrink: 0, alignSelf: 'center' }}
              >
                선택
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Selected result preview */}
      {selectedSearchResult && (
        <div style={{ marginBottom: 10, padding: '10px 12px', background: `${T.accent}12`, borderRadius: 8, border: `1px solid ${T.accent}50`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: T.accent, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>선택된 장소</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedSearchResult.name}</div>
            {selectedSearchResult.roadAddress && (
              <div style={{ fontSize: 11, color: T.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedSearchResult.roadAddress}</div>
            )}
            {selectedSearchResult.lotAddress && selectedSearchResult.lotAddress !== selectedSearchResult.roadAddress && (
              <div style={{ fontSize: 10, color: T.border, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedSearchResult.lotAddress}</div>
            )}
          </div>
          <button
            onClick={onClearResult}
            style={{ width: 26, height: 26, borderRadius: '50%', background: T.surfaceSecondary, border: `1px solid ${T.border}`, color: T.textSecondary, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, flexShrink: 0, lineHeight: 1 }}
          >×</button>
        </div>
      )}

      {/* Advanced: manual coordinate input (collapsed by default) */}
      <div style={{ marginBottom: 10 }}>
        <button
          onClick={() => setShowAdvancedInput(v => !v)}
          style={{ fontSize: 11, color: T.textSecondary, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: FONT, padding: '2px 0', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          {showAdvancedInput ? '▲ 좌표 직접 입력 숨기기' : '▼ 좌표 직접 입력 (고급)'}
        </button>
        {showAdvancedInput && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { key: 'name', label: '배송지 이름', type: 'text', placeholder: '예) 강남역' },
              { key: 'lat', label: '위도 (Lat)', type: 'number', placeholder: '예) 37.4979' },
              { key: 'lng', label: '경도 (Lng)', type: 'number', placeholder: '예) 127.0276' },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <div style={{ fontSize: 10, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, fontWeight: 500 }}>{label}</div>
                <input
                  type={type}
                  value={destForm[key]}
                  onChange={e => setDestForm(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onSave}
          disabled={!isDestFormValid}
          style={{ flex: 1, padding: '11px 0', borderRadius: 6, border: 'none', background: isDestFormValid ? T.accent : T.surfaceSecondary, color: isDestFormValid ? '#fff' : T.textSecondary, fontSize: 13, fontWeight: 600, cursor: isDestFormValid ? 'pointer' : 'not-allowed', fontFamily: FONT }}
        >
          {saveLabel}
        </button>
        <button
          onClick={onCancel}
          style={{ padding: '11px 18px', borderRadius: 6, border: `1px solid ${T.border}`, background: 'transparent', color: T.textSecondary, fontSize: 13, cursor: 'pointer', fontFamily: FONT }}
        >
          취소
        </button>
      </div>
    </>
  )
}

function BottomStat({ label, value, T }) {
  return (
    <div style={{ padding: '0 8px' }}>
      <div style={{ fontSize: HMI.text.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: HMI.text.title, fontWeight: 600, color: T.text, letterSpacing: '-0.01em' }}>{value}</div>
    </div>
  )
}

export default function MVP6Page() {
  const navigate = useNavigate()
  const [themeName, setThemeName] = useState(getInitialTheme)
  const T = THEMES[themeName]
  const toggleTheme = () => {
    setThemeName(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      try { localStorage.setItem('ev-theme', next) } catch {}
      return next
    })
  }

  const [view, setView] = useState(() => loadDriverSession() ? 'cockpit' : 'setup')
  const [setupStep, setSetupStep] = useState('vehicle')
  const [selectedBrand, setSelectedBrand] = useState(() => loadDriverSession()?.selectedBrand ?? '')
  const [selectedId, setSelectedId] = useState(() => loadDriverSession()?.selectedId ?? '')
  const [custom, setCustom] = useState(() => loadDriverSession()?.custom ?? EMPTY_CUSTOM)
  const [soc, setSoc] = useState(() => loadDriverSession()?.soc ?? 80)
  const [userMinReserveSoc, setUserMinReserveSoc] = useState(() => loadDriverSession()?.userMinReserveSoc ?? loadUserMinReserveSoc())
  const [showSocModal, setShowSocModal] = useState(false)
  const [socDraft, setSocDraft] = useState(80)
  const [minReserveDraft, setMinReserveDraft] = useState(10)
  const [routeExpanded, setRouteExpanded] = useState(false)
  const [calcExpanded, setCalcExpanded] = useState(false)
  const [showChargePlanDetail, setShowChargePlanDetail] = useState(false)
  const [intelligenceResult, setIntelligenceResult] = useState(null)
  // Delivery route (start → all deliveries, NO charger waypoint).
  // This route is always attempted and is the primary polyline on the driver map.
  const [deliveryRoutePathResult, setDeliveryRoutePathResult] = useState(() => {
    const s = loadDriverSession()
    return isValidRoadRouteResult(s?.routePathResult) ? s.routePathResult : null
  })
  const [deliveryRouteStatus, setDeliveryRouteStatus] = useState(() =>
    isValidRoadRouteResult(loadDriverSession()?.routePathResult) ? 'ready' : 'loading'
  )
  const [deliveryRouteErrorDetail, setDeliveryRouteErrorDetail] = useState(null)
  // Skip the initial fetch when a valid delivery route was restored from session.
  const isMountedWithSessionRef = useRef(isValidRoadRouteResult(loadDriverSession()?.routePathResult))

  // Charger route (start → recommended charger only).
  // Requested separately only when charger is reachable. Failure here does NOT
  // fail the delivery route.
  const [chargerRoutePathResult, setChargerRoutePathResult] = useState(null)
  const [chargerRouteStatus, setChargerRouteStatus]         = useState('idle')

  // Aliases so the rest of this file can keep using the original variable names.
  const routePathResult  = deliveryRoutePathResult
  const routeStatus      = deliveryRouteStatus
  const routeErrorDetail = deliveryRouteErrorDetail

  const [routeRetryCount, setRouteRetryCount] = useState(0)
  const [deliveries, setDeliveries] = useState(() => loadDriverSession()?.deliveries ?? INITIAL_DELIVERIES)
  const [showDestModal, setShowDestModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [destForm, setDestForm] = useState(EMPTY_DEST_FORM)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchStatus, setSearchStatus] = useState('idle')
  const [selectedSearchResult, setSelectedSearchResult] = useState(null)
  const [showAdvancedInput, setShowAdvancedInput] = useState(false)
  const searchSeqRef = useRef(0)

  // Starting point state
  const [startPoint, setStartPoint] = useState(() => loadDriverSession()?.startPoint ?? defaultStartPoint)
  const [showStartModal, setShowStartModal] = useState(false)
  const [startSearchQuery, setStartSearchQuery] = useState('')
  const [startSearchResults, setStartSearchResults] = useState([])
  const [startSearchStatus, setStartSearchStatus] = useState('idle')
  const [startSelectedResult, setStartSelectedResult] = useState(null)
  const [startShowAdvanced, setStartShowAdvanced] = useState(false)
  const [startForm, setStartForm] = useState(EMPTY_DEST_FORM)
  const startSearchSeqRef = useRef(0)

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
      const efficiency = enteredEff > 0 ? enteredEff : (capacity > 0 && range > 0) ? parseFloat((range / capacity).toFixed(1)) : 0
      return { id: 'custom', fullName: custom.name || '커스텀 차량', grade: '직접 입력', batteryCapacityKwh: capacity, maxRangeKm: range, efficiencyKmPerKwh: efficiency }
    }
    if (!selectedId) return null
    return VEHICLES.find(v => v.id === selectedId) ?? null
  }, [selectedBrand, isCustomBrand, selectedId, custom])

  const totalRouteKm = useMemo(() => parseFloat(calculateRouteDistance(startPoint, deliveries).toFixed(1)), [startPoint, deliveries])
  const { isVehicleReady, remainingKwh, estimatedRangeKm, drivableRangeKm, canDeliver, chargeNeeded, shortageKm } = useBatteryCalculation({ vehicle, soc, totalRouteKm })

  // Compute road-based feasibility BEFORE charger recommendation so effectiveChargeNeeded
  // can be passed to the hook, enabling correct nearest-reachable charger selection.
  const roadDistanceAvailable = !routePathResult?.isFallback && routePathResult?.distanceKm != null
  const roadDeliveryKm = roadDistanceAvailable ? routePathResult.distanceKm : null
  const effectiveCanDeliver = roadDistanceAvailable
    ? (isVehicleReady && parseFloat(estimatedRangeKm) >= routePathResult.distanceKm)
    : canDeliver
  const effectiveChargeNeeded = isVehicleReady && !effectiveCanDeliver

  const { recommendedCharger, depotToRecommendedChargerKm, chargerReachable, displayRouteKm, chargerWaypoint, warnChargerId, scoredChargers, nearestUnreachable, recommendationMode, mockCoverageWarning } = useChargerRecommendation({ deliveries, chargeNeeded: effectiveChargeNeeded, drivableRangeKm, totalRouteKm, startPoint })
  const effectiveRouteKm = roadDeliveryKm ?? displayRouteKm

  // Low-margin: vehicle CAN complete delivery but surplus range or remaining SOC is very small.
  const surplusRangeKm = parseFloat((parseFloat(estimatedRangeKm) - effectiveRouteKm).toFixed(1))
  const remainingSocAfterDelivery = (isVehicleReady && vehicle?.batteryCapacityKwh > 0 && vehicle?.efficiencyKmPerKwh > 0)
    ? parseFloat(Math.max(0, (Math.max(0, surplusRangeKm) / vehicle.efficiencyKmPerKwh / vehicle.batteryCapacityKwh) * 100).toFixed(1))
    : null
  const SYSTEM_SAFETY_SOC_THRESHOLD = 5
  const isLowMargin = effectiveCanDeliver && isVehicleReady && (
    (remainingSocAfterDelivery != null && remainingSocAfterDelivery < SYSTEM_SAFETY_SOC_THRESHOLD) ||
    surplusRangeKm < 3
  )
  // reserve-warning: delivery is physically possible, but predicted arrival SOC is below
  // the driver's userMinReserveSoc preference (and above the hard safety threshold).
  const isReserveWarning = effectiveCanDeliver && isVehicleReady && !isLowMargin && (
    remainingSocAfterDelivery != null && remainingSocAfterDelivery < userMinReserveSoc
  )

  const chargePlan = useChargingPlan({ chargeNeeded: effectiveChargeNeeded, chargerReachable, recommendedCharger, depotToRecommendedChargerKm, displayRouteKm: effectiveRouteKm, remainingKwh, vehicle, isVehicleReady, userMinReserveSoc })

  const optimizationResult = useMemo(() => {
    if (deliveries.length < 2) return null
    return optimizeDeliveryOrder(startPoint, deliveries)
  }, [startPoint, deliveries])

  const isCurrentlyOptimal = useMemo(() => {
    if (!optimizationResult || optimizationResult.savedDistanceKm === 0) return true
    const optIds = optimizationResult.optimizedDeliveries.map(d => d.id).join(',')
    const curIds = deliveries.map(d => d.id).join(',')
    return optIds === curIds
  }, [optimizationResult, deliveries])

  // chargerReachable meanings:
  //   true  → charger found and reachable → 'chargeNeeded'
  //   false → confirmed no reachable charger → 'unreachable' (danger)
  //   null  → reachability not yet resolved (async API) or chargeNeeded=false
  //            → 'critical': shown as a temporary checking state, NOT a confirmed error
  const overlayState = !isVehicleReady ? null
    : (effectiveCanDeliver && !isLowMargin && !isReserveWarning) ? 'canDeliver'
    : isLowMargin ? 'lowMargin'
    : isReserveWarning ? 'reserveWarning'
    : chargerReachable === true ? 'chargeNeeded'
    : recommendationMode === 'no-local-data' ? 'no-local-data'
    : chargerReachable === false ? 'unreachable'
    : 'critical'

  const intel = intelligenceResult
  const defaultEff = vehicle?.combinedEfficiencyKmPerKwh ?? vehicle?.efficiencyKmPerKwh ?? null
  const intlEff = intel?.energy?.effectiveEfficiencyKmPerKwh ?? null
  const isPersonalized = intlEff != null && defaultEff != null && Math.abs(intlEff - defaultEff) >= 0.01
  const intlHealthScore = intel?.summary?.routeHealthScore ?? null
  const intlConfidence = intel?.energy?.confidenceLevel ?? null
  const intlConsumption = intel?.energy?.estimatedConsumptionKwh ?? null

  const overlayData = useMemo(() => {
    if (overlayState === 'canDeliver') {
      const nextSegKm = deliveries.length > 0
        ? parseFloat(haversineKm(startPoint.lat, startPoint.lng, deliveries[0].lat, deliveries[0].lng).toFixed(1))
        : 0
      return { nextDeliveryName: deliveries[0]?.name ?? '-', nextSegmentKm: nextSegKm, displayRouteKm: effectiveRouteKm, deliveryCount: deliveries.length }
    }
    if (overlayState === 'lowMargin') {
      const nextSegKm = deliveries.length > 0
        ? parseFloat(haversineKm(startPoint.lat, startPoint.lng, deliveries[0].lat, deliveries[0].lng).toFixed(1))
        : 0
      return {
        nextDeliveryName: deliveries[0]?.name ?? '-',
        nextSegmentKm: nextSegKm,
        displayRouteKm: effectiveRouteKm,
        deliveryCount: deliveries.length,
        surplusRangeKm: Math.max(0, surplusRangeKm),
        remainingSocAfterDelivery,
      }
    }
    if (overlayState === 'reserveWarning') {
      const nextSegKm = deliveries.length > 0
        ? parseFloat(haversineKm(startPoint.lat, startPoint.lng, deliveries[0].lat, deliveries[0].lng).toFixed(1))
        : 0
      const gap = (remainingSocAfterDelivery != null && userMinReserveSoc != null)
        ? parseFloat((userMinReserveSoc - remainingSocAfterDelivery).toFixed(1))
        : null
      return {
        nextDeliveryName: deliveries[0]?.name ?? '-',
        nextSegmentKm: nextSegKm,
        displayRouteKm: effectiveRouteKm,
        deliveryCount: deliveries.length,
        surplusRangeKm: Math.max(0, surplusRangeKm),
        remainingSocAfterDelivery,
        userMinReserveSoc,
        gap,
        recommendedCharger,
        chargerDistKm: depotToRecommendedChargerKm,
      }
    }
    if (overlayState === 'chargeNeeded') {
      return {
        chargerName: recommendedCharger?.name ?? '',
        distKm: depotToRecommendedChargerKm,
        chargePlan,
        chargerOperator: recommendedCharger?.operator ?? '',
        chargerPricePerKwh: recommendedCharger?.pricePerKwh ?? null,
        recommendationReason: recommendedCharger?.recommendationReason ?? null,
        remainingSocAfterDelivery,
      }
    }
    if (overlayState === 'unreachable') {
      const nearestDistKm = nearestUnreachable?.distanceFromStartKm ?? null
      const shortageKmVal = nearestDistKm != null
        ? parseFloat((nearestDistKm - parseFloat(estimatedRangeKm)).toFixed(1))
        : null
      return {
        chargerDistKm: nearestDistKm,
        drivableKm: estimatedRangeKm,
        shortageKm: shortageKmVal != null && shortageKmVal > 0.05 ? shortageKmVal : null,
        currentSoc: soc,
      }
    }
    if (overlayState === 'no-local-data') {
      return { drivableKm: estimatedRangeKm, currentSoc: soc }
    }
    if (overlayState === 'critical') {
      return { drivableKm: estimatedRangeKm, currentSoc: soc }
    }
    return null
  }, [overlayState, deliveries, effectiveRouteKm, estimatedRangeKm, soc, recommendedCharger, depotToRecommendedChargerKm, chargePlan, surplusRangeKm, remainingSocAfterDelivery, nearestUnreachable, startPoint, userMinReserveSoc])

  const enrichedOverlayData = useMemo(() => {
    if (!overlayData || !intel) return overlayData
    if (overlayState === 'canDeliver' || overlayState === 'lowMargin' || overlayState === 'reserveWarning') {
      return {
        ...overlayData,
        estimatedConsumptionKwh: intel.energy?.estimatedConsumptionKwh ?? null,
        confidenceLevel: intel.energy?.confidenceLevel ?? null,
      }
    }
    if (overlayState === 'chargeNeeded') {
      return {
        ...overlayData,
        estimatedConsumptionKwh: intel.energy?.estimatedConsumptionKwh ?? null,
        confidenceLevel: intel.energy?.confidenceLevel ?? null,
        deliverySuccessPct: intel.summary?.routeHealthScore ?? null,
      }
    }
    return overlayData
  }, [overlayData, overlayState, intel])

  const socStepRange = isVehicleReady
    ? (((vehicle.batteryCapacityKwh * soc) / 100) * vehicle.efficiencyKmPerKwh).toFixed(1)
    : null
  const socDraftRange = isVehicleReady
    ? (((vehicle.batteryCapacityKwh * socDraft) / 100) * vehicle.efficiencyKmPerKwh).toFixed(1)
    : null

  function handleBrandChange(brandId) { setSelectedBrand(brandId); setSelectedId(''); setCustom(EMPTY_CUSTOM) }

  function resetSearchState() {
    setSearchQuery(''); setSearchResults([]); setSearchStatus('idle'); setSelectedSearchResult(null); setShowAdvancedInput(false)
  }

  function resetStartSearchState() {
    setStartSearchQuery(''); setStartSearchResults([]); setStartSearchStatus('idle'); setStartSelectedResult(null); setStartShowAdvanced(false)
  }

  function handleReset() {
    clearDriverSession()
    setSelectedBrand(''); setSelectedId(''); setCustom(EMPTY_CUSTOM); setSoc(80)
    setView('setup'); setSetupStep('vehicle'); setShowSocModal(false); setSocDraft(80)
    setRouteExpanded(false); setCalcExpanded(false); setShowChargePlanDetail(false)
    setDeliveries(INITIAL_DELIVERIES); setShowDestModal(false); setEditingId(null); setDestForm(EMPTY_DEST_FORM)
    setSearchQuery(''); setSearchResults([]); setSearchStatus('idle'); setSelectedSearchResult(null); setShowAdvancedInput(false)
    setStartPoint(defaultStartPoint); setShowStartModal(false); resetStartSearchState(); setStartForm(EMPTY_DEST_FORM)
    setDeliveryRoutePathResult(null); setDeliveryRouteStatus('loading'); setDeliveryRouteErrorDetail(null)
    setChargerRoutePathResult(null); setChargerRouteStatus('idle')
  }

  function handleOpenDestModal() { setShowDestModal(true) }
  function handleCloseDestModal() { setShowDestModal(false); setEditingId(null); setDestForm(EMPTY_DEST_FORM); resetSearchState() }
  function handleDestStartEdit(dest) {
    setEditingId(dest.id)
    setDestForm({ name: dest.name, lat: String(dest.lat), lng: String(dest.lng), address: dest.address || '' })
    resetSearchState()
  }
  function handleDestStartAdd() { setEditingId('new'); setDestForm(EMPTY_DEST_FORM); resetSearchState() }
  function handleDestSave() {
    const lat = parseFloat(destForm.lat)
    const lng = parseFloat(destForm.lng)
    if (!destForm.name.trim() || isNaN(lat) || isNaN(lng)) return
    if (editingId === 'new') {
      setDeliveries(prev => [...prev, { id: Date.now(), name: destForm.name.trim(), lat, lng, address: destForm.address || '' }])
    } else {
      setDeliveries(prev => prev.map(d => d.id === editingId ? { ...d, name: destForm.name.trim(), lat, lng, address: destForm.address || '' } : d))
    }
    setEditingId(null); setDestForm(EMPTY_DEST_FORM); resetSearchState()
  }
  function handleDestDelete(id) {
    setDeliveries(prev => prev.filter(d => d.id !== id))
    if (editingId === id) { setEditingId(null); setDestForm(EMPTY_DEST_FORM); resetSearchState() }
  }
  function handleDestCancel() { setEditingId(null); setDestForm(EMPTY_DEST_FORM); resetSearchState() }

  async function handlePlaceSearch(query) {
    if (!query.trim()) return
    const seq = ++searchSeqRef.current
    setSearchStatus('searching')
    setSearchResults([])
    setSelectedSearchResult(null)

    try {
      await loadKakaoServices()
    } catch {
      if (seq !== searchSeqRef.current) return
      setSearchStatus('error')
      setShowAdvancedInput(true)
      return
    }
    if (seq !== searchSeqRef.current) return

    const services = window.kakao.maps.services
    const ps = new services.Places()
    ps.keywordSearch(query.trim(), (data, status) => {
      if (seq !== searchSeqRef.current) return
      if (status === services.Status.OK && data.length > 0) {
        setSearchResults(data.slice(0, 6).map(p => ({
          id: p.id,
          name: p.place_name,
          roadAddress: p.road_address_name || '',
          lotAddress: p.address_name || '',
          address: p.road_address_name || p.address_name,
          category: p.category_group_name || (p.category_name ? p.category_name.split(' > ')[0] : ''),
          lat: parseFloat(p.y),
          lng: parseFloat(p.x),
        })))
        setSearchStatus('done')
      } else {
        const gc = new services.Geocoder()
        gc.addressSearch(query.trim(), (gData, gStatus) => {
          if (seq !== searchSeqRef.current) return
          if (gStatus === services.Status.OK && gData.length > 0) {
            setSearchResults(gData.slice(0, 4).map(a => ({
              id: a.address_name,
              name: a.address_name,
              roadAddress: a.road_address?.address_name || '',
              lotAddress: a.address_name || '',
              address: a.road_address?.address_name || a.address_name,
              category: '',
              lat: parseFloat(a.y),
              lng: parseFloat(a.x),
            })))
            setSearchStatus('done')
          } else {
            setSearchResults([])
            setSearchStatus('no-results')
          }
        })
      }
    })
  }

  function handleSelectSearchResult(result) {
    setSelectedSearchResult(result)
    setDestForm({ name: result.name, lat: String(result.lat), lng: String(result.lng), address: result.address || '' })
  }

  const isDestFormValid = destForm.name.trim() !== '' && !isNaN(parseFloat(destForm.lat)) && !isNaN(parseFloat(destForm.lng))

  // Starting point search handlers
  async function handleStartPlaceSearch(query) {
    if (!query.trim()) return
    const seq = ++startSearchSeqRef.current
    setStartSearchStatus('searching')
    setStartSearchResults([])
    setStartSelectedResult(null)

    try {
      await loadKakaoServices()
    } catch {
      if (seq !== startSearchSeqRef.current) return
      setStartSearchStatus('error')
      setStartShowAdvanced(true)
      return
    }
    if (seq !== startSearchSeqRef.current) return

    const services = window.kakao.maps.services
    const ps = new services.Places()
    ps.keywordSearch(query.trim(), (data, status) => {
      if (seq !== startSearchSeqRef.current) return
      if (status === services.Status.OK && data.length > 0) {
        setStartSearchResults(data.slice(0, 6).map(p => ({
          id: p.id,
          name: p.place_name,
          roadAddress: p.road_address_name || '',
          lotAddress: p.address_name || '',
          address: p.road_address_name || p.address_name,
          category: p.category_group_name || (p.category_name ? p.category_name.split(' > ')[0] : ''),
          lat: parseFloat(p.y),
          lng: parseFloat(p.x),
        })))
        setStartSearchStatus('done')
      } else {
        const gc = new services.Geocoder()
        gc.addressSearch(query.trim(), (gData, gStatus) => {
          if (seq !== startSearchSeqRef.current) return
          if (gStatus === services.Status.OK && gData.length > 0) {
            setStartSearchResults(gData.slice(0, 4).map(a => ({
              id: a.address_name,
              name: a.address_name,
              roadAddress: a.road_address?.address_name || '',
              lotAddress: a.address_name || '',
              address: a.road_address?.address_name || a.address_name,
              category: '',
              lat: parseFloat(a.y),
              lng: parseFloat(a.x),
            })))
            setStartSearchStatus('done')
          } else {
            setStartSearchResults([])
            setStartSearchStatus('no-results')
          }
        })
      }
    })
  }

  function handleStartSelectResult(result) {
    setStartSelectedResult(result)
    setStartForm({ name: result.name, lat: String(result.lat), lng: String(result.lng), address: result.address || '' })
  }

  const isStartFormValid = startForm.name.trim() !== '' && !isNaN(parseFloat(startForm.lat)) && !isNaN(parseFloat(startForm.lng))

  function handleSetStartPoint() {
    const lat = parseFloat(startForm.lat)
    const lng = parseFloat(startForm.lng)
    if (!startForm.name.trim() || isNaN(lat) || isNaN(lng)) return
    setStartPoint({ id: startSelectedResult?.id || 'custom-start', name: startForm.name.trim(), lat, lng, address: startForm.address || '' })
    setShowStartModal(false)
    resetStartSearchState()
    setStartForm(EMPTY_DEST_FORM)
  }

  function handleResetStartPoint() {
    setStartPoint(defaultStartPoint)
    setShowStartModal(false)
    resetStartSearchState()
    setStartForm(EMPTY_DEST_FORM)
  }

  function openSocModal() { setSocDraft(soc); setMinReserveDraft(userMinReserveSoc); setShowSocModal(true) }
  function saveSoc() { setSoc(socDraft); setUserMinReserveSoc(minReserveDraft); setShowSocModal(false) }

  useEffect(() => { saveUserMinReserveSoc(userMinReserveSoc) }, [userMinReserveSoc])

  function handleApplyOptimization() {
    if (!optimizationResult || isCurrentlyOptimal) return
    setDeliveries([...optimizationResult.optimizedDeliveries])
  }

  useEffect(() => {
    if (document.getElementById('ev-pretendard')) return
    const link = document.createElement('link')
    link.id = 'ev-pretendard'
    link.rel = 'stylesheet'
    link.href = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css'
    document.head.appendChild(link)
  }, [])

  useEffect(() => {
    if (!isVehicleReady || view !== 'cockpit') { setIntelligenceResult(null); return }
    let cancelled = false
    const routeResult = {
      distanceKm: effectiveRouteKm,
      durationMin: routePathResult?.durationMin ?? null,
      isFallback: routePathResult?.isFallback ?? true,
      source: routePathResult?.source ?? 'fallback-polyline',
    }
    const chargingPayload = {
      chargeNeeded: effectiveChargeNeeded,
      // When road distance triggers chargeNeeded but haversine didn't, chargerReachable is null
      // (no charger was evaluated). Treat as false so routeHealth reflects the critical state.
      chargerReachable: effectiveChargeNeeded ? (chargerReachable ?? false) : (chargerReachable ?? null),
      recommendedCharger: effectiveChargeNeeded && chargerReachable ? recommendedCharger : null,
      chargePlan: effectiveChargeNeeded && chargerReachable && chargePlan
        ? { targetSoc: chargePlan.targetSoc, finalDeliverySOC: chargePlan.finalDeliverySOC, chargeAmountKwh: chargePlan.chargeAmountKwh, chargeTimeMin: chargePlan.chargeTimeMin, totalExtraCost: chargePlan.totalExtraCost }
        : null,
    }
    const chargingPayloadWithMode = {
      ...chargingPayload,
      recommendationMode,
      mockCoverageWarning: mockCoverageWarning ?? false,
      isLowMargin,
      isReserveWarning,
      userMinReserveSoc,
    }
    analyzeRoute({ userId: 'demo-driver-001', vehicle, batterySOC: soc, routeResult, chargingResult: chargingPayloadWithMode, optimizationResult: optimizationResult ?? null, userMinReserveSoc })
      .then(r => {
        if (!cancelled) {
          setIntelligenceResult(r)
          saveRouteIntelligence({
            userId: 'demo-driver-001',
            vehicle,
            batterySOC: soc,
            startPoint,
            deliveries,
            recommendedCharger: (effectiveChargeNeeded && chargerReachable) ? recommendedCharger : (isReserveWarning ? recommendedCharger : null),
            routePathResult,
            chargerRoutePathResult,
            routeIntelligenceResult: r,
            chargePlan: effectiveChargeNeeded && chargerReachable ? chargePlan : null,
            optimizationResult: optimizationResult ?? null,
            recommendationMode,
            mockCoverageWarning: mockCoverageWarning ?? false,
            chargerReachable,
            nearestUnreachable: nearestUnreachable ?? null,
            drivableRangeKm,
            estimatedRangeKm,
            deliveryRouteStatus,
            chargerRouteStatus,
            isCurrentlyOptimal,
            userMinReserveSoc,
            isLowMargin,
            isReserveWarning,
          })
        }
      })
    return () => { cancelled = true }
  }, [view, vehicle?.id, soc, effectiveRouteKm, effectiveChargeNeeded, chargerReachable, recommendedCharger?.id, chargePlan?.chargeTimeMin, isVehicleReady, routeStatus, userMinReserveSoc, isReserveWarning])

  // Effect A — delivery route (no charger).
  // Always requested when cockpit is active. Charger detour failure never blocks this.
  useEffect(() => {
    if (view !== 'cockpit' || !isVehicleReady) {
      setDeliveryRoutePathResult(null)
      setDeliveryRouteStatus('loading')
      setDeliveryRouteErrorDetail(null)
      isMountedWithSessionRef.current = false
      return
    }

    // Skip initial fetch if a valid route was restored from session storage.
    if (isMountedWithSessionRef.current) {
      isMountedWithSessionRef.current = false
      return
    }

    setDeliveryRouteStatus('loading')
    setDeliveryRouteErrorDetail(null)
    let cancelled = false

    getDeliveryRoute({ startPoint, deliveries })
      .then(r => {
        if (cancelled) return
        if (isValidRoadRouteResult(r)) {
          setDeliveryRoutePathResult(r)
          setDeliveryRouteStatus('ready')
          setDeliveryRouteErrorDetail(null)
        } else {
          setDeliveryRoutePathResult(null)
          setDeliveryRouteStatus('error')
          setDeliveryRouteErrorDetail(r?.message ?? null)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setDeliveryRoutePathResult(null)
          setDeliveryRouteStatus('error')
          setDeliveryRouteErrorDetail(err?.message ?? null)
        }
      })
    return () => { cancelled = true }
  }, [view, isVehicleReady, startPoint, deliveries, routeRetryCount])

  // Effect B — charger route (start → charger only).
  // Requested only when charger is reachable. A failure here leaves the delivery route intact.
  useEffect(() => {
    if (view !== 'cockpit' || !effectiveChargeNeeded || !chargerReachable || !recommendedCharger) {
      setChargerRoutePathResult(null)
      setChargerRouteStatus('idle')
      return
    }

    setChargerRouteStatus('loading')
    let cancelled = false

    getChargerRoute({ startPoint, charger: recommendedCharger })
      .then(r => {
        if (cancelled) return
        if (isValidRoadRouteResult(r)) {
          setChargerRoutePathResult(r)
          setChargerRouteStatus('ready')
        } else {
          setChargerRoutePathResult(null)
          setChargerRouteStatus('error')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setChargerRoutePathResult(null)
          setChargerRouteStatus('error')
        }
      })
    return () => { cancelled = true }
  }, [view, effectiveChargeNeeded, chargerReachable, recommendedCharger?.id, startPoint, routeRetryCount])

  const zoneH = `calc(100vh - ${OUTER_HDR}px - ${HDR}px - ${BAR}px)`
  const battColor = soc >= 30 ? T.success : T.danger
  const stepLabel = setupStep === 'soc' ? '3 / 3 단계' : (!selectedBrand ? '1 / 3 단계' : '2 / 3 단계')

  return (
    <div style={{ position: 'fixed', top: OUTER_HDR, left: 0, right: 0, bottom: 0, zIndex: 10, display: 'flex', flexDirection: 'column', fontFamily: FONT, background: T.bg, color: T.text, overflow: 'hidden' }}>

      {/* PAGE HEADER */}
      <div style={{ height: HDR, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}`, background: T.surface, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: T.accent, letterSpacing: '0.1em', textTransform: 'uppercase' }}>MVP-6</span>
          <span style={{ width: 1, height: 14, background: T.border, display: 'inline-block' }} />
          <span style={{ fontSize: 14, fontWeight: 500, color: T.textSecondary }}>배송 순서 최적화</span>
        </div>
        <button onClick={toggleTheme} style={{ padding: '7px 16px', border: `1px solid ${T.border}`, borderRadius: 6, background: 'transparent', color: T.textSecondary, cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: FONT }}>
          {themeName === 'dark' ? '☀ 라이트' : '🌙 다크'}
        </button>
      </div>

      {/* VIEW: SETUP */}
      {view === 'setup' ? (
        <div style={{ height: zoneH, minHeight: 460, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, overflow: 'hidden' }}>
          <div style={{ width: 480, maxWidth: 'calc(100% - 48px)' }}>

            {setupStep === 'soc' ? (
              <>
                <div style={{ marginBottom: 6 }}>
                  <button onClick={() => setSetupStep('vehicle')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontWeight: 500, color: T.textSecondary, cursor: 'pointer', fontFamily: FONT }}>
                    ← 차량 다시 선택
                  </button>
                </div>
                <div style={{ marginBottom: 20, marginTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: T.textSecondary, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{stepLabel} · 출발 전 설정</div>
                  <div style={{ fontSize: 24, fontWeight: 400, color: T.text, letterSpacing: '-0.01em' }}>현재 배터리 잔량을 설정하세요</div>
                </div>
                <div style={{ padding: '12px 16px', marginBottom: 20, background: T.surface, borderRadius: 10, border: `1px solid ${T.accent}50`, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.success, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{vehicle?.fullName}</div>
                    <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>{vehicle?.batteryCapacityKwh} kWh · {vehicle?.efficiencyKmPerKwh?.toFixed(1)} km/kWh</div>
                  </div>
                </div>
                <div style={{ background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, padding: '20px 20px 16px', marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>현재 배터리 잔량 (SOC)</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 2, marginBottom: 14 }}>
                    <span style={{ fontSize: 72, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.03em', color: soc >= 30 ? T.success : T.danger }}>{soc}</span>
                    <span style={{ fontSize: 24, color: T.textSecondary, marginBottom: 8 }}>%</span>
                  </div>
                  <BatteryBar percent={soc} T={T} />
                  <div style={{ marginTop: 12 }}>
                    <input type="range" min="0" max="100" value={soc} onChange={e => setSoc(Number(e.target.value))} style={{ width: '100%', accentColor: T.accent, cursor: 'pointer' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: T.textSecondary }}>0%</span>
                      <input type="number" min="0" max="100" value={soc} onChange={e => setSoc(Math.min(100, Math.max(0, Number(e.target.value))))} style={{ width: 60, padding: '5px 8px', border: `1px solid ${T.border}`, borderRadius: 5, fontSize: 14, textAlign: 'center', background: T.surfaceSecondary, color: T.text, fontFamily: FONT }} />
                      <span style={{ fontSize: 10, color: T.textSecondary }}>100%</span>
                    </div>
                  </div>
                  {socStepRange && (
                    <div style={{ marginTop: 14, padding: '10px 14px', background: T.surfaceSecondary, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: T.textSecondary }}>예상 주행 가능 거리</span>
                      <span style={{ fontSize: 15, fontWeight: 600, color: soc >= 30 ? T.success : T.danger }}>{socStepRange} km</span>
                    </div>
                  )}
                </div>
                <div style={{ background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, padding: '18px 20px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>최소 도착 SOC</div>
                      <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.55 }}>
                        배송 완료 후 남기고 싶은 최소 배터리입니다.<br />
                        이 기준보다 낮게 도착할 것으로 예상되면<br />충전을 권장합니다.
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, flexShrink: 0, marginLeft: 12 }}>
                      <span style={{ fontSize: 28, fontWeight: 700, color: T.accent }}>{userMinReserveSoc}</span>
                      <span style={{ fontSize: 14, color: T.textSecondary }}>%</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[5, 10, 15, 20, 25, 30].map(v => (
                      <button
                        key={v}
                        onClick={() => setUserMinReserveSoc(v)}
                        style={{
                          flex: 1, padding: '9px 0', borderRadius: 7,
                          border: `1px solid ${userMinReserveSoc === v ? T.accent : T.border}`,
                          background: userMinReserveSoc === v ? `${T.accent}18` : T.surfaceSecondary,
                          color: userMinReserveSoc === v ? T.accent : T.textSecondary,
                          fontSize: 12, fontWeight: userMinReserveSoc === v ? 700 : 400,
                          cursor: 'pointer', fontFamily: FONT,
                        }}
                      >
                        {v}%
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={() => setView('cockpit')} style={{ width: '100%', padding: '15px 20px', background: T.accent, color: '#fff', border: `1px solid ${T.accent}`, borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, transition: 'background 0.15s' }}>
                  경로 분석 시작 →
                </button>
              </>

            ) : !selectedBrand ? (

              <>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: T.textSecondary, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{stepLabel} · 출발 전 설정</div>
                  <div style={{ fontSize: 24, fontWeight: 400, color: T.text, letterSpacing: '-0.01em' }}>브랜드를 선택하세요</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {BRANDS.map(brand => (
                    <BrandChip key={brand.id} brand={brand} onClick={() => handleBrandChange(brand.id)} T={T} />
                  ))}
                </div>
              </>

            ) : (

              <>
                <div style={{ marginBottom: 20 }}>
                  <button onClick={() => handleBrandChange('')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontWeight: 500, color: T.textSecondary, cursor: 'pointer', fontFamily: FONT }}>
                    ← 브랜드 다시 선택
                  </button>
                </div>

                {isCustomBrand ? (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: T.textSecondary, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{stepLabel} · 직접 입력</div>
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
                          <input type={type} placeholder={placeholder} value={custom[field]} onChange={e => setCustom(prev => ({ ...prev, [field]: e.target.value }))} style={{ padding: '9px 13px', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 14, background: T.surfaceSecondary, color: T.text, fontFamily: FONT, textTransform: 'none', letterSpacing: 'normal' }} />
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
                      <div style={{ fontSize: 11, fontWeight: 500, color: T.textSecondary, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{stepLabel} · {BRANDS.find(b => b.id === selectedBrand)?.name}</div>
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
                  <div style={{ marginBottom: 18, background: T.surface, borderRadius: 10, border: `1px solid ${isVehicleReady ? T.accent + '60' : T.border}`, overflow: 'hidden' }}>
                    <VehicleImage src={vehicle.image} alt={vehicle.fullName} height={80} bg={T.surface} T={T} />
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

                <button onClick={() => setSetupStep('soc')} disabled={!isVehicleReady} style={{ width: '100%', padding: '15px 20px', background: isVehicleReady ? T.accent : T.surfaceSecondary, color: isVehicleReady ? '#fff' : T.textSecondary, border: `1px solid ${isVehicleReady ? T.accent : T.border}`, borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: isVehicleReady ? 'pointer' : 'not-allowed', fontFamily: FONT, transition: 'background 0.15s' }}>
                  {isVehicleReady ? '다음: 배터리 설정 →' : '차량을 선택하세요'}
                </button>
              </>
            )}
          </div>
        </div>

      ) : (

        /* VIEW: COCKPIT */
        <div style={{ display: 'grid', gridTemplateColumns: '30% 70%', height: zoneH, minHeight: 500, overflow: 'hidden' }}>

          {/* LEFT PANEL */}
          <div style={{ borderRight: `1px solid ${T.border}`, overflowY: 'auto', background: T.surface, display: 'flex', flexDirection: 'column' }}>

            {/* CLUSTER PANEL */}
            <div style={{ margin: '16px 16px 0', borderRadius: 12, background: T.bg, border: `1px solid ${T.border}`, overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: HMI.text.title, fontWeight: 600, color: T.text, lineHeight: 1.2 }}>{vehicle?.fullName}</div>
                  <div style={{ fontSize: HMI.text.caption, color: T.textSecondary, marginTop: 2 }}>{vehicle?.grade}</div>
                </div>
                <div style={{ padding: '4px 11px', borderRadius: 20, background: overlayState === 'canDeliver' ? `${T.success}18` : overlayState === 'unreachable' ? `${T.danger}18` : `${T.warning}18`, border: `1px solid ${overlayState === 'canDeliver' ? T.success + '40' : overlayState === 'unreachable' ? T.danger + '40' : T.warning + '40'}`, fontSize: HMI.text.caption, fontWeight: 600, color: overlayState === 'canDeliver' ? T.success : overlayState === 'unreachable' ? T.danger : T.warning, flexShrink: 0, marginLeft: 8 }}>
                  {(effectiveCanDeliver && !isLowMargin && !isReserveWarning) ? '배송 가능' : isLowMargin ? '여유 부족' : isReserveWarning ? '충전 권장' : chargerReachable === true ? '충전 경유 필요' : recommendationMode === 'no-local-data' ? '충전소 데이터 없음' : chargerReachable === false ? '충전소 도달 불가' : 'SOC 확인 필요'}
                </div>
              </div>

              <div style={{ padding: '16px 16px 0' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: HMI.text.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 6 }}>배터리</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                      <span style={{ fontSize: HMI.text.metric, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.03em', color: soc >= 30 ? T.success : T.danger }}>{soc}</span>
                      <span style={{ fontSize: HMI.text.metricUnit, color: T.textSecondary, marginBottom: 7 }}>%</span>
                    </div>
                  </div>
                  <div style={{ width: 1, background: T.border, alignSelf: 'stretch', margin: '4px 0' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: HMI.text.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 6 }}>주행 가능</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                      <span style={{ fontSize: HMI.text.metric, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.03em', color: effectiveCanDeliver ? T.success : T.danger }}>{estimatedRangeKm}</span>
                      <span style={{ fontSize: HMI.text.metricUnit, color: T.textSecondary, marginBottom: 7 }}>km</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ padding: '8px 16px 4px' }}>
                <VehicleImage
                  src={vehicle?.image} alt={vehicle?.fullName} height={72} bg={T.bg}
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

              <div style={{ padding: '2px 16px 8px' }}>
                <BatteryBar percent={soc} T={T} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                  <span style={{ fontSize: HMI.text.caption, color: T.textSecondary }}>{remainingKwh} kWh 남음</span>
                  <span style={{ fontSize: HMI.text.caption, color: effectiveChargeNeeded ? T.danger : T.success }}>
                    {effectiveChargeNeeded
                      ? `${(effectiveRouteKm - parseFloat(estimatedRangeKm)).toFixed(1)} km 부족`
                      : surplusRangeKm < 0.05
                        ? '안전 여유 부족'
                        : `+${surplusRangeKm.toFixed(1)} km 여유`}
                  </span>
                </div>
              </div>

              {intlEff != null && (
                <div style={{ padding: '4px 16px 6px', borderTop: `1px solid ${T.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: HMI.text.caption, color: T.textSecondary }}>적용 전비</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: HMI.text.body, fontWeight: 600, color: isPersonalized ? T.success : T.text }}>{intlEff.toFixed(2)}</span>
                      <span style={{ fontSize: HMI.text.caption, color: T.textSecondary }}>km/kWh</span>
                      {isPersonalized && (
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: `${T.success}18`, border: `1px solid ${T.success}40`, color: T.success, fontWeight: 600 }}>개인화</span>
                      )}
                    </div>
                  </div>
                  {isPersonalized && defaultEff != null && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: HMI.text.caption, color: T.textSecondary }}>기본 전비</span>
                      <span style={{ fontSize: HMI.text.caption, color: T.textSecondary }}>{defaultEff.toFixed(1)} km/kWh</span>
                    </div>
                  )}
                </div>
              )}
              {remainingSocAfterDelivery != null && isVehicleReady && (() => {
                const arrivalColor = effectiveChargeNeeded ? T.danger : isLowMargin ? T.warning : isReserveWarning ? T.warning : T.success
                const gap = isReserveWarning ? parseFloat((userMinReserveSoc - remainingSocAfterDelivery).toFixed(1)) : null
                const statusText = effectiveChargeNeeded
                  ? '충전 없이 배송 시 기준'
                  : isLowMargin
                    ? '안전 여유 부족'
                    : isReserveWarning
                      ? `기준보다 ${gap}%p 부족`
                      : '기준 충족'
                return (
                  <div style={{ padding: '5px 16px 5px', borderTop: `1px solid ${T.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: HMI.text.caption, color: T.textSecondary }}>
                        {effectiveChargeNeeded ? '충전 전 예상 도착 SOC' : '예상 도착 SOC'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                        <span style={{ fontSize: HMI.text.body, fontWeight: 600, color: arrivalColor }}>{remainingSocAfterDelivery.toFixed(1)}</span>
                        <span style={{ fontSize: HMI.text.caption, color: T.textSecondary }}>%</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: arrivalColor, fontWeight: 600, marginTop: 1 }}>{statusText}</div>
                  </div>
                )
              })()}
              <div style={{ padding: '5px 16px 7px', borderTop: `1px solid ${T.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: HMI.text.caption, color: T.textSecondary }}>최소 도착 SOC</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                    <span style={{ fontSize: HMI.text.body, fontWeight: 600, color: isReserveWarning ? T.warning : T.textSecondary }}>{userMinReserveSoc}</span>
                    <span style={{ fontSize: HMI.text.caption, color: T.textSecondary }}>%</span>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: T.textSecondary, marginTop: 1 }}>예상 도착 SOC가 이 기준보다 낮으면 충전을 권장합니다.</div>
              </div>
              <div style={{ padding: '6px 16px 12px', borderTop: `1px solid ${T.border}` }}>
                <button onClick={openSocModal} style={{ width: '100%', minHeight: HMI.touch.small, border: `1px solid ${T.border}`, borderRadius: 6, background: 'transparent', color: T.textSecondary, fontSize: HMI.text.body, fontWeight: 500, cursor: 'pointer', fontFamily: FONT, letterSpacing: '0.02em' }}>
                  배터리 수정
                </button>
              </div>
            </div>

            {/* CHARGING NOTICE */}
            {effectiveChargeNeeded && (
              <div style={{ margin: '8px 16px 0', padding: '8px 12px', background: chargerReachable ? `${T.warning}18` : `${T.danger}18`, border: `1px solid ${chargerReachable ? T.warning + '40' : T.danger + '40'}`, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>⚡</span>
                <div>
                  <div style={{ fontSize: HMI.text.body, fontWeight: 600, color: chargerReachable ? T.warning : T.danger }}>{chargerReachable ? '충전소 경유 필요' : '충전소 도달 불가'}</div>
                  <div style={{ fontSize: HMI.text.caption, color: T.textSecondary, marginTop: 1 }}>{chargerReachable ? '추천 충전소 경유 후 배송 가능' : '현재 배터리로 추천 충전소까지 도달하기 어렵습니다.'}</div>
                </div>
              </div>
            )}

            {/* CHARGER CARD */}
            {recommendedCharger && (
              <div style={{ margin: '10px 16px 0', borderRadius: 10, background: T.bg, border: `1px solid ${!effectiveChargeNeeded ? (isReserveWarning ? T.warning + '55' : T.border) : chargerReachable ? T.accent + '80' : T.danger + '60'}` }}>
                <div style={{ padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4, borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: HMI.text.caption, fontWeight: 600, color: !effectiveChargeNeeded ? (isReserveWarning ? T.warning : T.textSecondary) : chargerReachable ? T.accent : T.danger, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {!effectiveChargeNeeded ? (isReserveWarning ? '충전 권장 충전소' : '주변 충전소') : chargerReachable ? '추천 충전소' : '충전소 도달 불가'}
                  </div>
                  <div style={{ padding: '3px 9px', borderRadius: 20, fontSize: HMI.text.caption, fontWeight: 600, flexShrink: 0, background: !effectiveChargeNeeded ? (isReserveWarning ? T.warning + '18' : T.surfaceSecondary) : chargerReachable ? T.warning + '1A' : T.danger + '1A', border: `1px solid ${!effectiveChargeNeeded ? (isReserveWarning ? T.warning + '50' : T.border) : chargerReachable ? T.warning + '50' : T.danger + '50'}`, color: !effectiveChargeNeeded ? (isReserveWarning ? T.warning : T.textSecondary) : chargerReachable ? T.warning : T.danger }}>
                    {!effectiveChargeNeeded ? (isReserveWarning ? '선택 경유 권장' : '여유 있음') : chargerReachable ? '충전 필요' : '도달 불가'}
                  </div>
                </div>
                <div style={{ padding: '10px 14px' }}>
                  <div style={{ fontSize: HMI.text.title, fontWeight: 600, color: !effectiveChargeNeeded ? (isReserveWarning ? T.text : T.textSecondary) : chargerReachable ? T.text : T.danger, marginBottom: 2, lineHeight: 1.3 }}>{recommendedCharger.name}</div>
                  {(recommendedCharger.operator || recommendedCharger.pricePerKwh) && (
                    <div style={{ fontSize: HMI.text.caption, color: T.textSecondary, marginBottom: recommendedCharger.recommendationReason ? 4 : 8 }}>
                      {recommendedCharger.operator}
                      {recommendedCharger.operator && recommendedCharger.pricePerKwh ? ' · ' : ''}
                      {recommendedCharger.pricePerKwh ? `${recommendedCharger.pricePerKwh.toLocaleString('ko-KR')}원/kWh` : ''}
                    </div>
                  )}
                  {(recommendedCharger.recommendationReason || isPersonalized) && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                      {(recommendedCharger.recommendationReason ? recommendedCharger.recommendationReason.split(' · ') : []).map(tag => (
                        <span key={tag} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, background: T.surfaceSecondary, border: `1px solid ${T.border}`, color: T.textSecondary, letterSpacing: '0.02em', fontWeight: 500 }}>
                          {tag}
                        </span>
                      ))}
                      {isPersonalized && (
                        <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, background: `${T.success}14`, border: `1px solid ${T.success}40`, color: T.success, letterSpacing: '0.02em', fontWeight: 600 }}>
                          개인화 전비 적용
                        </span>
                      )}
                    </div>
                  )}
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
                  {!effectiveChargeNeeded && (
                    <div style={{ fontSize: HMI.text.caption, color: isReserveWarning ? T.warning : T.textSecondary }}>
                      {isReserveWarning
                        ? '선택 경유 시 최소 도착 SOC 기준 충족 가능'
                        : `${recommendedCharger.routeBandLabel ?? '경로 인근'} · 필요 시 이용`}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CHARGING PLAN CARD */}
            {effectiveChargeNeeded && chargerReachable === true && chargePlan && (
              <div style={{ margin: '10px 16px 0', borderRadius: 10, background: T.bg, border: `1px solid ${T.accent}60` }}>
                <div style={{ padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: HMI.text.caption, fontWeight: 600, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.1em' }}>충전 계획</div>
                  <button onClick={() => setShowChargePlanDetail(e => !e)} style={{ fontSize: HMI.text.caption, color: T.textSecondary, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: FONT, padding: '2px 0' }}>
                    {showChargePlanDetail ? '계산 상세 숨기기 ↑' : '계산 상세 보기 ↓'}
                  </button>
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
                    {[
                      { label: '충전 후 도착', value: chargePlan.finalDeliverySOC, unit: '%', color: T.success },
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
                  <div style={{ padding: '8px 10px', background: T.surfaceSecondary, borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: HMI.text.caption, color: T.textSecondary }}>대기 {recommendedCharger.waitMin}분</span>
                    <span style={{ fontSize: HMI.text.body, fontWeight: 600, color: T.text }}>예상 {chargePlan.totalExtraCost.toLocaleString('ko-KR')}원</span>
                  </div>
                  {showChargePlanDetail && (
                    <div style={{ marginTop: 8, fontSize: HMI.text.caption, color: T.textSecondary, lineHeight: 1.9, background: T.surfaceSecondary, borderRadius: 6, padding: '8px 10px' }}>
                      <div>충전소까지: <span style={{ color: T.text, fontWeight: 500 }}>{depotToRecommendedChargerKm} km</span></div>
                      <div>도착 배터리: <span style={{ color: T.text, fontWeight: 500 }}>{chargePlan.batteryAtChargerKwh} kWh ({chargePlan.batteryAtChargerSoc}%)</span></div>
                      <div>충전 후 잔여 경로: <span style={{ color: T.text, fontWeight: 500 }}>{chargePlan.remainingRouteAfterChargeKm} km</span></div>
                      <div>배송 필요 에너지: <span style={{ color: T.text, fontWeight: 500 }}>{chargePlan.energyNeededAfterChargeKwh} kWh</span></div>
                      <div>SOC 여유: <span style={{ color: T.text, fontWeight: 500 }}>{chargePlan.reserveEnergyKwh} kWh ({userMinReserveSoc}%)</span></div>
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

            {/* ROUTE HEALTH CARD */}
            {intel && intlHealthScore != null && (
              <div style={{ margin: '10px 16px 0', borderRadius: 10, background: T.bg, border: `1px solid ${intlHealthScore >= 80 ? T.success + '60' : intlHealthScore >= 60 ? T.warning + '60' : T.danger + '60'}` }}>
                <div style={{ padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: HMI.text.caption, fontWeight: 600, color: intlHealthScore >= 80 ? T.success : intlHealthScore >= 60 ? T.warning : T.danger, textTransform: 'uppercase', letterSpacing: '0.1em' }}>경로 건강</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {intlConfidence && (
                      <div style={{ padding: '3px 9px', borderRadius: 20, fontSize: HMI.text.caption, fontWeight: 600, background: ({ none: T.surfaceSecondary, low: `${T.warning}1A`, medium: `${T.accent}1A`, high: `${T.success}1A` })[intlConfidence], border: `1px solid ${({ none: T.border, low: T.warning + '50', medium: T.accent + '50', high: T.success + '50' })[intlConfidence]}`, color: ({ none: T.textSecondary, low: T.warning, medium: T.accent, high: T.success })[intlConfidence] }}>
                        {({ none: '데이터 없음', low: '낮은 신뢰도', medium: '보통', high: '높은 신뢰도' })[intlConfidence]}
                      </div>
                    )}
                    {/* MVP-8: 우측 슬라이드 패널로 전환 예정 */}
                    <button
                      disabled={routeStatus !== 'ready'}
                      onClick={() => {
                        const validResult = isValidRoadRouteResult(deliveryRoutePathResult) ? deliveryRoutePathResult : null
                        saveDriverSession({ selectedBrand, selectedId, custom, soc, startPoint, deliveries, routePathResult: validResult, userMinReserveSoc })
                        navigate('/mvp-7')
                      }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', padding: '3px 9px', borderRadius: 8, border: `1px solid ${routeStatus === 'ready' ? T.accent + '45' : T.border}`, background: routeStatus === 'ready' ? `${T.accent}10` : T.surfaceSecondary, color: routeStatus === 'ready' ? T.accent : T.textSecondary, cursor: routeStatus === 'ready' ? 'pointer' : 'not-allowed', fontFamily: FONT, lineHeight: 1.3, opacity: routeStatus === 'ready' ? 1 : 0.5 }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.02em' }}>EV 인텔리전스 상세 →</span>
                      <span style={{ fontSize: 8, opacity: 0.7, marginTop: 1 }}>{routeStatus === 'ready' ? '경로 분석 보기' : '경로 로딩 중...'}</span>
                    </button>
                  </div>
                </div>
                <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: HMI.text.caption, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>건강 점수</div>
                    <div style={{ fontSize: HMI.text.title, fontWeight: 700, color: intlHealthScore >= 80 ? T.success : intlHealthScore >= 60 ? T.warning : T.danger, lineHeight: 1 }}>
                      {intlHealthScore}<span style={{ fontSize: HMI.text.caption, fontWeight: 400, color: T.textSecondary }}>/100</span>
                    </div>
                  </div>
                  {intlConsumption != null && (
                    <>
                      <div style={{ width: 1, height: 28, background: T.border }} />
                      <div>
                        <div style={{ fontSize: HMI.text.caption, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>예상 소비</div>
                        <div style={{ fontSize: HMI.text.bodyStrong, fontWeight: 500, color: T.text }}>{intlConsumption}<span style={{ fontSize: HMI.text.caption, color: T.textSecondary }}> kWh</span></div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* OPTIMIZATION RECOMMENDATION NOTICE — shown when savings are large */}
            {!isCurrentlyOptimal && optimizationResult &&
              (optimizationResult.savedPercent >= 20 || optimizationResult.savedDistanceKm >= 50) && (
              <div style={{ margin: '8px 16px 0', padding: '10px 12px', background: `${T.warning}18`, border: `1px solid ${T.warning}50`, borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 15, flexShrink: 0, lineHeight: 1.4 }}>⚠</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: HMI.text.body, fontWeight: 700, color: T.warning, marginBottom: 2 }}>최적 순서 적용 권장</div>
                  <div style={{ fontSize: HMI.text.caption, color: T.textSecondary, lineHeight: 1.5 }}>
                    현재 {optimizationResult.originalDistanceKm} km → 최적 {optimizationResult.optimizedDistanceKm} km
                    <span style={{ color: T.warning, fontWeight: 600 }}> ({optimizationResult.savedPercent}% · {optimizationResult.savedDistanceKm} km 단축)</span>
                  </div>
                </div>
                <button
                  onClick={handleApplyOptimization}
                  style={{ padding: '5px 12px', border: 'none', borderRadius: 5, background: T.warning, color: '#fff', fontSize: HMI.text.caption, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, flexShrink: 0, alignSelf: 'center' }}
                >
                  적용
                </button>
              </div>
            )}

            {/* OPTIMIZATION CARD */}
            {deliveries.length >= 2 && optimizationResult && (
              <div style={{ margin: '10px 16px 0', borderRadius: 10, background: T.bg, border: `1px solid ${isCurrentlyOptimal ? T.success + '60' : T.accent + '60'}` }}>
                <div style={{ padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: HMI.text.caption, fontWeight: 600, color: isCurrentlyOptimal ? T.success : T.accent, textTransform: 'uppercase', letterSpacing: '0.1em' }}>배송 순서 최적화</div>
                  <div style={{ padding: '3px 9px', borderRadius: 20, fontSize: HMI.text.caption, fontWeight: 600, background: isCurrentlyOptimal ? `${T.success}18` : `${T.accent}18`, border: `1px solid ${isCurrentlyOptimal ? T.success + '50' : T.accent + '50'}`, color: isCurrentlyOptimal ? T.success : T.accent }}>
                    {isCurrentlyOptimal ? '최적' : optimizationResult.method === 'brute-force' ? '완전탐색' : '근사탐색'}
                  </div>
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
                    {[
                      { label: '현재 순서', value: optimizationResult.originalDistanceKm, unit: 'km', color: T.text },
                      { label: '최적 순서', value: optimizationResult.optimizedDistanceKm, unit: 'km', color: isCurrentlyOptimal ? T.success : T.accent },
                      { label: '절감', value: optimizationResult.savedDistanceKm > 0 ? `-${optimizationResult.savedDistanceKm}` : '±0', unit: 'km', color: optimizationResult.savedDistanceKm > 0 ? T.success : T.textSecondary },
                    ].map(({ label, value, unit, color }) => (
                      <div key={label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: HMI.text.caption, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: HMI.text.bodyStrong, fontWeight: 500, color, lineHeight: 1 }}>
                          {value}<span style={{ fontSize: HMI.text.caption, color: T.textSecondary }}>{unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '6px 10px', background: T.surfaceSecondary, borderRadius: 6, marginBottom: isCurrentlyOptimal ? 0 : 10, fontSize: HMI.text.caption, color: T.textSecondary }}>
                    {isCurrentlyOptimal
                      ? '현재 순서가 이미 최적에 가깝습니다.'
                      : `최적 순서로 ${optimizationResult.savedDistanceKm} km (${optimizationResult.savedPercent}%) 단축 가능합니다.`
                    }
                  </div>
                  {!isCurrentlyOptimal && (
                    <button onClick={handleApplyOptimization} style={{ width: '100%', minHeight: HMI.touch.small, border: 'none', borderRadius: 6, background: T.accent, color: '#fff', fontSize: HMI.text.body, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                      최적 순서 적용
                    </button>
                  )}
                </div>
              </div>
            )}

            <div style={{ height: 1, background: T.border, margin: '12px 0' }} />

            {/* ROUTE LIST */}
            <div style={{ padding: '0 20px' }}>
              {/* Starting point row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '8px 10px', background: T.surfaceSecondary, borderRadius: 8, border: `1px solid ${T.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#F59E0B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 }}>S</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: HMI.text.micro, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>출발지</div>
                    <div style={{ fontSize: HMI.text.body, fontWeight: 500, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{startPoint.name}</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowStartModal(true)}
                  style={{ fontSize: HMI.text.caption, color: T.accent, background: 'transparent', border: `1px solid ${T.accent}50`, borderRadius: 4, cursor: 'pointer', padding: '4px 10px', fontFamily: FONT, flexShrink: 0, minHeight: HMI.touch.small }}
                >
                  변경
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: HMI.text.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  배송 경로 ({deliveries.length}개)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={handleOpenDestModal} style={{ fontSize: HMI.text.caption, color: T.accent, background: 'transparent', border: `1px solid ${T.accent}50`, borderRadius: 4, cursor: 'pointer', padding: '4px 10px', fontFamily: FONT, minHeight: HMI.touch.small }}>
                    배송지 관리
                  </button>
                  {deliveries.length > 1 && (
                    <button onClick={() => setRouteExpanded(e => !e)} style={{ fontSize: HMI.text.caption, color: T.textSecondary, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: FONT, padding: '2px 0' }}>
                      {routeExpanded ? '접기 ↑' : `+${deliveries.length - 1}개 더 ↓`}
                    </button>
                  )}
                </div>
              </div>

              {effectiveChargeNeeded && chargerReachable && recommendedCharger && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: T.warning, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 }}>⚡</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: HMI.text.body, fontWeight: 500, color: T.warning, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>충전 경유 · {recommendedCharger.name}</div>
                    <div style={{ fontSize: HMI.text.caption, color: T.textSecondary, marginTop: 1 }}>출발지에서</div>
                  </div>
                  <div style={{ fontSize: HMI.text.body, fontWeight: 500, color: T.warning, flexShrink: 0 }}>{depotToRecommendedChargerKm} km</div>
                </div>
              )}

              {deliveries.length === 0 ? (
                <div style={{ padding: '12px 0', fontSize: 12, color: T.textSecondary, textAlign: 'center' }}>배송지 없음 — 배송지 관리에서 추가하세요</div>
              ) : (
                deliveries.slice(0, routeExpanded ? deliveries.length : 1).map((d, i) => {
                  const prev = i === 0 ? startPoint : deliveries[i - 1]
                  const segDist = haversineKm(prev.lat, prev.lng, d.lat, d.lng).toFixed(2)
                  const visibleCount = routeExpanded ? deliveries.length : 1
                  return (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < visibleCount - 1 ? `1px solid ${T.border}` : 'none' }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: T.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: HMI.text.body, fontWeight: 500, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                        <div style={{ fontSize: HMI.text.caption, color: T.textSecondary, marginTop: 1 }}>{i === 0 ? startPoint.name : deliveries[i - 1].name}에서</div>
                      </div>
                      <div style={{ fontSize: HMI.text.body, fontWeight: 500, color: T.text, flexShrink: 0 }}>{segDist} km</div>
                    </div>
                  )
                })
              )}
            </div>

            {/* CALC TOGGLE */}
            {isVehicleReady && (
              <>
                <div style={{ height: 1, background: T.border, margin: '12px 0' }} />
                <div style={{ padding: '0 20px 16px' }}>
                  <button onClick={() => setCalcExpanded(e => !e)} style={{ width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: HMI.text.caption, fontWeight: 500, color: T.textSecondary, cursor: 'pointer', fontFamily: FONT, transition: 'border-color 0.15s, color 0.15s', minHeight: HMI.touch.small }}>
                    {calcExpanded ? '계산식 숨기기 ↑' : '계산식 보기 ↓'}
                  </button>
                  {calcExpanded && (
                    <div style={{ marginTop: 8, fontSize: HMI.text.caption, color: T.textSecondary, lineHeight: 1.85, background: T.surfaceSecondary, borderRadius: 6, padding: '8px 10px' }}>
                      <div>{vehicle.batteryCapacityKwh}kWh × {soc}% = <span style={{ color: T.text, fontWeight: 500 }}>{remainingKwh}kWh</span></div>
                      <div>{remainingKwh}kWh × {vehicle.efficiencyKmPerKwh?.toFixed(1)} = <span style={{ color: effectiveCanDeliver ? (isLowMargin ? T.warning : T.success) : T.danger, fontWeight: 500 }}>{estimatedRangeKm}km</span>{' '}<span style={{ color: effectiveCanDeliver ? (isLowMargin ? T.warning : T.success) : T.danger }}>({effectiveCanDeliver ? (surplusRangeKm < 0.05 ? '여유 부족' : `+${surplusRangeKm.toFixed(1)}km`) : `−${(effectiveRouteKm - parseFloat(estimatedRangeKm)).toFixed(1)}km`})</span></div>
                    </div>
                  )}
                </div>
              </>
            )}

          </div>

          {/* RIGHT: Map Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', padding: '10px 10px 10px 6px', background: T.bg, overflow: 'hidden' }}>
            <div style={{ padding: '0 4px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: T.textSecondary, letterSpacing: '0.08em', textTransform: 'uppercase' }}>경로 지도</span>
              {routeStatus === 'loading' && (
                <span style={{ fontSize: 10, color: T.textSecondary }}>● 도로 경로 연결 중...</span>
              )}
            </div>
            <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <MapPanel
                T={T} themeName={themeName}
                deliveries={deliveries} chargers={scoredChargers?.length ? scoredChargers : CHARGERS}
                recommendedChargerId={effectiveChargeNeeded && chargerReachable ? (recommendedCharger?.id ?? null) : null}
                chargerWaypoint={chargerWaypoint}
                warnChargerId={warnChargerId}
                overlayState={overlayState}
                overlayData={enrichedOverlayData}
                onOpenSocModal={openSocModal}
                hmi={HMI}
                startPoint={startPoint}
                routePathResult={deliveryRoutePathResult}
                chargerRoutePathResult={chargerRoutePathResult}
              />
              {routeStatus === 'loading' && (
                <div style={{
                  position: 'absolute', top: 8, left: 8, right: 8, zIndex: 10,
                  padding: '7px 12px',
                  background: themeName === 'dark' ? 'rgba(10,11,13,0.90)' : 'rgba(255,255,255,0.95)',
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  display: 'flex', alignItems: 'center', gap: 8,
                  backdropFilter: 'blur(4px)',
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.textSecondary, flexShrink: 0, opacity: 0.7 }} />
                  <span style={{ fontSize: 12, color: T.textSecondary, fontWeight: 500, fontFamily: FONT }}>실제 도로 경로를 불러오는 중...</span>
                </div>
              )}
              {routeStatus === 'error' && (
                <div style={{
                  position: 'absolute', top: 8, left: 8, right: 8, zIndex: 10,
                  padding: '8px 12px',
                  background: themeName === 'dark' ? 'rgba(10,11,13,0.92)' : 'rgba(255,255,255,0.97)',
                  border: `1px solid ${T.danger}50`,
                  borderRadius: 8,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  backdropFilter: 'blur(4px)',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.danger }}>배송 경로 연결 실패</span>
                    <span style={{ fontSize: 11, color: T.textSecondary }}>
                      {routeErrorDetail
                        ? routeErrorDetail.includes('구간')
                          ? `구간 실패: ${routeErrorDetail}`
                          : routeErrorDetail
                        : '백엔드 서버 확인 필요 · Directions API 요청 실패'}
                    </span>
                    {!isCurrentlyOptimal && optimizationResult && optimizationResult.savedDistanceKm >= 50 && (
                      <span style={{ fontSize: 10, color: T.warning, marginTop: 1 }}>
                        ⚠ 최적 순서 적용 시 경로가 단순해져 성공할 수 있습니다
                      </span>
                    )}
                    {chargerReachable === false && (
                      <span style={{ fontSize: 10, color: T.warning, marginTop: 1 }}>
                        충전소 도달 불가 · SOC 수정 후 다시 시도
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setRouteRetryCount(n => n + 1)}
                    style={{ padding: '6px 14px', background: T.accent, color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    다시 시도
                  </button>
                </div>
              )}
              {routeStatus !== 'error' && chargerRouteStatus === 'error' && (
                <div style={{
                  position: 'absolute', top: 8, left: 8, right: 8, zIndex: 10,
                  padding: '7px 12px',
                  background: themeName === 'dark' ? 'rgba(10,11,13,0.88)' : 'rgba(255,255,255,0.95)',
                  border: `1px solid ${T.warning}60`,
                  borderRadius: 8,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  display: 'flex', alignItems: 'center', gap: 10,
                  backdropFilter: 'blur(4px)',
                }}>
                  <span style={{ fontSize: 13, flexShrink: 0 }}>⚡</span>
                  <span style={{ fontSize: 11, color: T.textSecondary, flex: 1 }}>
                    충전소 경유 경로 실패 · 배송 경로는 정상 표시됩니다
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM BAR */}
      <div style={{ height: BAR, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 0, background: T.surface, borderTop: `1px solid ${T.border}`, boxShadow: `inset 0 1px 0 ${T.accent}35`, flexShrink: 0 }}>
        {view === 'setup' ? (
          <>
            <span style={{ fontSize: HMI.text.body, color: T.textSecondary }}>경로: {totalRouteKm} km · 배송지 {deliveries.length}개</span>
            <div style={{ flex: 1 }} />
            {setupStep === 'soc' ? (
              <button onClick={() => setView('cockpit')} style={{ padding: '0 28px', border: 'none', borderRadius: 6, background: T.accent, color: '#fff', fontSize: HMI.text.bodyStrong, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, minHeight: HMI.touch.normal }}>
                경로 분석 시작 →
              </button>
            ) : (
              <button onClick={() => setSetupStep('soc')} disabled={!isVehicleReady} style={{ padding: '0 28px', border: 'none', borderRadius: 6, background: isVehicleReady ? T.accent : T.surfaceSecondary, color: isVehicleReady ? '#fff' : T.textSecondary, fontSize: HMI.text.bodyStrong, fontWeight: 600, cursor: isVehicleReady ? 'pointer' : 'not-allowed', fontFamily: FONT, minHeight: HMI.touch.normal }}>
                {isVehicleReady ? '다음: 배터리 설정 →' : '차량을 선택하세요'}
              </button>
            )}
          </>
        ) : (
          <>
            <BottomStat label="총 경로" value={`${effectiveRouteKm} km`} T={T} />
            <div style={{ width: 1, height: 40, background: T.border, margin: '0 12px' }} />
            <BottomStat label="배송지" value={`${deliveries.length}개`} T={T} />
            <div style={{ width: 1, height: 40, background: T.border, margin: '0 12px' }} />
            <BottomStat label="주행 가능" value={`${estimatedRangeKm} km`} T={T} />
            {intlConsumption != null && (
              <>
                <div style={{ width: 1, height: 40, background: T.border, margin: '0 12px' }} />
                <BottomStat label="예상 소비" value={`${intlConsumption} kWh`} T={T} />
              </>
            )}
            {intlHealthScore != null && (
              <>
                <div style={{ width: 1, height: 40, background: T.border, margin: '0 12px' }} />
                <div style={{ padding: '0 8px' }}>
                  <div style={{ fontSize: HMI.text.caption, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>경로 건강</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: HMI.text.title, fontWeight: 600, color: intlHealthScore >= 80 ? T.success : intlHealthScore >= 60 ? T.warning : T.danger }}>{intlHealthScore}</span>
                    {intlConfidence && (
                      <span style={{ fontSize: 9, color: ({ none: T.textSecondary, low: T.warning, medium: T.accent, high: T.success })[intlConfidence] }}>
                        {({ none: '없음', low: '낮음', medium: '보통', high: '높음' })[intlConfidence]}
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
            <div style={{ width: 1, height: 40, background: T.border, margin: '0 16px' }} />
            <div style={{ padding: '8px 18px', borderRadius: 20, background: overlayState === 'canDeliver' ? `${T.success}18` : overlayState === 'unreachable' ? `${T.danger}18` : `${T.warning}18`, border: `1px solid ${overlayState === 'canDeliver' ? T.success + '60' : overlayState === 'unreachable' ? T.danger + '60' : T.warning + '60'}`, fontSize: HMI.text.bodyStrong, fontWeight: 600, color: overlayState === 'canDeliver' ? T.success : overlayState === 'unreachable' ? T.danger : T.warning }}>
              {(effectiveCanDeliver && !isLowMargin && !isReserveWarning) ? '배송 가능' : isLowMargin ? '배송 가능 · 여유 부족' : isReserveWarning ? '배송 가능 · 충전 권장' : chargerReachable === true ? '충전 경유 필요' : chargerReachable === false ? '충전소 도달 불가' : 'SOC 확인 필요'}
            </div>
            <div style={{ flex: 1 }} />
            <button
              onClick={handleApplyOptimization}
              disabled={isCurrentlyOptimal || !optimizationResult || deliveries.length < 2}
              style={{
                padding: '0 22px',
                border: `1px solid ${(!optimizationResult || isCurrentlyOptimal) ? T.border : T.accent}`,
                borderRadius: 6,
                background: (!optimizationResult || isCurrentlyOptimal) ? 'transparent' : `${T.accent}18`,
                color: (!optimizationResult || isCurrentlyOptimal) ? T.textSecondary : T.accent,
                fontSize: HMI.text.body, fontWeight: 500,
                cursor: (!optimizationResult || isCurrentlyOptimal) ? 'not-allowed' : 'pointer',
                opacity: (!optimizationResult || isCurrentlyOptimal) ? 0.55 : 1,
                fontFamily: FONT, marginRight: 8, minHeight: HMI.touch.normal,
              }}
            >
              {isCurrentlyOptimal ? '최적 순서 완료' : '경로 최적화'}
            </button>
            <button onClick={handleReset} style={{ padding: '0 22px', border: `1px solid ${T.border}`, borderRadius: 6, background: T.surface, color: T.text, fontSize: HMI.text.body, fontWeight: 500, cursor: 'pointer', fontFamily: FONT, minHeight: HMI.touch.normal }}>
              초기화
            </button>
          </>
        )}
      </div>

      {/* DESTINATION MANAGEMENT MODAL */}
      {showDestModal && (
        <div onClick={e => { if (e.target === e.currentTarget) handleCloseDestModal() }} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 440, maxHeight: '82vh', background: T.surface, borderRadius: 16, border: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>배송지 관리</div>
                <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>{deliveries.length}개 배송지 · 총 {effectiveRouteKm} km</div>
              </div>
              <button onClick={handleCloseDestModal} style={{ width: 36, height: 36, borderRadius: '50%', background: T.surfaceSecondary, border: `1px solid ${T.border}`, fontSize: 20, color: T.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, lineHeight: 1 }}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {deliveries.length === 0 && editingId !== 'new' && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: T.textSecondary, fontSize: 13 }}>배송지가 없습니다</div>
              )}

              {deliveries.map((d, i) => (
                <div key={d.id} style={{ background: T.bg, borderRadius: 10, border: `1px solid ${editingId === d.id ? T.accent : T.border}`, marginBottom: 8, overflow: 'hidden', transition: 'border-color 0.15s' }}>
                  {editingId === d.id ? (
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>배송지 {i + 1} 편집</div>
                      <DestSearchForm
                        T={T} FONT={FONT}
                        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
                        searchStatus={searchStatus} setSearchStatus={setSearchStatus} searchResults={searchResults}
                        selectedSearchResult={selectedSearchResult}
                        showAdvancedInput={showAdvancedInput} setShowAdvancedInput={setShowAdvancedInput}
                        destForm={destForm} setDestForm={setDestForm}
                        isDestFormValid={isDestFormValid}
                        onSearch={handlePlaceSearch}
                        onSelectResult={handleSelectSearchResult}
                        onClearResult={() => { setSelectedSearchResult(null); setDestForm(EMPTY_DEST_FORM); setSearchStatus('done') }}
                        onSave={handleDestSave}
                        onCancel={handleDestCancel}
                        saveLabel="저장"
                      />
                    </div>
                  ) : (
                    <div style={{ padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: T.text, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                        <div style={{ fontSize: 11, color: T.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.address || `${d.lat.toFixed(4)}, ${d.lng.toFixed(4)}`}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => handleDestStartEdit(d)} style={{ padding: '7px 14px', borderRadius: 6, border: `1px solid ${T.border}`, background: 'transparent', color: T.textSecondary, fontSize: 12, cursor: 'pointer', fontFamily: FONT }}>편집</button>
                        <button onClick={() => handleDestDelete(d.id)} style={{ padding: '7px 12px', borderRadius: 6, border: `1px solid ${T.danger}40`, background: `${T.danger}10`, color: T.danger, fontSize: 12, cursor: 'pointer', fontFamily: FONT }}>삭제</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {editingId === 'new' ? (
                <div style={{ background: T.bg, borderRadius: 10, border: `1px solid ${T.accent}`, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>새 배송지</div>
                    <DestSearchForm
                      T={T} FONT={FONT}
                      searchQuery={searchQuery} setSearchQuery={setSearchQuery}
                      searchStatus={searchStatus} setSearchStatus={setSearchStatus} searchResults={searchResults}
                      selectedSearchResult={selectedSearchResult}
                      showAdvancedInput={showAdvancedInput} setShowAdvancedInput={setShowAdvancedInput}
                      destForm={destForm} setDestForm={setDestForm}
                      isDestFormValid={isDestFormValid}
                      onSearch={handlePlaceSearch}
                      onSelectResult={handleSelectSearchResult}
                      onClearResult={() => { setSelectedSearchResult(null); setDestForm(EMPTY_DEST_FORM); setSearchStatus('done') }}
                      onSave={handleDestSave}
                      onCancel={handleDestCancel}
                      saveLabel="배송지 추가"
                    />
                  </div>
                </div>
              ) : (
                <button onClick={handleDestStartAdd} style={{ width: '100%', padding: '14px', border: `1px dashed ${T.border}`, borderRadius: 10, background: 'transparent', color: T.textSecondary, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxSizing: 'border-box' }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
                  배송지 추가
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* START POINT MODAL */}
      {showStartModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { setShowStartModal(false); resetStartSearchState(); setStartForm(EMPTY_DEST_FORM) } }}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div style={{ width: 440, maxHeight: '82vh', background: T.surface, borderRadius: 16, border: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>출발지 설정</div>
                <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>현재: {startPoint.name}</div>
              </div>
              <button
                onClick={() => { setShowStartModal(false); resetStartSearchState(); setStartForm(EMPTY_DEST_FORM) }}
                style={{ width: 36, height: 36, borderRadius: '50%', background: T.surfaceSecondary, border: `1px solid ${T.border}`, fontSize: 20, color: T.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, lineHeight: 1 }}
              >×</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {/* Default depot shortcut */}
              <div style={{ marginBottom: 12, padding: '9px 12px', background: T.bg, borderRadius: 8, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: T.textSecondary }}>기본 출발지</div>
                  <div style={{ fontSize: 13, color: T.text }}>{depot.name}</div>
                </div>
                <button
                  onClick={handleResetStartPoint}
                  style={{ padding: '5px 12px', borderRadius: 5, border: `1px solid ${T.border}`, background: T.surfaceSecondary, color: T.textSecondary, fontSize: 11, cursor: 'pointer', fontFamily: FONT }}
                >
                  초기화
                </button>
              </div>

              {/* Place search (reuse DestSearchForm) */}
              <DestSearchForm
                T={T} FONT={FONT}
                searchQuery={startSearchQuery} setSearchQuery={setStartSearchQuery}
                searchStatus={startSearchStatus} setSearchStatus={setStartSearchStatus} searchResults={startSearchResults}
                selectedSearchResult={startSelectedResult}
                showAdvancedInput={startShowAdvanced} setShowAdvancedInput={setStartShowAdvanced}
                destForm={startForm} setDestForm={setStartForm}
                isDestFormValid={isStartFormValid}
                onSearch={handleStartPlaceSearch}
                onSelectResult={handleStartSelectResult}
                onClearResult={() => { setStartSelectedResult(null); setStartForm(EMPTY_DEST_FORM); setStartSearchStatus('done') }}
                onSave={handleSetStartPoint}
                onCancel={() => { setShowStartModal(false); resetStartSearchState(); setStartForm(EMPTY_DEST_FORM) }}
                saveLabel="이 장소를 출발지로 설정"
              />
            </div>
          </div>
        </div>
      )}

      {/* SOC EDIT MODAL */}
      {showSocModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowSocModal(false) }} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 320, background: T.surface, borderRadius: 16, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>배터리 설정</div>
              <button onClick={() => setShowSocModal(false)} style={{ width: 32, height: 32, borderRadius: '50%', background: T.surfaceSecondary, border: `1px solid ${T.border}`, fontSize: 18, color: T.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>현재 배터리 잔량 (SOC)</div>
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 60, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.03em', color: socDraft >= 30 ? T.success : T.danger }}>{socDraft}</span>
                <span style={{ fontSize: 20, color: T.textSecondary, verticalAlign: 'bottom', lineHeight: '2.2' }}>%</span>
              </div>
              <BatteryBar percent={socDraft} T={T} />
              <div style={{ marginTop: 12 }}>
                <input type="range" min="0" max="100" value={socDraft} onChange={e => setSocDraft(Number(e.target.value))} style={{ width: '100%', accentColor: T.accent, cursor: 'pointer' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: T.textSecondary }}>0%</span>
                  <input type="number" min="0" max="100" value={socDraft} onChange={e => setSocDraft(Math.min(100, Math.max(0, Number(e.target.value))))} style={{ width: 60, padding: '5px 8px', border: `1px solid ${T.border}`, borderRadius: 5, fontSize: 14, textAlign: 'center', background: T.surfaceSecondary, color: T.text, fontFamily: FONT }} />
                  <span style={{ fontSize: 10, color: T.textSecondary }}>100%</span>
                </div>
              </div>
              {isVehicleReady && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: T.surfaceSecondary, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: T.textSecondary }}>예상 주행 가능</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: socDraft >= 30 ? T.success : T.danger }}>{socDraftRange} km</span>
                </div>
              )}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>최소 도착 SOC</div>
                    <div style={{ fontSize: 11, color: T.textSecondary, lineHeight: 1.55 }}>
                      주행 가능 거리는 바뀌지 않지만,<br />배송 가능/충전 권장 판단 기준이 달라집니다.
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, flexShrink: 0, marginLeft: 10 }}>
                    <span style={{ fontSize: 22, fontWeight: 700, color: T.accent }}>{minReserveDraft}</span>
                    <span style={{ fontSize: 13, color: T.textSecondary }}>%</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {[5, 10, 15, 20, 25, 30].map(v => (
                    <button
                      key={v}
                      onClick={() => setMinReserveDraft(v)}
                      style={{
                        flex: 1, padding: '8px 0', borderRadius: 6,
                        border: `1px solid ${minReserveDraft === v ? T.accent : T.border}`,
                        background: minReserveDraft === v ? `${T.accent}18` : T.surfaceSecondary,
                        color: minReserveDraft === v ? T.accent : T.textSecondary,
                        fontSize: 11, fontWeight: minReserveDraft === v ? 700 : 400,
                        cursor: 'pointer', fontFamily: FONT,
                      }}
                    >
                      {v}%
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={saveSoc} style={{ flex: 1, padding: '12px 0', border: 'none', borderRadius: 8, background: T.accent, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>저장</button>
                <button onClick={() => setShowSocModal(false)} style={{ padding: '12px 20px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.textSecondary, fontSize: 14, cursor: 'pointer', fontFamily: FONT }}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
