// MVP-8 Driver Session Store
// Persists the active MVP-8 driver setup and cockpit state across page refreshes.
// Uses sessionStorage key separate from MVP-6's 'ev-driver-session' to avoid collisions.
//
// Lifecycle:
//   auto-saved → whenever core state changes (useEffect in MVP8Page)
//   loaded     → lazy useState initializers on mount
//   cleared    → handleReset (user explicitly resets)

const SESSION_KEY = 'ev-mvp8-driver-session'
let _cache = null

/**
 * @param {{ view, step, selectedBrand, selectedId, custom, soc, userMinReserveSoc, startPoint, deliveries }} session
 */
export function saveMvp8Session(session) {
  _cache = { ...session, savedAt: new Date().toISOString() }
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(_cache)) } catch {}
}

/** Returns the saved MVP-8 session, or null if none exists. */
export function loadMvp8Session() {
  if (_cache) return _cache
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) { _cache = JSON.parse(raw); return _cache }
  } catch {}
  return null
}

export function clearMvp8Session() {
  _cache = null
  try { sessionStorage.removeItem(SESSION_KEY) } catch {}
}
