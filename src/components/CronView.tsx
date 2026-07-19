import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Save, RefreshCw, Clock, Pencil, Check } from 'lucide-react'
import { notify } from '../lib/notifications'

interface CronEntry {
  id: string
  min: string
  hour: string
  dom: string
  month: string
  dow: string
  command: string
  comment: string
}

const PRESETS = [
  { label: '@reboot', schedule: '@reboot', title: 'On Reboot' },
  { label: 'Every minute', schedule: '* * * * *', title: 'Every Minute' },
  { label: 'Hourly', schedule: '0 * * * *', title: 'Every Hour' },
  { label: 'Daily 2am', schedule: '0 2 * * *', title: 'Daily 2 AM' },
  { label: 'Weekly Sun', schedule: '0 3 * * 0', title: 'Weekly Sunday 3 AM' },
  { label: 'Monthly 1st', schedule: '0 4 1 * *', title: '1st of Month 4 AM' },
]

function uid() { return Math.random().toString(36).slice(2, 9) }

function humanSchedule(e: CronEntry): string {
  if (e.min.startsWith('@')) return e.min
  if (e.min === '*' && e.hour === '*' && e.dom === '*' && e.month === '*' && e.dow === '*') return 'Every minute'
  if (e.min !== '*' && e.hour !== '*' && e.dom === '*' && e.month === '*' && e.dow === '*') return `Daily at ${e.hour}:${e.min.padStart(2,'0')}`
  if (e.min !== '*' && e.hour !== '*' && e.dom === '*' && e.month === '*' && e.dow !== '*') {
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    return `${days[parseInt(e.dow)] ?? e.dow} at ${e.hour}:${e.min.padStart(2,'0')}`
  }
  return `${e.min} ${e.hour} ${e.dom} ${e.month} ${e.dow}`
}

function newEntry(): CronEntry {
  return { id: uid(), min: '0', hour: '2', dom: '*', month: '*', dow: '*', command: '', comment: '' }
}

function EntryRow({ entry, onUpdate, onDelete }: {
  entry: CronEntry
  onUpdate: (e: CronEntry) => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  const field = (key: keyof CronEntry, label: string, w = '60px') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <label style={{ fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4b5563' }}>{label}</label>
      <input
        value={entry[key] as string}
        onChange={e => onUpdate({ ...entry, [key]: e.target.value })}
        style={{ width: w, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '5px', padding: '4px 6px', fontSize: '11px', fontFamily: 'monospace', color: '#e2e8f0', boxSizing: 'border-box' }}
      />
    </div>
  )

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px' }}>
        <Clock size={13} style={{ color: '#52525b', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', color: '#e2e8f0', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.command || <span style={{ color: '#4b5563', fontStyle: 'italic' }}>no command</span>}
          </div>
          <div style={{ fontSize: '10px', color: '#52525b', marginTop: '1px' }}>
            {humanSchedule(entry)}{entry.comment ? ` — ${entry.comment}` : ''}
          </div>
        </div>
        <button onClick={() => setExpanded(p => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', padding: '3px' }}>
          <Pencil size={12} />
        </button>
        <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', padding: '3px' }}>
          <Trash2 size={12} />
        </button>
      </div>

      {expanded && (
        <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Preset chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => {
                  const parts = p.schedule.split(' ')
                  if (parts.length === 1) onUpdate({ ...entry, min: p.schedule })
                  else onUpdate({ ...entry, min: parts[0], hour: parts[1], dom: parts[2], month: parts[3], dow: parts[4] })
                }}
                style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '9px', fontFamily: 'monospace', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: '#f87171', cursor: 'pointer' }}
              >
                {p.label}
              </button>
            ))}
          </div>
          {/* Schedule fields */}
          {!entry.min.startsWith('@') && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {field('min', 'Minute')}
              {field('hour', 'Hour')}
              {field('dom', 'Day/Mo')}
              {field('month', 'Month')}
              {field('dow', 'Day/Wk')}
            </div>
          )}
          {/* Command */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4b5563' }}>Command</label>
            <input
              value={entry.command}
              onChange={e => onUpdate({ ...entry, command: e.target.value })}
              placeholder="/usr/bin/some-script.sh"
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '5px', padding: '5px 8px', fontSize: '11px', fontFamily: 'monospace', color: '#e2e8f0' }}
            />
          </div>
          {/* Comment */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4b5563' }}>Label (optional)</label>
            <input
              value={entry.comment}
              onChange={e => onUpdate({ ...entry, comment: e.target.value })}
              placeholder="e.g. Weekly backup"
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '5px', padding: '5px 8px', fontSize: '11px', fontFamily: 'monospace', color: '#e2e8f0' }}
            />
          </div>
          <button onClick={() => setExpanded(false)} style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: '6px', fontSize: '10px', fontFamily: 'monospace', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399', cursor: 'pointer' }}>
            <Check size={11} /> Done
          </button>
        </div>
      )}
    </div>
  )
}

