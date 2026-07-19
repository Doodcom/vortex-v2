import { useState, useEffect, useRef, useCallback } from 'react'
import { Wifi, ArrowDown, ArrowUp, RefreshCw, Activity } from 'lucide-react'
import { motion } from 'framer-motion'

interface NetStat {
  iface: string; rx_sec: number; tx_sec: number
  rx_bytes: number; tx_bytes: number
  operstate: string; ip4: string; mac: string; type: string
}
interface Connection {
  protocol: string; localaddr: string; localport: string
  peeraddr: string; peerport: string; state: string
  pid: number; process: string
}

const HISTORY_LEN = 30

function fmtSpeed(bps: number): string {
  if (bps > 1_000_000) return `${(bps / 1_000_000).toFixed(1)} MB/s`
  if (bps > 1_000)     return `${(bps / 1_000).toFixed(0)} KB/s`
  return `${Math.round(bps)} B/s`
}
function fmtBytes(b: number): string {
  if (b > 1e9) return `${(b / 1e9).toFixed(2)} GB`
  if (b > 1e6) return `${(b / 1e6).toFixed(1)} MB`
  return `${(b / 1e3).toFixed(0)} KB`
}

function Sparkline({ data, color, max }: { data: number[]; color: string; max: number }) {
  const W = 80, H = 28
  if (data.length < 2) return <div style={{ width: W, height: H }} />
  const peak = max || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - (v / peak) * (H - 2) - 1
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={(data.length - 1) / (data.length - 1) * W} cy={H - (data[data.length - 1] / peak) * (H - 2) - 1} r="2.5" fill={color} />
    </svg>
  )
}

const STATE_COLOR: Record<string, string> = {
  ESTABLISHED: 'var(--signal)', LISTEN: '#3b8eea',
  TIME_WAIT: '#f59e0b', SYN_SENT: '#f59e0b', FIN_WAIT1: '#71717a',
}

export default function NetworkView() {
  const [stats, setStats] = useState<NetStat[]>([])
  const [conns, setConns] = useState<Connection[]>([])
  const [history, setHistory] = useState<Record<string, { rx: number[]; tx: number[] }>>({})
  const [connSearch, setConnSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStats = useCallback(async () => {
    if (!(window as any).electron) return
    const data: NetStat[] = await (window as any).electron.networkStats()
    setStats(data)
    setHistory(prev => {
      const next = { ...prev }
      data.forEach(s => {
        const h = next[s.iface] ?? { rx: [], tx: [] }
        next[s.iface] = {
          rx: [...h.rx, s.rx_sec].slice(-HISTORY_LEN),
          tx: [...h.tx, s.tx_sec].slice(-HISTORY_LEN),
        }
      })
      return next
    })
    setLoading(false)
  }, [])

  const fetchConns = useCallback(async () => {
    if (!(window as any).electron) return
    const data = await (window as any).electron.networkConnections()
    setConns(data)
  }, [])

  useEffect(() => {
    fetchStats(); fetchConns()
    intervalRef.current = setInterval(() => { fetchStats(); fetchConns() }, 2000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchStats, fetchConns])

  const filteredConns = conns.filter(c =>
    !connSearch ||
    c.process?.toLowerCase().includes(connSearch.toLowerCase()) ||
    c.peeraddr?.includes(connSearch) ||
    c.localport?.includes(connSearch) ||
    String(c.pid)?.includes(connSearch)
  )

  const safeMax = (arr: number[]) => arr.length ? Math.max(...arr) : 0
  const peakRx = Math.max(...stats.map(s => safeMax(history[s.iface]?.rx ?? [])), 1)
  const peakTx = Math.max(...stats.map(s => safeMax(history[s.iface]?.tx ?? [])), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Interface cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {loading && stats.length === 0 && (
          <div className="v-card" style={{ padding: '24px', color: '#52525b', fontFamily: 'monospace', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <RefreshCw size={14} className="animate-spin" /> Scanning interfaces...
          </div>
        )}
        {stats.map(s => (
          <motion.div key={s.iface} className="v-card" style={{ padding: '16px 20px' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Wifi size={14} style={{ color: 'var(--signal)' }} />
                <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: '#f4f4f5' }}>{s.iface}</span>
                <span style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', color: '#3f3f46' }}>{s.type}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--signal)', boxShadow: '0 0 4px var(--signal)' }} />
                <span style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--signal)', textTransform: 'uppercase' }}>up</span>
              </div>
            </div>

            {/* IP + MAC */}
            {s.ip4 && <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#52525b', marginBottom: '14px' }}>{s.ip4} · {s.mac}</div>}

            {/* RX / TX sparklines */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* RX */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                  <ArrowDown size={11} style={{ color: 'var(--signal)' }} />
                  <span style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', color: '#52525b' }}>RX</span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--signal)', marginLeft: 'auto' }}>{fmtSpeed(s.rx_sec)}</span>
                </div>
                <Sparkline data={history[s.iface]?.rx ?? [0]} color="var(--signal)" max={peakRx} />
                <div style={{ fontSize: '8px', color: '#3f3f46', fontFamily: 'monospace', marginTop: '4px' }}>Total: {fmtBytes(s.rx_bytes)}</div>
              </div>
              {/* TX */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                  <ArrowUp size={11} style={{ color: 'var(--crimson)' }} />
                  <span style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', color: '#52525b' }}>TX</span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--crimson)', marginLeft: 'auto' }}>{fmtSpeed(s.tx_sec)}</span>
                </div>
                <Sparkline data={history[s.iface]?.tx ?? [0]} color="var(--crimson)" max={peakTx} />
                <div style={{ fontSize: '8px', color: '#3f3f46', fontFamily: 'monospace', marginTop: '4px' }}>Total: {fmtBytes(s.tx_bytes)}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Active connections */}
      <div className="v-card" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={13} style={{ color: 'var(--crimson)' }} />
            <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a1a1aa' }}>
              Active Connections ({filteredConns.length})
            </span>
          </div>
          <input
            value={connSearch}
            onChange={e => setConnSearch(e.target.value)}
            placeholder="filter process / port / ip..."
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '4px 10px', color: '#f4f4f5', fontSize: '11px', fontFamily: 'monospace', outline: 'none', width: '220px' }}
          />
        </div>

        {/* Connections header */}
        <div style={{ display: 'grid', gridTemplateColumns: '60px 80px 180px 180px 100px 120px', gap: '0 10px', padding: '7px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#3f3f46' }}>
          <span>Proto</span><span>PID</span><span>Local</span><span>Remote</span><span>State</span><span>Process</span>
        </div>

        <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
          {filteredConns.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#3f3f46', fontFamily: 'monospace', fontSize: '11px', fontStyle: 'italic' }}>No connections match filter.</div>
          ) : (
            filteredConns.map((c, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 80px 180px 180px 100px 120px', gap: '0 10px', padding: '6px 18px', borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '11px', fontFamily: 'monospace', alignItems: 'center', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.003)' }}>
                <span style={{ color: '#52525b', textTransform: 'uppercase', fontSize: '9px' }}>{c.protocol}</span>
                <span style={{ color: '#52525b' }}>{c.pid || '—'}</span>
                <span style={{ color: '#a1a1aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${c.localaddr}:${c.localport}`}>{c.localaddr}:{c.localport}</span>
                <span style={{ color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${c.peeraddr}:${c.peerport}`}>{c.peeraddr || '*'}:{c.peerport || '*'}</span>
                <span style={{ fontSize: '9px', textTransform: 'uppercase', color: STATE_COLOR[c.state] ?? '#52525b' }}>{c.state}</span>
                <span style={{ color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.process || '—'}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
