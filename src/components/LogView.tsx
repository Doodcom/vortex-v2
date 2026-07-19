import { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, Play, Square, Filter } from 'lucide-react'
import { motion } from 'framer-motion'

function lineColor(line: string): string {
  const l = line.toLowerCase()
  if (/\b(emerg|alert|crit|panic)\b/.test(l)) return 'var(--crimson)'
  if (/\b(error|err|failed|failure)\b/.test(l)) return '#f87171'
  if (/\b(warning|warn)\b/.test(l)) return '#f59e0b'
  if (/\b(notice|info|debug)\b/.test(l)) return '#71717a'
  return '#a1a1aa'
}

const PRIORITY_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Critical (0–2)', value: '2' },
  { label: 'Error (≤3)',     value: '3' },
  { label: 'Warning (≤4)',   value: '4' },
  { label: 'Info (≤6)',      value: '6' },
]

const SINCE_OPTIONS = [
  { label: 'Last 1h',  value: '1 hour ago' },
  { label: 'Last 6h',  value: '6 hours ago' },
  { label: 'Last 24h', value: '24 hours ago' },
  { label: 'Last 7d',  value: '7 days ago' },
  { label: 'All time', value: '' },
]

const LINE_OPTIONS = [100, 300, 500, 1000]

export default function LogView() {
  const [lines, setLines] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const [unit, setUnit]         = useState('')
  const [priority, setPriority] = useState('')
  const [since, setSince]       = useState('1 hour ago')
  const [keyword, setKeyword]   = useState('')
  const [lineCount, setLineCount] = useState(300)

  const scrollRef   = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchLogs = useCallback(async () => {
    const el = (window as any).electron
    if (!el?.journalGetLogs) return
    setLoading(true)
    setError(null)
    const res = await el.journalGetLogs({ unit: unit || undefined, priority: priority || undefined, lines: lineCount, keyword: keyword || undefined, since: since || undefined })
    setLoading(false)
    if (!res.success && res.error) { setError(res.error); return }
    setLines(res.lines ?? [])
    setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, 50)
  }, [unit, priority, since, keyword, lineCount])

  useEffect(() => { fetchLogs() }, [])

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (autoRefresh) intervalRef.current = setInterval(fetchLogs, 8000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [autoRefresh, fetchLogs])

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '8px', padding: '6px 10px', color: '#f4f4f5', fontSize: '11px',
    fontFamily: 'monospace', outline: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: 'calc(100vh - 220px)' }}>

      {/* Filter bar */}
      <div className="v-card" style={{ padding: '14px 18px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Filter size={13} style={{ color: '#52525b' }} />
          <span style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#52525b' }}>Filters</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="Unit (e.g. nginx.service)" style={{ ...inputStyle, width: '180px' }} />
          <select value={priority} onChange={e => setPriority(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ background: '#0d0e11' }}>{o.label}</option>)}
          </select>
          <select value={since} onChange={e => setSince(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            {SINCE_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ background: '#0d0e11' }}>{o.label}</option>)}
          </select>
          <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Keyword / grep" style={{ ...inputStyle, width: '160px' }} />
          <select value={lineCount} onChange={e => setLineCount(Number(e.target.value))} style={{ ...inputStyle, cursor: 'pointer' }}>
            {LINE_OPTIONS.map(n => <option key={n} value={n} style={{ background: '#0d0e11' }}>{n} lines</option>)}
          </select>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={fetchLogs} disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--crimson)', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.5 : 1 }}>
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button onClick={() => setAutoRefresh(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: `1px solid ${autoRefresh ? 'rgba(34,211,238,0.25)' : 'rgba(255,255,255,0.06)'}`, background: autoRefresh ? 'rgba(34,211,238,0.08)' : 'rgba(255,255,255,0.02)', color: autoRefresh ? 'var(--signal)' : '#52525b', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer' }}>
              {autoRefresh ? <Square size={10} /> : <Play size={10} />}
              {autoRefresh ? 'Live' : 'Follow'}
            </button>
          </div>
        </div>
      </div>

      {/* Log output */}
      <div className="v-card" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#52525b' }}>
            Output — {lines.length} lines
          </span>
          {autoRefresh && (
            <span style={{ fontSize: '8px', fontFamily: 'monospace', color: 'var(--signal)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="animate-pulse-dot" style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: 'var(--signal)' }} />
              live · 8s
            </span>
          )}
        </div>

        {error ? (
          <div style={{ padding: '24px', color: 'var(--crimson)', fontFamily: 'monospace', fontSize: '12px' }}>{error}</div>
        ) : lines.length === 0 && !loading ? (
          <div style={{ padding: '24px', color: '#3f3f46', fontFamily: 'monospace', fontSize: '11px', fontStyle: 'italic' }}>No log entries found for the selected filters.</div>
        ) : (
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 16px', fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '11px', lineHeight: '1.65' }}>
            {loading && lines.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: '#52525b', fontStyle: 'italic' }}>Loading...</motion.div>
            )}
            {lines.map((line, i) => (
              <div key={i} style={{ color: lineColor(line), whiteSpace: 'pre-wrap', wordBreak: 'break-all', padding: '1px 0', borderBottom: '1px solid rgba(255,255,255,0.015)' }}>
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