export default function CronView() {
  const [entries, setEntries] = useState<CronEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await (window as any).electron.cronList()
    if (res.success) setEntries(res.entries)
    setLoading(false)
    setDirty(false)
  }, [])

  useEffect(() => { load() }, [load])

  const update = (id: string, updated: CronEntry) => {
    setEntries(prev => prev.map(e => e.id === id ? updated : e))
    setDirty(true)
  }

  const remove = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id))
    setDirty(true)
  }

  const addEntry = () => {
    setEntries(prev => [...prev, newEntry()])
    setDirty(true)
  }

  const save = async () => {
    setSaving(true)
    const res = await (window as any).electron.cronSave({ entries })
    setSaving(false)
    if (res.success) {
      notify('Cron', 'Crontab saved successfully', 'success')
      setDirty(false)
    } else {
      notify('Cron', `Save failed: ${res.error}`, 'error')
    }
  }

  return (
    <div style={{ maxWidth: '700px' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#52525b', fontFamily: 'monospace', marginTop: '4px' }}>
            {loading ? 'Loading...' : `${entries.length} job${entries.length !== 1 ? 's' : ''} in user crontab`}
            {dirty && <span style={{ color: '#f59e0b', marginLeft: '8px' }}>● Unsaved changes</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '7px', fontSize: '10px', fontFamily: 'monospace', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#71717a', cursor: 'pointer' }}>
            <RefreshCw size={11} /> Reload
          </button>
          <button onClick={addEntry} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '7px', fontSize: '10px', fontFamily: 'monospace', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', cursor: 'pointer' }}>
            <Plus size={11} /> New Job
          </button>
          <button
            onClick={save}
            disabled={!dirty || saving}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '7px', fontSize: '10px', fontFamily: 'monospace', fontWeight: 600, background: dirty ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${dirty ? 'rgba(34,211,238,0.3)' : 'rgba(255,255,255,0.06)'}`, color: dirty ? '#22d3ee' : '#3f3f46', cursor: dirty ? 'pointer' : 'default' }}
          >
            <Save size={11} /> {saving ? 'Saving...' : 'Save Crontab'}
          </button>
        </div>
      </div>

      {/* Cron reference */}
      <div style={{ marginBottom: '16px', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', fontFamily: 'monospace', fontSize: '10px', color: '#4b5563' }}>
        Format: <span style={{ color: '#6b7280' }}>MIN HOUR DAY/MO MONTH DAY/WK COMMAND</span>
        &nbsp;·&nbsp; <span style={{ color: '#6b7280' }}>* = any &nbsp; */n = every n &nbsp; @reboot @hourly @daily @weekly @monthly</span>
      </div>

      {/* Entry list */}
      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', fontSize: '12px', color: '#3f3f46', fontFamily: 'monospace' }}>Loading crontab…</div>
      ) : entries.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', fontSize: '13px', color: '#3f3f46', fontStyle: 'italic', border: '2px dashed rgba(255,255,255,0.05)', borderRadius: '10px' }}>
          No cron jobs found.<br />
          <span style={{ fontSize: '11px' }}>Click "New Job" to add your first scheduled task.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {entries.map(e => (
            <EntryRow key={e.id} entry={e} onUpdate={u => update(e.id, u)} onDelete={() => remove(e.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
