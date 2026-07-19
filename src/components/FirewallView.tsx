import { useState, useCallback, useEffect } from 'react'
import { Shield, ShieldOff, Plus, Trash2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { notify } from '../lib/notifications'

interface UfwRule { to: string; action: string; from: string; comment: string }

const ACTION_COLOR: Record<string, string> = {
  ALLOW: '#34d399',
  DENY: '#f87171',
  REJECT: '#f87171',
  LIMIT: '#f59e0b',
}

const EMPTY_FORM = { port: '', proto: 'tcp', action: 'allow', from: '', comment: '' }

export default function FirewallView() {
  const [enabled, setEnabled] = useState(false)
  const [rules, setRules] = useState<UfwRule[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [adding, setAdding] = useState(false)
  const [showRaw, setShowRaw] = useState(false)
  const [raw, setRaw] = useState('')
  const [confirmDel, setConfirmDel] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await (window as any).electron.ufwStatus()
    setLoading(false)
    if (res.success) { setEnabled(res.enabled); setRules(res.rules); setRaw(res.raw) }
    else notify('Firewall', res.error ?? 'Failed to read UFW status', 'error')
  }, [])

  useEffect(() => { load() }, [load])

  const toggle = async () => {
    setToggling(true)
    const res = await (window as any).electron.ufwEnable(!enabled)
    setToggling(false)
    if (res.success) { setEnabled(p => !p); notify('Firewall', res.output ?? (enabled ? 'UFW disabled' : 'UFW enabled'), 'success'); load() }
    else notify('Firewall', res.error ?? 'Failed', 'error')
  }

  const addRule = async () => {
    if (!form.port.trim()) return
    setAdding(true)
    const res = await (window as any).electron.ufwAddRule(form)
    setAdding(false)
    if (res.success) { notify('Firewall', 'Rule added', 'success'); setShowAdd(false); setForm(EMPTY_FORM); load() }
    else notify('Firewall', res.error ?? 'Failed', 'error')
  }

  const deleteRule = async (index: number) => {
    const res = await (window as any).electron.ufwDeleteRule(index + 1)
    if (res.success) { notify('Firewall', 'Rule deleted', 'success'); setConfirmDel(null); load() }
    else notify('Firewall', res.error ?? 'Failed', 'error')
  }

  return (
    <div style={{ maxWidth: '720px' }}>
      {/* Status card */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', marginBottom: '20px', background: enabled ? 'rgba(52,211,153,0.06)' : 'rgba(248,113,113,0.06)', border: `1px solid ${enabled ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}`, borderRadius: '10px' }}>
        {enabled ? <Shield size={22} style={{ color: '#34d399' }} /> : <ShieldOff size={22} style={{ color: '#f87171' }} />}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: enabled ? '#34d399' : '#f87171', fontFamily: 'monospace' }}>
            UFW Firewall — {enabled ? 'ACTIVE' : 'INACTIVE'}
          </div>
          <div style={{ fontSize: '10px', color: '#52525b', marginTop: '2px' }}>
            {loading ? 'Loading…' : `${rules.length} rule${rules.length !== 1 ? 's' : ''} configured`}
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={toggling}
          style={{ padding: '7px 18px', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 600, cursor: 'pointer', background: enabled ? 'rgba(248,113,113,0.12)' : 'rgba(52,211,153,0.12)', border: `1px solid ${enabled ? 'rgba(248,113,113,0.3)' : 'rgba(52,211,153,0.3)'}`, color: enabled ? '#f87171' : '#34d399' }}
        >
          {toggling ? '…' : enabled ? 'Disable' : 'Enable'}
        </button>
        <button onClick={load} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '7px', padding: '6px', cursor: 'pointer', color: '#4b5563' }}>
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Add rule panel */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setShowAdd(p => !p)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '7px', fontSize: '10px', fontFamily: 'monospace', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', cursor: 'pointer', marginBottom: showAdd ? '12px' : 0 }}
        >
          <Plus size={11} /> Add Rule {showAdd ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>

        {showAdd && (
          <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {[
                { key: 'port', label: 'Port / Range', placeholder: '22 or 8000:9000' },
              ].map(({ key, label, placeholder }) => (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '140px', flex: 1 }}>
                  <label style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4b5563' }}>{label}</label>
                  <input value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '5px 8px', fontSize: '11px', fontFamily: 'monospace', color: '#e2e8f0' }} />
                </div>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4b5563' }}>Protocol</label>
                <select value={form.proto} onChange={e => setForm(p => ({ ...p, proto: e.target.value }))} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '5px 8px', fontSize: '11px', fontFamily: 'monospace', color: '#e2e8f0', cursor: 'pointer' }}>
                  {['tcp', 'udp', 'any'].map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4b5563' }}>Action</label>
                <select value={form.action} onChange={e => setForm(p => ({ ...p, action: e.target.value }))} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '5px 8px', fontSize: '11px', fontFamily: 'monospace', color: '#e2e8f0', cursor: 'pointer' }}>
                  {['allow', 'deny', 'reject', 'limit'].map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '140px' }}>
                <label style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4b5563' }}>From IP / Subnet (optional)</label>
                <input value={form.from} onChange={e => setForm(p => ({ ...p, from: e.target.value }))} placeholder="192.168.1.0/24" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '5px 8px', fontSize: '11px', fontFamily: 'monospace', color: '#e2e8f0' }} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '140px' }}>
                <label style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4b5563' }}>Comment (optional)</label>
                <input value={form.comment} onChange={e => setForm(p => ({ ...p, comment: e.target.value }))} placeholder="SSH access" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '5px 8px', fontSize: '11px', fontFamily: 'monospace', color: '#e2e8f0' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowAdd(false); setForm(EMPTY_FORM) }} style={{ padding: '6px 14px', borderRadius: '7px', fontSize: '10px', fontFamily: 'monospace', background: 'none', border: '1px solid rgba(255,255,255,0.07)', color: '#52525b', cursor: 'pointer' }}>Cancel</button>
              <button onClick={addRule} disabled={adding || !form.port.trim()} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 16px', borderRadius: '7px', fontSize: '10px', fontFamily: 'monospace', fontWeight: 600, background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.3)', color: '#22d3ee', cursor: 'pointer' }}>
                <Plus size={11} /> {adding ? 'Adding…' : 'Add Rule'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Rules table */}
      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', fontSize: '12px', color: '#3f3f46', fontFamily: 'monospace' }}>Loading firewall rules…</div>
      ) : rules.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', fontSize: '12px', color: '#3f3f46', fontFamily: 'monospace', fontStyle: 'italic', border: '2px dashed rgba(255,255,255,0.05)', borderRadius: '10px' }}>
          No rules configured.{!enabled && ' Enable UFW first.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 1fr 1fr auto', gap: '8px', padding: '6px 12px', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4b5563' }}>
            <span>To</span><span>Action</span><span>From</span><span>Comment</span><span style={{ width: '60px' }}></span>
          </div>
          {rules.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 1fr 1fr auto', gap: '8px', alignItems: 'center', padding: '9px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '7px' }}>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#a1a1aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.to}</span>
              <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: ACTION_COLOR[r.action.toUpperCase()] ?? '#94a3b8' }}>{r.action.toUpperCase()}</span>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#71717a' }}>{r.from}</span>
              <span style={{ fontSize: '10px', color: '#4b5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.comment}</span>
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', width: '60px' }}>
                {confirmDel === i ? (
                  <>
                    <button onClick={() => deleteRule(i)} style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '9px', fontFamily: 'monospace', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', cursor: 'pointer' }}>Del</button>
                    <button onClick={() => setConfirmDel(null)} style={{ padding: '3px 6px', borderRadius: '5px', fontSize: '9px', background: 'none', border: '1px solid rgba(255,255,255,0.07)', color: '#52525b', cursor: 'pointer' }}>×</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmDel(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3f3f46', padding: '2px' }}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Raw toggle */}
      {raw && (
        <div style={{ marginTop: '16px' }}>
          <button onClick={() => setShowRaw(p => !p)} style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'none', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '4px 10px', color: '#4b5563', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {showRaw ? <ChevronUp size={10} /> : <ChevronDown size={10} />} Raw UFW Output
          </button>
          {showRaw && <pre style={{ marginTop: '8px', fontSize: '9px', fontFamily: 'monospace', color: '#52525b', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '10px', maxHeight: '160px', overflow: 'auto', whiteSpace: 'pre-wrap' }}>{raw}</pre>}
        </div>
      )}
    </div>
  )
}
