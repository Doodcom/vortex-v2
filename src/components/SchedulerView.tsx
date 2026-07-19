import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, StopCircle, RefreshCw, Cpu, Zap, Check } from 'lucide-react'
import { notify } from '../lib/notifications'

const SCX_MODE_LABELS: Record<number, string> = { 0: 'Auto', 1: 'Power Save', 2: 'Performance', 3: 'Gaming' }

const SCX_DESCRIPTIONS: Record<string, string> = {
  scx_lavd:       'LAVD — latency-aware vruntime. Best for desktop + gaming.',
  scx_bpfland:    'BPFLand — interactive-first BPF scheduler. Great for mixed workloads.',
  scx_rusty:      'Rusty — multi-domain topology-aware. Good for NUMA/MCM.',
  scx_cake:       'CAKE — fair queuing with network-aware weighting.',
  scx_p2dq:       'P2DQ — pick-2 dequeue. Low overhead, consistent latency.',
  scx_beerland:   'Beerland — experimental. Not recommended for daily use.',
  scx_cosmos:     'Cosmos — global vruntime scheduler.',
  scx_flash:      'Flash — ultra-low latency, aggressive preemption.',
  scx_pandemonium: 'Pandemonium — chaotic but fast. For testing.',
}

const BORE_PROFILES = [
  { id: 'desktop',  label: 'Desktop',   desc: 'Responsive UI, balanced burst penalty' },
  { id: 'ai_heavy', label: 'AI Heavy',  desc: 'Low penalty for long-running AI tasks' },
  { id: 'balanced', label: 'Balanced',  desc: 'Good default for mixed workloads' },
  { id: 'gaming',   label: 'Gaming',    desc: 'Reduced burst penalty, lower latency' },
]

