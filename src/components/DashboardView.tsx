import { useState, useEffect, useCallback } from 'react'
import { motion, Reorder } from 'framer-motion'
import { Cpu, MemoryStick, HardDrive, Network, Settings2, Eye, EyeOff, Terminal, CheckCircle2, XCircle, Activity, Zap, Sparkles, Rocket, Shield, RotateCcw, GripVertical } from 'lucide-react'
import { notify } from '../lib/notifications'

import type { SystemStats } from '../types/electron.d.ts'

interface DashboardViewProps {
  stats?: SystemStats | null
  onNavigate?: (tab: string) => void
}

const WIDGET_DEFS = [
  { id: 'cpu',      label: 'CPU Load' },
  { id: 'ram',      label: 'RAM Usage' },
  { id: 'gpu',      label: 'GPU' },
  { id: 'disk',     label: 'Storage' },
  { id: 'net',      label: 'Network' },
  { id: 'game',     label: 'Game Mode' },
  { id: 'guardian', label: 'Auto-Pilot' },
  { id: 'power',    label: 'Power Mode' },
  { id: 'chart',    label: 'Live Chart' },
  { id: 'activity', label: 'Recent Activity' },
]

const DEFAULT_VISIBLE = ['cpu', 'ram', 'gpu', 'disk', 'net', 'game', 'guardian', 'power', 'chart', 'activity']

const SECTION_DEFS = [
  { id: 'metrics',  label: 'Resource Metrics' },
  { id: 'control',  label: 'System Control' },
  { id: 'silicon',  label: 'Silicon Detail' },
  { id: 'activity', label: 'Audit Trail' },
]
const DEFAULT_SECTION_ORDER = SECTION_DEFS.map(s => s.id)

