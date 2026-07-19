import { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, Terminal, Bot, RefreshCw, Trash2, CheckCircle2, XCircle, CalendarDays, X } from 'lucide-react'
import { motion } from 'framer-motion'

interface AuditEntry {
  id: number
  command: string
  exit_code: number | null
  source: string
  session_id: number | null
  created_at: number
}

type Filter = 'all' | 'terminal' | 'ai' | 'failed'

function fmtTime(unix: number): string {
  const d = new Date(unix * 1000)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function dateToUnix(dateStr: string, endOfDay = false): number {
  const d = new Date(dateStr)
  if (endOfDay) { d.setHours(23, 59, 59, 999) }
  return d.getTime() / 1000
}

export default function AuditView() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<Filter>('all')
  const [search, setSearch]   = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [clearConfirm, setClearConfirm] = useState(false)

  const hasDateFilter = dateFrom !== '' || dateTo !== ''

  const load = useCallback(async () => {
    if (!(window as any).electron) return
    setLoading(true)
    const rows = await (window as any).electron.dbGetAuditLog(300)
    setEntries(rows)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const clearAll = async () => {
    setClearConfirm(false)
    await (window as any).electron.dbClearAuditLog()
    setEntries([])
  }

  const filtered = entries.filter(e => {
    if (filter === 'terminal' && e.source !== 'terminal') return false
    if (filter === 'ai'       && e.source !== 'ai')       return false
    if (filter === 'failed'   && (e.exit_code === null || e.exit_code === 0)) return false
    if (search && !e.command.toLowerCase().includes(search.toLowerCase())) return false
    if (dateFrom && e.created_at < dateToUnix(dateFrom)) return false
    if (dateTo   && e.created_at > dateToUnix(dateTo, true)) return false
    return true
  })

  const total    = entries.length
  const succeded = entries.filter(e => e.exit_code === 0).length
  const aiCount  = entries.filter(e => e.source === 'ai').length
  const failed   = entries.filter(e => e.exit_code !== null && e.exit_code !== 0).length

  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: 'all',      label: 'All',      count: total },
    { id: 'terminal', label: 'Terminal', count: entries.filter(e => e.source === 'terminal').length },
    { id: 'ai',       label: 'AI Fix',   count: aiCount },
    { id: 'failed',   label: 'Failed',   count: failed },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'Total Commands', value: total, color: '#f4f4f5' },
          { label: 'Succeeded',      value: succeded, color: 'var(--signal)' },
          { label: 'AI-Executed',    value: aiCount,  color: 'var(--crimson)' },
          { label: 'Failed',         value: failed,   color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="v-card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', color: '#52525b', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontSize: '24px', fontFamily: 'monospace', fontWeight: 'bold', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="v-card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <ShieldCheck size={13} style={{ color: 'var(--signal)' }} />

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                style={{
                  padding: '3px 10px', borderRadius: '6px', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer',
                  background: filter === t.id ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${filter === t.id ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.06)'}`,
                  color: filter === t.id ? 'var(--crimson)' : '#52525b',
                }}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="search commands..."
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '3px 10px', color: '#f4f4f5', fontSize: '11px', fontFamily: 'monospace', outline: 'none', width: '180px' }}
          />

          {/* Date range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <CalendarDays size={11} style={{ color: '#52525b', flexShrink: 0 }} />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '3px 8px', color: dateFrom ? '#f4f4f5' : '#52525b', fontSize: '10px', fontFamily: 'monospace', outline: 'none', width: '118px', colorScheme: 'dark' }}
            />
            <span style={{ color: '#3f3f46', fontSize: '9px', fontFamily: 'monospace' }}>→</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '3px 8px', color: dateTo ? '#f4f4f5' : '#52525b', fontSize: '10px', fontFamily: 'monospace', outline: 'none', width: '118px', colorScheme: 'dark' }}
            />
            {hasDateFilter && (
              <button
                onClick={() => { setDateFrom(''); setDateTo('') }}
                title="Clear date filter"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#52525b', padding: '2px', display: 'flex', alignItems: 'center' }}
              >
                <X size={11} />
              </button>
            )}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
            <button onClick={load} style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#52525b', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <RefreshCw size={10} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            {clearConfirm ? (
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={clearAll} style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--crimson)', fontSize: '9px', fontFamily: 'monospace', cursor: 'pointer' }}>Confirm Clear</button>
                <button onClick={() => setClearConfirm(false)} style={{ padding: '4px 10px', borderRadius: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: '#52525b', fontSize: '9px', fontFamily: 'monospace', cursor: 'pointer' }}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => setClearConfirm(true)} style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#52525b', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Trash2 size={10} /> Clear Log
              </button>
            )}
          </div>
        </div>

        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '160px 70px 50px 1fr', gap: '0 12px', padding: '7px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#3f3f46' }}>
          <span>Time</span><span>Source</span><span>Exit</span><span>Command</span>
        </div>

        <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#3f3f46', fontFamily: 'monospace', fontSize: '11px', fontStyle: 'italic' }}>
              {loading ? 'Loading audit log...' : 'No entries match filter.'}
            </div>
          ) : filtered.map((e, i) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ display: 'grid', gridTemplateColumns: '160px 70px 50px 1fr', gap: '0 12px', padding: '7px 16px', borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '11px', fontFamily: 'monospace', alignItems: 'center', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.003)' }}
            >
              <span style={{ color: '#52525b', fontSize: '9px' }}>{fmtTime(e.created_at)}</span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                {e.source === 'terminal'
                  ? <Terminal size={10} style={{ color: 'var(--signal)' }} />
                  : <Bot size={10} style={{ color: 'var(--crimson)' }} />
                }
                <span style={{ fontSize: '8px', textTransform: 'uppercase', color: e.source === 'terminal' ? 'var(--signal)' : 'var(--crimson)' }}>
                  {e.source === 'terminal' ? 'Term' : 'AI'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center' }}>
                {e.exit_code === null
                  ? <span style={{ fontSize: '9px', color: '#3f3f46' }}>—</span>
                  : e.exit_code === 0
                    ? <CheckCircle2 size={12} style={{ color: 'var(--signal)' }} />
                    : <XCircle size={12} style={{ color: 'var(--crimson)' }} />
                }
                {e.exit_code !== null && e.exit_code !== 0 && (
                  <span style={{ fontSize: '9px', color: 'var(--crimson)', marginLeft: '4px' }}>{e.exit_code}</span>
                )}
              </div>

              <span style={{ color: '#d4d4d8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px' }} title={e.command}>
                {e.command}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
