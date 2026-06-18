// Kakao Maps SDK loader — shared singleton promises
//
// Exports:
//   loadKakaoMaps()     — resolves when window.kakao.maps APIs are ready (map rendering)
//   loadKakaoServices() — resolves when window.kakao.maps.services is ready (search)
//
// Key env vars (both supported):
//   VITE_KAKAO_MAP_API_KEY  (primary)
//   VITE_KAKAO_MAP_KEY      (legacy fallback)
//
// Error codes: 'no_api_key' | 'sdk_load_failed' | 'services_unavailable'

let _mapsPromise = null
let _servicesPromise = null

export function loadKakaoMaps() {
  if (_mapsPromise) return _mapsPromise
  _mapsPromise = _loadBase().catch(err => {
    _mapsPromise = null
    return Promise.reject(err)
  })
  return _mapsPromise
}

export function loadKakaoServices() {
  if (_servicesPromise) return _servicesPromise
  _servicesPromise = loadKakaoMaps()
    .then(() => _ensureServices())
    .catch(err => {
      _servicesPromise = null
      return Promise.reject(err)
    })
  return _servicesPromise
}

function _key() {
  return import.meta.env.VITE_KAKAO_MAP_API_KEY || import.meta.env.VITE_KAKAO_MAP_KEY || ''
}

function _loadBase() {
  return new Promise((resolve, reject) => {
    const key = _key()
    if (!key) { reject(new Error('no_api_key')); return }

    // Case 1: maps object already exists — call load() to ensure APIs are initialized
    // (load() is idempotent: calls callback immediately if already done)
    if (window.kakao?.maps) {
      window.kakao.maps.load(() => resolve())
      return
    }

    // Case 2: A Kakao script tag exists (from an older MVP page) but kakao not yet set
    const existing = document.querySelector('script[src*="dapi.kakao.com"]')
    if (existing) {
      if (window.kakao) {
        // Script ran but maps not available — call load()
        if (window.kakao.maps) {
          window.kakao.maps.load(() => resolve())
        } else {
          reject(new Error('sdk_load_failed'))
        }
      } else {
        existing.addEventListener('load', () => {
          if (window.kakao?.maps) {
            window.kakao.maps.load(() => resolve())
          } else {
            reject(new Error('sdk_load_failed'))
          }
        }, { once: true })
        existing.addEventListener('error', () => reject(new Error('sdk_load_failed')), { once: true })
      }
      return
    }

    // Case 3: No script yet — inject fresh with libraries=services so services is ready later
    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=services`
    script.async = true
    script.onload = () => {
      if (!window.kakao?.maps) { reject(new Error('sdk_load_failed')); return }
      window.kakao.maps.load(() => resolve())
    }
    script.onerror = () => reject(new Error('sdk_load_failed'))
    document.head.appendChild(script)
  })
}

function _ensureServices() {
  if (window.kakao?.maps?.services) return Promise.resolve()

  const key = _key()
  if (!key) return Promise.reject(new Error('no_api_key'))

  // If the maps object is already initialised but services is absent, the SDK was booted
  // without libraries=services. The Kakao Maps SDK does not support adding libraries to an
  // already-running instance via a second script tag — maps.load() becomes a no-op after the
  // first initialisation, so the callback either fires synchronously with services still
  // undefined, or never fires at all (causing an indefinite hang in the caller).
  // Reject immediately so the search UI shows an error without delay.
  if (window.kakao?.maps) return Promise.reject(new Error('services_unavailable'))

  // SDK not yet initialised — inject with libraries=services and wait.
  // The 5-second timeout is a safety net for unexpected network or SDK delays.
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('services_unavailable')), 5000)
    const settle = (err) => { clearTimeout(timer); err ? reject(err) : resolve() }

    const addon = document.createElement('script')
    addon.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=services`
    addon.async = true
    addon.onload = () => {
      window.kakao.maps.load(() => {
        if (window.kakao?.maps?.services) settle()
        else settle(new Error('services_unavailable'))
      })
    }
    addon.onerror = () => settle(new Error('sdk_load_failed'))
    document.head.appendChild(addon)
  })
}
