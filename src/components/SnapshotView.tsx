import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, RotateCcw, Trash2, RefreshCw, Plus, AlertTriangle, CheckCircle2, AlertCircle, Clock, HardDrive, Sliders } from 'lucide-react'

interface Snapshot {
  id: string
  type: string
  date: string
  description: string
  usedSpace: string
}

type Op = { kind: 'delete' | 'rollback'; id: string }

const TYPE_COLOR: Record<string, string> = {
  single:   '#6366f1',
  pre:      '#f59e0b',
  post:     '#10b981',
  timeline: '#3b82f6',
}

export default function SnapshotView() {
  const [activeTab, setActiveTab] = useState<'snapshots' | 'maintenance'>('snapshots')

  // Snapshots states
  const [snapshots, setSnapshots]     = useState<Snapshot[]>([])
  const [loading, setLoading]         = useState(true)
  const [notAvailable, setNotAvailable] = useState(false)
  const [createDesc, setCreateDesc]   = useState('')
  const [creating, setCreating]       = useState(false)
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null)
  const [pending, setPending]         = useState<Op | null>(null)
  const [busy, setBusy]               = useState<string | null>(null)

  // BTRFS Maintenance States
  const [btrfsUsage, setBtrfsUsage] = useState<{ dataAlloc: number; metaAlloc: number; unallocated: number } | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [scrubStatus, setScrubStatus] = useState('')
  const [scrubProgress, setScrubProgress] = useState<number | undefined>(undefined)
  const [scrubErrors, setScrubErrors] = useState(0)
  const [scrubLoading, setScrubLoading] = useState(false)
  
  const [balanceStatus, setBalanceStatus] = useState('')
  const [dusage, setDusage] = useState(50)
  const [musage, setMusage] = useState(50)
  const [balanceLoading, setBalanceLoading] = useState(false)

  const [defragPath, setDefragPath] = useState('/')
  const [defragLoading, setDefragLoading] = useState(false)

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    if (!(window as any).electron) return
    setLoading(true)
    const res = await window.electron.systemSnapperList()
    if (!res.success) {
      setNotAvailable(true)
    } else {
      setNotAvailable(false)
      setSnapshots(res.snapshots.filter(s => s.id !== '0'))
    }
    setLoading(false)
  }, [])

  const loadBtrfsData = useCallback(async () => {
    if (!(window as any).electron) return
    setUsageLoading(true)
    const usageRes = await window.electron.btrfsUsage()
    if (usageRes.success) {
      setBtrfsUsage({
        dataAlloc: usageRes.dataAlloc,
        metaAlloc: usageRes.metaAlloc,
        unallocated: usageRes.unallocated
      })
    }
    setUsageLoading(false)

    // Load Scrub status
    const scrubRes = await window.electron.btrfsScrub('status')
    if (scrubRes.success) {
      setScrubStatus(scrubRes.status || '')
      setScrubProgress(scrubRes.progress)
      setScrubErrors(scrubRes.errors || 0)
    }

    // Load Balance status
    const balanceRes = await window.electron.btrfsBalance('status')
    if (balanceRes.success) {
      setBalanceStatus(balanceRes.status || '')
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'snapshots') {
      load()
    } else {
      loadBtrfsData()
    }
  }, [activeTab, load, loadBtrfsData])

  const handleCreate = async () => {
    const desc = createDesc.trim() || 'Manual snapshot'
    setCreating(true)
    const res = await window.electron.systemSnapperCreate({ description: desc })
    setCreating(false)
    if (res.success) {
      showToast(`Snapshot #${res.id} created`, true)
      setCreateDesc('')
      await load()
    } else {
      showToast(res.error ?? 'Create failed', false)
    }
  }

  const handleDelete = async (id: string) => {
    setPending(null)
    setBusy(id)
    const res = await window.electron.systemSnapperDelete({ id })
    setBusy(null)
    if (res.success) {
      setSnapshots(prev => prev.filter(s => s.id !== id))
      showToast(`Snapshot #${id} deleted`, true)
    } else {
      showToast(res.error ?? 'Delete failed', false)
    }
  }

  const handleRollback = async (id: string) => {
    setPending(null)
    setBusy(id)
    const res = await window.electron.systemSnapperRollback({ id })
    setBusy(null)
    if (res.success) {
      showToast(`Rollback to #${id} queued — reboot to apply`, true)
    } else {
      showToast(res.error ?? 'Rollback failed', false)
    }
  }

  const handleScrubStart = async () => {
    setScrubLoading(true)
    const res = await window.electron.btrfsScrub('start')
    setScrubLoading(false)
    if (res.success) {
      showToast('Scrub started', true)
      await loadBtrfsData()
    } else {
      showToast(res.error || 'Failed to start scrub', false)
    }
  }

  const handleScrubCancel = async () => {
    setScrubLoading(true)
    const res = await window.electron.btrfsScrub('cancel')
    setScrubLoading(false)
    if (res.success) {
      showToast('Scrub cancelled', true)
      await loadBtrfsData()
    } else {
      showToast(res.error || 'Failed to cancel scrub', false)
    }
  }

  const handleBalanceStart = async () => {
    setBalanceLoading(true)
    const res = await window.electron.btrfsBalance('start', dusage, musage)
    setBalanceLoading(false)
    if (res.success) {
      showToast('Balance started', true)
      await loadBtrfsData()
    } else {
      showToast(res.error || 'Failed to start balance', false)
    }
  }

  const handleBalanceCancel = async () => {
    setBalanceLoading(true)
    const res = await window.electron.btrfsBalance('cancel')
    setBalanceLoading(false)
    if (res.success) {
      showToast('Balance cancelled', true)
      await loadBtrfsData()
    } else {
      showToast(res.error || 'Failed to cancel balance', false)
    }
  }

  const handleDefrag = async () => {
    setDefragLoading(true)
    const res = await window.electron.btrfsDefrag(defragPath)
    setDefragLoading(false)
    if (res.success) {
      showToast('Defragmentation completed', true)
    } else {
      showToast(res.error || 'Defragmentation failed', false)
    }
  }

  if (notAvailable) return (
    <div className="v-card" style={{ padding: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <AlertCircle size={32} style={{ color: '#52525b' }} />
      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#71717a' }}>Snapper Not Available</div>
      <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#3f3f46', maxWidth: '400px', lineHeight: '1.6' }}>
        Install <code style={{ color: 'var(--signal)' }}>snapper</code> and configure a root config (<code style={{ color: 'var(--signal)' }}>snapper -c root create-config /</code>) to enable restore points. Requires Btrfs filesystem.
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 200, display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '10px', background: toast.ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${toast.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', fontSize: '12px', fontFamily: 'monospace', color: toast.ok ? 'var(--signal)' : 'var(--crimson)' }}
          >
            {toast.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm modal */}
      <AnimatePresence>
        {pending && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setPending(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="v-card" style={{ position: 'relative', zIndex: 10, padding: '28px', maxWidth: '400px', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                  <AlertTriangle size={20} style={{ color: 'var(--crimson)' }} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'white' }}>
                    {pending.kind === 'rollback' ? 'Rollback to Snapshot' : 'Delete Snapshot'} #{pending.id}
                  </div>
                  <div style={{ fontSize: '11px', color: '#71717a', marginTop: '2px' }}>
                    {pending.kind === 'rollback'
                      ? 'This sets the snapshot as default for next boot. Current state is preserved as a new snapshot.'
                      : 'This permanently removes the snapshot and cannot be undone.'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setPending(null)} style={{ padding: '8px 16px', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#71717a', fontSize: '11px', fontFamily: 'monospace', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button
                  onClick={() => pending.kind === 'rollback' ? handleRollback(pending.id) : handleDelete(pending.id)}
                  style={{ padding: '8px 20px', borderRadius: '8px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--crimson)', fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {pending.kind === 'rollback' ? 'Rollback' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px', marginBottom: '8px' }}>
        <button
          onClick={() => setActiveTab('snapshots')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            background: activeTab === 'snapshots' ? 'var(--crimson)' : 'rgba(255,255,255,0.02)',
            border: activeTab === 'snapshots' ? 'none' : '1px solid rgba(255,255,255,0.06)',
            color: 'white',
            fontFamily: 'monospace',
            fontSize: '11px',
            textTransform: 'uppercase',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Restore Points
        </button>
        <button
          onClick={() => setActiveTab('maintenance')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            background: activeTab === 'maintenance' ? 'var(--crimson)' : 'rgba(255,255,255,0.02)',
            border: activeTab === 'maintenance' ? 'none' : '1px solid rgba(255,255,255,0.06)',
            color: 'white',
            fontFamily: 'monospace',
            fontSize: '11px',
            textTransform: 'uppercase',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Btrfs Maintenance
        </button>
      </div>

      {activeTab === 'snapshots' ? (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {[
              { label: 'Total Snapshots', value: snapshots.length,                                                          icon: Camera,    color: 'var(--crimson)' },
              { label: 'Manual',          value: snapshots.filter(s => s.type === 'single').length,                          icon: Plus,      color: '#6366f1' },
              { label: 'Auto / Pre-Post', value: snapshots.filter(s => s.type === 'pre' || s.type === 'timeline').length,   icon: Clock,     color: '#f59e0b' },
            ].map(s => (
              <div key={s.label} className="v-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', background: `${s.color}15`, border: `1px solid ${s.color}30` }}>
                  <s.icon size={16} style={{ color: s.color }} />
                </div>
                <div>
                  <div style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', color: '#52525b', marginBottom: '3px' }}>{s.label}</div>
                  <div style={{ fontSize: '20px', fontFamily: 'monospace', fontWeight: 'bold', color: '#f4f4f5' }}>{s.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Create */}
          <div className="v-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Camera size={13} style={{ color: 'var(--signal)' }} />
              <span style={{ fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#71717a', fontWeight: 'bold' }}>Create Restore Point</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={createDesc}
                onChange={e => setCreateDesc(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="Description (optional)"
                style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '8px 12px', color: '#f4f4f5', fontSize: '12px', fontFamily: 'monospace', outline: 'none' }}
              />
              <button
                onClick={handleCreate}
                disabled={creating}
                style={{ padding: '8px 20px', borderRadius: '8px', background: 'rgba(34,211,238,0.10)', border: '1px solid rgba(34,211,238,0.2)', color: 'var(--signal)', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {creating ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                {creating ? 'Creating...' : 'Snapshot'}
              </button>
            </div>
            <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#3f3f46' }}>
              Creates a <code style={{ color: '#52525b' }}>single</code> type snapshot of the root btrfs subvolume.
            </div>
          </div>

          {/* Snapshot list */}
          <div className="v-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <HardDrive size={13} style={{ color: '#52525b' }} />
              <span style={{ fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#a1a1aa', fontWeight: 'bold' }}>Restore Points</span>
              <button onClick={load} style={{ marginLeft: 'auto', padding: '3px 8px', borderRadius: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: '#52525b', fontSize: '9px', fontFamily: 'monospace', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <RefreshCw size={9} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '50px 80px 1fr 200px 80px 140px', gap: '0 12px', padding: '6px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#3f3f46' }}>
              <span>#</span><span>Type</span><span>Description</span><span>Date</span><span>Size</span><span>Actions</span>
            </div>

            {loading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#3f3f46', fontFamily: 'monospace', fontSize: '11px', fontStyle: 'italic' }}>Loading snapshots...</div>
            ) : snapshots.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#3f3f46', fontFamily: 'monospace', fontSize: '11px', fontStyle: 'italic' }}>No snapshots found. Create one above.</div>
            ) : snapshots.map((s, i) => {
              const tColor = TYPE_COLOR[s.type] ?? '#52525b'
              const isBusy = busy === s.id
              return (
                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '50px 80px 1fr 200px 80px 140px', gap: '0 12px', padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '11px', fontFamily: 'monospace', alignItems: 'center', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.003)', opacity: isBusy ? 0.4 : 1, transition: 'opacity 0.2s' }}>
                  <span style={{ color: '#52525b', fontSize: '10px' }}>#{s.id}</span>
                  <span style={{ fontSize: '8px', textTransform: 'uppercase', color: tColor, fontWeight: 'bold' }}>{s.type}</span>
                  <span style={{ color: '#d4d4d8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.description}>{s.description || '—'}</span>
                  <span style={{ color: '#52525b', fontSize: '10px' }}>{s.date || '—'}</span>
                  <span style={{ color: '#71717a', fontSize: '10px' }}>{s.usedSpace || '—'}</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => setPending({ kind: 'rollback', id: s.id })}
                      disabled={isBusy}
                      title="Rollback to this snapshot on next boot"
                      style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#6366f1', fontSize: '8px', fontFamily: 'monospace', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                      <RotateCcw size={9} /> Rollback
                    </button>
                    <button
                      onClick={() => setPending({ kind: 'delete', id: s.id })}
                      disabled={isBusy}
                      style={{ padding: '3px 8px', borderRadius: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: '#52525b', fontSize: '8px', fontFamily: 'monospace', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                      <Trash2 size={9} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Info callout */}
          <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)', fontSize: '10px', fontFamily: 'monospace', color: '#52525b', lineHeight: '1.7' }}>
            <span style={{ color: '#6366f1', fontWeight: 'bold' }}>Rollback</span> queues the snapshot as the default Btrfs subvolume — takes effect after reboot. Current state is automatically preserved as a new snapshot before rollback. Managed by <code style={{ color: 'var(--signal)' }}>snapper -c root</code>.
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Usage details */}
          <div className="v-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HardDrive size={13} style={{ color: 'var(--signal)' }} />
              <span style={{ fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#71717a', fontWeight: 'bold' }}>Btrfs Filesystem Usage</span>
              <button onClick={loadBtrfsData} style={{ marginLeft: 'auto', padding: '3px 8px', borderRadius: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: '#52525b', fontSize: '9px', fontFamily: 'monospace', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <RefreshCw size={9} className={usageLoading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>

            {usageLoading ? (
              <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#71717a', fontStyle: 'italic' }}>Loading Btrfs storage footprint...</div>
            ) : btrfsUsage ? (() => {
              const total = btrfsUsage.dataAlloc + btrfsUsage.metaAlloc + btrfsUsage.unallocated
              const dataPct = total > 0 ? (btrfsUsage.dataAlloc / total) * 100 : 0
              const metaPct = total > 0 ? (btrfsUsage.metaAlloc / total) * 100 : 0
              const unallocPct = total > 0 ? (btrfsUsage.unallocated / total) * 100 : 0

              const toGB = (b: number) => (b / 1024 / 1024 / 1024).toFixed(2)

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', height: '16px', borderRadius: '8px', overflow: 'hidden', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ width: `${dataPct}%`, background: '#6366f1', transition: 'width 0.3s' }} title={`Data: ${toGB(btrfsUsage.dataAlloc)} GB (${dataPct.toFixed(1)}%)`} />
                    <div style={{ width: `${metaPct}%`, background: '#f59e0b', transition: 'width 0.3s' }} title={`Metadata: ${toGB(btrfsUsage.metaAlloc)} GB (${metaPct.toFixed(1)}%)`} />
                    <div style={{ width: `${unallocPct}%`, background: '#10b981', transition: 'width 0.3s' }} title={`Unallocated: ${toGB(btrfsUsage.unallocated)} GB (${unallocPct.toFixed(1)}%)`} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginTop: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1' }} />
                      <div>
                        <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#52525b' }}>ALLOCATED DATA</div>
                        <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: '#f4f4f5' }}>{toGB(btrfsUsage.dataAlloc)} GB</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
                      <div>
                        <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#52525b' }}>ALLOCATED METADATA</div>
                        <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: '#f4f4f5' }}>{toGB(btrfsUsage.metaAlloc)} GB</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                      <div>
                        <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#52525b' }}>UNALLOCATED SPACE</div>
                        <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: '#f4f4f5' }}>{toGB(btrfsUsage.unallocated)} GB</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a1a1aa' }} />
                      <div>
                        <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#52525b' }}>TOTAL VOLUME SIZE</div>
                        <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: '#f4f4f5' }}>{toGB(total)} GB</div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })() : (
              <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--crimson)' }}>Failed to read Btrfs usage data. Make sure Btrfs is used as the root filesystem.</div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Scrub Panel */}
            <div className="v-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={13} style={{ color: 'var(--signal)' }} />
                <span style={{ fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#71717a', fontWeight: 'bold' }}>Filesystem Scrub</span>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'monospace' }}>
                  <span style={{ color: '#71717a' }}>Status:</span>
                  <span style={{ color: '#f4f4f5', fontWeight: 'bold' }}>
                    {scrubStatus.includes('running') ? 'Running' : scrubStatus.includes('canceled') ? 'Canceled' : scrubStatus.includes('finished') ? 'Finished' : 'Idle'}
                  </span>
                </div>
                {scrubProgress !== undefined && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'monospace', color: '#a1a1aa' }}>
                      <span>Progress:</span>
                      <span>{scrubProgress.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                      <div style={{ width: `${scrubProgress}%`, height: '100%', background: 'var(--signal)' }} />
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'monospace' }}>
                  <span style={{ color: '#71717a' }}>Errors:</span>
                  <span style={{ color: scrubErrors > 0 ? 'var(--crimson)' : '#10b981', fontWeight: 'bold' }}>{scrubErrors}</span>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                <button
                  onClick={handleScrubStart}
                  disabled={scrubLoading || scrubStatus.includes('running')}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)', color: 'var(--signal)', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer' }}
                >
                  {scrubLoading ? 'Processing...' : 'Start Scrub'}
                </button>
                <button
                  onClick={handleScrubCancel}
                  disabled={scrubLoading || !scrubStatus.includes('running')}
                  style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--crimson)', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>

            {/* Balance Panel */}
            <div className="v-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={13} style={{ color: 'var(--signal)' }} />
                <span style={{ fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#71717a', fontWeight: 'bold' }}>Filesystem Balance</span>
              </div>
              
              <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'monospace' }}>
                  <span style={{ color: '#71717a' }}>Status:</span>
                  <span style={{ color: '#f4f4f5', fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '180px' }} title={balanceStatus}>
                    {balanceStatus.includes('running') ? 'Running' : balanceStatus.includes('No balance active') ? 'Idle' : balanceStatus || 'Idle'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'monospace', color: '#a1a1aa' }}>
                    <span>Usage Filter:</span>
                    <span style={{ color: 'var(--signal)', fontWeight: 'bold' }}>{dusage}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={dusage}
                    onChange={e => {
                      const val = parseInt(e.target.value)
                      setDusage(val)
                      setMusage(val)
                    }}
                    style={{ width: '100%', accentColor: 'var(--signal)', cursor: 'pointer', background: 'rgba(255,255,255,0.08)' }}
                  />
                  <div style={{ fontSize: '8px', fontFamily: 'monospace', color: '#52525b' }}>
                    Reclaims chunks with usage lower than {dusage}%.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                <button
                  onClick={handleBalanceStart}
                  disabled={balanceLoading || balanceStatus.includes('running')}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)', color: 'var(--signal)', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer' }}
                >
                  {balanceLoading ? 'Processing...' : 'Start Balance'}
                </button>
                <button
                  onClick={handleBalanceCancel}
                  disabled={balanceLoading || !balanceStatus.includes('running')}
                  style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--crimson)', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>

          {/* Defrag Panel */}
          <div className="v-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={13} style={{ color: 'var(--signal)' }} />
              <span style={{ fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#71717a', fontWeight: 'bold' }}>Filesystem Defragmentation</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={defragPath}
                onChange={e => setDefragPath(e.target.value)}
                placeholder="Path to defragment (e.g. /)"
                style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '8px 12px', color: '#f4f4f5', fontSize: '12px', fontFamily: 'monospace', outline: 'none' }}
              />
              <button
                onClick={handleDefrag}
                disabled={defragLoading}
                style={{ padding: '8px 20px', borderRadius: '8px', background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)', color: 'var(--signal)', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {defragLoading ? <RefreshCw size={12} className="animate-spin" /> : null}
                {defragLoading ? 'Defragging...' : 'Defragment'}
              </button>
            </div>
            <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#52525b' }}>
              Recursively defragments the files and metadata within the specified path to consolidate free chunks.
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
