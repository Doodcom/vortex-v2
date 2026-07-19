import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Search, Square, Zap, AlertTriangle, X, Loader2, Activity } from 'lucide-react'
import { useTheme } from './ThemeProvider'

interface Proc {
  pid: number
  name: string
  cpu: number
  mem: number
  memRss: number
  command: string
  user: string
  state: string
  started: string
}

type SortKey = 'cpu' | 'mem' | 'pid' | 'name'

interface KillConfirm { proc: Proc; signal: 'SIGTERM' | 'SIGKILL' }

function bytesLabel(kb: number): string {
  if (kb > 1024 * 1024) return `${(kb / 1024 / 1024).toFixed(1)}G`
  if (kb > 1024)        return `${(kb / 1024).toFixed(0)}M`
  return `${kb}K`
}

function CpuBar({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 100)
  const color = clamped > 80 ? 'var(--crimson)' : clamped > 40 ? '#f59e0b' : 'var(--signal)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
      <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${clamped}%`, background: color, borderRadius: '2px', transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: '10px', fontFamily: 'monospace', color, minWidth: '38px', textAlign: 'right' }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  )
}

export default function ProcessView() {
  const { playSound } = useTheme()
  const [procs, setProcs] = useState<Proc[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('cpu')
  const [sortAsc, setSortAsc] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [killConfirm, setKillConfirm] = useState<KillConfirm | null>(null)
  const [killing, setKilling] = useState<number | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadProcs = useCallback(async () => {
    setLoading(true)
    const list = await (window as any).electron.processList()
    setProcs(list)
    setLoading(false)
  }, [])

  useEffect(() => { loadProcs() }, [loadProcs])

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(loadProcs, 3000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [autoRefresh, loadProcs])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(key === 'name') }
    playSound('click')
  }

  const handleKill = async () => {
    if (!killConfirm) return
    setKilling(killConfirm.proc.pid)
    setKillConfirm(null)
    const res = await (window as any).electron.processKill({ pid: killConfirm.proc.pid, signal: killConfirm.signal })
    setKilling(null)
    setToast({ ok: res.success, msg: res.success ? `Sent ${killConfirm.signal} to ${killConfirm.proc.name} (${killConfirm.proc.pid})` : (res.error ?? 'Failed') })
    if (res.success) { playSound('success'); setTimeout(loadProcs, 600) }
    setTimeout(() => setToast(null), 3000)
  }

  const sorted = [...procs]
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.command.toLowerCase().includes(search.toLowerCase()) || String(p.pid).includes(search))
    .sort((a, b) => {
      let diff = 0
      if (sortKey === 'cpu')  diff = a.cpu  - b.cpu
      if (sortKey === 'mem')  diff = a.mem  - b.mem
      if (sortKey === 'pid')  diff = a.pid  - b.pid
      if (sortKey === 'name') diff = a.name.localeCompare(b.name)
      return sortAsc ? diff : -diff
    })

  const totalCpu = procs.reduce((s, p) => s + p.cpu, 0)
  const totalMem = procs.reduce((s, p) => s + p.mem, 0) / procs.length || 0

  function SortHeader({ k, label, align = 'left' }: { k: SortKey; label: string; align?: string }) {
    const active = sortKey === k
    return (
      <button
        onClick={() => handleSort(k)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: active ? 'var(--crimson)' : '#3f3f46', display: 'flex', alignItems: 'center', gap: '4px', padding: 0, textAlign: align as any }}
      >
        {label}
        {active && <span style={{ fontSize: '8px' }}>{sortAsc ? '▲' : '▼'}</span>}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Summary bar */}
      <div className="v-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={14} style={{ color: 'var(--crimson)' }} />
          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#f4f4f5', fontWeight: 'bold' }}>{procs.length}</span>
          <span style={{ fontSize: '9px', color: '#52525b', textTransform: 'uppercase' }}>processes</span>
        </div>
        <div style={{ height: '24px', width: '1px', background: 'rgba(255,255,255,0.05)' }} />
        <div>
          <span style={{ fontSize: '9px', color: '#52525b', textTransform: 'uppercase', marginRight: '6px' }}>CPU</span>
          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: totalCpu > 80 ? 'var(--crimson)' : '#f4f4f5' }}>{totalCpu.toFixed(1)}%</span>
        </div>
        <div>
          <span style={{ fontSize: '9px', color: '#52525b', textTransform: 'uppercase', marginRight: '6px' }}>MEM avg</span>
          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#f4f4f5' }}>{totalMem.toFixed(1)}%</span>
        </div>
        <div style={{ flex: 1 }} />
        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '6px 12px' }}>
            <Search size={12} style={{ color: '#52525b' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="filter..." style={{ background: 'transparent', border: 'none', outline: 'none', color: '#f4f4f5', fontSize: '12px', fontFamily: 'monospace', width: '140px' }} />
          </div>
          <button
            onClick={() => { setAutoRefresh(v => !v); playSound('click') }}
            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer', background: autoRefresh ? 'rgba(16,185,129,0.1)' : 'transparent', borderColor: autoRefresh ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.06)', color: autoRefresh ? 'var(--signal)' : '#52525b', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: autoRefresh ? 'var(--signal)' : '#3f3f46' }} />
            Live
          </button>
          <button
            onClick={() => { loadProcs(); playSound('click') }}
            disabled={loading}
            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: '#71717a', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ padding: '10px 16px', borderRadius: '10px', fontSize: '11px', fontFamily: 'monospace', background: toast.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${toast.ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, color: toast.ok ? 'var(--signal)' : 'var(--crimson)' }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kill confirm modal */}
      <AnimatePresence>
        {killConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div initial={{ scale: 0.92 }} animate={{ scale: 1 }}
              style={{ background: '#0d0e11', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '20px', padding: '28px', maxWidth: '420px', width: '90%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <AlertTriangle size={20} style={{ color: 'var(--crimson)' }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#f4f4f5', fontFamily: 'monospace' }}>
                    {killConfirm.signal === 'SIGKILL' ? 'Force Kill' : 'Terminate'} Process?
                  </div>
                  <div style={{ fontSize: '10px', color: '#71717a', marginTop: '2px' }}>
                    {killConfirm.proc.name} — PID {killConfirm.proc.pid}
                  </div>
                </div>
              </div>
              <pre style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '10px', color: '#71717a', margin: '0 0 20px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {killConfirm.proc.command.slice(0, 200)}
              </pre>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handleKill} style={{ flex: 1, padding: '10px', borderRadius: '12px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--crimson)', fontFamily: 'monospace', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer' }}>
                  {killConfirm.signal === 'SIGKILL' ? '⚡ Force Kill' : '✕ Terminate'}
                </button>
                <button onClick={() => setKillConfirm(null)} style={{ flex: 1, padding: '10px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#a1a1aa', fontFamily: 'monospace', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <X size={12} /> Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="v-card" style={{ overflow: 'hidden', padding: 0 }}>
        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '70px 160px 1fr 130px 100px 60px 80px', gap: '0 12px', padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'center' }}>
          <SortHeader k="pid"  label="PID" />
          <SortHeader k="name" label="Name" />
          <span style={{ fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#3f3f46' }}>Command</span>
          <SortHeader k="cpu"  label="CPU" />
          <SortHeader k="mem"  label="Mem RSS" />
          <span style={{ fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#3f3f46' }}>State</span>
          <span style={{ fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#3f3f46' }}>Actions</span>
        </div>

        <div style={{ maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
          {loading && procs.length === 0 ? (
            <div style={{ padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#52525b', fontFamily: 'monospace', fontSize: '12px' }}>
              <Loader2 size={16} className="animate-spin" /> Scanning processes...
            </div>
          ) : (
            sorted.map((p, i) => (
              <div key={p.pid} style={{ display: 'grid', gridTemplateColumns: '70px 160px 1fr 130px 100px 60px 80px', gap: '0 12px', padding: '7px 16px', borderBottom: '1px solid rgba(255,255,255,0.025)', alignItems: 'center', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.004)', opacity: killing === p.pid ? 0.4 : 1, transition: 'opacity 0.3s' }}>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#52525b' }}>{p.pid}</span>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#e4e4e7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.name}>{p.name}</span>
                <span style={{ fontSize: '10px', color: '#52525b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.command}>{p.command || '—'}</span>
                <CpuBar pct={p.cpu} />
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#a1a1aa' }}>{bytesLabel(p.memRss)}</span>
                <span style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', color: p.state === 'running' ? 'var(--signal)' : '#52525b' }}>{p.state}</span>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button
                    onClick={() => { setKillConfirm({ proc: p, signal: 'SIGTERM' }); playSound('click') }}
                    title="Terminate (SIGTERM)"
                    style={{ padding: '3px 6px', borderRadius: '5px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#71717a', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--crimson)')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#71717a')}
                  >
                    <Square size={10} />
                  </button>
                  <button
                    onClick={() => { setKillConfirm({ proc: p, signal: 'SIGKILL' }); playSound('click') }}
                    title="Force Kill (SIGKILL)"
                    style={{ padding: '3px 6px', borderRadius: '5px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)', color: '#71717a', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--crimson)')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#71717a')}
                  >
                    <Zap size={10} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
