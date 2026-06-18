// Driver Session State
// Persists the active driving session so MVP-6 can restore its cockpit view
// after the user navigates to MVP-7 and returns.
//
// Strategy: in-memory module singleton + sessionStorage backup.
// sessionStorage survives navigate() but not a hard page reload.
//
// Lifecycle:
//   MVP-6 saves  → just before navigate('/mvp-7')
//   MVP-6 loads  → lazy useState initializers on mount
//   MVP-6 clears → handleReset (user explicitly starts a new session)

const SESSION_KEY = 'ev-driver-session'
const MIN_RESERVE_SOC_KEY = 'ev-user-min-reserve-soc'
let _cache = null

/**
 * @param {{ selectedBrand, selectedId, custom, soc, startPoint, deliveries, routePathResult, userMinReserveSoc }} session
 */
export function saveDriverSession(session) {
  _cache = { ...session, savedAt: new Date().toISOString() }
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(_cache)) } catch {}
  if (session.userMinReserveSoc != null) {
    try { localStorage.setItem(MIN_RESERVE_SOC_KEY, String(session.userMinReserveSoc)) } catch {}
  }
}

/** Persists userMinReserveSoc driver preference to localStorage (survives tab close). */
export function saveUserMinReserveSoc(value) {
  try { localStorage.setItem(MIN_RESERVE_SOC_KEY, String(value)) } catch {}
}

/** Loads userMinReserveSoc from localStorage. Falls back to 10 if missing or invalid (5–30 range). */
export function loadUserMinReserveSoc() {
  try {
    const raw = localStorage.getItem(MIN_RESERVE_SOC_KEY)
    if (raw != null) {
      const v = parseInt(raw, 10)
      if (!isNaN(v) && v >= 5 && v <= 30) return v
    }
  } catch {}
  return 10
}

/** Returns the saved session, or null if none exists. */
export function loadDriverSession() {
  if (_cache) return _cache
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) { _cache = JSON.parse(raw); return _cache }
  } catch {}
  return null
}

export function clearDriverSession() {
  _cache = null
  try { sessionStorage.removeItem(SESSION_KEY) } catch {}
}
