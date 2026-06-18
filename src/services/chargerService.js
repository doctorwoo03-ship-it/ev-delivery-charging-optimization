// Charger data service layer.
// fetchPublicChargers() — used exclusively by MVP-8 — requires VITE_CHARGER_API_BASE_URL.
// If the env var is absent or the API fails it returns an error state (chargers: []).
// It never falls back to sample data.
// getChargers() and fetchNearbyChargers() are used by demo pages and may return sample data.
//
// ── Future real-API integration candidates ─────────────────────────────────
//
// 1. 환경부 전기차충전소 개방 API (공공데이터포털 / data.go.kr)
//    - Endpoint: https://api.odcloud.kr/api/15067985/v1/...
//    - Provides: location, operator, charger type, real-time status
//    - Key field: stat (2=available, 3=occupied, 9=maintenance)
//    - Auth: serviceKey (server-side only — never expose in frontend)
//
// 2. 한국전력공사(KEPCO) 충전 인프라
//    - Separate API contract required via KEPCO EV Infra portal
//    - Provides KEPCO-operated charger real-time status
//
// 3. 민간 CPO APIs
//    - SK일렉링크, ChargeEV, 에버온, 대영채비 등은 각 사 계약 필요
//    - 표준 OCPP 2.0.1 또는 독자 REST API
//
// 4. 실시간 상태 갱신
//    - WebSocket (OCPP 기반) 또는 polling (30초 간격 권장)
//
// 5. 충전 요금
//    - 운영사별 요금이 달라 단일 API에서 제공하지 않는 경우 많음
//    - 별도 운영사별 요금 테이블 관리 또는 EV Infra 요금 API 연동 필요
//
// ── Required env var (no API key in frontend) ─────────────────────────────
//   VITE_CHARGER_API_BASE_URL = https://your-backend-proxy.com
// ──────────────────────────────────────────────────────────────────────────

import { CHARGERS } from '../data/chargerData'
import { devWarn } from '../utils/devLog'

export { CHARGERS }

const API_BASE = (import.meta.env.VITE_CHARGER_API_BASE_URL ?? '').replace(/\/$/, '')

// Fetch nearby chargers from the backend proxy.
// Falls back to sample data if the API is not configured or returns an error.
export async function fetchNearbyChargers({ lat, lng, radiusKm = 10 } = {}) {
  if (API_BASE) {
    try {
      const params = new URLSearchParams({ lat, lng, radius: radiusKm })
      const res = await fetch(`${API_BASE}/api/chargers?${params}`)
      if (!res.ok) throw new Error(`api_${res.status}`)
      const data = await res.json()
      const chargers = (Array.isArray(data) ? data : (data.chargers ?? [])).map(normalizeCharger)
      if (!chargers.length) throw new Error('empty_response')
      return { chargers, isSample: false, source: 'api' }
    } catch (err) {
      devWarn('[chargerService] API unavailable, using sample data:', err.message)
    }
  }
  return { chargers: CHARGERS, isSample: true, source: 'sample-data' }
}

// Returns a charger list synchronously for the given provider.
// provider='mock'       → returns sample data immediately (default)
// provider='public-api' → async-only; logs a warning and falls back to mock.
//                         Use fetchPublicChargers() for actual API access.
// provider='env-api'    → same as public-api placeholder; configure VITE_CHARGER_API_BASE_URL
//                         then call fetchPublicChargers() from a useEffect.
export function getChargers({ startPoint: _sp, routeBounds: _rb, provider = 'mock' } = {}) {
  if (provider === 'mock') return { chargers: CHARGERS, isSample: true, source: 'mock' }
  devWarn('[chargerService] getChargers: provider "' + provider + '" requires async fetch. Falling back to mock data. Call fetchPublicChargers() for real API access.')
  return { chargers: CHARGERS, isSample: true, source: 'mock-fallback' }
}

