import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Cpu, MemoryStick, Zap, HardDrive, Network } from 'lucide-react'

interface Sample {
  ts: number
  cpu: number
  ram: number
  gpu: number
  disk: number
  net_rx: number
}

const RANGES = [
  { label: '1h',  hours: 1  },
  { label: '6h',  hours: 6  },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
]

const METRICS = [
  { key: 'cpu'   as const, label: 'CPU',       color: 'var(--crimson)', icon: Cpu,        unit: '%'    },
  { key: 'ram'   as const, label: 'RAM',       color: 'var(--signal)',  icon: MemoryStick, unit: '%'  },
  { key: 'gpu'   as const, label: 'GPU',       color: '#a855f7',        icon: Zap,         unit: '%'  },
  { key: 'disk'  as const, label: 'Disk Use',  color: '#f59e0b',        icon: HardDrive,   unit: '%'  },
  { key: 'net_rx'as const, label: 'Net RX',    color: '#10b981',        icon: Network,     unit: 'MB/s'},
]

function fmtTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function avg(arr: number[]): number {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function max(arr: number[]): number {
  return arr.length ? Math.max(...arr) : 0
}

interface ChartProps {
  data: Sample[]
  metricKey: keyof Omit<Sample, 'ts'>
  color: string
  unit: string
  height?: number
}

function SparkChart({ data, metricKey, color, unit: _unit, height = 80 }: ChartProps) {
  if (data.length < 2) return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3f3f46', fontFamily: 'monospace', fontSize: '10px', fontStyle: 'italic' }}>
      Collecting data...
    </div>
  )

  const values = data.map(d => d[metricKey] as number)
  const yMax = metricKey === 'net_rx' ? Math.max(max(values) * 1.2, 1) : 100
  const W = 600
  const H = height

  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W
    const y = H - (v / yMax) * (H - 4) - 2
    return `${x},${y}`
  }).join(' ')

  const fillPts = pts + ` ${W},${H} 0,${H}`

  // X-axis tick marks every ~20% of data points
  const tickCount = 5
  const tickIndices = Array.from({ length: tickCount }, (_, i) => Math.round(i * (data.length - 1) / (tickCount - 1)))

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
        {/* Grid lines at 25%, 50%, 75% */}
        {[25, 50, 75].map(pct => {
          const y = H - (pct / yMax) * (H - 4) - 2
          return (
            <line key={pct} x1={0} x2={W} y1={y} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
          )
        })}
        <polyline points={fillPts} fill={color.replace(')', ', 0.08)').replace('rgb(', 'rgba(').replace('var(--crimson)', 'rgba(239,68,68,0.08)').replace('var(--signal)', 'rgba(34,211,238,0.08)')} stroke="none" />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        {/* Last value dot */}
        {(() => {
          const last = values[values.length - 1]
          const x = W
          const y = H - (last / yMax) * (H - 4) - 2
          return <circle cx={x} cy={y} r={3} fill={color} />
        })()}
      </svg>
      {/* Time axis labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        {tickIndices.map(i => (
          <span key={i} style={{ fontSize: '8px', fontFamily: 'monospace', color: '#3f3f46' }}>
            {fmtTime(data[i].ts)}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function HistoryView() {
  const [hours, setHours]   = useState(6)
  const [data, setData]     = useState<Sample[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!(window as any).electron) return
    setLoading(true)
    const rows = await window.electron.dbGetResourceHistory(hours)
    setData(rows)
    setLoading(false)
  }, [hours])

  useEffect(() => { load() }, [load])

  // Downsample for display if too many points (keep max 300)
  const display = data.length > 300
    ? data.filter((_, i) => i % Math.ceil(data.length / 300) === 0)
    : data

  const last = data[data.length - 1]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {RANGES.map(r => (
            <button
              key={r.hours}
              onClick={() => setHours(r.hours)}
              style={{ padding: '4px 12px', borderRadius: '7px', fontSize: '10px', fontFamily: 'monospace', cursor: 'pointer', background: hours === r.hours ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.02)', border: `1px solid ${hours === r.hours ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.06)'}`, color: hours === r.hours ? 'var(--crimson)' : '#52525b', fontWeight: hours === r.hours ? 'bold' : 'normal' }}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: '7px', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: '#52525b', fontSize: '9px', fontFamily: 'monospace', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Summary stats row */}
      {last && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
          {METRICS.map(m => {
            const vals = data.map(d => d[m.key] as number)
            const cur  = last[m.key] as number
            const avgV = avg(vals)
            const maxV = max(vals)
            return (
              <div key={m.key} className="v-card" style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <m.icon size={12} style={{ color: m.color }} />
                  <span style={{ fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', color: '#52525b' }}>{m.label}</span>
                </div>
                <div style={{ fontSize: '18px', fontFamily: 'monospace', fontWeight: 'bold', color: '#f4f4f5', marginBottom: '6px' }}>
                  {cur.toFixed(m.key === 'net_rx' ? 2 : 1)}<span style={{ fontSize: '9px', color: '#52525b', marginLeft: '2px' }}>{m.unit}</span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '7px', fontFamily: 'monospace', color: '#3f3f46', textTransform: 'uppercase' }}>Avg</div>
                    <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#71717a' }}>{avgV.toFixed(1)}{m.unit}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '7px', fontFamily: 'monospace', color: '#3f3f46', textTransform: 'uppercase' }}>Peak</div>
                    <div style={{ fontSize: '9px', fontFamily: 'monospace', color: m.color }}>{maxV.toFixed(1)}{m.unit}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {data.length > 0 && last && (
        <div style={{ fontSize: '8px', fontFamily: 'monospace', color: '#3f3f46', textAlign: 'right' }}>
          {data.length} samples · {fmtDate(data[0].ts)} {fmtTime(data[0].ts)} → {fmtTime(last.ts)}
        </div>
      )}

      {/* Charts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {METRICS.map(m => (
          <div key={m.key} className="v-card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <div style={{ width: '3px', height: '12px', borderRadius: '2px', background: m.color }} />
                <span style={{ fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#71717a', fontWeight: 'bold' }}>{m.label}</span>
              </div>
              {last && (
                <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold', color: m.color }}>
                  {(last[m.key] as number).toFixed(m.key === 'net_rx' ? 2 : 1)}{m.unit}
                </span>
              )}
            </div>
            <SparkChart data={display} metricKey={m.key} color={m.color} unit={m.unit} height={90} />
          </div>
        ))}
      </div>

      {data.length === 0 && !loading && (
        <div className="v-card" style={{ padding: '40px', textAlign: 'center', color: '#3f3f46', fontFamily: 'monospace', fontSize: '11px', fontStyle: 'italic' }}>
          No history yet. Data is sampled every 30 seconds — check back shortly.
        </div>
      )}

    </div>
  )
}
