import { useState } from 'react'
import { GitBranch, ArrowUpFromLine, ArrowDownToLine, RefreshCw } from 'lucide-react'

export interface DepTree {
  name: string
  version: string
  direct: string[]
  optional: string[]
  required: string[]
  depDetails: Record<string, string[]>
}

interface DepGraphProps {
  tree: DepTree
  onDrillDown: (name: string) => void
  loading: boolean
}

const W = 480
const H = 320
const CX = W / 2
const CY = H / 2
const R1 = 130
const R2 = 215

function polarToCart(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

export default function DepGraph({ tree, onDrillDown, loading }: DepGraphProps) {
  const [hover, setHover] = useState<string | null>(null)
  const [tab, setTab] = useState<'deps' | 'required'>('deps')

  const direct = tree.direct.slice(0, 14)
  const totalDeps = direct.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {(['deps', 'required'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '4px 12px', borderRadius: '8px', fontSize: '9px', fontFamily: 'monospace',
              textTransform: 'uppercase', cursor: 'pointer',
              background: tab === t ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${tab === t ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`,
              color: tab === t ? 'var(--crimson)' : '#52525b',
            }}>
            {t === 'deps'
              ? <><GitBranch size={9} style={{ display: 'inline', marginRight: 4 }} />Deps ({tree.direct.length + tree.optional.length})</>
              : <><ArrowUpFromLine size={9} style={{ display: 'inline', marginRight: 4 }} />Required By ({tree.required.length})</>}
          </button>
        ))}
        {loading && <RefreshCw size={11} className="animate-spin" style={{ color: '#52525b', marginLeft: 8 }} />}
      </div>

      {tab === 'deps' && (
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
          {/* SVG radial graph */}
          <div style={{ flexShrink: 0 }}>
            <svg width={W} height={H} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
              {/* Lines from center to direct deps */}
              {direct.map((dep, i) => {
                const angle = (i / totalDeps) * 2 * Math.PI - Math.PI / 2
                const p = polarToCart(CX, CY, R1, angle)
                return (
                  <line key={`l1-${dep}`} x1={CX} y1={CY} x2={p.x} y2={p.y}
                    stroke={hover === dep ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.06)'}
                    strokeWidth={hover === dep ? 1.5 : 1} />
                )
              })}
              {/* Lines from deps to sub-deps (R1→R2) */}
              {direct.map((dep, i) => {
                const subdeps = (tree.depDetails[dep] ?? []).slice(0, 4)
                const angle = (i / totalDeps) * 2 * Math.PI - Math.PI / 2
                const p1 = polarToCart(CX, CY, R1, angle)
                return subdeps.map((sd, j) => {
                  const subAngle = angle + ((j - (subdeps.length - 1) / 2) * 0.22)
                  const p2 = polarToCart(CX, CY, R2, subAngle)
                  return (
                    <line key={`l2-${dep}-${sd}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                      stroke="rgba(255,255,255,0.03)" strokeWidth={1} />
                  )
                })
              })}

              {/* Sub-dep nodes (faint, no label) */}
              {direct.map((dep, i) => {
                const subdeps = (tree.depDetails[dep] ?? []).slice(0, 4)
                const angle = (i / totalDeps) * 2 * Math.PI - Math.PI / 2
                return subdeps.map((sd, j) => {
                  const subAngle = angle + ((j - (subdeps.length - 1) / 2) * 0.22)
                  const p = polarToCart(CX, CY, R2, subAngle)
                  return (
                    <circle key={`sd-${dep}-${sd}`} cx={p.x} cy={p.y} r={4}
                      fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
                  )
                })
              })}

              {/* Direct dep nodes */}
              {direct.map((dep, i) => {
                const angle = (i / totalDeps) * 2 * Math.PI - Math.PI / 2
                const p = polarToCart(CX, CY, R1, angle)
                const isHov = hover === dep
                const label = truncate(dep, 12)
                const textAnchor = p.x < CX - 10 ? 'end' : p.x > CX + 10 ? 'start' : 'middle'
                const labelOffset = p.x < CX - 10 ? -14 : p.x > CX + 10 ? 14 : 0
                const labelYOffset = p.y < CY ? -14 : 14
                return (
                  <g key={dep} style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHover(dep)} onMouseLeave={() => setHover(null)}
                    onClick={() => onDrillDown(dep)}>
                    <circle cx={p.x} cy={p.y} r={isHov ? 11 : 9}
                      fill={isHov ? 'rgba(34,211,238,0.2)' : 'rgba(34,211,238,0.08)'}
                      stroke={isHov ? 'var(--signal)' : 'rgba(34,211,238,0.25)'} strokeWidth={1.5} />
                    <text x={p.x + labelOffset} y={p.y + labelYOffset}
                      textAnchor={textAnchor} fontSize={9} fontFamily="monospace"
                      fill={isHov ? 'var(--signal)' : '#71717a'}>
                      {label}
                    </text>
                  </g>
                )
              })}

              {/* Center node */}
              <circle cx={CX} cy={CY} r={24} fill="rgba(239,68,68,0.12)" stroke="var(--crimson)" strokeWidth={1.5} />
              <text x={CX} y={CY - 3} textAnchor="middle" fontSize={10} fontFamily="monospace" fontWeight="bold" fill="#f4f4f5">
                {truncate(tree.name, 14)}
              </text>
              <text x={CX} y={CY + 11} textAnchor="middle" fontSize={7} fontFamily="monospace" fill="#52525b">
                {tree.version}
              </text>
            </svg>
            <p style={{ textAlign: 'center', fontSize: '8px', fontFamily: 'monospace', color: '#3f3f46', marginTop: 6 }}>
              Click a node to drill into its deps
            </p>
          </div>

          {/* Dep list */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
            {/* Direct */}
            <div>
              <div style={{ fontSize: '8px', fontFamily: 'monospace', color: '#3f3f46', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ArrowDownToLine size={9} /> Direct deps ({tree.direct.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {tree.direct.map(dep => (
                  <button key={dep} onClick={() => onDrillDown(dep)}
                    onMouseEnter={() => setHover(dep)} onMouseLeave={() => setHover(null)}
                    style={{
                      padding: '2px 8px', borderRadius: '6px', fontSize: '9px', fontFamily: 'monospace',
                      cursor: 'pointer', background: hover === dep ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${hover === dep ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.06)'}`,
                      color: hover === dep ? 'var(--signal)' : '#71717a',
                    }}>{dep}</button>
                ))}
              </div>
            </div>
            {/* Optional */}
            {tree.optional.length > 0 && (
              <div>
                <div style={{ fontSize: '8px', fontFamily: 'monospace', color: '#3f3f46', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                  Optional ({tree.optional.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {tree.optional.map(dep => (
                    <span key={dep} style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '9px', fontFamily: 'monospace', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', color: '#3f3f46' }}>{dep}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'required' && (
        <div>
          {tree.required.length === 0 ? (
            <p style={{ fontFamily: 'monospace', fontSize: '10px', color: '#3f3f46', fontStyle: 'italic' }}>Nothing depends on this package.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {tree.required.map(r => (
                <button key={r} onClick={() => onDrillDown(r)}
                  style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '10px', fontFamily: 'monospace', cursor: 'pointer', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)', color: '#71717a' }}>
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