// Async public charger fetch with automatic mock fallback.
// Requires VITE_CHARGER_API_BASE_URL pointing to a backend proxy that holds the API key.
// When the env var is absent or the fetch fails, returns mock chargers with a console.warn.
export async function fetchPublicChargers({ lat, lng, radiusKm = 10 } = {}) {
  if (!API_BASE) {
    devWarn('[chargerService] fetchPublicChargers: VITE_CHARGER_API_BASE_URL not configured.')
    return { chargers: [], isSample: false, source: 'api-error', error: true, reason: 'no_base_url' }
  }
  try {
    const params = new URLSearchParams({ lat, lng, radius_km: radiusKm })
    const res = await fetch(`${API_BASE}/api/chargers?${params}`)
    if (!res.ok) throw new Error(`api_${res.status}`)
    const data = await res.json()
    if (data.error) {
      devWarn('[chargerService] fetchPublicChargers: backend error:', data.reason)
      return { chargers: [], isSample: false, source: 'api-error', error: true, reason: data.reason }
    }
    const chargers = (Array.isArray(data) ? data : (data.chargers ?? [])).map(normalizeCharger)
    if (!chargers.length) {
      devWarn('[chargerService] fetchPublicChargers: no chargers near location')
      return { chargers: [], isSample: false, source: 'api-empty', error: false, reason: 'empty_response' }
    }
    // Pass through backend source/endpoint so callers can label the data origin correctly.
    // source: "safemap-api" | "korea-environment" | "public-api" (legacy)
    return { chargers, isSample: false, source: data.source ?? 'public-api', endpoint: data.endpoint ?? null, dataKind: data.dataKind ?? null }
  } catch (err) {
    devWarn('[chargerService] fetchPublicChargers failed:', err.message)
    return { chargers: [], isSample: false, source: 'api-error', error: true, reason: err.message }
  }
}

// Maps a raw API response object to the internal charger schema.
// Field names cover common patterns from Korean public APIs and OCPP systems.
// Extend this mapping as real API shapes become known.
export function normalizeCharger(raw) {
  // Preserve null for availableSlots so SafeMap location-only chargers
  // don't incorrectly appear as "0 slots available" in the popup.
  const availableSlots =
    raw.availableSlots != null ? parseInt(raw.availableSlots, 10)
    : raw.availCnt     != null ? parseInt(raw.availCnt, 10)
    : null

  return {
    id:             raw.id ?? raw.charger_id ?? raw.chgerId ?? String(Math.random()),
    name:           raw.name ?? raw.chargerNm ?? raw.chgerNm ?? '충전소',
    address:        raw.address ?? raw.addr ?? raw.addressNm ?? '',
    lat:            parseFloat(raw.lat ?? raw.latitude ?? raw.ycoord ?? 0),
    lng:            parseFloat(raw.lng ?? raw.longitude ?? raw.xcoord ?? 0),
    operator:       raw.operator ?? raw.busiNm ?? '',
    operatorId:     raw.operatorId ?? raw.busiId ?? '',
    chargerType:    normalizeChargerType(raw.chargerType ?? raw.chgerType),
    powerKw:        parseInt(raw.powerKw ?? raw.output ?? 50, 10),
    pricePerKwh:    parseFloat(raw.pricePerKwh ?? raw.price ?? 300),
    waitMin:        parseInt(raw.waitMin ?? 0, 10),
    availableSlots,
    totalSlots:     parseInt(raw.totalSlots ?? raw.totalCnt ?? 1, 10),
    status:         normalizeStatus(raw.status ?? raw.stat),
    lastUpdated:    raw.lastUpdated ?? raw.lastTsdt ?? null,
    useTime:        raw.useTime ?? null,
    connectorCount: raw.connectorCount != null ? parseInt(raw.connectorCount, 10) : null,
    dataKind:       raw.dataKind ?? null,
    source:         raw.source ?? 'api',
  }
}

// Maps both Korean public API codes and English strings to the internal type enum.
function normalizeChargerType(raw) {
  if (!raw) return 'DC_COMBO'
  const t = String(raw).toUpperCase()
  if (t === '01' || t === 'DC_CHADEMO') return 'DC_CHADEMO'
  if (t === '02' || t === 'AC_SLOW' || t === 'AC_3') return 'AC_SLOW'
  if (t === '03' || t === 'DC_CHADEMO_AC_3') return 'DC_CHADEMO'
  if (t === '04' || t === 'DC_COMBO' || t === 'CCS') return 'DC_COMBO'
  if (t === '05' || t === 'DC_COMBO_AC_3') return 'DC_COMBO'
  if (t === '06' || t === 'DC_CHADEMO_DC_COMBO_AC_3') return 'DC_COMBO'
  if (t === '07' || t === 'AC_3_PHASE') return 'AC_3'
  return 'DC_COMBO'
}

// Maps both Korean public API status codes and English strings.
function normalizeStatus(raw) {
  if (raw == null) return 'unknown'
  const s = String(raw).toLowerCase()
  if (s === '2' || s === 'available' || s === 'idle' || s === 'ready') return 'available'
  if (s === '3' || s === 'occupied' || s === 'charging' || s === 'in_use') return 'occupied'
  if (s === '9' || s === 'maintenance' || s === 'fault' || s === 'error' || s === 'out_of_order') return 'maintenance'
  return 'unknown'
}