function fmtBytes(b: number) {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`
  if (b >= 1e6) return `${(b / 1e6).toFixed(0)} MB`
  return `${(b / 1e3).toFixed(0)} KB`
}

function progressColor(pct: number) {
  if (pct > 85) return 'var(--crimson)'
  if (pct > 60) return '#f59e0b'
  return 'var(--signal)'
}

export default function DashboardView({ stats }: DashboardViewProps) {
  const [visible, setVisible] = useState<string[]>(
    () => JSON.parse(localStorage.getItem('vortex-widgets') ?? 'null') ?? DEFAULT_VISIBLE
  )
  const [sectionOrder, setSectionOrder] = useState<string[]>(
    () => JSON.parse(localStorage.getItem('vortex-section-order') ?? 'null') ?? DEFAULT_SECTION_ORDER
  )
  const [customize, setCustomize] = useState(false)
  const [cpuHist, setCpuHist]     = useState<number[]>([])
  const [ramHist, setRamHist]     = useState<number[]>([])
  const [gpuHist, setGpuHist]     = useState<number[]>([])

interface AuditLogEntry {
  id: number
  command: string
  exit_code: number | null
  source: string
  session_id: number | null
  created_at: number
}

  const [auditLog, setAuditLog]   = useState<AuditLogEntry[]>([])
  const [powerProfile, setPowerProfile] = useState<string | null>(null)
  const [gameMode, setGameMode] = useState(() => localStorage.getItem('vortex-game-mode') === 'true')
  const [gameModeBusy, setGameModeBusy] = useState(false)
  const [guardianEnabled, setGuardianEnabled] = useState(false)
  const [guardianActiveOpt, setGuardianActiveOpt] = useState('Balanced')

  const handleGuardianToggle = async () => {
    const next = !guardianEnabled
    const res = await window.electron.guardianToggle(next)
    if (res.success) {
      setGuardianEnabled(next)
      notify('Guardian', next ? 'Auto-Pilot Engaged: Monitoring system state' : 'Auto-Pilot Disengaged', next ? 'success' : 'info')
    }
  }

  const handleGameModeToggle = async () => {
    const nextState = !gameMode
    setGameModeBusy(true)
    const res = await window.electron.gameModeToggle(nextState)
    setGameModeBusy(false)
    if (res.success) {
      setGameMode(nextState)
      localStorage.setItem('vortex-game-mode', String(nextState))
      notify('Game Mode', nextState ? 'System optimized for Zero-Latency Gaming' : 'System restored to Balanced', nextState ? 'success' : 'info')
    } else {
      notify('Game Mode', res.log, 'error')
    }
  }

  useEffect(() => {
    if (!stats) return
    const cpu = stats.cpu?.load ?? 0
    const ram = stats.memory ? (stats.memory.used / stats.memory.total) * 100 : 0
    const gpu = stats.gpu?.utilizationGpu ?? 0
    setTimeout(() => {
      setCpuHist(prev => [...prev, cpu].slice(-40))
      setRamHist(prev => [...prev, ram].slice(-40))
      setGpuHist(prev => [...prev, gpu].slice(-40))
    }, 0)
  }, [stats])

  useEffect(() => {
    const el = window.electron
    if (!el?.dbGetAuditLog) return
    el.dbGetAuditLog(8).then((rows) => setAuditLog(rows))
    
    if (el?.powerGetProfile) {
      el.powerGetProfile().then((res) => setPowerProfile(res.profile))
    }

    if (el?.guardianStatus) {
      el.guardianStatus().then((res) => {
        setGuardianEnabled(res.enabled)
        setGuardianActiveOpt(res.activeOptimization)
      })
    }
  }, [])

  const handleSetPowerProfile = async (p: string) => {
    const el = window.electron
    if (el?.powerSetProfile) {
      const res = await el.powerSetProfile(p)
      if (res.success) setPowerProfile(p)
    }
  }

  const toggleWidget = useCallback((id: string) => {
    setVisible(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      localStorage.setItem('vortex-widgets', JSON.stringify(next))
      return next
    })
  }, [])

  const show = (id: string) => visible.includes(id)

  const cpuPct  = stats?.cpu?.load ?? 0
  const ramPct  = stats?.memory ? (stats.memory.used / stats.memory.total) * 100 : 0
  const diskPct = stats?.storage?.use ?? 0
  const netMb   = ((stats?.network?.rx_sec ?? 0) / 1_000_000).toFixed(2)
  const gpuPct  = stats?.gpu?.utilizationGpu ?? 0
  const gpuVramPct = stats?.gpu?.memoryTotal ? (stats.gpu.memoryUsed / stats.gpu.memoryTotal) * 100 : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>

      {/* Header with Customize Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '4px', height: '16px', background: 'var(--crimson)', borderRadius: '2px' }} />
          <h2 style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'white', margin: 0 }}>System Overview</h2>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => {
              localStorage.removeItem('vortex-widgets')
              localStorage.removeItem('vortex-section-order')
              setVisible(DEFAULT_VISIBLE)
              setSectionOrder(DEFAULT_SECTION_ORDER)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#52525b', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            <RotateCcw size={11} />
            Reset Defaults
          </button>
          <button
            onClick={() => setCustomize(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '8px', background: customize ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${customize ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`, color: customize ? 'var(--crimson)' : '#52525b', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            <Settings2 size={11} />
            Layout Config
          </button>
        </div>
      </div>

      {/* Widget toggle + section reorder panel */}
      {customize && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="v-card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(239,68,68,0.02)', border: '1px solid rgba(239,68,68,0.08)' }}>

          {/* Widget visibility */}
          <div>
            <div style={{ fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#3f3f46', marginBottom: '8px' }}>Widget Visibility</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {WIDGET_DEFS.map(w => (
                <button key={w.id} onClick={() => toggleWidget(w.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '8px', border: `1px solid ${visible.includes(w.id) ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.06)'}`, background: visible.includes(w.id) ? 'rgba(34,211,238,0.06)' : 'rgba(255,255,255,0.02)', color: visible.includes(w.id) ? 'var(--signal)' : '#52525b', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer' }}>
                  {visible.includes(w.id) ? <Eye size={10} /> : <EyeOff size={10} />}
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {/* Section order */}
          <div>
            <div style={{ fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#3f3f46', marginBottom: '8px' }}>Section Order <span style={{ color: '#27272a' }}>— drag to reorder</span></div>
            <Reorder.Group
              axis="y"
              values={sectionOrder}
              onReorder={(next) => {
                setSectionOrder(next)
                localStorage.setItem('vortex-section-order', JSON.stringify(next))
              }}
              style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}
            >
              {sectionOrder.map(id => {
                const def = SECTION_DEFS.find(s => s.id === id)!
                return (
                  <Reorder.Item
                    key={id}
                    value={id}
                    style={{ listStyle: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'grab', userSelect: 'none' }}>
                      <GripVertical size={11} style={{ color: '#3f3f46', flexShrink: 0 }} />
                      <span style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', color: '#71717a' }}>{def.label}</span>
                    </div>
                  </Reorder.Item>
                )
              })}
            </Reorder.Group>
          </div>
        </motion.div>
      )}

      {sectionOrder.map(sectionId => {
        if (sectionId === 'metrics') return (
          <section key="metrics" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#3f3f46', textTransform: 'uppercase', letterSpacing: '0.2em', marginLeft: '4px' }}>// Resource_Metrics</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
              {show('cpu') && <StatCard icon={Cpu} label="CPU Load" value={`${cpuPct.toFixed(1)}%`} sub={stats?.cpu?.brand ?? '—'} pct={cpuPct} />}
              {show('ram') && <StatCard icon={MemoryStick} label="RAM" value={`${ramPct.toFixed(1)}%`} sub={stats?.memory ? `${fmtBytes(stats.memory.used)} / ${fmtBytes(stats.memory.total)}` : '—'} pct={ramPct} color="var(--signal)" />}
              {show('gpu') && stats?.gpu && <StatCard icon={Zap} label="GPU" value={`${gpuPct.toFixed(0)}%`} sub={stats.gpu.model} pct={gpuPct} color="#a855f7" />}
              {show('disk') && <StatCard icon={HardDrive} label="Storage" value={`${diskPct.toFixed(0)}%`} sub={stats?.storage ? `${fmtBytes(stats.storage.used)} / ${fmtBytes(stats.storage.size)}` : '—'} pct={diskPct} color="#f59e0b" />}
              {show('net') && <StatCard icon={Network} label="Network RX" value={`${netMb} MB/s`} sub={stats?.network?.iface ?? '—'} pct={Math.min((parseFloat(netMb) / 100) * 100, 100)} color="#10b981" />}
            </div>
            {show('chart') && (
              <div className="v-card" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                  <h3 style={{ margin: 0, fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#71717a', fontWeight: 'bold' }}>Silicon Telemetry</h3>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    {([['CPU', 'var(--crimson)', cpuPct], ['RAM', 'var(--signal)', ramPct], ...(stats?.gpu ? [['GPU', '#a855f7', gpuPct]] : [])] as [string, string, number][]).map(([label, color, val]) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: color }} />
                        <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#52525b', textTransform: 'uppercase' }}>{label}</span>
                        <span style={{ fontSize: '9px', fontFamily: 'monospace', color: color, fontWeight: 'bold' }}>{val.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ position: 'relative', height: '80px', display: 'flex', alignItems: 'flex-end' }}>
                  {[25, 50, 75, 100].map(v => (
                    <div key={v} style={{ position: 'absolute', left: 0, right: 0, bottom: `${v}%`, borderTop: '1px solid rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: '7px', fontFamily: 'monospace', color: '#2a2a2a', paddingRight: '4px' }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ width: '100%', height: '80px', position: 'relative' }}>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
                        <svg viewBox="0 0 200 40" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                          {cpuHist.length >= 2 && (() => { const pts = cpuHist.map((v, i) => `${(i/(cpuHist.length-1))*200},${40-(v/100)*38-1}`).join(' '); return <><polyline points={pts + ` 200,40 0,40`} fill="rgba(239,68,68,0.1)" stroke="none" /><polyline points={pts} fill="none" stroke="var(--crimson)" strokeWidth="1.5" strokeLinejoin="round" /></> })()}
                          {ramHist.length >= 2 && (() => { const pts = ramHist.map((v, i) => `${(i/(ramHist.length-1))*200},${40-(v/100)*38-1}`).join(' '); return <><polyline points={pts + ` 200,40 0,40`} fill="rgba(34,211,238,0.06)" stroke="none" /><polyline points={pts} fill="none" stroke="var(--signal)" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="4 2" /></> })()}
                          {gpuHist.length >= 2 && (() => { const pts = gpuHist.map((v, i) => `${(i/(gpuHist.length-1))*200},${40-(v/100)*38-1}`).join(' '); return <><polyline points={pts + ` 200,40 0,40`} fill="rgba(168,85,247,0.06)" stroke="none" /><polyline points={pts} fill="none" stroke="#a855f7" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="2 3" /></> })()}
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )

        if (sectionId === 'control') return (
          <section key="control" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#3f3f46', textTransform: 'uppercase', letterSpacing: '0.2em', marginLeft: '4px' }}>// System_Control</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '16px' }}>
              {show('game') && (
                <div className="v-card" style={{ padding: '20px', display: 'flex', gap: '20px', alignItems: 'center', background: gameMode ? 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(8,13,23,0.9) 100%)' : 'rgba(255,255,255,0.02)', border: gameMode ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.05)', boxShadow: gameMode ? '0 0 30px rgba(239,68,68,0.1)' : 'none', transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                  <div style={{ padding: '12px', borderRadius: '12px', background: gameMode ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${gameMode ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`, color: gameMode ? 'var(--crimson)' : '#52525b', position: 'relative' }}>
                    <Rocket size={24} className={gameMode ? 'animate-pulse' : ''} />
                    {gameMode && <motion.div layoutId="glow" style={{ position: 'absolute', inset: -4, borderRadius: '14px', border: '2px solid var(--crimson)', opacity: 0.3 }} animate={{ opacity: [0.1, 0.5, 0.1] }} transition={{ duration: 2, repeat: Infinity }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: gameMode ? 'var(--crimson)' : '#71717a', fontWeight: 'bold', marginBottom: '4px' }}>Zero-Latency Mode</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'white' }}>Hardware Optimization</div>
                    <div style={{ fontSize: '11px', color: '#52525b', marginTop: '4px' }}>{gameMode ? 'LAVD gaming scheduler active.' : 'Switch to the LAVD scheduler for gaming.'}</div>
                  </div>
                  <button onClick={handleGameModeToggle} disabled={gameModeBusy} style={{ padding: '10px 24px', borderRadius: '8px', background: gameMode ? 'var(--crimson)' : 'rgba(255,255,255,0.05)', border: gameMode ? 'none' : '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', boxShadow: gameMode ? '0 0 20px rgba(239,68,68,0.4)' : 'none', textTransform: 'uppercase', letterSpacing: '0.1em', transition: 'all 0.2s' }}>
                    {gameModeBusy ? '...' : gameMode ? 'ACTIVE' : 'ACTIVATE'}
                  </button>
                </div>
              )}
              {show('guardian') && (
                <div className="v-card" style={{ padding: '20px', display: 'flex', gap: '20px', alignItems: 'center', background: guardianEnabled ? 'linear-gradient(135deg, rgba(16,185,129,0.05) 0%, rgba(8,13,23,0.9) 100%)' : 'rgba(255,255,255,0.02)', border: guardianEnabled ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.05)', transition: 'all 0.3s ease' }}>
                  <div style={{ padding: '12px', borderRadius: '12px', background: guardianEnabled ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${guardianEnabled ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`, color: guardianEnabled ? 'var(--signal)' : '#52525b' }}>
                    <Shield size={24} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: guardianEnabled ? 'var(--signal)' : '#71717a', fontWeight: 'bold', marginBottom: '4px' }}>Vortex Guardian</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'white' }}>Autonomous Watchdog</div>
                    <div style={{ fontSize: '11px', color: '#52525b', marginTop: '4px' }}>{guardianEnabled ? `Active: ${guardianActiveOpt}` : 'Auto-detect game launches.'}</div>
                  </div>
                  <button onClick={handleGuardianToggle} style={{ width: '40px', height: '20px', borderRadius: '20px', background: guardianEnabled ? 'var(--signal)' : '#27272a', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                    <motion.div animate={{ x: guardianEnabled ? 20 : 2 }} initial={false} style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'white', position: 'absolute', top: 2 }} />
                  </button>
                </div>
              )}
            </div>
            {show('power') && (
              <div className="v-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Zap size={14} style={{ color: '#f59e0b' }} />
                  <span style={{ fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#71717a', fontWeight: 'bold' }}>CachyOS Power Profiles</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[{ id: 'power-saver', label: 'Saver', icon: Sparkles, color: 'var(--signal)' }, { id: 'balanced', label: 'Balanced', icon: Activity, color: '#64748b' }, { id: 'performance', label: 'Performance', icon: Zap, color: 'var(--crimson)' }].map(p => {
                    const active = powerProfile === p.id
                    return (
                      <button key={p.id} onClick={() => handleSetPowerProfile(p.id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '10px 4px', borderRadius: '8px', background: active ? `${p.color}15` : 'rgba(255,255,255,0.02)', border: `1px solid ${active ? p.color : 'rgba(255,255,255,0.05)'}`, color: active ? p.color : '#52525b', cursor: 'pointer', transition: 'all 0.2s' }}>
                        <p.icon size={14} />
                        <span style={{ fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', fontWeight: active ? 'bold' : 'normal' }}>{p.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        )


        if (sectionId === 'silicon' && show('gpu') && stats?.gpu) return (
          <section key="silicon" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#3f3f46', textTransform: 'uppercase', letterSpacing: '0.2em', marginLeft: '4px' }}>// Silicon_Detail</div>
            <div className="v-card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <Zap size={14} style={{ color: '#a855f7' }} />
                <span style={{ fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#71717a', fontWeight: 'bold' }}>{stats.gpu.model}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                <GpuStat label="VRAM" value={`${stats.gpu.memoryUsed} / ${stats.gpu.memoryTotal} MB`} pct={gpuVramPct} color="#a855f7" />
                <GpuStat label="Temperature" value={`${stats.gpu.temperatureGpu}°C`} pct={(stats.gpu.temperatureGpu / 100) * 100} color={stats.gpu.temperatureGpu > 80 ? 'var(--crimson)' : stats.gpu.temperatureGpu > 65 ? '#f59e0b' : 'var(--signal)'} />
                <GpuStat label="Power" value={`${stats.gpu.powerDraw.toFixed(0)}W / ${stats.gpu.powerLimit}W`} pct={(stats.gpu.powerDraw / stats.gpu.powerLimit) * 100} color="#f59e0b" />
                <GpuStat label="Fan Speed" value={`${stats.gpu.fanSpeed}%`} pct={stats.gpu.fanSpeed} color="var(--signal)" />
                <GpuStat label="Core Clock" value={`${stats.gpu.clockCore} MHz`} pct={100} color="#64748b" noBar />
                <GpuStat label="VRAM Util" value={`${stats.gpu.utilizationMemory}%`} pct={stats.gpu.utilizationMemory} color="#a855f7" />
              </div>
            </div>
          </section>
        )

        if (sectionId === 'activity' && show('activity')) return (
          <section key="activity" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#3f3f46', textTransform: 'uppercase', letterSpacing: '0.2em', marginLeft: '4px' }}>// Audit_Trail</div>
            <div className="v-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Activity size={13} style={{ color: '#52525b' }} />
                <span style={{ fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#a1a1aa', fontWeight: 'bold' }}>Recent Operations</span>
              </div>
              {auditLog.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#3f3f46', fontFamily: 'monospace', fontSize: '10px', fontStyle: 'italic' }}>No commands recorded yet.</div>
              ) : auditLog.map((entry, i) => (
                <div key={entry.id} style={{ display: 'grid', gridTemplateColumns: '28px 60px 1fr 50px', gap: '0 10px', padding: '7px 16px', borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '10px', fontFamily: 'monospace', alignItems: 'center', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.003)' }}>
                  {entry.exit_code === 0 || entry.exit_code === null ? <CheckCircle2 size={12} style={{ color: 'var(--signal)' }} /> : <XCircle size={12} style={{ color: 'var(--crimson)' }} />}
                  {entry.source === 'terminal' ? <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--signal)', fontSize: '8px', textTransform: 'uppercase' }}><Terminal size={8} /> Term</div> : <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--crimson)', fontSize: '8px', textTransform: 'uppercase' }}><Zap size={8} /> App</div>}
                  <span style={{ color: '#a1a1aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.command}>{entry.command}</span>
                  <span style={{ color: '#3f3f46', fontSize: '8px' }}>{new Date(entry.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
          </section>
        )

        return null
      })}
    </div>
  )
}

function GpuStat({ label, value, pct, color, noBar }: { label: string; value: string; pct: number; color: string; noBar?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#52525b' }}>{label}</span>
        <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold', color: '#f4f4f5' }}>{value}</span>
      </div>
      {!noBar && (
        <div style={{ height: '2px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 100)}%` }} style={{ height: '100%', background: color }} />
        </div>
      )}
    </div>
  )
}

interface StatCardProps {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  label: string
  value: string
  sub: string
  pct: number
  color?: string
}

function StatCard({ icon: Icon, label, value, sub, pct, color = 'var(--crimson)' }: StatCardProps) {
  const c = progressColor(pct) === 'var(--signal)' ? color : progressColor(pct)
  return (
    <motion.div className="v-card" style={{ padding: '16px 20px' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <Icon size={18} style={{ color: c }} />
        </div>
        <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#3f3f46', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize: '26px', fontWeight: '900', letterSpacing: '-0.03em', marginBottom: '4px', color: '#f4f4f5' }}>{value}</div>
      <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#52525b', marginBottom: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
      <div style={{ height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} style={{ height: '100%', background: c }} />
      </div>
    </motion.div>
  )
}
