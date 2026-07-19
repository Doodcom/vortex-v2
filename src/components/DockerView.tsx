import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Container, Play, Square, RotateCcw, ScrollText, Box, Search, RefreshCw, AlertCircle, Cpu, MemoryStick } from 'lucide-react'
import { notify } from '../lib/notifications'
import { useTheme } from './ThemeProvider'

interface DockerContainer {
  id: string
  name: string
  image: string
  state: string
  status: string
  cpu_percent: number
  mem_usage: number
  mem_limit: number
  net_io: { rx: number; tx: number }
}

export default function DockerView() {
  const { playSound } = useTheme()
  const [containers, setContainers] = useState<DockerContainer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selectedLogs, setSelectedLogs] = useState<{ id: string; name: string; content: string } | null>(null)

  const fetchContainers = useCallback(async () => {
    if (!(window as any).electron?.dockerList) return
    const res = await (window as any).electron.dockerList()
    if (res.error) {
      setError(res.error)
      setContainers([])
    } else {
      setError(null)
      setContainers(res)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchContainers()
    if (autoRefresh) {
      const id = setInterval(fetchContainers, 4000)
      return () => clearInterval(id)
    }
  }, [fetchContainers, autoRefresh])

  const handleControl = async (id: string, action: 'start' | 'stop' | 'restart') => {
    playSound('click')
    const res = await (window as any).electron.dockerControl({ id, action })
    if (res.success) {
      notify('Docker', `Container ${action} successful`, 'success')
      fetchContainers()
    } else {
      notify('Docker', `Failed to ${action}: ${res.error}`, 'error')
    }
  }

  const showLogs = async (id: string, name: string) => {
    playSound('click')
    const logs = await (window as any).electron.dockerLogs({ id, lines: 100 })
    setSelectedLogs({ id, name, content: logs })
  }

  const filtered = containers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.image.toLowerCase().includes(search.toLowerCase())
  )

  const totalCpu = containers.reduce((s, c) => s + c.cpu_percent, 0)
  const totalMem = containers.reduce((s, c) => s + c.mem_usage, 0)

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: '16px' }}>
        <AlertCircle size={48} style={{ color: 'var(--crimson)', opacity: 0.5 }} />
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#f4f4f5', margin: '0 0 8px' }}>Docker Error</h2>
          <p style={{ fontSize: '12px', color: '#71717a', fontFamily: 'monospace', maxWidth: '400px' }}>{error}</p>
        </div>
        <button 
          onClick={() => { setLoading(true); fetchContainers(); }}
          style={{ padding: '8px 24px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--crimson)', fontSize: '11px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer' }}
        >
          Retry Connection
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Summary Header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <SummaryCard icon={Box} label="Active Containers" value={containers.filter(c => c.state === 'running').length.toString()} sub={`of ${containers.length} total`} />
        <SummaryCard icon={Cpu} label="Cumulative CPU" value={`${totalCpu.toFixed(1)}%`} sub="Combined load" />
        <SummaryCard icon={MemoryStick} label="Total RAM" value={`${(totalMem / 1024 / 1024).toFixed(0)} MB`} sub="Allocated memory" />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#52525b' }} />
          <input
            type="text"
            placeholder="Search containers or images..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px 16px 10px 38px', color: '#f4f4f5', fontSize: '13px', outline: 'none' }}
          />
        </div>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '10px', background: autoRefresh ? 'rgba(34,211,238,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${autoRefresh ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.06)'}`, color: autoRefresh ? 'var(--signal)' : '#52525b', fontSize: '11px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer' }}
        >
          <RefreshCw size={14} className={autoRefresh && !loading ? 'animate-spin' : ''} style={{ animationDuration: '3s' }} />
          {autoRefresh ? 'Live' : 'Paused'}
        </button>
      </div>

      {/* Container List */}
      <div className="v-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'monospace' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <th style={{ textAlign: 'left', padding: '12px 20px', color: '#52525b', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.1em' }}>Container / Image</th>
              <th style={{ textAlign: 'left', padding: '12px 20px', color: '#52525b', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.1em' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '12px 20px', color: '#52525b', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.1em' }}>CPU / RAM</th>
              <th style={{ textAlign: 'right', padding: '12px 20px', color: '#52525b', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.1em' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {filtered.map(c => (
                <motion.tr
                  key={c.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', background: 'transparent' }}
                  className="hover:bg-white/[0.01] transition-colors"
                >
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Container size={16} style={{ color: c.state === 'running' ? 'var(--signal)' : '#3f3f46' }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 'bold', color: '#f4f4f5' }}>{c.name}</div>
                        <div style={{ fontSize: '10px', color: '#52525b', marginTop: '2px' }}>{c.image}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: c.state === 'running' ? 'var(--signal)' : c.state === 'exited' ? 'var(--crimson)' : '#52525b', boxShadow: c.state === 'running' ? '0 0 8px var(--signal)' : 'none' }} />
                      <span style={{ textTransform: 'uppercase', fontSize: '10px', color: c.state === 'running' ? '#f4f4f5' : '#71717a' }}>{c.status}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '120px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                        <span style={{ color: '#52525b' }}>CPU</span>
                        <span style={{ color: c.cpu_percent > 50 ? 'var(--crimson)' : '#a1a1aa' }}>{c.cpu_percent.toFixed(1)}%</span>
                      </div>
                      <div style={{ height: '2px', background: 'rgba(255,255,255,0.05)', borderRadius: '1px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(c.cpu_percent, 100)}%`, background: 'var(--signal)' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                        <span style={{ color: '#52525b' }}>RAM</span>
                        <span style={{ color: '#a1a1aa' }}>{(c.mem_usage / 1024 / 1024).toFixed(0)}MB</span>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <ActionButton icon={ScrollText} color="#71717a" onClick={() => showLogs(c.id, c.name)} title="View Logs" />
                      {c.state === 'running' ? (
                        <>
                          <ActionButton icon={RotateCcw} color="#f59e0b" onClick={() => handleControl(c.id, 'restart')} title="Restart" />
                          <ActionButton icon={Square} color="var(--crimson)" onClick={() => handleControl(c.id, 'stop')} title="Stop" />
                        </>
                      ) : (
                        <ActionButton icon={Play} color="var(--signal)" onClick={() => handleControl(c.id, 'start')} title="Start" />
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Logs Modal */}
      <AnimatePresence>
        {selectedLogs && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}
            onClick={() => setSelectedLogs(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="v-card"
              style={{ width: '100%', maxWidth: '900px', height: '80vh', display: 'flex', flexDirection: 'column', padding: 0 }}
            >
              <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <ScrollText size={18} style={{ color: 'var(--signal)' }} />
                  <span style={{ fontSize: '13px', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Logs: {selectedLogs.name}</span>
                </div>
                <button onClick={() => setSelectedLogs(null)} style={{ background: 'none', border: 'none', color: '#52525b', cursor: 'pointer' }}>
                  <Square size={16} />
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: 'rgba(0,0,0,0.3)', fontFamily: 'monospace', fontSize: '12px', color: '#a1a1aa', whiteSpace: 'pre-wrap' }}>
                {selectedLogs.content || 'No logs available.'}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value, sub }: any) {
  return (
    <div className="v-card" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <Icon size={14} style={{ color: '#52525b' }} />
        <span style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#52525b' }}>{label}</span>
      </div>
      <div style={{ fontSize: '24px', fontWeight: '900', color: '#f4f4f5', marginBottom: '4px' }}>{value}</div>
      <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#3f3f46' }}>{sub}</div>
    </div>
  )
}

function ActionButton({ icon: Icon, color, onClick, title }: any) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{ padding: '6px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: color, cursor: 'pointer', display: 'flex', transition: 'all 0.15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLButtonElement).style.borderColor = color; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.02)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.05)'; }}
    >
      <Icon size={14} />
    </button>
  )
}
