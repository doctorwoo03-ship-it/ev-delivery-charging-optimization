import { useState, useMemo, useRef, useEffect } from 'react'
import { BRANDS, VEHICLES } from '../data/vehicleData'
import { depot, deliveries as INITIAL_DELIVERIES } from '../data/sampleData'
import { calculateRouteDistance, haversineKm } from '../utils/routeUtils'
import { THEMES, getInitialTheme, FONT } from '../theme/themes'

const EMPTY_CUSTOM = { name: '', batteryCapacityKwh: '', maxRangeKm: '', efficiencyKmPerKwh: '' }
const EMPTY_DEST_FORM = { name: '', lat: '', lng: '' }

const HDR = 56
const BAR = 68
const OUTER_HDR = 52

// ── Sub-components ────────────────────────────────────────────────────────────

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
        padding: '14px',
        transition: 'all 0.15s',
        userSelect: 'none',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: selected ? T.accent : T.text, marginBottom: 8, lineHeight: 1.3 }}>
        {vehicle.name}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 11, color: T.textSecondary }}>{vehicle.batteryCapacityKwh} kWh</span>
        <span style={{ fontSize: 11, color: T.textSecondary }}>{vehicle.efficiencyKmPerKwh?.toFixed(1)} km/kWh</span>
        <span style={{ fontSize: 11, color: T.textSecondary }}>최대 {vehicle.maxRangeKm} km</span>
      </div>
    </div>
  )
}

function BottomStat({ label, value, T }) {
  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 500, color: T.text }}>{value}</div>
    </div>
  )
}

// ── MapPanel ──────────────────────────────────────────────────────────────────
// Receives deliveries as a prop. Initial effect creates map + depot marker.
// A separate effect re-renders delivery markers and polyline whenever deliveries changes.

