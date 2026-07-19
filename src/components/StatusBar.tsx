import { useState, useEffect } from 'react'
import { Cpu, MemoryStick, Bot, Shield, Zap, MessageSquare, Hash } from 'lucide-react'

interface StatusBarProps {
  stats: {
    cpu?: {
      load: number
    }
    memory?: {
      used: number
      total: number
    }
  } | null
}

function statColor(pct: number) {
  if (pct > 85) return 'var(--crimson)'
  if (pct > 60) return '#f59e0b'
  return 'var(--signal)'
}

function Pill({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <Icon size={9} style={{ color, flexShrink: 0 }} />
      <span style={{ color: '#3f3f46' }}>{label}</span>
      <span style={{ color, fontWeight: 'bold' }}>{value}</span>
    </div>
  )
}

function Sep() {
  return <div style={{ width: '1px', height: '10px', background: 'rgba(255,255,255,0.06)' }} />
}

const PROFILES = ['performance', 'balanced', 'power-saver'] as const
const PROFILE_COLOR: Record<string, string> = {
  performance: 'var(--crimson)',
  balanced:    '#f59e0b',
  'power-saver': 'var(--signal)',
}

export default function StatusBar({ stats }: StatusBarProps) {
  const cpuPct = stats?.cpu?.load ?? null
  const ramPct = stats?.memory ? (stats.memory.used / stats.memory.total) * 100 : null
  const [model, setModel] = useState(() => (localStorage.getItem('vortex-default-model') ?? '').split(':')[0] || 'no model')
  const [sessionName, setSessionName] = useState('New Chat')
  const [powerProfile, setPowerProfile] = useState<string | null>(null)
  const [tokenUsage, setTokenUsage] = useState<{ promptTokens: number; completionTokens: number } | null>(null)

  useEffect(() => {
    const handleSessionChange = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setSessionName(detail?.name || 'New Chat')
    }
    const handleModelChange = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setModel(String(detail || '').split(':')[0] || 'no model')
    }
    const handleTokenUsage = (e: Event) => {
      const detail = (e as CustomEvent).detail as { promptTokens: number; completionTokens: number } | null
      setTokenUsage(detail)
    }
    window.addEventListener('vortex-session-change', handleSessionChange)
    window.addEventListener('vortex-model-change', handleModelChange)
    window.addEventListener('vortex-token-usage', handleTokenUsage)
    return () => {
      window.removeEventListener('vortex-session-change', handleSessionChange)
      window.removeEventListener('vortex-model-change', handleModelChange)
      window.removeEventListener('vortex-token-usage', handleTokenUsage)
    }
  }, [])

  useEffect(() => {
    const el = window.electron
    if (!el?.powerGetProfile) return
    el.powerGetProfile().then((r) => { if (r.profile) setPowerProfile(r.profile) })
  }, [])

  const cycleProfile = async () => {
    if (!powerProfile) return
    const idx = PROFILES.indexOf(powerProfile as typeof PROFILES[number])
    const next = PROFILES[(idx + 1) % PROFILES.length]
    const r = await window.electron?.powerSetProfile(next)
    if (r?.success) setPowerProfile(next)
  }

  return (
    <div style={{
      height: '26px',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: '14px',
      background: 'rgba(4,7,15,0.95)',
      borderTop: '1px solid rgba(255,255,255,0.04)',
      fontSize: '9px',
      fontFamily: 'monospace',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      flexShrink: 0,
      userSelect: 'none',
    }}>
      <Pill
        icon={Cpu}
        label="CPU"
        value={cpuPct !== null ? `${cpuPct.toFixed(1)}%` : '--.-%'}
        color={cpuPct !== null ? statColor(cpuPct) : '#3f3f46'}
      />
      <Sep />
      <Pill
        icon={MemoryStick}
        label="RAM"
        value={ramPct !== null ? `${ramPct.toFixed(1)}%` : '--.-%'}
        color={ramPct !== null ? statColor(ramPct) : '#3f3f46'}
      />
      <Sep />
      <Pill icon={Bot} label="Model" value={model} color="#52525b" />
      {tokenUsage && (
        <>
          <Sep />
          <Pill icon={Hash} label="Ctx" value={`${(tokenUsage.promptTokens / 1000).toFixed(1)}k`} color="#52525b" />
        </>
      )}
      <Sep />
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <MessageSquare size={9} style={{ color: '#52525b', flexShrink: 0 }} />
        <span style={{ color: '#3f3f46' }}>Session</span>
        <span style={{ color: '#52525b', fontWeight: 'bold' }}>{sessionName}</span>
      </div>

      {powerProfile && (
        <>
          <Sep />
          <button
            onClick={cycleProfile}
            title="Click to cycle power profile"
            style={{
              display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none',
              cursor: 'pointer', padding: 0, fontFamily: 'monospace', fontSize: '9px',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}
          >
            <Zap size={9} style={{ color: PROFILE_COLOR[powerProfile] ?? '#52525b' }} />
            <span style={{ color: PROFILE_COLOR[powerProfile] ?? '#52525b' }}>{powerProfile}</span>
          </button>
        </>
      )}

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#27272a' }}>
        <Shield size={8} />
        <span>Vortex V2</span>
      </div>
    </div>
  )
}