export default function SchedulerView() {
  const [scheduler, setScheduler] = useState('unknown')
  const [state, setStateStr] = useState('disabled')
  const [supportedSchedulers, setSupportedSchedulers] = useState<string[]>([])
  const [metrics, setMetrics] = useState<{ enableSeq: number; nrRejected: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState<string | null>(null)
  const [boreApplying, setBoreApplying] = useState<string | null>(null)
  const [boreResult, setBoreResult] = useState<{ profile: string; output: string; partial: boolean } | null>(null)
  const [selectedMode, setSelectedMode] = useState(0)
  const [cpuInfo, setCpuInfo] = useState<string | null>(null)

  useEffect(() => {
    window.electron.getSystemStats().then(s => {
      const cpu = s?.cpu
      if (cpu) setCpuInfo(`${cpu.brand} · ${cpu.cores}C · sched-ext enabled`)
    }).catch(() => {})
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    const [status, mx] = await Promise.all([
      window.electron.scxStatus(),
      window.electron.scxMetrics(),
    ])
    if (status.success) {
      setScheduler(status.scheduler)
      setStateStr(status.state)
      setSupportedSchedulers(status.schedulers)
    }
    if (mx.success) {
      setMetrics({ enableSeq: mx.enableSeq, nrRejected: mx.nrRejected })
    }
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleSwitch = async (name: string) => {
    setSwitching(name)
    const r = await window.electron.scxSetScheduler({ name, mode: selectedMode })
    if (r.success) {
      notify('Scheduler', `Switched to ${name} (mode: ${SCX_MODE_LABELS[selectedMode]})`, 'success')
      setTimeout(refresh, 1200)
    } else {
      notify('Scheduler Error', r.error ?? 'Failed', 'error')
    }
    setSwitching(null)
  }

  const handleStop = async () => {
    const r = await window.electron.scxStop()
    if (r.success) {
      notify('Scheduler', 'Stopped — reverted to kernel default (EEVDF)', 'success')
      setTimeout(refresh, 800)
    } else {
      notify('Scheduler Error', r.error ?? 'Failed', 'error')
    }
  }

  const handleBoreProfile = async (profile: string) => {
    setBoreApplying(profile)
    const r = await window.electron.boreSetProfile(profile)
    if (r.output) {
      setBoreResult({ profile, output: r.output, partial: r.partial ?? false })
      notify('BORE', r.partial ? 'Partial apply — some params not available' : `Profile "${profile}" applied`, r.partial ? 'error' : 'success')
    } else {
      notify('BORE Error', r.error ?? 'Failed', 'error')
    }
    setBoreApplying(null)
  }

  const isActive = state === 'enabled' || state === 'active'

  return (
    <div style={{ padding: '24px', maxWidth: '860px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontFamily: 'monospace', fontWeight: 'bold', color: '#f4f4f5', letterSpacing: '0.05em' }}>
            SCHEDULER CONTROL
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '10px', fontFamily: 'monospace', color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            sched-ext BPF schedulers + BORE tuner
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#71717a', cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase' }}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Status bar */}
      <div className="v-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isActive ? 'var(--crimson)' : '#3f3f46', boxShadow: isActive ? '0 0 8px var(--crimson)' : 'none' }} />
          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#f4f4f5' }}>
            {scheduler === 'unknown' ? 'EEVDF (default)' : scheduler}
          </span>
        </div>
        <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          state: <span style={{ color: isActive ? '#10b981' : '#71717a' }}>{state}</span>
        </div>
        {metrics && (
          <>
            <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#52525b' }}>
              enable_seq: <span style={{ color: '#a1a1aa' }}>{metrics.enableSeq}</span>
            </div>
            <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#52525b' }}>
              rejected: <span style={{ color: metrics.nrRejected > 0 ? '#ef4444' : '#a1a1aa' }}>{metrics.nrRejected}</span>
            </div>
          </>
        )}
        {isActive && (
          <button
            onClick={handleStop}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--crimson)', cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            <StopCircle size={12} /> Stop Scheduler
          </button>
        )}
      </div>

      {/* Mode selector */}
      <div className="v-card" style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--crimson)', marginBottom: '12px' }}>
          // Scheduler Mode
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {Object.entries(SCX_MODE_LABELS).map(([k, label]) => {
            const m = parseInt(k, 10)
            const active = selectedMode === m
            return (
              <button
                key={k}
                onClick={() => setSelectedMode(m)}
                style={{ padding: '6px 16px', borderRadius: '8px', fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', transition: 'all 0.15s', background: active ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${active ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.06)'}`, color: active ? 'var(--crimson)' : '#71717a' }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Scheduler list */}
      <div className="v-card" style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--crimson)', marginBottom: '14px' }}>
          // Available Schedulers
        </div>
        {loading ? (
          <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#52525b', fontStyle: 'italic' }}>Loading...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {supportedSchedulers.map(name => {
              const isCurrent = name === scheduler && isActive
              const isBusy = switching === name
              return (
                <motion.div
                  key={name}
                  layout
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', borderRadius: '10px', transition: 'all 0.15s',
                    background: isCurrent ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isCurrent ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.05)'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, background: isCurrent ? 'var(--crimson)' : '#3f3f46', boxShadow: isCurrent ? '0 0 6px var(--crimson)' : 'none' }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: isCurrent ? '#f4f4f5' : '#a1a1aa' }}>{name}</div>
                      <div style={{ fontSize: '10px', color: '#3f3f46', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {SCX_DESCRIPTIONS[name] ?? 'sched-ext BPF scheduler'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => !isCurrent && handleSwitch(name)}
                    disabled={isBusy || isCurrent}
                    style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '8px', fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: isBusy || isCurrent ? 'default' : 'pointer', background: isCurrent ? 'transparent' : 'rgba(239,68,68,0.07)', border: `1px solid ${isCurrent ? 'transparent' : 'rgba(239,68,68,0.2)'}`, color: isCurrent ? '#52525b' : 'var(--crimson)', transition: 'all 0.15s' }}
                  >
                    {isBusy ? <><Activity size={10} className="animate-spin" /> Switching</> : isCurrent ? <><Check size={10} /> Active</> : 'Switch'}
                  </button>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* BORE Tuner */}
      <div className="v-card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <div style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--crimson)' }}>
            // BORE Burst Tuner
          </div>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#3f3f46', textTransform: 'uppercase' }}>(kernel.sched_burst_*)</span>
        </div>
        <p style={{ fontSize: '10px', fontFamily: 'monospace', color: '#52525b', marginBottom: '14px', marginTop: '4px' }}>
          Applies BORE burst-penalty sysctl presets. Works when BORE is compiled into the running kernel. CachyOS LTS variant may expose these only in the -bore or -eevdf-bore kernel.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {BORE_PROFILES.map(({ id, label, desc }) => {
            const busy = boreApplying === id
            const applied = boreResult?.profile === id
            return (
              <button
                key={id}
                onClick={() => !busy && handleBoreProfile(id)}
                disabled={busy}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '12px 14px', borderRadius: '10px', cursor: busy ? 'default' : 'pointer', transition: 'all 0.15s', background: applied ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.02)', border: `1px solid ${applied ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.05)'}`, textAlign: 'left' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', width: '100%' }}>
                  <Zap size={12} style={{ color: busy ? '#52525b' : applied ? 'var(--crimson)' : '#71717a', flexShrink: 0 }} />
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold', color: applied ? '#f4f4f5' : '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {busy ? 'Applying...' : label}
                  </span>
                  {applied && <Check size={10} style={{ color: 'var(--crimson)', marginLeft: 'auto', flexShrink: 0 }} />}
                </div>
                <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#3f3f46' }}>{desc}</span>
              </button>
            )
          })}
        </div>

        <AnimatePresence>
          {boreResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ marginTop: '14px', overflow: 'hidden' }}
            >
              {boreResult.partial && (
                <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#f59e0b', marginBottom: '6px', textTransform: 'uppercase' }}>
                  ⚠ Partial apply — BORE sysctls not present in this kernel variant
                </div>
              )}
              <pre style={{ fontSize: '9px', fontFamily: 'monospace', color: '#52525b', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '8px 10px', margin: 0, whiteSpace: 'pre-wrap', maxHeight: '120px', overflow: 'auto' }}>
                {boreResult.output}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CPU info strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.4 }}>
        <Cpu size={10} style={{ color: '#52525b' }} />
        <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#3f3f46', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {cpuInfo ?? 'Loading CPU info...'}
        </span>
      </div>

    </div>
  )
}
