import { useState } from 'react'
import { Activity, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react'

interface ReportSection {
  title: string
  status: 'ok' | 'warn' | 'error'
  detail: string
}

interface Report {
  score: number
  summary: string
  sections: ReportSection[]
  recommendations: string[]
  generatedAt: number
}

// The health score is always computed deterministically from real metrics
// (buildBaseReport).
const SCORE_COLOR = (s: number) => s >= 85 ? '#34d399' : s >= 65 ? '#f59e0b' : '#f87171'
const STATUS_ICON = { ok: CheckCircle2, warn: AlertTriangle, error: XCircle }
const STATUS_COLOR = { ok: '#34d399', warn: '#f59e0b', error: '#f87171' }

function ScoreRing({ score }: { score: number }) {
  const r = 48, cx = 56, cy = 56
  const circ = 2 * Math.PI * r
  const dash = circ * (score / 100)
  const color = SCORE_COLOR(score)
  return (
    <svg width={112} height={112} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={8} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill={color} fontSize={22} fontWeight={800} fontFamily="monospace">{score}</text>
    </svg>
  )
}

function buildBaseReport(data: Record<string, any>): Report {
  const cpu = Math.round(data.cpu?.load ?? 0)
  const mem = Math.round(data.memPct ?? 0)
  const disk = Math.round(data.diskPct ?? 0)
  const errors = data.errorCount ?? 0
  const failed = data.failedServices ?? 0
  const updates = data.updateCount ?? 0

  let score = 100
  if (cpu > 85) score -= 10; else if (cpu > 70) score -= 4
  if (mem > 90) score -= 20; else if (mem > 75) score -= 8
  if (disk > 90) score -= 20; else if (disk > 80) score -= 10
  if (errors > 20) score -= 15; else if (errors > 5) score -= 8; else if (errors > 0) score -= 3
  score -= Math.min(failed * 12, 30)
  if (updates > 30) score -= 8; else if (updates > 10) score -= 3
  score = Math.max(0, score)

  const issues: string[] = []
  if (failed > 0) issues.push(`${failed} failed systemd unit${failed > 1 ? 's' : ''}`)
  if (mem > 75) issues.push(`high RAM usage (${mem}%)`)
  if (disk > 80) issues.push(`disk nearing capacity (${disk}%)`)
  if (errors > 5) issues.push(`${errors} recent journal errors`)
  if (updates > 10) issues.push(`${updates} pending updates`)

  const summary = issues.length === 0
    ? `System is healthy. CPU ${cpu}%, RAM ${mem}%, disk ${disk}% — all within normal parameters.`
    : `System has ${issues.length} concern${issues.length > 1 ? 's' : ''}: ${issues.join(', ')}. Review the metrics below.`

  const recs: string[] = []
  if (failed > 0) recs.push(`Investigate failed units: ${data.failedNames || 'run "systemctl --failed"'}`)
  if (updates > 0) recs.push(`Apply ${updates} pending package update${updates > 1 ? 's' : ''} with "sudo pacman -Syu"`)
  if (errors > 5) recs.push('Review journal errors with "journalctl -p 3 -n 50 --no-pager"')
  if (mem > 75) recs.push('Check top memory consumers with "ps aux --sort=-%mem | head -10"')
  if (disk > 80) recs.push('Free disk space — run the Cleaner or "paccache -r" to remove old package caches')

  const sections: ReportSection[] = [
    { title: 'CPU', status: cpu > 85 ? 'warn' : 'ok', detail: `Load: ${cpu}%` },
    { title: 'RAM', status: mem > 90 ? 'error' : mem > 75 ? 'warn' : 'ok', detail: `Used: ${mem}%` },
    { title: 'Disk', status: disk > 90 ? 'error' : disk > 80 ? 'warn' : 'ok', detail: `Root: ${disk}% used` },
    { title: 'Journal Errors', status: errors > 20 ? 'error' : errors > 5 ? 'warn' : 'ok', detail: `${errors} recent errors` },
    { title: 'Failed Services', status: failed > 0 ? 'error' : 'ok', detail: `${failed} failed units` },
    { title: 'Pending Updates', status: updates > 30 ? 'warn' : 'ok', detail: `${updates} packages` },
  ]

  return { score, summary, sections, recommendations: recs, generatedAt: Date.now() }
}

export default function HealthReportView() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState('')

  const generate = async () => {
    if (loading) return
    setLoading(true)
    setReport(null)

    const el = (window as any).electron
    const data: Record<string, any> = {}

    setStage('Gathering system stats…')
    try {
      const stats = await el.getSystemStats()
      data.cpu = stats.cpu
      data.memPct = stats.memory ? (stats.memory.used / stats.memory.total) * 100 : 0
    } catch {}

    setStage('Checking disk…')
    try {
      const disk = await el.diskInfo()
      const root = disk.filesystems?.find((f: any) => f.mount === '/')
      if (root) data.diskPct = (root.used / root.size) * 100
    } catch {}

    setStage('Reading journal errors…')
    try {
      const journal = await el.journalGetLogs({ priority: '3', lines: 50 })
      data.errorCount = journal.lines?.filter((l: string) => l.trim()).length ?? 0
      data.recentErrors = journal.lines?.slice(0, 5).join('\n') ?? ''
    } catch {}

    setStage('Checking services…')
    try {
      const units = await el.systemdListUnits()
      data.failedServices = units.filter((u: any) => u.active === 'failed').length
      data.failedNames = units.filter((u: any) => u.active === 'failed').map((u: any) => u.unit).slice(0, 3).join(', ')
    } catch {}

    setStage('Checking updates…')
    try {
      const upd = await el.systemCheckUpdates()
      data.updateCount = (upd.repo?.length ?? 0) + (upd.aur?.length ?? 0)
    } catch {}

    const base = buildBaseReport(data)
    setReport(base)

    setStage('')
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '760px' }}>
      {/* Generate button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={generate}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: '9px', fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: loading ? 'default' : 'pointer', background: loading ? 'rgba(255,255,255,0.03)' : 'rgba(239,68,68,0.12)', border: `1px solid ${loading ? 'rgba(255,255,255,0.06)' : 'rgba(239,68,68,0.3)'}`, color: loading ? '#4b5563' : 'var(--crimson)' }}
        >
          {loading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> {stage || 'Analysing…'}</> : <><Activity size={14} /> Generate Health Report</>}
        </button>
        {report && <button onClick={generate} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 14px', borderRadius: '7px', fontSize: '10px', fontFamily: 'monospace', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#4b5563', cursor: 'pointer' }}><RefreshCw size={11} /> Refresh</button>}
      </div>

      {!report && !loading && (
        <div style={{ padding: '48px', textAlign: 'center', border: '2px dashed rgba(255,255,255,0.06)', borderRadius: '12px', color: '#3f3f46', fontSize: '13px', fontStyle: 'italic' }}>
          Click "Generate Health Report" to scan your system.<br />
          <span style={{ fontSize: '11px' }}>Gathers disk, memory, journal errors, failed services, and pending updates. AI summary available if a model is configured.</span>
        </div>
      )}

      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Score + summary */}
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', padding: '20px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${SCORE_COLOR(report.score)}22`, borderRadius: '12px' }}>
            <ScoreRing score={report.score} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                System Health Score
                {loading && <span style={{ fontSize: '8px', color: '#3f3f46' }}>{stage}</span>}
              </div>
              <p style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.7, margin: 0 }}>{report.summary}</p>
              <div style={{ fontSize: '9px', color: '#3f3f46', fontFamily: 'monospace', marginTop: '8px' }}>Generated {new Date(report.generatedAt).toLocaleTimeString()}</div>
            </div>
          </div>

          {/* Metric grid */}
          {report.sections.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {report.sections.map(s => {
                const Icon = STATUS_ICON[s.status]
                const color = STATUS_COLOR[s.status]
                return (
                  <div key={s.title} style={{ padding: '12px 14px', background: color + '08', border: `1px solid ${color}22`, borderRadius: '9px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Icon size={16} style={{ color, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace' }}>{s.title}</div>
                      <div style={{ fontSize: '10px', color: '#52525b', marginTop: '1px' }}>{s.detail}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Recommendations</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {report.recommendations.map((rec, i) => (
                  <div key={i} style={{ display: 'flex', gap: '10px', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--crimson)', fontFamily: 'monospace', flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontSize: '12px', color: '#a1a1aa', lineHeight: 1.6 }}>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
