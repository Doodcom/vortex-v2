import { useState, useEffect, useRef } from 'react'
import { Bell, CheckCircle2, XCircle, AlertTriangle, Info, X, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { VortexNotification } from '../lib/notifications'

const TYPE_ICON: Record<string, any> = {
  success: CheckCircle2,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
}
const TYPE_COLOR: Record<string, string> = {
  success: '#10b981', // emerald
  error:   '#ef4444', // crimson
  warning: '#f59e0b', // amber
  info:    '#71717a', // zinc
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60)  return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

export default function NotificationCentre() {
  const [notes, setNotes] = useState<VortexNotification[]>(() => {
    try {
      const saved = localStorage.getItem('vortex-notifications')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [open, setOpen] = useState(false)
  const [, setTick] = useState(0)
  const [newCount, setNewCount] = useState(() => {
    try {
      return parseInt(localStorage.getItem('vortex-unread-count') || '0', 10)
    } catch { return 0 }
  })
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Persist state
  useEffect(() => {
    localStorage.setItem('vortex-notifications', JSON.stringify(notes))
    localStorage.setItem('vortex-unread-count', newCount.toString())
  }, [notes, newCount])

  // Receive notifications
  useEffect(() => {
    const handler = (e: Event) => {
      const n = (e as CustomEvent).detail as VortexNotification
      setNotes(prev => [n, ...prev].slice(0, 50))
      // Use functional state update to safely increment count
      setOpen((currentOpen) => {
        if (!currentOpen) {
          setNewCount(c => c + 1)
        }
        return currentOpen
      })
    }
    window.addEventListener('vortex-notify', handler)

    const ipcHandler = (_event: any, data: any) => {
      const n: VortexNotification = {
        id: Math.random().toString(36).substring(2, 11) + Date.now(),
        title: data.title,
        message: data.message,
        type: data.type,
        timestamp: data.timestamp || Date.now()
      }
      window.dispatchEvent(new CustomEvent('vortex-notify', { detail: n }))
    }

    if ((window as any).electron?.on) {
      ;(window as any).electron.on('vortex-notify', ipcHandler)
    }

    return () => {
      window.removeEventListener('vortex-notify', handler)
      if ((window as any).electron?.off) {
        ;(window as any).electron.off('vortex-notify', ipcHandler)
      }
    }
  }, [])

  // Time ticker
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = () => {
    if (!open) setNewCount(0)
    setOpen(!open)
  }

  const clearAll = () => {
    setNotes([])
    setNewCount(0)
  }

  return (
    <div style={{ position: 'relative' }} className="no-drag">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={handleOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: open ? 'rgba(244, 63, 94, 0.1)' : 'transparent',
          border: `1px solid ${open ? 'rgba(244, 63, 94, 0.3)' : 'transparent'}`,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          color: newCount > 0 ? '#f43f5e' : '#94a3b8',
          position: 'relative'
        }}
      >
        <Bell size={14} />
        {newCount > 0 && (
          <div style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            background: '#f43f5e',
            color: 'white',
            fontSize: '9px',
            fontWeight: 'bold',
            height: '14px',
            minWidth: '14px',
            padding: '0 4px',
            borderRadius: '7px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 8px rgba(244, 63, 94, 0.6)'
          }}>
            {newCount > 9 ? '9+' : newCount}
          </div>
        )}
      </button>

      {/* Redesigned Dropdown Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 12px)',
              right: 0,
              width: '340px',
              background: 'rgba(10, 15, 26, 0.98)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)',
              zIndex: 9999,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              textAlign: 'left'
            }}
          >
            {/* Header */}
            <div style={{
              padding: '16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255, 255, 255, 0.02)'
            }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.05em', color: '#f8fafc', textTransform: 'uppercase' }}>
                System Notifications
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                {notes.length > 0 && (
                  <button onClick={clearAll} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase' }}>
                    <Trash2 size={12} /> Clear
                  </button>
                )}
                <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* List */}
            <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
              {notes.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                  No notifications to display.
                </div>
              ) : (
                notes.map(n => {
                  const Icon = TYPE_ICON[n.type] ?? Info
                  const color = TYPE_COLOR[n.type] ?? '#94a3b8'
                  return (
                    <div key={n.id} style={{
                      padding: '14px 16px',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start',
                      transition: 'background 0.2s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ marginTop: '2px' }}>
                        <Icon size={16} style={{ color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#f8fafc', marginBottom: '4px' }}>{n.title}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.5 }}>{n.message}</div>
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {timeAgo(n.timestamp)}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
