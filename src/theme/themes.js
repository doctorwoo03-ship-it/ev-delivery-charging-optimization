export const THEMES = {
  dark: {
    bg: '#0A0B0D',
    surface: '#111317',
    surfaceSecondary: '#1A1D22',
    text: '#FFFFFF',
    textSecondary: '#A3A3A3',
    border: '#2A2D33',
    accent: '#3E6AE1',
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
  },
  light: {
    bg: '#FFFFFF',
    surface: '#F8F8F8',
    surfaceSecondary: '#F2F2F2',
    text: '#171A20',
    textSecondary: '#5C5E62',
    border: '#E5E5E5',
    accent: '#3E6AE1',
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
  },
}

export function getInitialTheme() {
  try {
    const saved = localStorage.getItem('ev-theme')
    if (saved === 'dark' || saved === 'light') return saved
  } catch {}
  try {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  } catch {}
  return 'dark'
}

export const FONT = '"Pretendard Variable", Pretendard, Inter, system-ui, -apple-system, sans-serif'
