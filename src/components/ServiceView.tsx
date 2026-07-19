import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Search, Play, Square, RotateCcw, ChevronDown, ChevronRight, ScrollText, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { useTheme } from './ThemeProvider'

interface Unit {
  unit: string
  load: string
  active: string
  sub: string
  description: string
}

type Filter = 'all' | 'active' | 'failed' | 'inactive'

const STATUS_COLOR: Record<string, string> = {
  active:   'var(--signal)',
  failed:   'var(--crimson)',
  inactive: '#52525b',
  activating: '#f59e0b',
}

function StatusDot({ active }: { active: string }) {
  const color = STATUS_COLOR[active] ?? '#52525b'
  return (
    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, boxShadow: active === 'active' ? `0 0 5px ${color}` : 'none', flexShrink: 0 }} />
  )
}


export default function ServiceView() {
  const { playSound } = useTheme()
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [logs, setLogs] = useState<Record<string, string>>({})
  const [loadingLogs, setLoadingLogs] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<{ unit: string; ok: boolean; msg: string } | null>(null)

  const loadUnits = useCallback(async () => {
    setLoading(true)
    const data = await (window as any).electron.systemdListUnits()
    setUnits(data)
    setLoading(false)
  }, [])

  useEffect(() => { loadUnits() }, [loadUnits])

  const handleExpand = async (unit: string) => {
    if (expanded === unit) { setExpanded(null); return }
    setExpanded(unit)
    playSound('click')
    if (!logs[unit]) {
      setLoadingLogs(unit)
      const text = await (window as any).electron.systemdUnitLogs({ unit, lines: 60 })
      setLogs(prev => ({ ...prev, [unit]: text }))
      setLoadingLogs(null)
    }
  }

  const handleAction = async (unit: string, action: string) => {
    playSound('click')
    setActionLoading(`${unit}:${action}`)
    const res = await (window as any).electron.systemdControlUnit({ unit, action })
    setActionLoading(null)
    setActionResult({ unit, ok: res.success, msg: res.output || res.error || '' })
    setTimeout(() => setActionResult(null), 3000)
    if (res.success) { playSound('success'); await loadUnits() }
  }

  const filtered = units.filter(u => {
    if (filter === 'active'   && u.active !== 'active')   return false
    if (filter === 'failed'   && u.active !== 'failed')   return false
    if (filter === 'inactive' && u.active !== 'inactive') return false
    if (search && !u.unit.toLowerCase().includes(search.toLowerCase()) &&
        !u.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const counts = {
    all:      units.length,
    active:   units.filter(u => u.active === 'active').length,
    failed:   units.filter(u => u.active === 'failed').length,
    inactive: units.filter(u => u.active === 'inactive').length,
  }

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all',      label: `All (${counts.all})` },
    { id: 'active',   label: `Active (${counts.active})` },
    { id: 'failed',   label: `Failed (${counts.failed})` },
    { id: 'inactive', label: `Inactive (${counts.inactive})` },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Controls */}
      <div className="v-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '6px 12px', flex: 1, minWidth: '200px' }}>
          <Search size={13} style={{ color: '#52525b', flexShrink: 0 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter services..."
            style={{ background: 'transparent', border: 'none', outline: 'none', color: '#f4f4f5', fontSize: '12px', fontFamily: 'monospace', width: '100%' }}
          />
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => { setFilter(f.id); playSound('click') }}
              style={{
                padding: '5px 12px', borderRadius: '8px', border: '1px solid',
                fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer',
                background: filter === f.id ? (f.id === 'failed' ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)') : 'transparent',
                borderColor: filter === f.id ? (f.id === 'failed' ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.2)') : 'rgba(255,255,255,0.06)',
                color: filter === f.id ? (f.id === 'failed' ? 'var(--crimson)' : '#f4f4f5') : '#52525b',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => { loadUnits(); playSound('click') }}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: '#71717a', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer' }}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Action result toast */}
      <AnimatePresence>
        {actionResult && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{ padding: '10px 16px', borderRadius: '10px', fontSize: '11px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '10px', background: actionResult.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${actionResult.ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, color: actionResult.ok ? 'var(--signal)' : 'var(--crimson)' }}
          >
            {actionResult.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
            <span style={{ color: '#a1a1aa' }}>{actionResult.unit}</span>
            <span>{actionResult.msg || (actionResult.ok ? 'OK' : 'Failed')}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '32px', justifyContent: 'center', color: '#52525b', fontFamily: 'monospace', fontSize: '12px' }}>
          <Loader2 size={16} className="animate-spin" />
          Loading systemd units...
        </div>
      ) : (
        <div className="v-card" style={{ overflow: 'hidden', padding: 0 }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '16px 280px 80px 80px 1fr', gap: '0 16px', padding: '8px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#3f3f46' }}>
            <span />
            <span>Unit</span>
            <span>Active</span>
            <span>Sub</span>
            <span>Description</span>
          </div>

          <div style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', color: '#3f3f46', fontFamily: 'monospace', fontSize: '12px', fontStyle: 'italic' }}>
                No services match the current filter.
              </div>
            )}
            {filtered.map((unit, i) => {
              const isExpanded = expanded === unit.unit
              const isActioning = actionLoading?.startsWith(unit.unit + ':')
              return (
                <div key={unit.unit} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  {/* Main row */}
                  <div
                    onClick={() => handleExpand(unit.unit)}
                    style={{
                      display: 'grid', gridTemplateColumns: '16px 280px 80px 80px 1fr', gap: '0 16px',
                      padding: '10px 18px', cursor: 'pointer', transition: 'background 0.15s',
                      background: isExpanded ? 'rgba(255,255,255,0.02)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.005)',
                      alignItems: 'center',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = isExpanded ? 'rgba(255,255,255,0.02)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.005)')}
                  >
                    <span style={{ color: '#52525b', display: 'flex' }}>
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </span>
                    <span style={{ fontSize: '12px', fontFamily: 'monospace', color: unit.active === 'failed' ? 'var(--crimson)' : '#e4e4e7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {unit.unit.replace('.service', '')}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <StatusDot active={unit.active} />
                      <span style={{ fontSize: '10px', fontFamily: 'monospace', color: STATUS_COLOR[unit.active] ?? '#52525b' }}>{unit.active}</span>
                    </div>
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#52525b' }}>{unit.sub}</span>
                    <span style={{ fontSize: '11px', color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{unit.description}</span>
                  </div>

                  {/* Expanded panel */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.04)' }}
                      >
                        <div style={{ padding: '14px 18px 14px 50px' }}>
                          {/* Actions */}
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                            {[
                              { action: 'start',   icon: Play,       color: 'var(--signal)',  show: unit.active !== 'active' },
                              { action: 'stop',    icon: Square,     color: 'var(--crimson)', show: unit.active === 'active' },
                              { action: 'restart', icon: RotateCcw,  color: '#f59e0b',        show: true },
                              { action: 'enable',  icon: CheckCircle2, color: 'var(--signal)', show: true },
                              { action: 'disable', icon: XCircle,    color: '#71717a',        show: true },
                            ].filter(a => a.show).map(({ action, icon: Icon, color }) => {
                              const key = `${unit.unit}:${action}`
                              return (
                                <button
                                  key={action}
                                  onClick={e => { e.stopPropagation(); handleAction(unit.unit, action) }}
                                  disabled={isActioning}
                                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '7px', border: `1px solid ${color}30`, background: `${color}0d`, color, fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer', opacity: isActioning ? 0.5 : 1 }}
                                >
                                  {actionLoading === key ? <Loader2 size={10} className="animate-spin" /> : <Icon size={10} />}
                                  {action}
                                </button>
                              )
                            })}
                            <button
                              onClick={e => { e.stopPropagation(); setLogs(prev => ({ ...prev, [unit.unit]: '' })); handleExpand(unit.unit); handleExpand(unit.unit) }}
                              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: '#52525b', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer', marginLeft: 'auto' }}
                            >
                              <RefreshCw size={10} />
                              Refresh Logs
                            </button>
                          </div>

                          {/* Logs */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#3f3f46', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            <ScrollText size={11} />
                            Journal (last 60 lines)
                          </div>
                          {loadingLogs === unit.unit ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#52525b', fontSize: '11px', fontFamily: 'monospace' }}>
                              <Loader2 size={12} className="animate-spin" /> Fetching logs...
                            </div>
                          ) : (
                            <pre style={{ margin: 0, fontSize: '10px', fontFamily: 'monospace', color: '#71717a', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '220px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                              {logs[unit.unit] || '(no logs)'}
                            </pre>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
