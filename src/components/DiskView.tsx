import { useState, useEffect, useCallback } from 'react'
import { HardDrive, RefreshCw, Database, Shield, ShieldAlert, ShieldQuestion } from 'lucide-react'
import { motion } from 'framer-motion'

function fmtBytes(b: number): string {
  if (b >= 1e12) return `${(b / 1e12).toFixed(1)} TB`
  if (b >= 1e9)  return `${(b / 1e9).toFixed(1)} GB`
  if (b >= 1e6)  return `${(b / 1e6).toFixed(0)} MB`
  return `${Math.round(b / 1e3)} KB`
}

function usageColor(pct: number): string {
  if (pct > 90) return 'var(--crimson)'
  if (pct > 75) return '#f59e0b'
  return 'var(--signal)'
}

interface SmartCache { [device: string]: { health: string; temp: number | null } }

export default function DiskView() {
  const [layout, setLayout]   = useState<any[]>([])
  const [fsSizes, setFsSizes] = useState<any[]>([])
  const [smart, setSmart]     = useState<SmartCache>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!(window as any).electron) return
    setLoading(true)
    const { layout: l, filesystems: fs } = await (window as any).electron.diskInfo()
    setLayout(l)
    setFsSizes(fs.filter((f: any) => f.size > 0 && f.mount && !f.mount.startsWith('/dev') && !f.mount.startsWith('/sys') && !f.mount.startsWith('/proc')))
    setLoading(false)

    // Fetch SMART for each physical disk
    const smartMap: SmartCache = {}
    await Promise.all(l.map(async (disk: any) => {
      if (!disk.device) return
      const res = await (window as any).electron.diskSmart(disk.device)
      smartMap[disk.device] = { health: res.health, temp: res.temp }
    }))
    setSmart(smartMap)
  }, [])

  useEffect(() => { load() }, [load])

  const HealthIcon = ({ device }: { device: string }) => {
    const s = smart[device]
    if (!s) return null
    if (s.health === 'PASSED') return <span title="SMART: PASSED"><Shield size={14} style={{ color: 'var(--signal)' }} /></span>
    if (s.health === 'FAILED') return <span title="SMART: FAILED"><ShieldAlert size={14} style={{ color: 'var(--crimson)' }} /></span>
    return <span title="SMART: Unknown"><ShieldQuestion size={14} style={{ color: '#52525b' }} /></span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Physical disks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
        {loading && layout.length === 0 && (
          <div className="v-card" style={{ padding: '24px', color: '#52525b', fontFamily: 'monospace', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <RefreshCw size={13} className="animate-spin" /> Scanning disks...
          </div>
        )}
        {layout.map((disk, i) => (
          <motion.div key={i} className="v-card" style={{ padding: '16px 20px' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <HardDrive size={16} style={{ color: 'var(--crimson)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold', color: '#f4f4f5' }}>{disk.name || disk.device || `Disk ${i}`}</div>
                  <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#52525b', marginTop: '2px' }}>{disk.device || '—'}</div>
                </div>
              </div>
              <HealthIcon device={disk.device} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              {[
                ['Type',  disk.type || '—'],
                ['Size',  disk.size ? fmtBytes(disk.size) : '—'],
                ['Interface', disk.interfaceType || '—'],
                ['Temp',  smart[disk.device]?.temp != null ? `${smart[disk.device]!.temp}°C` : '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', color: '#3f3f46', marginBottom: '2px' }}>{k}</div>
                  <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#a1a1aa' }}>{v}</div>
                </div>
              ))}
            </div>

            {disk.vendor && (
              <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#3f3f46' }}>{disk.vendor} {disk.model || ''}</div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Filesystem usage */}
      <div className="v-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Database size={13} style={{ color: '#52525b' }} />
            <span style={{ fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#a1a1aa', fontWeight: 'bold' }}>Filesystems</span>
          </div>
          <button
            onClick={load}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#52525b', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {fsSizes.length === 0 && !loading && (
          <div style={{ padding: '24px', textAlign: 'center', color: '#3f3f46', fontFamily: 'monospace', fontSize: '11px', fontStyle: 'italic' }}>No filesystem data available.</div>
        )}

        {fsSizes.map((fs, i) => {
          const pct = fs.use > 0 ? Math.round(fs.use) : 0
          const color = usageColor(pct)
          return (
            <div key={i} style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.02)', display: 'grid', gridTemplateColumns: '200px 1fr 100px 80px 80px', gap: '0 16px', alignItems: 'center', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.003)' }}>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#d4d4d8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fs.mount}>{fs.mount}</span>
              <div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.6s ease' }} />
                </div>
              </div>
              <span style={{ fontSize: '10px', fontFamily: 'monospace', color, textAlign: 'right', fontWeight: 'bold' }}>{pct}%</span>
              <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#52525b', textAlign: 'right' }}>{fmtBytes(fs.used)}</span>
              <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#3f3f46', textAlign: 'right' }}>{fmtBytes(fs.size)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
