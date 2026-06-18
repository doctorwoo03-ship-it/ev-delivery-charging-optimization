// Shared debug logger — only active when VITE_MVP8_DEBUG=true in dev mode.
// Usage in .env.local: VITE_MVP8_DEBUG=true
const DEBUG = import.meta.env.DEV && import.meta.env.VITE_MVP8_DEBUG === 'true'

export const devLog  = (...args) => { if (DEBUG) console.log(...args) }
export const devWarn = (...args) => { if (DEBUG) console.warn(...args) }
