import React, { createContext, useContext, useState, useEffect } from 'react'

export type ThemeType =
  | 'vortex-red' | 'cyber-blue' | 'neon-gold' | 'matrix-green'
  | 'crt-retro' | 'neon-pulse' | 'holographic'

interface Theme {
  name: ThemeType
  label: string
  primary: string
  primaryGlow: string
  bg: string
  card: string
  visualFx: boolean
}

const THEMES: Record<ThemeType, Theme> = {
  'vortex-red': {
    name: 'vortex-red', label: 'Vortex Red', visualFx: false,
    primary: '#ef4444', primaryGlow: 'rgba(239,68,68,0.5)',
    bg: '#08090b', card: 'rgba(13,14,17,0.7)',
  },
  'cyber-blue': {
    name: 'cyber-blue', label: 'Cyber Blue', visualFx: false,
    primary: '#22d3ee', primaryGlow: 'rgba(34,211,238,0.5)',
    bg: '#080b0d', card: 'rgba(13,17,20,0.7)',
  },
  'neon-gold': {
    name: 'neon-gold', label: 'Neon Gold', visualFx: false,
    primary: '#f59e0b', primaryGlow: 'rgba(245,158,11,0.5)',
    bg: '#0b0a08', card: 'rgba(17,15,13,0.7)',
  },
  'matrix-green': {
    name: 'matrix-green', label: 'Matrix Green', visualFx: false,
    primary: '#10b981', primaryGlow: 'rgba(16,185,129,0.5)',
    bg: '#080d0a', card: 'rgba(13,20,15,0.7)',
  },
  'crt-retro': {
    name: 'crt-retro', label: 'CRT Retro', visualFx: true,
    primary: '#39ff14', primaryGlow: 'rgba(57,255,20,0.5)',
    bg: '#010301', card: 'rgba(2,12,4,0.95)',
  },
  'neon-pulse': {
    name: 'neon-pulse', label: 'Neon Pulse', visualFx: true,
    primary: '#e040fb', primaryGlow: 'rgba(224,64,251,0.5)',
    bg: '#06040e', card: 'rgba(12,8,20,0.95)',
  },
  'holographic': {
    name: 'holographic', label: 'Holographic', visualFx: true,
    primary: '#00d4ff', primaryGlow: 'rgba(0,212,255,0.5)',
    bg: '#040810', card: 'rgba(6,12,22,0.95)',
  },
}

interface ThemeContextType {
  theme: Theme
  setTheme: (name: ThemeType) => void
  playSound: (type: 'click' | 'hover' | 'success' | 'error' | 'done') => void
  soundEnabled: boolean
  setSoundEnabled: (v: boolean) => void
  animationsEnabled: boolean
  setAnimationsEnabled: (v: boolean) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<ThemeType>(
    () => (localStorage.getItem('vortex-theme') as ThemeType) ?? 'vortex-red'
  )
  const [soundEnabled, setSoundEnabledState] = useState(
    () => localStorage.getItem('vortex-sound') !== 'false'
  )
  const [animationsEnabled, setAnimationsEnabledState] = useState(
    () => localStorage.getItem('vortex-animations') !== 'false'
  )

  const setSoundEnabled = (v: boolean) => { setSoundEnabledState(v); localStorage.setItem('vortex-sound', String(v)) }
  const setAnimationsEnabled = (v: boolean) => { setAnimationsEnabledState(v); localStorage.setItem('vortex-animations', String(v)) }

  const setTheme = (name: ThemeType) => {
    setCurrentTheme(name)
    localStorage.setItem('vortex-theme', name)
  }

  useEffect(() => {
    const root = document.documentElement
    const theme = THEMES[currentTheme]

    root.setAttribute('data-theme', currentTheme)
    root.style.setProperty('--crimson', theme.primary)
    root.style.setProperty('--crimson-glow', theme.primaryGlow)
    root.style.setProperty('--ink-900', theme.bg)
    root.style.setProperty('--card-bg', theme.card)

    const [r, g, b] = hexToRgb(theme.primary)
    const c = (a: number) => `rgba(${r},${g},${b},${a})`
    root.style.setProperty('--crimson-05', c(0.05))
    root.style.setProperty('--crimson-06', c(0.06))
    root.style.setProperty('--crimson-07', c(0.07))
    root.style.setProperty('--crimson-08', c(0.08))
    root.style.setProperty('--crimson-10', c(0.10))
    root.style.setProperty('--crimson-12', c(0.12))
    root.style.setProperty('--crimson-15', c(0.15))
    root.style.setProperty('--crimson-20', c(0.20))
    root.style.setProperty('--crimson-25', c(0.25))
    root.style.setProperty('--crimson-30', c(0.30))
    root.style.setProperty('--crimson-40', c(0.40))
    root.style.setProperty('--crimson-60', c(0.60))
  }, [currentTheme])

  const playSound = (type: 'click' | 'hover' | 'success' | 'error' | 'done') => {
    if (!soundEnabled) return
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    const now = ctx.currentTime
    switch (type) {
      case 'click':
        osc.frequency.setValueAtTime(800, now)
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1)
        gain.gain.setValueAtTime(0.1, now)
        gain.gain.linearRampToValueAtTime(0, now + 0.1)
        osc.start(now); osc.stop(now + 0.1)
        break
      case 'hover':
        osc.frequency.setValueAtTime(400, now)
        gain.gain.setValueAtTime(0.02, now)
        gain.gain.linearRampToValueAtTime(0, now + 0.05)
        osc.start(now); osc.stop(now + 0.05)
        break
      case 'success':
        osc.frequency.setValueAtTime(600, now)
        osc.frequency.setValueAtTime(800, now + 0.1)
        gain.gain.setValueAtTime(0.1, now)
        gain.gain.linearRampToValueAtTime(0, now + 0.2)
        osc.start(now); osc.stop(now + 0.2)
        break
      case 'done':
        osc.frequency.setValueAtTime(1000, now)
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1)
        gain.gain.setValueAtTime(0.05, now)
        gain.gain.linearRampToValueAtTime(0, now + 0.3)
        osc.start(now); osc.stop(now + 0.3)
        break
      case 'error':
        osc.frequency.setValueAtTime(440, now)
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.2)
        gain.gain.setValueAtTime(0.12, now)
        gain.gain.linearRampToValueAtTime(0, now + 0.2)
        osc.start(now); osc.stop(now + 0.2)
        break
    }
  }

  return (
    <ThemeContext.Provider value={{
      theme: THEMES[currentTheme], setTheme, playSound,
      soundEnabled, setSoundEnabled,
      animationsEnabled, setAnimationsEnabled,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