function MapPanel({ T, themeName, deliveries }) {
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const [mapStatus, setMapStatus] = useState('loading')
  const iwRef = useRef(null)
  const deliveryMarkersRef = useRef([])
  const polylineRef = useRef(null)

  // Create map and depot marker once per mount.
  useEffect(() => {
    const apiKey = import.meta.env.VITE_KAKAO_MAP_API_KEY
    if (!apiKey) { setMapStatus('error'); return }

    let cancelled = false
    let rafId = null

    const buildMap = () => {
      if (cancelled) return

      const container = mapContainerRef.current

      console.log('[MapPanel] mapContainerRef.current', container)
      console.log('[MapPanel] offsetWidth', container?.offsetWidth)
      console.log('[MapPanel] offsetHeight', container?.offsetHeight)

      if (!container) {
        rafId = requestAnimationFrame(buildMap)
        return
      }
      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        rafId = requestAnimationFrame(buildMap)
        return
      }

      if (mapInstanceRef.current) {
        mapInstanceRef.current.relayout()
        return
      }

      const kakao = window.kakao
      const center = new kakao.maps.LatLng(depot.lat, depot.lng)
      const map = new kakao.maps.Map(container, { center, level: 6 })
      mapInstanceRef.current = map

      const iw = new kakao.maps.InfoWindow({ removable: true })
      iwRef.current = iw

      const depotEl = document.createElement('div')
      depotEl.style.cssText = 'padding:4px 10px;background:#F59E0B;color:#fff;font-size:11px;font-weight:600;border-radius:20px;border:2px solid rgba(255,255,255,0.8);box-shadow:0 2px 6px rgba(0,0,0,.3);cursor:pointer;white-space:nowrap;font-family:sans-serif'
      depotEl.textContent = '출발지'
      depotEl.addEventListener('click', () => {
        iw.setContent(`<div style="padding:8px;font-size:13px;">${depot.name}</div>`)
        iw.setPosition(center)
        iw.open(map)
      })
      new kakao.maps.CustomOverlay({ position: center, content: depotEl, yAnchor: 1 }).setMap(map)

      setMapStatus('ready')
    }

    const onSDKReady = () => {
      if (cancelled) return
      if (!window.kakao?.maps) { setMapStatus('error'); return }
      window.kakao.maps.load(() => {
        if (!cancelled) rafId = requestAnimationFrame(buildMap)
      })
    }

    if (window.kakao?.maps) {
      window.kakao.maps.load(() => {
        if (!cancelled) rafId = requestAnimationFrame(buildMap)
      })
    } else {
      const existing = document.querySelector('script[src*="dapi.kakao.com"]')
      if (existing) {
        const prev = existing.onload
        existing.onload = () => { if (prev) prev(); onSDKReady() }
      } else {
        const script = document.createElement('script')
        script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false&libraries=services`
        script.async = true
        script.onload = onSDKReady
        script.onerror = () => { if (!cancelled) setMapStatus('error') }
        document.head.appendChild(script)
      }
    }

    return () => {
      cancelled = true
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  // Re-render delivery markers and polyline whenever deliveries changes or map becomes ready.
  useEffect(() => {
    if (mapStatus !== 'ready') return
    const map = mapInstanceRef.current
    if (!map) return

    deliveryMarkersRef.current.forEach(m => m.setMap(null))
    deliveryMarkersRef.current = []

    if (polylineRef.current) {
      polylineRef.current.setMap(null)
      polylineRef.current = null
    }

    const kakao = window.kakao
    const iw = iwRef.current
    const center = new kakao.maps.LatLng(depot.lat, depot.lng)

    deliveries.forEach((d, i) => {
      const pos = new kakao.maps.LatLng(d.lat, d.lng)
      const el = document.createElement('div')
      el.style.cssText = 'width:26px;height:26px;border-radius:50%;background:#3E6AE1;color:#fff;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,0.8);box-shadow:0 2px 6px rgba(0,0,0,.3);cursor:pointer;font-family:sans-serif'
      el.textContent = String(i + 1)
      el.addEventListener('click', () => {
        iw.setContent(`<div style="padding:8px;font-size:13px;">${d.name}</div>`)
        iw.setPosition(pos)
        iw.open(map)
      })
      const overlay = new kakao.maps.CustomOverlay({ position: pos, content: el, yAnchor: 1 })
      overlay.setMap(map)
      deliveryMarkersRef.current.push(overlay)
    })

    if (deliveries.length > 0) {
      const path = [center, ...deliveries.map(d => new kakao.maps.LatLng(d.lat, d.lng))]
      const polyline = new kakao.maps.Polyline({
        path,
        strokeWeight: 2,
        strokeColor: '#3E6AE1',
        strokeOpacity: 0.6,
        strokeStyle: 'shortdot',
      })
      polyline.setMap(map)
      polylineRef.current = polyline
    }
  }, [deliveries, mapStatus])

  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      position: 'relative',
      borderRadius: 12,
      overflow: 'hidden',
      border: `1px solid ${T.border}`,
      background: themeName === 'dark' ? '#1A1F2A' : '#E8EAEC',
    }}>
      {mapStatus === 'error' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 8, color: T.textSecondary,
        }}>
          <span style={{ fontSize: 28 }}>🗺</span>
          <span style={{ fontSize: 13 }}>지도를 불러올 수 없습니다</span>
          <span style={{ fontSize: 11 }}>VITE_KAKAO_MAP_API_KEY를 확인해 주세요</span>
        </div>
      )}
      <div
        ref={mapContainerRef}
        id="mvp4-kakao-map"
        style={{
          width: '100%',
          height: '100%',
          display: mapStatus === 'error' ? 'none' : 'block',
        }}
      />
      <div style={{
        position: 'absolute', bottom: 12, left: 12,
        display: 'flex', gap: 10, padding: '5px 10px',
        background: themeName === 'dark' ? 'rgba(10,11,13,0.72)' : 'rgba(255,255,255,0.85)',
        borderRadius: 6, backdropFilter: 'blur(4px)',
      }}>
        {[{ color: '#F59E0B', label: '출발지' }, { color: '#3E6AE1', label: '배송지' }].map(({ color, label }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: T.text }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MVP4Page() {
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

  // Vehicle state
  const [selectedBrand, setSelectedBrand] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [custom, setCustom] = useState(EMPTY_CUSTOM)
  const [soc, setSoc] = useState(80)
  const [view, setView] = useState('setup')
  const [routeExpanded, setRouteExpanded] = useState(false)
  const [calcExpanded, setCalcExpanded] = useState(false)

  // Delivery destinations — mutable, drives map + calculations
  const [deliveries, setDeliveries] = useState(INITIAL_DELIVERIES)

  // Destination management modal
  const [showDestModal, setShowDestModal] = useState(false)
  const [editingId, setEditingId] = useState(null) // null | 'new' | dest.id
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
        : (capacity > 0 && range > 0)
          ? parseFloat((range / capacity).toFixed(1))
          : 0
      return { id: 'custom', fullName: custom.name || '커스텀 차량', grade: '직접 입력', batteryCapacityKwh: capacity, maxRangeKm: range, efficiencyKmPerKwh: efficiency }
    }
    if (!selectedId) return null
    return VEHICLES.find(v => v.id === selectedId) ?? null
  }, [selectedBrand, isCustomBrand, selectedId, custom])

  const isVehicleReady = vehicle && vehicle.batteryCapacityKwh > 0 && vehicle.efficiencyKmPerKwh > 0
  const remainingKwh = isVehicleReady ? ((vehicle.batteryCapacityKwh * soc) / 100).toFixed(1) : null
  const estimatedRangeKm = isVehicleReady ? (parseFloat(remainingKwh) * vehicle.efficiencyKmPerKwh).toFixed(1) : null

  // totalRouteKm is reactive to deliveries state — auto-recalculates on any CRUD change
  const totalRouteKm = useMemo(() => parseFloat(calculateRouteDistance(depot, deliveries).toFixed(1)), [deliveries])

  const canDeliver = isVehicleReady && parseFloat(estimatedRangeKm) >= totalRouteKm
  const chargeNeeded = isVehicleReady && !canDeliver
  const shortageKm = chargeNeeded ? (totalRouteKm - parseFloat(estimatedRangeKm)).toFixed(1) : null

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
    setRouteExpanded(false)
    setCalcExpanded(false)
    setDeliveries(INITIAL_DELIVERIES)
    setShowDestModal(false)
    setEditingId(null)
    setDestForm(EMPTY_DEST_FORM)
  }

  // ── Destination CRUD ──────────────────────────────────────────────────────

  function handleOpenDestModal() {
    setShowDestModal(true)
  }

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
    if (editingId === id) {
      setEditingId(null)
      setDestForm(EMPTY_DEST_FORM)
    }
  }

  function handleDestCancel() {
    setEditingId(null)
    setDestForm(EMPTY_DEST_FORM)
  }

  const isDestFormValid = destForm.name.trim() !== '' &&
    !isNaN(parseFloat(destForm.lat)) &&
    !isNaN(parseFloat(destForm.lng))

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
          <span style={{ fontSize: 11, fontWeight: 600, color: T.accent, letterSpacing: '0.1em', textTransform: 'uppercase' }}>MVP-4</span>
          <span style={{ width: 1, height: 14, background: T.border, display: 'inline-block' }} />
          <span style={{ fontSize: 14, fontWeight: 500, color: T.textSecondary }}>배터리 & 경로 분석</span>
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

            {!selectedBrand ? (
              /* ── STEP 1: Brand selection ── */
              <>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: T.textSecondary, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>출발 전 설정</div>
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
                      <div style={{ fontSize: 11, fontWeight: 500, color: T.textSecondary, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>직접 입력</div>
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
                      <div style={{ fontSize: 11, fontWeight: 500, color: T.textSecondary, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
                        {BRANDS.find(b => b.id === selectedBrand)?.name}
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
                    padding: '14px 18px', marginBottom: 18,
                    background: T.surface, borderRadius: 10,
                    border: `1px solid ${isVehicleReady ? T.accent + '60' : T.border}`,
                  }}>
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
                )}

                <button
                  onClick={() => setView('cockpit')}
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
                  {isVehicleReady ? '경로 분석 시작 →' : '차량을 선택하세요'}
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
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text, lineHeight: 1.2 }}>{vehicle?.fullName}</div>
                  <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>{vehicle?.grade}</div>
                </div>
                <div style={{
                  padding: '3px 11px', borderRadius: 20,
                  background: canDeliver ? `${T.success}18` : `${T.danger}18`,
                  border: `1px solid ${canDeliver ? T.success + '40' : T.danger + '40'}`,
                  fontSize: 11, fontWeight: 600,
                  color: canDeliver ? T.success : T.danger,
                  flexShrink: 0, marginLeft: 8,
                }}>
                  {canDeliver ? '배송 가능' : '충전 필요'}
                </div>
              </div>

              {/* Gauge row: Battery % | Remaining range km */}
              <div style={{ padding: '16px 16px 0' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: 10, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 6 }}>배터리</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                      <span style={{
                        fontSize: 64, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.03em',
                        color: soc >= 30 ? T.success : T.danger,
                      }}>{soc}</span>
                      <span style={{ fontSize: 20, color: T.textSecondary, marginBottom: 7 }}>%</span>
                    </div>
                  </div>
                  <div style={{ width: 1, background: T.border, alignSelf: 'stretch', margin: '4px 0' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: 10, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 6 }}>주행 가능</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                      <span style={{
                        fontSize: 64, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.03em',
                        color: canDeliver ? T.success : T.danger,
                      }}>{estimatedRangeKm}</span>
                      <span style={{ fontSize: 20, color: T.textSecondary, marginBottom: 7 }}>km</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vehicle silhouette */}
              <div style={{ padding: '8px 16px 4px', display: 'flex', justifyContent: 'center' }}>
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

              {/* Battery progress strip */}
              <div style={{ padding: '2px 16px 8px' }}>
                <BatteryBar percent={soc} T={T} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                  <span style={{ fontSize: 11, color: T.textSecondary }}>{remainingKwh} kWh 남음</span>
                  <span style={{ fontSize: 11, color: chargeNeeded ? T.danger : T.success }}>
                    {chargeNeeded
                      ? `${shortageKm} km 부족`
                      : `+${(parseFloat(estimatedRangeKm) - totalRouteKm).toFixed(1)} km 여유`}
                  </span>
                </div>
              </div>

              {/* SOC slider */}
              <div style={{ padding: '10px 16px 14px', borderTop: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>SOC 조정</div>
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
                      width: 56, padding: '4px 7px', border: `1px solid ${T.border}`, borderRadius: 5,
                      fontSize: 13, textAlign: 'center', background: T.surfaceSecondary, color: T.text, fontFamily: FONT,
                    }}
                  />
                  <span style={{ fontSize: 10, color: T.textSecondary }}>100%</span>
                </div>
              </div>
            </div>
            {/* ── END INTEGRATED CLUSTER PANEL ── */}

            {/* Current driving info widget */}
            <div style={{ margin: '12px 16px 0', borderRadius: 8, background: T.surfaceSecondary, border: `1px solid ${T.border}`, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>현재 운행 정보</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 12px' }}>
                {[
                  { label: '총 경로', value: `${totalRouteKm} km`, color: T.text },
                  { label: '배송지', value: `${deliveries.length}개`, color: T.text },
                  { label: '주행 가능', value: `${estimatedRangeKm} km`, color: canDeliver ? T.success : T.danger },
                  { label: '현재 SOC', value: `${soc}%`, color: T.text },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, color: T.textSecondary, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>{label}</div>
                    <div style={{ fontSize: 15, fontWeight: 500, color }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Vehicle spec row + change button */}
            <div style={{ padding: '12px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{vehicle?.fullName}</div>
                <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>
                  {vehicle?.batteryCapacityKwh} kWh · {vehicle?.efficiencyKmPerKwh?.toFixed(1)} km/kWh
                </div>
              </div>
              <button
                onClick={() => setView('setup')}
                style={{
                  fontSize: 11, color: T.accent, background: 'transparent',
                  border: `1px solid ${T.accent}50`, borderRadius: 4,
                  cursor: 'pointer', padding: '4px 12px', fontFamily: FONT,
                }}
              >
                변경
              </button>
            </div>

            <div style={{ height: 1, background: T.border, margin: '12px 0' }} />

            {/* Route list header: label + [배송지 관리] + expand toggle */}
            <div style={{ padding: '0 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 500, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  배송 경로 ({deliveries.length}개)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={handleOpenDestModal}
                    style={{
                      fontSize: 11, color: T.accent, background: 'transparent',
                      border: `1px solid ${T.accent}50`, borderRadius: 4,
                      cursor: 'pointer', padding: '3px 10px', fontFamily: FONT,
                    }}
                  >
                    배송지 관리
                  </button>
                  {deliveries.length > 2 && (
                    <button
                      onClick={() => setRouteExpanded(e => !e)}
                      style={{
                        fontSize: 11, color: T.textSecondary, background: 'transparent',
                        border: 'none', cursor: 'pointer', fontFamily: FONT, padding: '2px 0',
                      }}
                    >
                      {routeExpanded ? '접기 ↑' : `+${deliveries.length - 2}개 더 ↓`}
                    </button>
                  )}
                </div>
              </div>

              {deliveries.length === 0 ? (
                <div style={{ padding: '12px 0', fontSize: 12, color: T.textSecondary, textAlign: 'center' }}>
                  배송지 없음 — 배송지 관리에서 추가하세요
                </div>
              ) : (
                deliveries.slice(0, routeExpanded ? deliveries.length : 2).map((d, i) => {
                  const prev = i === 0 ? depot : deliveries[i - 1]
                  const segDist = haversineKm(prev.lat, prev.lng, d.lat, d.lng).toFixed(2)
                  const visibleCount = routeExpanded ? deliveries.length : 2
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
                        <div style={{ fontSize: 12, fontWeight: 500, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {d.name}
                        </div>
                        <div style={{ fontSize: 10, color: T.textSecondary, marginTop: 1 }}>
                          {i === 0 ? depot.name : deliveries[i - 1].name}에서
                        </div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: T.text, flexShrink: 0 }}>{segDist} km</div>
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
                      fontSize: 12, fontWeight: 500, color: T.textSecondary,
                      cursor: 'pointer', fontFamily: FONT,
                      transition: 'border-color 0.15s, color 0.15s',
                    }}
                  >
                    {calcExpanded ? '계산식 숨기기 ↑' : '계산식 보기 ↓'}
                  </button>

                  {calcExpanded && (
                    <div style={{
                      marginTop: 8,
                      fontSize: 11, color: T.textSecondary, lineHeight: 1.85,
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
            display: 'flex',
            flexDirection: 'column',
            padding: '10px 10px 10px 6px',
            background: T.bg,
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 4px 8px',
            }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: T.textSecondary, letterSpacing: '0.08em', textTransform: 'uppercase' }}>경로 지도</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{totalRouteKm} km · {deliveries.length}개 배송지</span>
            </div>
            <MapPanel T={T} themeName={themeName} deliveries={deliveries} />
          </div>
        </div>
      )}

      {/* ── BOTTOM UTILITY BAR ── */}
      <div style={{
        height: BAR, padding: '0 20px',
        display: 'flex', alignItems: 'center', gap: 0,
        background: T.surface,
        borderTop: `1px solid ${T.border}`,
        boxShadow: `inset 0 1px 0 ${T.accent}35`,
        flexShrink: 0,
      }}>
        {view === 'setup' ? (
          <>
            <span style={{ fontSize: 13, color: T.textSecondary }}>경로: {totalRouteKm} km · 배송지 {deliveries.length}개</span>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setView('cockpit')}
              disabled={!isVehicleReady}
              style={{
                padding: '10px 28px', border: 'none', borderRadius: 6,
                background: isVehicleReady ? T.accent : T.surfaceSecondary,
                color: isVehicleReady ? '#fff' : T.textSecondary,
                fontSize: 13, fontWeight: 600,
                cursor: isVehicleReady ? 'pointer' : 'not-allowed', fontFamily: FONT,
              }}
            >
              {isVehicleReady ? '경로 분석 시작 →' : '차량을 선택하세요'}
            </button>
          </>
        ) : (
          <>
            <BottomStat label="총 경로" value={`${totalRouteKm} km`} T={T} />
            <div style={{ width: 1, height: 30, background: T.border, margin: '0 8px' }} />
            <BottomStat label="배송지" value={`${deliveries.length}개`} T={T} />
            <div style={{ width: 1, height: 30, background: T.border, margin: '0 8px' }} />
            <BottomStat label="주행 가능" value={`${estimatedRangeKm} km`} T={T} />
            <div style={{ width: 1, height: 30, background: T.border, margin: '0 8px' }} />
            <div style={{
              padding: '5px 14px', borderRadius: 20,
              background: canDeliver ? `${T.success}18` : `${T.danger}18`,
              border: `1px solid ${canDeliver ? T.success + '50' : T.danger + '50'}`,
              fontSize: 12, fontWeight: 600,
              color: canDeliver ? T.success : T.danger,
            }}>
              {canDeliver ? '배송 가능' : '충전 필요'}
            </div>
            <div style={{ flex: 1 }} />
            <button
              disabled
              title="MVP-5에서 구현 예정"
              style={{
                padding: '10px 22px', border: `1px solid ${T.border}`, borderRadius: 6,
                background: 'transparent', color: T.textSecondary,
                fontSize: 13, fontWeight: 500, cursor: 'not-allowed', opacity: 0.4, fontFamily: FONT,
                marginRight: 8,
              }}
            >
              경로 최적화
            </button>
            <button
              onClick={handleReset}
              style={{
                padding: '10px 22px', border: `1px solid ${T.border}`, borderRadius: 6,
                background: T.surface, color: T.text,
                fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: FONT,
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

            {/* Modal header */}
            <div style={{
              padding: '18px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: `1px solid ${T.border}`,
              flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>배송지 관리</div>
                <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>
                  {deliveries.length}개 배송지 · 총 {totalRouteKm} km
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
              >
                ×
              </button>
            </div>

            {/* Scrollable destination list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>

              {deliveries.length === 0 && editingId !== 'new' && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: T.textSecondary, fontSize: 13 }}>
                  배송지가 없습니다
                </div>
              )}

              {deliveries.map((d, i) => (
                <div key={d.id} style={{
                  background: T.bg,
                  borderRadius: 10,
                  border: `1px solid ${editingId === d.id ? T.accent : T.border}`,
                  marginBottom: 8,
                  overflow: 'hidden',
                  transition: 'border-color 0.15s',
                }}>
                  {editingId === d.id ? (
                    /* Inline edit form */
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
                        <button
                          onClick={handleDestSave}
                          disabled={!isDestFormValid}
                          style={{
                            flex: 1, padding: '11px 0', borderRadius: 6, border: 'none',
                            background: isDestFormValid ? T.accent : T.surfaceSecondary,
                            color: isDestFormValid ? '#fff' : T.textSecondary,
                            fontSize: 13, fontWeight: 600,
                            cursor: isDestFormValid ? 'pointer' : 'not-allowed', fontFamily: FONT,
                          }}
                        >저장</button>
                        <button
                          onClick={handleDestCancel}
                          style={{
                            padding: '11px 18px', borderRadius: 6,
                            border: `1px solid ${T.border}`, background: 'transparent',
                            color: T.textSecondary, fontSize: 13, cursor: 'pointer', fontFamily: FONT,
                          }}
                        >취소</button>
                      </div>
                    </div>
                  ) : (
                    /* Destination card */
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
                        <div style={{ fontSize: 11, color: T.textSecondary }}>
                          {d.lat.toFixed(4)}, {d.lng.toFixed(4)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => handleDestStartEdit(d)}
                          style={{
                            padding: '7px 14px', borderRadius: 6,
                            border: `1px solid ${T.border}`, background: 'transparent',
                            color: T.textSecondary, fontSize: 12, cursor: 'pointer', fontFamily: FONT,
                          }}
                        >편집</button>
                        <button
                          onClick={() => handleDestDelete(d.id)}
                          style={{
                            padding: '7px 12px', borderRadius: 6,
                            border: `1px solid ${T.danger}40`, background: `${T.danger}10`,
                            color: T.danger, fontSize: 12, cursor: 'pointer', fontFamily: FONT,
                          }}
                        >삭제</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add new destination */}
              {editingId === 'new' ? (
                <div style={{
                  background: T.bg, borderRadius: 10,
                  border: `1px solid ${T.accent}`,
                  overflow: 'hidden', marginBottom: 8,
                }}>
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                      새 배송지
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
                      <button
                        onClick={handleDestSave}
                        disabled={!isDestFormValid}
                        style={{
                          flex: 1, padding: '11px 0', borderRadius: 6, border: 'none',
                          background: isDestFormValid ? T.accent : T.surfaceSecondary,
                          color: isDestFormValid ? '#fff' : T.textSecondary,
                          fontSize: 13, fontWeight: 600,
                          cursor: isDestFormValid ? 'pointer' : 'not-allowed', fontFamily: FONT,
                        }}
                      >추가</button>
                      <button
                        onClick={handleDestCancel}
                        style={{
                          padding: '11px 18px', borderRadius: 6,
                          border: `1px solid ${T.border}`, background: 'transparent',
                          color: T.textSecondary, fontSize: 13, cursor: 'pointer', fontFamily: FONT,
                        }}
                      >취소</button>
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
    </div>
  )
}
