import { useState, useRef, useEffect } from 'react'
import { depot as defaultDepot } from '../../data/sampleData'
import RouteActionOverlay from './RouteActionOverlay'
import { loadKakaoMaps } from '../../utils/kakaoMapLoader'
import { getVehicleRoute } from '../../services/kakaoDirectionsService'
import { FONT } from '../../theme/themes'
import { getVisibleChargersForRoute } from '../../utils/chargerVisibilityUtils'
import { isValidRoadRouteResult } from '../../utils/routeValidation'

const CHARGER_TYPE_LABELS = {
  DC_COMBO:    'DC 콤보',
  DC_CHADEMO:  'DC 차데모',
  AC_3:        'AC 3상',
  AC_SLOW:     'AC 완속',
}

function relativeTime(isoStr) {
  if (!isoStr) return null
  const date = new Date(isoStr)
  if (isNaN(date.getTime())) return null   // "24시간 이용가능" 등 비날짜 문자열 방어
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return '방금 전'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return `${Math.floor(diff / 86400)}일 전`
}

function ChargerDetailCard({ charger, recommendedChargerId, warnChargerId, onClose, T, themeName, hmi }) {
  if (!charger) return null

  const isRec = charger.id === recommendedChargerId
  const isUnreachable = charger.id === warnChargerId || charger.reachableFromStart === false
  const isMaintenance = charger.status === 'maintenance'
  const isOccupied = charger.status === 'occupied' || (charger.availableSlots === 0 && charger.status !== 'maintenance')
  const isUnknownStatus = charger.status === 'unknown'
  const isSafeMap = charger.source === 'safemap' || charger.dataKind === 'location'

  const fs = hmi?.text ?? { caption: '12px', body: '14px', bodyStrong: '16px', title: '18px' }
  const bgColor = themeName === 'dark' ? 'rgba(17,19,23,0.96)' : 'rgba(255,255,255,0.97)'

  // Header badge: priority → recommended > unreachable > maintenance > occupied > available
  let badgeLabel, badgeBg, borderColor, headerBg
  if (isRec) {
    badgeLabel = '⚡ 추천'
    badgeBg = T.accent
    borderColor = `${T.accent}80`
    headerBg = `${T.accent}14`
  } else if (isUnreachable) {
    badgeLabel = '도달 불가'
    badgeBg = T.danger
    borderColor = `${T.danger}80`
    headerBg = `${T.danger}14`
  } else if (isMaintenance) {
    badgeLabel = '점검 중'
    badgeBg = T.danger
    borderColor = `${T.danger}60`
    headerBg = `${T.danger}10`
  } else if (isOccupied) {
    badgeLabel = '사용 중'
    badgeBg = T.warning
    borderColor = `${T.warning}60`
    headerBg = `${T.warning}10`
  } else if (isUnknownStatus && isSafeMap) {
    badgeLabel = '위치 확인됨'
    badgeBg = '#22C55E'
    borderColor = T.border
    headerBg = 'rgba(34,197,94,0.10)'
  } else if (isUnknownStatus) {
    badgeLabel = '정보 없음'
    badgeBg = T.textSecondary
    borderColor = T.border
    headerBg = `${T.surfaceSecondary}`
  } else {
    badgeLabel = '이용 가능'
    badgeBg = T.success
    borderColor = T.border
    headerBg = `${T.success}10`
  }

  const slotColor = charger.availableSlots != null && charger.availableSlots > 0 ? T.success : T.danger
  const typeLabel = CHARGER_TYPE_LABELS[charger.chargerType] ?? charger.chargerType ?? null
  // SafeMap: lastUpdated is null; useTime contains operating-hours text (e.g. "24시간 이용가능")
  const updatedLabel = isSafeMap
    ? (charger.useTime ?? null)
    : relativeTime(charger.lastUpdated)

  return (
    <div style={{
      position: 'absolute', top: 12, right: 12, zIndex: 20,
      width: 'min(300px, calc(100% - 24px))',
      background: bgColor,
      borderRadius: 12,
      border: `1px solid ${borderColor}`,
      boxShadow: '0 4px 24px rgba(0,0,0,0.28)',
      overflow: 'hidden',
      fontFamily: FONT,
    }}>
      {/* Header: status badge + close */}
      <div style={{
        padding: '9px 14px',
        background: headerBg,
        borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ padding: '2px 9px', borderRadius: 20, background: badgeBg, color: '#fff', fontSize: 11, fontWeight: 600 }}>
          {badgeLabel}
        </span>
        <button
          onClick={onClose}
          style={{
            width: 24, height: 24, borderRadius: '50%',
            background: T.surfaceSecondary, border: `1px solid ${T.border}`,
            color: T.textSecondary, fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1, fontFamily: FONT, flexShrink: 0,
          }}
        >×</button>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px' }}>

        {/* Name */}
        <div style={{ fontSize: fs.bodyStrong, fontWeight: 600, color: T.text, marginBottom: 3, lineHeight: 1.3 }}>
          {charger.name}
        </div>

        {/* Operator + charger type */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {charger.operator && (
            <span style={{ fontSize: fs.caption, color: T.textSecondary }}>
              {charger.operator}
              {charger.operatorId ? ` (${charger.operatorId})` : ''}
            </span>
          )}
          {typeLabel && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20,
              background: T.surfaceSecondary, border: `1px solid ${T.border}`,
              color: T.textSecondary, whiteSpace: 'nowrap',
            }}>
              {typeLabel}
            </span>
          )}
        </div>

        {/* PRIMARY METRICS: price + speed + slots */}
        <div style={{ display: 'grid', gridTemplateColumns: '5fr 3fr 3fr', gap: 6, marginBottom: 8 }}>
          {/* Price — most prominent */}
          <div style={{
            padding: '9px 10px', background: T.surfaceSecondary, borderRadius: 8,
            border: `1px solid ${T.border}`, textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, color: T.textSecondary, marginBottom: 3 }}>충전 단가</div>
            <div style={{ fontSize: fs.bodyStrong, fontWeight: 700, color: T.text, lineHeight: 1 }}>
              {charger.pricePerKwh?.toLocaleString('ko-KR')}
              <span style={{ fontSize: 10, fontWeight: 400, color: T.textSecondary }}> 원/kWh</span>
            </div>
          </div>
          {/* Speed */}
          <div style={{
            padding: '9px 6px', background: T.surfaceSecondary, borderRadius: 8,
            border: `1px solid ${T.border}`, textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, color: T.textSecondary, marginBottom: 3 }}>속도</div>
            <div style={{ fontSize: fs.body, fontWeight: 600, color: T.text, lineHeight: 1 }}>
              {charger.powerKw}kW
            </div>
          </div>
          {/* Slots */}
          <div style={{
            padding: '9px 6px', background: T.surfaceSecondary, borderRadius: 8,
            border: `1px solid ${T.border}`, textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, color: T.textSecondary, marginBottom: 3 }}>충전기</div>
            {charger.availableSlots != null ? (
              <div style={{ fontSize: fs.body, fontWeight: 600, color: slotColor, lineHeight: 1 }}>
                {charger.availableSlots}/{charger.totalSlots}
              </div>
            ) : (
              <div style={{ fontSize: fs.body, fontWeight: 600, color: T.textSecondary, lineHeight: 1 }}>
                {charger.connectorCount ?? charger.totalSlots ?? '-'}기
              </div>
            )}
          </div>
        </div>

        {/* Distance metrics — only when scored data is available */}
        {(charger.distanceFromStartKm != null || charger.routeDeviationKm != null) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            {charger.distanceFromStartKm != null && (
              <div style={{
                padding: '6px 8px', background: T.bg, borderRadius: 6,
                border: `1px solid ${T.border}`, textAlign: 'center',
              }}>
                <div style={{ fontSize: 10, color: T.textSecondary, marginBottom: 2 }}>출발지 거리</div>
                <div style={{ fontSize: fs.body, fontWeight: 500, color: isUnreachable ? T.danger : T.text }}>
                  {charger.distanceFromStartKm} km
                </div>
              </div>
            )}
            {charger.routeDeviationKm != null && (
              <div style={{
                padding: '6px 8px', background: T.bg, borderRadius: 6,
                border: `1px solid ${T.border}`, textAlign: 'center',
              }}>
                <div style={{ fontSize: 10, color: T.textSecondary, marginBottom: 2 }}>경로 편차</div>
                <div style={{ fontSize: fs.body, fontWeight: 500, color: T.text }}>
                  {charger.routeDeviationMeters != null
                    ? charger.routeDeviationMeters < 1000
                      ? `${charger.routeDeviationMeters}m`
                      : `${(charger.routeDeviationMeters / 1000).toFixed(1)}km`
                    : `${charger.routeDeviationKm}km`}
                </div>
                {charger.routeBandLabel && (
                  <div style={{ fontSize: 9, color: T.textSecondary, marginTop: 2, lineHeight: 1.2 }}>
                    {charger.routeBandLabel}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Secondary: wait + last updated */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 11, color: T.textSecondary, marginBottom: (isUnreachable || isMaintenance || isUnknownStatus) ? 8 : 0,
        }}>
          {isSafeMap
            ? <span style={{ color: T.textSecondary }}>위치 정보 기준</span>
            : <span>{charger.waitMin > 0 ? `대기 ${charger.waitMin}분` : '대기 정보 미확인'}</span>
          }
          {isSafeMap
            ? <span>{updatedLabel ?? '업데이트 정보 없음'}</span>
            : (updatedLabel && <span>업데이트 {updatedLabel}</span>)
          }
        </div>

        {/* Warning messages */}
        {isUnreachable && (
          <div style={{ padding: '6px 10px', background: `${T.danger}15`, borderRadius: 6, fontSize: 11, color: T.danger }}>
            현재 배터리로 도달하기 어렵습니다
          </div>
        )}
        {!isUnreachable && isMaintenance && (
          <div style={{ padding: '6px 10px', background: `${T.danger}15`, borderRadius: 6, fontSize: 11, color: T.danger }}>
            현재 점검 중입니다
          </div>
        )}
        {!isUnreachable && !isMaintenance && isUnknownStatus && (
          <div style={{ padding: '6px 10px', background: `${T.textSecondary}15`, borderRadius: 6, fontSize: 11, color: T.textSecondary }}>
            {isSafeMap ? '생활안전정보 위치 데이터 기준입니다.' : '실시간 상태를 확인할 수 없습니다'}
          </div>
        )}
      </div>
    </div>
  )
}

function MapPanel({ T, themeName, deliveries, chargers, recommendedChargerId, chargerWaypoint, warnChargerId, overlayState, overlayData, onOpenSocModal, hmi, startPoint, routePathResult, chargerRoutePathResult }) {
  const effectiveStart = startPoint || defaultDepot
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const [mapStatus, setMapStatus] = useState('loading')
  const [mapError, setMapError] = useState(null)
  const [selectedCharger, setSelectedCharger] = useState(null)
  const [internalRouteResult, setInternalRouteResult] = useState(null)
  const iwRef = useRef(null)
  const deliveryMarkersRef = useRef([])
  const polylineRef = useRef([])
  const chargerMarkersRef = useRef([])
  const startPointOverlayRef = useRef(null)
  const ignoreNextMapClickRef = useRef(false)
  const routeSeqRef = useRef(0)

  // Map initialization
  useEffect(() => {
    let cancelled = false
    let rafId = null

    const buildMap = () => {
      if (cancelled) return
      const container = mapContainerRef.current
      if (!container) { rafId = requestAnimationFrame(buildMap); return }
      if (container.offsetWidth === 0 || container.offsetHeight === 0) { rafId = requestAnimationFrame(buildMap); return }
      if (mapInstanceRef.current) { mapInstanceRef.current.relayout(); return }

      const kakao = window.kakao
      const sp = startPoint || defaultDepot
      const center = new kakao.maps.LatLng(sp.lat, sp.lng)
      const map = new kakao.maps.Map(container, { center, level: 6 })
      mapInstanceRef.current = map

      const iw = new kakao.maps.InfoWindow({ removable: true })
      iwRef.current = iw

      kakao.maps.event.addListener(map, 'click', () => {
        if (ignoreNextMapClickRef.current) {
          ignoreNextMapClickRef.current = false
          return
        }
        setSelectedCharger(null)
      })

      setMapStatus('ready')
    }

    loadKakaoMaps()
      .then(() => { if (!cancelled) rafId = requestAnimationFrame(buildMap) })
      .catch(err => { if (!cancelled) { setMapStatus('error'); setMapError(err?.message || 'unknown') } })

    return () => { cancelled = true; if (rafId) cancelAnimationFrame(rafId) }
  }, [])

  // Starting point marker — re-creates when startPoint changes
  useEffect(() => {
    if (mapStatus !== 'ready') return
    const map = mapInstanceRef.current
    if (!map) return

    if (startPointOverlayRef.current) {
      startPointOverlayRef.current.setMap(null)
      startPointOverlayRef.current = null
    }

    const kakao = window.kakao
    const iw = iwRef.current
    const sp = startPoint || defaultDepot
    const pos = new kakao.maps.LatLng(sp.lat, sp.lng)

    const depotEl = document.createElement('div')
    depotEl.style.cssText = 'padding:4px 10px;background:#F59E0B;color:#fff;font-size:11px;font-weight:600;border-radius:20px;border:2px solid rgba(255,255,255,0.8);box-shadow:0 2px 6px rgba(0,0,0,.3);cursor:pointer;white-space:nowrap;font-family:sans-serif'
    depotEl.textContent = '출발지'
    depotEl.addEventListener('click', () => {
      ignoreNextMapClickRef.current = true
      setSelectedCharger(null)
      iw.setContent(`<div style="padding:8px;font-size:13px;">${sp.name}</div>`)
      iw.setPosition(pos)
      iw.open(map)
    })
    const overlay = new kakao.maps.CustomOverlay({ position: pos, content: depotEl, yAnchor: 1 })
    overlay.setMap(map)
    startPointOverlayRef.current = overlay
  }, [mapStatus, startPoint])

  // Delivery markers
  useEffect(() => {
    if (mapStatus !== 'ready') return
    const map = mapInstanceRef.current
    if (!map) return

    deliveryMarkersRef.current.forEach(m => m.setMap(null))
    deliveryMarkersRef.current = []

    const kakao = window.kakao
    const iw = iwRef.current

    deliveries.forEach((d, i) => {
      const pos = new kakao.maps.LatLng(d.lat, d.lng)
      const el = document.createElement('div')
      el.style.cssText = 'width:26px;height:26px;border-radius:50%;background:#3E6AE1;color:#fff;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,0.8);box-shadow:0 2px 6px rgba(0,0,0,.3);cursor:pointer;font-family:sans-serif'
      el.textContent = String(i + 1)
      el.addEventListener('click', () => {
        ignoreNextMapClickRef.current = true
        setSelectedCharger(null)
        iw.setContent(`<div style="padding:8px;font-size:13px;">${d.name}</div>`)
        iw.setPosition(pos)
        iw.open(map)
      })
      const overlay = new kakao.maps.CustomOverlay({ position: pos, content: el, yAnchor: 1 })
      overlay.setMap(map)
      deliveryMarkersRef.current.push(overlay)
    })
  }, [deliveries, mapStatus])

  // Route polylines — renders only validated real road routes.
  // Three rendering paths:
  //   1. chargerRoutePathResult provided (MVP6Page separated routes):
  //      • Amber polyline for charger route (start→charger)
  //      • Blue polyline for delivery route (routePathResult)
  //      • Each drawn only when its result passes isValidRoadRouteResult
  //   2. Only routePathResult provided (backward-compat section split for older callers):
  //      • Uses sectionPaths[0] as amber and rest as blue when chargerWaypoint exists
  //   3. Neither provided (MVP5Page): internal fetch via getVehicleRoute
  // Fallback straight-line rendering is intentionally absent in all paths.
  useEffect(() => {
    if (mapStatus !== 'ready') return
    const map = mapInstanceRef.current
    if (!map) return

    polylineRef.current.forEach(p => p.setMap(null))
    polylineRef.current = []

    if (deliveries.length === 0) {
      if (routePathResult === undefined && chargerRoutePathResult === undefined) setInternalRouteResult(null)
      return
    }

    const sp = startPoint || defaultDepot
    const kakao = window.kakao
    const newPolylines = []

    // ── Path 1: Separate charger + delivery routes (MVP6Page) ─────────────
    if (chargerRoutePathResult !== undefined) {
      if (isValidRoadRouteResult(chargerRoutePathResult)) {
        const amber = new kakao.maps.Polyline({
          path:          chargerRoutePathResult.path.map(pt => new kakao.maps.LatLng(pt.lat, pt.lng)),
          strokeWeight:  4,
          strokeColor:   '#F59E0B',
          strokeOpacity: 0.88,
          strokeStyle:   'solid',
        })
        amber.setMap(map)
        newPolylines.push(amber)
      }
      if (isValidRoadRouteResult(routePathResult)) {
        const blue = new kakao.maps.Polyline({
          path:          routePathResult.path.map(pt => new kakao.maps.LatLng(pt.lat, pt.lng)),
          strokeWeight:  4,
          strokeColor:   '#3E6AE1',
          strokeOpacity: 0.85,
          strokeStyle:   'solid',
        })
        blue.setMap(map)
        newPolylines.push(blue)
      }
      polylineRef.current = newPolylines

      // Fit bounds to all visible path points
      const allPts = [
        ...(isValidRoadRouteResult(chargerRoutePathResult) ? chargerRoutePathResult.path : []),
        ...(isValidRoadRouteResult(routePathResult)        ? routePathResult.path        : []),
      ]
      if (allPts.length >= 2) {
        const bounds = new kakao.maps.LatLngBounds()
        allPts.forEach(pt => bounds.extend(new kakao.maps.LatLng(pt.lat, pt.lng)))
        map.setBounds(bounds, 50)
      }
      return
    }

    // ── Path 2: Single combined result with optional section split ─────────
    function drawRoadPolylines(result) {
      const sPathLen    = result.sectionPaths?.length ?? 0
      const seg0Len     = result.sectionPaths?.[0]?.length ?? 0
      const restPathLen = sPathLen >= 2 ? result.sectionPaths.slice(1).flat().length : 0
      const useSection  = !!chargerWaypoint && sPathLen >= 2 && seg0Len >= 2 && restPathLen >= 2

      if (useSection) {
        const p1 = new kakao.maps.Polyline({
          path: result.sectionPaths[0].map(pt => new kakao.maps.LatLng(pt.lat, pt.lng)),
          strokeWeight: 4, strokeColor: '#F59E0B', strokeOpacity: 0.88, strokeStyle: 'solid',
        })
        p1.setMap(map)
        newPolylines.push(p1)
        const p2 = new kakao.maps.Polyline({
          path: result.sectionPaths.slice(1).flat().map(pt => new kakao.maps.LatLng(pt.lat, pt.lng)),
          strokeWeight: 4, strokeColor: '#3E6AE1', strokeOpacity: 0.85, strokeStyle: 'solid',
        })
        p2.setMap(map)
        newPolylines.push(p2)
      } else {
        const polyline = new kakao.maps.Polyline({
          path: result.path.map(pt => new kakao.maps.LatLng(pt.lat, pt.lng)),
          strokeWeight: 4, strokeColor: '#3E6AE1', strokeOpacity: 0.85, strokeStyle: 'solid',
        })
        polyline.setMap(map)
        newPolylines.push(polyline)
      }
      polylineRef.current = newPolylines

      if (result.path?.length >= 2) {
        const routeBounds = new kakao.maps.LatLngBounds()
        result.path.forEach(pt => routeBounds.extend(new kakao.maps.LatLng(pt.lat, pt.lng)))
        map.setBounds(routeBounds, 50)
      }
    }

    if (routePathResult !== undefined) {
      if (isValidRoadRouteResult(routePathResult)) drawRoadPolylines(routePathResult)
      return
    }

    // ── Path 3: Internal fetch (MVP5Page backward compat) ─────────────────
    const seq = ++routeSeqRef.current
    getVehicleRoute({ startPoint: sp, deliveries, chargerWaypoint }).then(result => {
      if (seq !== routeSeqRef.current) return
      setInternalRouteResult(result)
      if (isValidRoadRouteResult(result)) drawRoadPolylines(result)
    })
  }, [deliveries, chargerWaypoint, mapStatus, startPoint, routePathResult, chargerRoutePathResult])

  // Charger markers
  useEffect(() => {
    if (mapStatus !== 'ready') return
    const map = mapInstanceRef.current
    if (!map) return

    chargerMarkersRef.current.forEach(m => m.setMap(null))
    chargerMarkersRef.current = []

    const kakao = window.kakao

    const visibleChargers = getVisibleChargersForRoute(chargers, {
      recommendedId: recommendedChargerId,
      selectedId: selectedCharger?.id ?? null,
      warnId: warnChargerId,
    })

    visibleChargers.forEach(c => {
      const pos = new kakao.maps.LatLng(c.lat, c.lng)
      const isRec = c.id === recommendedChargerId
      const isWarn = c.id === warnChargerId
      const el = document.createElement('div')

      if (isRec) {
        el.style.cssText = 'padding:4px 10px;background:#3E6AE1;color:#fff;font-size:11px;font-weight:600;border-radius:20px;border:2px solid rgba(255,255,255,0.9);box-shadow:0 2px 10px rgba(62,106,225,.5);cursor:pointer;white-space:nowrap;font-family:sans-serif'
        el.textContent = '⚡ 추천'
      } else if (isWarn) {
        el.style.cssText = 'padding:4px 10px;background:#EF4444;color:#fff;font-size:11px;font-weight:600;border-radius:20px;border:2px solid rgba(255,255,255,0.9);box-shadow:0 2px 10px rgba(239,68,68,.5);cursor:pointer;white-space:nowrap;font-family:sans-serif'
        el.textContent = '⚡ 도달 불가'
      } else {
        el.style.cssText = 'width:20px;height:20px;border-radius:50%;background:#22C55E;color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,0.7);box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:pointer;font-family:sans-serif'
        el.textContent = '⚡'
      }

      el.addEventListener('click', () => {
        ignoreNextMapClickRef.current = true
        if (iwRef.current) iwRef.current.close()
        setSelectedCharger(prev => prev?.id === c.id ? null : c)
      })

      const overlay = new kakao.maps.CustomOverlay({ position: pos, content: el, yAnchor: 1 })
      overlay.setMap(map)
      chargerMarkersRef.current.push(overlay)
    })
  }, [chargers, recommendedChargerId, warnChargerId, mapStatus, selectedCharger])

  const activeRouteResult = (routePathResult !== undefined || chargerRoutePathResult !== undefined)
    ? routePathResult
    : internalRouteResult
  const routeBadgeInfo = (() => {
    if (!activeRouteResult) return null
    if (activeRouteResult.isFallback) {
      return {
        icon: '⚠',
        text: '임시 직선 경로',
        sub: activeRouteResult.message === 'no_api_configured' ? '도로 경로 API 미연결' : null,
        bg: 'rgba(245,158,11,0.92)',
      }
    }
    const dur = activeRouteResult.durationMin != null ? ` · ${activeRouteResult.durationMin}분` : ''
    if (activeRouteResult.split?.enabled) {
      return {
        icon: '✓',
        text: `도로 기반 경로 · split${dur}`,
        sub: `Kakao Mobility Directions · ${activeRouteResult.split.segmentCount}개 구간`,
        bg: 'rgba(34,197,94,0.92)',
      }
    }
    return { icon: '✓', text: `도로 기반 경로${dur}`, sub: 'Kakao Mobility Directions', bg: 'rgba(34,197,94,0.92)' }
  })()

  const hasRouteScoredChargers = chargers.some(c => c.routeDeviationMeters != null)
  const chargerFilterBadgeText = hasRouteScoredChargers ? '경로 1km 이내 충전소' : null

  return (
    <div style={{
      flex: 1, minHeight: 0, position: 'relative',
      borderRadius: 12, overflow: 'hidden',
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
          <span style={{ fontSize: 13 }}>
            {mapError?.includes('missing') ? '카카오 API 키가 설정되지 않았습니다' : '지도를 불러올 수 없습니다'}
          </span>
          <span style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.6 }}>
            {mapError?.includes('missing')
              ? 'Kakao JavaScript API key is missing. — VITE_KAKAO_MAP_API_KEY를 Vercel 환경변수에 올바른 값으로 설정해 주세요'
              : mapError === 'sdk_load_failed'
              ? '카카오 Maps SDK 로드 실패 — 네트워크 연결 또는 Kakao 개발자 콘솔 도메인 설정을 확인해 주세요'
              : '카카오 개발자 콘솔의 도메인·API 키 설정을 확인해 주세요'}
          </span>
        </div>
      )}
      <div
        ref={mapContainerRef}
        id="mvp5-kakao-map"
        style={{ width: '100%', height: '100%', display: mapStatus === 'error' ? 'none' : 'block' }}
      />

      {/* Charger detail card */}
      <ChargerDetailCard
        charger={selectedCharger}
        recommendedChargerId={recommendedChargerId}
        warnChargerId={warnChargerId}
        onClose={() => setSelectedCharger(null)}
        T={T}
        themeName={themeName}
        hmi={hmi}
      />

      <RouteActionOverlay
        state={overlayState}
        data={overlayData}
        onOpenSocModal={onOpenSocModal}
        T={T}
        themeName={themeName}
        hmi={hmi}
      />

      {/* Legend + route source badge */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5,
      }}>
        {chargerFilterBadgeText && (
          <div style={{
            padding: '3px 9px',
            background: 'rgba(62,106,225,0.85)',
            borderRadius: 4,
            fontSize: 10, fontWeight: 600, color: '#fff',
            letterSpacing: '0.04em',
            backdropFilter: 'blur(4px)',
          }}>
            ⚡ {chargerFilterBadgeText}
          </div>
        )}
        {routeBadgeInfo && (
          <div style={{
            padding: routeBadgeInfo.sub ? '4px 9px' : '3px 9px',
            background: routeBadgeInfo.bg,
            borderRadius: 4,
            fontSize: 10, fontWeight: 600, color: '#fff',
            letterSpacing: '0.04em',
            backdropFilter: 'blur(4px)',
            lineHeight: 1.4,
          }}>
            <div>{routeBadgeInfo.icon} {routeBadgeInfo.text}</div>
            {routeBadgeInfo.sub && (
              <div style={{ fontSize: 9, opacity: 0.85, marginTop: 1 }}>{routeBadgeInfo.sub}</div>
            )}
          </div>
        )}
        <div style={{
          display: 'flex', gap: 10, padding: '5px 10px',
          background: themeName === 'dark' ? 'rgba(10,11,13,0.72)' : 'rgba(255,255,255,0.85)',
          borderRadius: 6, backdropFilter: 'blur(4px)',
          flexWrap: 'wrap', alignItems: 'center',
        }}>
          {[
            { color: '#F59E0B', label: '출발지' },
            { color: '#3E6AE1', label: '배송지' },
            { color: '#22C55E', label: '충전소' },
          ].map(({ color, label }) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: T.text }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
              {label}
            </span>
          ))}
          {chargerWaypoint && (
            <>
              <span style={{ width: 1, height: 12, background: 'rgba(128,128,128,0.4)', display: 'inline-block', flexShrink: 0 }} />
              {[
                { color: '#F59E0B', label: '충전 경유' },
                { color: '#3E6AE1', label: '배송 경로' },
              ].map(({ color, label }) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: T.text }}>
                  <span style={{ width: 14, height: 3, borderRadius: 1.5, background: color, display: 'inline-block', flexShrink: 0 }} />
                  {label}
                </span>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default MapPanel
