import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Trash2, Power, Terminal, MonitorPlay, Plus, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { notify } from '../lib/notifications'

interface DesktopEntry {
  filename: string
  path: string
  name: string
  exec: string
  comment: string
  icon: string
  enabled: boolean
}

interface SystemdService {
  unit: string
  active: string
  description: string
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      style={{
        width: '32px', height: '18px', borderRadius: '9px', flexShrink: 0, cursor: 'pointer', border: 'none',
        background: enabled ? 'var(--signal)' : 'rgba(255,255,255,0.08)', position: 'relative', transition: 'background 0.2s',
      }}
    >
      <div style={{
        position: 'absolute', top: '3px', left: enabled ? '17px' : '3px', width: '12px', height: '12px',
        borderRadius: '50%', background: 'white', transition: 'left 0.2s',
      }} />
    </button>
  )
}

export default function StartupView() {
  const [desktopEntries, setDesktopEntries] = useState<DesktopEntry[]>([])
  const [systemdServices, setSystemdServices] = useState<SystemdService[]>([])
  const [loading, setLoading] = useState(false)
  const [pendingPath, setPendingPath] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addName, setAddName] = useState('')
  const [addExec, setAddExec] = useState('')
  const [addComment, setAddComment] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [availableApps, setAvailableApps] = useState<{name: string, exec: string, comment: string}[]>([])

  const load = useCallback(async () => {
    const el = (window as any).electron
    if (!el?.startupList) return
    setLoading(true)
    try {
      const res = await el.startupList()
      setDesktopEntries(res.desktopEntries)
      setSystemdServices(res.systemdServices)
      if (el.appsList) {
        const appsRes = await el.appsList()
        if (appsRes.success) {
          setAvailableApps(appsRes.apps)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [])

  const toggleDesktop = async (entry: DesktopEntry) => {
    const el = (window as any).electron
    const next = !entry.enabled
    setDesktopEntries(prev => prev.map(e => e.path === entry.path ? { ...e, enabled: next } : e))
    const res = await el.startupToggleDesktop({ path: entry.path, enabled: next })
    if (!res.success) {
      setDesktopEntries(prev => prev.map(e => e.path === entry.path ? { ...e, enabled: entry.enabled } : e))
      notify('Error', res.error ?? 'Failed to toggle entry', 'error')
    } else {
      notify('Startup', `${entry.name} ${next ? 'enabled' : 'disabled'}`, 'success')
    }
  }

  const deleteDesktop = async (entry: DesktopEntry) => {
    const el = (window as any).electron
    const res = await el.startupDeleteDesktop(entry.path)
    if (res.success) {
      setDesktopEntries(prev => prev.filter(e => e.path !== entry.path))
      notify('Startup', `Removed ${entry.name}`, 'success')
    } else {
      notify('Error', res.error ?? 'Delete failed', 'error')
    }
    setPendingPath(null)
  }

  const toggleSystemd = async (svc: SystemdService) => {
    const el = (window as any).electron
    const enable = svc.active !== 'enabled'
    const res = await el.startupToggleSystemd({ unit: svc.unit, enable })
    if (res.success) {
      notify('Startup', `${svc.unit} ${enable ? 'enabled' : 'disabled'}`, 'success')
      await load()
    } else {
      notify('Error', res.error ?? 'Failed', 'error')
    }
  }

  const addDesktop = async () => {
    if (!addName.trim() || !addExec.trim()) return
    const el = (window as any).electron
    setAddLoading(true)
    try {
      const res = await el.startupAddDesktop({ name: addName.trim(), exec: addExec.trim(), comment: addComment.trim() || undefined })
      if (res.success) {
        notify('Startup', `Added ${addName.trim()} to autostart`, 'success')
        setAddName(''); setAddExec(''); setAddComment(''); setShowAddForm(false)
        await load()
      } else {
        notify('Error', res.error ?? 'Failed to add entry', 'error')
      }
    } finally {
      setAddLoading(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#52525b',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Power size={14} style={{ color: 'var(--crimson)' }} />
          <span style={{ ...labelStyle, color: '#71717a' }}>
            {desktopEntries.length} autostart entries · {systemdServices.length} user services
          </span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--crimson)', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.5 : 1 }}
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* XDG Desktop Autostart */}
      <div className="v-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MonitorPlay size={13} style={{ color: '#52525b' }} />
          <span style={{ ...labelStyle, flex: 1 }}>XDG Desktop Autostart — ~/.config/autostart/</span>
          <button
            onClick={() => setShowAddForm(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', background: showAddForm ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${showAddForm ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)'}`, color: showAddForm ? 'var(--crimson)' : '#71717a', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer', letterSpacing: '0.1em' }}
          >
            {showAddForm ? <X size={10} /> : <Plus size={10} />}
            {showAddForm ? 'Cancel' : 'Add App'}
          </button>
        </div>

        {desktopEntries.length === 0 && !loading && (
          <div style={{ padding: '24px', color: '#3f3f46', fontFamily: 'monospace', fontSize: '11px', fontStyle: 'italic' }}>
            No desktop autostart entries found.
          </div>
        )}

        <AnimatePresence initial={false}>
          {showAddForm && (
            <motion.div
              key="add-form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
            >
              <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(239,68,68,0.03)' }}>
                <span style={{ ...labelStyle, color: '#52525b' }}>New Autostart Entry</span>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 100%', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '8px', fontFamily: 'monospace', color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Select Existing App (Optional)</span>
                    <select
                      onChange={(e) => {
                        const app = availableApps.find(a => a.name === e.target.value)
                        if (app) {
                          setAddName(app.name)
                          setAddExec(app.exec)
                          setAddComment(app.comment || '')
                        }
                      }}
                      style={{ padding: '6px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#f4f4f5', fontSize: '11px', fontFamily: 'monospace', outline: 'none' }}
                    >
                      <option value="">-- Choose an app --</option>
                      {availableApps.map(app => (
                        <option key={app.name} value={app.name}>{app.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: '1 1 160px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '8px', fontFamily: 'monospace', color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Name *</span>
                    <input
                      value={addName}
                      onChange={e => setAddName(e.target.value)}
                      placeholder="e.g. My App"
                      style={{ padding: '6px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#f4f4f5', fontSize: '11px', fontFamily: 'monospace', outline: 'none' }}
                    />
                  </div>
                  <div style={{ flex: '2 1 240px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '8px', fontFamily: 'monospace', color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Exec Command *</span>
                    <input
                      value={addExec}
                      onChange={e => setAddExec(e.target.value)}
                      placeholder="e.g. /usr/bin/myapp --flag"
                      style={{ padding: '6px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#f4f4f5', fontSize: '11px', fontFamily: 'monospace', outline: 'none' }}
                    />
                  </div>
                  <div style={{ flex: '1 1 160px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '8px', fontFamily: 'monospace', color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Comment</span>
                    <input
                      value={addComment}
                      onChange={e => setAddComment(e.target.value)}
                      placeholder="Optional description"
                      style={{ padding: '6px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#f4f4f5', fontSize: '11px', fontFamily: 'monospace', outline: 'none' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={addDesktop}
                    disabled={addLoading || !addName.trim() || !addExec.trim()}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px', borderRadius: '7px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--crimson)', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: addLoading || !addName.trim() || !addExec.trim() ? 'default' : 'pointer', opacity: addLoading || !addName.trim() || !addExec.trim() ? 0.4 : 1 }}
                  >
                    <Plus size={10} /> Add to Autostart
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {desktopEntries.map(entry => (
            <motion.div
              key={entry.path}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', overflow: 'hidden' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 18px' }}>
                {/* Status dot */}
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, background: entry.enabled ? 'var(--signal)' : '#3f3f46', boxShadow: entry.enabled ? '0 0 5px var(--signal)' : 'none', transition: 'all 0.2s' }} />

                {/* Name + exec */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontFamily: 'monospace', color: entry.enabled ? '#f4f4f5' : '#52525b', fontWeight: 'bold', transition: 'color 0.2s' }}>
                    {entry.name}
                  </div>
                  {entry.comment && (
                    <div style={{ fontSize: '10px', color: '#3f3f46', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.comment}
                    </div>
                  )}
                  <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#3f3f46', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.7 }}>
                    {entry.exec || entry.filename}
                  </div>
                </div>

                {/* Toggle */}
                <Toggle enabled={entry.enabled} onChange={() => toggleDesktop(entry)} />

                {/* Delete */}
                {pendingPath === entry.path ? (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--crimson)' }}>Delete?</span>
                    <button onClick={() => deleteDesktop(entry)} style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--crimson)', fontSize: '9px', fontFamily: 'monospace', cursor: 'pointer' }}>Yes</button>
                    <button onClick={() => setPendingPath(null)} style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#52525b', fontSize: '9px', fontFamily: 'monospace', cursor: 'pointer' }}>No</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setPendingPath(entry.path)}
                    style={{ padding: '5px', borderRadius: '6px', background: 'none', border: '1px solid transparent', color: '#3f3f46', cursor: 'pointer', display: 'flex', transition: 'all 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget).style.borderColor = 'rgba(239,68,68,0.3)'; (e.currentTarget).style.color = 'var(--crimson)' }}
                    onMouseLeave={e => { (e.currentTarget).style.borderColor = 'transparent'; (e.currentTarget).style.color = '#3f3f46' }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* User Systemd Services */}
      <div className="v-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={13} style={{ color: '#52525b' }} />
          <span style={labelStyle}>User Systemd Services — systemctl --user</span>
        </div>

        {systemdServices.length === 0 && !loading && (
          <div style={{ padding: '24px', color: '#3f3f46', fontFamily: 'monospace', fontSize: '11px', fontStyle: 'italic' }}>
            No enabled user systemd services found.
          </div>
        )}

        {systemdServices.map(svc => (
          <div
            key={svc.unit}
            style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}
          >
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, background: svc.active === 'running' ? 'var(--signal)' : '#f59e0b', boxShadow: svc.active === 'running' ? '0 0 5px var(--signal)' : 'none' }} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#f4f4f5', fontWeight: 'bold' }}>
                {svc.unit.replace('.service', '')}
              </div>
              {svc.description && (
                <div style={{ fontSize: '9px', color: '#3f3f46', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {svc.description}
                </div>
              )}
            </div>

            <span style={{ fontSize: '8px', fontFamily: 'monospace', color: '#3f3f46', textTransform: 'uppercase' }}>
              {svc.active}
            </span>

            <button
              onClick={() => toggleSystemd(svc)}
              style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', color: 'var(--crimson)', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Disable
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
