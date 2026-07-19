import { useState, useCallback, useEffect } from 'react'
import { Key, Plus, Trash2, Copy, RefreshCw, Check, ChevronDown, ChevronUp, Shield } from 'lucide-react'
import { notify } from '../lib/notifications'

interface SshKey {
  name: string
  pubFile: string
  privFile: string
  type: string
  fingerprint: string
  comment: string
  pubKey: string
}

const TYPE_COLOR: Record<string, string> = {
  'ssh-ed25519': '#34d399',
  'ssh-rsa': '#60a5fa',
  'ecdsa-sha2-nistp256': '#f59e0b',
  'ssh-dss': '#f87171',
}

function KeyCard({ k, onDelete }: { k: SshKey; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const color = TYPE_COLOR[k.type] ?? '#94a3b8'

  const copyPub = () => {
    navigator.clipboard.writeText(k.pubKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shortType = k.type.replace('ssh-', '').replace('ecdsa-sha2-', '').toUpperCase()

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: `3px solid ${color}55`, borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px' }}>
        <Key size={14} style={{ color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', fontFamily: 'monospace' }}>{k.name}</span>
            <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: color + '22', color, fontFamily: 'monospace', fontWeight: 700, textTransform: 'uppercase' }}>{shortType}</span>
            {k.privFile && <span style={{ fontSize: '9px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '3px' }}><Shield size={9} /> private</span>}
          </div>
          <div style={{ fontSize: '10px', color: '#52525b', marginTop: '2px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {k.fingerprint || '—'}
            {k.comment && <span style={{ marginLeft: '8px', color: '#3f3f46' }}>{k.comment}</span>}
          </div>
        </div>
        <button onClick={copyPub} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontFamily: 'monospace', background: copied ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${copied ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.07)'}`, color: copied ? '#34d399' : '#71717a', cursor: 'pointer' }}>
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy pub'}
        </button>
        <button onClick={() => setExpanded(p => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', padding: '3px' }}>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {confirmDel ? (
          <>
            <button onClick={onDelete} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontFamily: 'monospace', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171', cursor: 'pointer' }}>Confirm</button>
            <button onClick={() => setConfirmDel(false)} style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '10px', background: 'none', border: '1px solid rgba(255,255,255,0.07)', color: '#52525b', cursor: 'pointer' }}>Cancel</button>
          </>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', padding: '3px' }}>
            <Trash2 size={12} />
          </button>
        )}
      </div>
      {expanded && (
        <div style={{ padding: '10px 14px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: '9px', color: '#4b5563', fontFamily: 'monospace', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Public key</div>
          <pre style={{ fontSize: '9px', fontFamily: 'monospace', color: '#71717a', background: 'rgba(0,0,0,0.3)', borderRadius: '5px', padding: '8px 10px', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '80px', overflow: 'auto' }}>
            {k.pubKey}
          </pre>
        </div>
      )}
    </div>
  )
}

const DEFAULT_FORM = { type: 'ed25519', bits: 4096, comment: '', filename: 'id_ed25519_new' }

export default function SshView() {
  const [keys, setKeys] = useState<SshKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showGen, setShowGen] = useState(false)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [generating, setGenerating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await (window as any).electron.sshListKeys()
    if (res.success) setKeys(res.keys)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const deleteKey = async (name: string) => {
    const res = await (window as any).electron.sshDeleteKey({ name })
    if (res.success) {
      notify('SSH', `Deleted key: ${name}`, 'success')
      setKeys(prev => prev.filter(k => k.name !== name))
    } else {
      notify('SSH', `Delete failed: ${res.error}`, 'error')
    }
  }

  const generate = async () => {
    if (!form.filename.trim() || !form.comment.trim()) return
    setGenerating(true)
    const res = await (window as any).electron.sshGenerateKey({ type: form.type, bits: form.bits, comment: form.comment, filename: form.filename })
    setGenerating(false)
    if (res.success) {
      notify('SSH', `Key "${form.filename}" generated`, 'success')
      setShowGen(false)
      setForm(DEFAULT_FORM)
      load()
    } else {
      notify('SSH', `Generation failed: ${res.error}`, 'error')
    }
  }

  return (
    <div style={{ maxWidth: '700px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', color: '#52525b', fontFamily: 'monospace' }}>
          {loading ? 'Scanning ~/.ssh…' : `${keys.length} key pair${keys.length !== 1 ? 's' : ''} in ~/.ssh`}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '7px', fontSize: '10px', fontFamily: 'monospace', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#71717a', cursor: 'pointer' }}>
            <RefreshCw size={11} /> Refresh
          </button>
          <button onClick={() => setShowGen(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '7px', fontSize: '10px', fontFamily: 'monospace', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', cursor: 'pointer' }}>
            <Plus size={11} /> Generate Key
          </button>
        </div>
      </div>

      {/* Generate panel */}
      {showGen && (
        <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#f4f4f5', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>New SSH Key</div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4b5563' }}>Type</label>
              <select
                value={form.type}
                onChange={e => setForm(p => ({ ...p, type: e.target.value, filename: `id_${e.target.value}_new` }))}
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontFamily: 'monospace', color: '#e2e8f0', cursor: 'pointer' }}
              >
                <option value="ed25519">Ed25519 (recommended)</option>
                <option value="rsa">RSA</option>
                <option value="ecdsa">ECDSA</option>
              </select>
            </div>
            {form.type === 'rsa' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4b5563' }}>Bits</label>
                <select
                  value={form.bits}
                  onChange={e => setForm(p => ({ ...p, bits: Number(e.target.value) }))}
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontFamily: 'monospace', color: '#e2e8f0', cursor: 'pointer' }}
                >
                  {[2048, 3072, 4096].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px' }}>
              <label style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4b5563' }}>Filename (~/.ssh/…)</label>
              <input
                value={form.filename}
                onChange={e => setForm(p => ({ ...p, filename: e.target.value }))}
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontFamily: 'monospace', color: '#e2e8f0' }}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px' }}>
              <label style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4b5563' }}>Comment / Email</label>
              <input
                value={form.comment}
                onChange={e => setForm(p => ({ ...p, comment: e.target.value }))}
                placeholder="user@hostname"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontFamily: 'monospace', color: '#e2e8f0' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowGen(false)} style={{ padding: '6px 14px', borderRadius: '7px', fontSize: '10px', fontFamily: 'monospace', background: 'none', border: '1px solid rgba(255,255,255,0.07)', color: '#52525b', cursor: 'pointer' }}>Cancel</button>
            <button onClick={generate} disabled={generating || !form.filename.trim() || !form.comment.trim()} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 16px', borderRadius: '7px', fontSize: '10px', fontFamily: 'monospace', fontWeight: 600, background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.3)', color: '#22d3ee', cursor: 'pointer' }}>
              {generating ? 'Generating…' : <><Key size={11} /> Generate</>}
            </button>
          </div>
        </div>
      )}

      {/* Key list */}
      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', fontSize: '12px', color: '#3f3f46', fontFamily: 'monospace' }}>Scanning ~/.ssh…</div>
      ) : keys.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', fontSize: '13px', color: '#3f3f46', fontStyle: 'italic', border: '2px dashed rgba(255,255,255,0.05)', borderRadius: '10px' }}>
          No SSH keys found in ~/.ssh<br />
          <span style={{ fontSize: '11px' }}>Click "Generate Key" to create your first key pair.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {keys.map(k => <KeyCard key={k.name} k={k} onDelete={() => deleteKey(k.name)} />)}
        </div>
      )}
    </div>
  )
}
