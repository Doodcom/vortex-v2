import { useState, useEffect, useCallback } from 'react'
import { Clock, ChevronDown, ChevronRight, Zap, RefreshCw, ShieldOff } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface BootUnit { time_ms: number; unit: string }

function fmtMs(ms: number): string {
  if (ms >= 60000) return `${(ms / 60000).toFixed(1)}min`
  if (ms >= 1000)  return `${(ms / 1000).toFixed(2)}s`
  return `${Math.round(ms)}ms`
}

function unitColor(ms: number): string {
  if (ms > 5000)  return 'var(--crimson)'
  if (ms > 1500)  return '#f59e0b'
  if (ms > 500)   return '#facc15'
  return 'var(--signal)'
}

export default function BootView() {
  const [summary, setSummary]     = useState('')
  const [units, setUnits]         = useState<BootUnit[]>([])
  const [loading, setLoading]     = useState(true)
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [unitLog, setUnitLog]     = useState('')
  const [logLoading, setLogLoading] = useState(false)
  const [disableConfirm, setDisableConfirm] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState('')

  const load = useCallback(async () => {
    if (!(window as any).electron) return
    setLoading(true)
    const res = await (window as any).electron.systemAnalyzeBoot()
    setSummary(res.summary)
    setUnits(res.units)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const toggleExpand = async (unit: string) => {
    if (expanded === unit) { setExpanded(null); setUnitLog(''); return }
    setExpanded(unit)
    setLogLoading(true)
    const log = await (window as any).electron.systemdUnitLogs({ unit, lines: 30 })
    setUnitLog(log)
    setLogLoading(false)
  }

  const disableUnit = async (unit: string) => {
    setDisableConfirm(null)
    const res = await (window as any).electron.systemdControlUnit({ unit, action: 'disable' })
    setActionMsg(res.success ? `Disabled ${unit}` : res.error ?? 'Failed')
    setTimeout(() => setActionMsg(''), 3000)
  }

  const peak = units[0]?.time_ms ?? 1

  // Parse total boot time from summary
  const totalMatch = summary.match(/=\s+([\d.]+s(?:\s+[\d.]+ms)?)/)
  const totalTime = totalMatch ? totalMatch[1] : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Summary banner */}
      <div className="v-card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <Zap size={18} style={{ color: 'var(--crimson)' }} />
            </div>
            <div>
              <div style={{ fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#52525b', marginBottom: '4px' }}>Total Boot Time</div>
              <div style={{ fontSize: '24px', fontFamily: 'monospace', fontWeight: 'bold', color: '#f4f4f5' }}>{totalTime || '—'}</div>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#71717a', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            Re-analyze
          </button>
        </div>
        {summary && (
          <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', fontSize: '10px', fontFamily: 'monospace', color: '#52525b', whiteSpace: 'pre-wrap' }}>
            {summary}
          </div>
        )}
      </div>

      {/* Action feedback */}
      <AnimatePresence>
        {actionMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ padding: '10px 16px', borderRadius: '10px', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)', color: 'var(--signal)', fontSize: '11px', fontFamily: 'monospace' }}
          >
            {actionMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unit blame chart */}
      <div className="v-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Clock size={13} style={{ color: '#52525b' }} />
          <span style={{ fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#a1a1aa', fontWeight: 'bold' }}>
            Slowest Startup Units ({units.length})
          </span>
        </div>

        {loading && units.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#3f3f46', fontFamily: 'monospace', fontSize: '11px', fontStyle: 'italic' }}>
            <RefreshCw size={14} className="animate-spin" style={{ display: 'inline-block', marginRight: '8px' }} />
            Analyzing boot sequence...
          </div>
        ) : units.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#3f3f46', fontFamily: 'monospace', fontSize: '11px', fontStyle: 'italic' }}>
            No unit data available
          </div>
        ) : units.map((u, i) => (
          <div key={u.unit}>
            {/* Row */}
            <div
              onClick={() => toggleExpand(u.unit)}
              style={{
                display: 'grid', gridTemplateColumns: '60px 1fr 80px 100px',
                gap: '0 12px', padding: '9px 18px', cursor: 'pointer',
                borderBottom: expanded === u.unit ? 'none' : '1px solid rgba(255,255,255,0.02)',
                background: expanded === u.unit ? 'rgba(255,255,255,0.02)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.005)',
                alignItems: 'center',
              }}
            >
              {/* Rank */}
              <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#3f3f46', textAlign: 'right' }}>#{i + 1}</span>

              {/* Bar + name */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  {expanded === u.unit ? <ChevronDown size={10} style={{ color: '#52525b', flexShrink: 0 }} /> : <ChevronRight size={10} style={{ color: '#3f3f46', flexShrink: 0 }} />}
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#d4d4d8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.unit}</span>
                </div>
                <div style={{ height: '3px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${(u.time_ms / peak) * 100}%`, height: '100%', background: unitColor(u.time_ms), borderRadius: '2px', transition: 'width 0.5s ease' }} />
                </div>
              </div>

              {/* Time */}
              <span style={{ fontSize: '12px', fontFamily: 'monospace', color: unitColor(u.time_ms), fontWeight: 'bold', textAlign: 'right' }}>{fmtMs(u.time_ms)}</span>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                {disableConfirm === u.unit ? (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={e => { e.stopPropagation(); disableUnit(u.unit) }} style={{ padding: '2px 7px', borderRadius: '5px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--crimson)', fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer' }}>Confirm</button>
                    <button onClick={e => { e.stopPropagation(); setDisableConfirm(null) }} style={{ padding: '2px 6px', borderRadius: '5px', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: '#52525b', fontSize: '8px', fontFamily: 'monospace', cursor: 'pointer' }}>Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setDisableConfirm(u.unit) }}
                    title="Disable this unit"
                    style={{ padding: '2px 7px', borderRadius: '5px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#3f3f46', fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <ShieldOff size={9} />
                    Disable
                  </button>
                )}
              </div>
            </div>

            {/* Expanded log */}
            <AnimatePresence>
              {expanded === u.unit && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <div style={{ padding: '10px 18px 14px', background: 'rgba(0,0,0,0.3)' }}>
                    <div style={{ fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3f3f46', marginBottom: '6px' }}>// journal — last 30 lines</div>
                    {logLoading ? (
                      <div style={{ color: '#52525b', fontFamily: 'monospace', fontSize: '10px', fontStyle: 'italic' }}>Loading...</div>
                    ) : (
                      <pre style={{ margin: 0, fontSize: '10px', fontFamily: 'monospace', color: '#71717a', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '160px', overflowY: 'auto', lineHeight: 1.6 }}>
                        {unitLog || '(no journal entries)'}
                      </pre>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  )
}
