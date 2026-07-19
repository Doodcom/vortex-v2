import { useState, useEffect } from 'react'
import { useTheme, type ThemeType } from './ThemeProvider'
import { Volume2, VolumeX, Zap, ZapOff, Palette, Check, Cpu, Fingerprint, Globe, ShieldCheck, Bell, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { notify } from '../lib/notifications'

import { ALERT_THRESHOLDS_KEY, DEFAULT_THRESHOLDS, type AlertThresholds } from '../lib/alerts'

const COLOR_THEMES: { id: ThemeType; label: string; color: string }[] = [
  { id: 'vortex-red',    label: 'Red',    color: '#ef4444' },
  { id: 'cyber-blue',   label: 'Blue',   color: '#22d3ee' },
  { id: 'neon-gold',    label: 'Gold',   color: '#f59e0b' },
  { id: 'matrix-green', label: 'Green',  color: '#10b981' },
]

const VISUAL_THEMES: { id: ThemeType; label: string; color: string; preview: string }[] = [
  { id: 'crt-retro',    label: 'CRT Retro',    color: '#39ff14', preview: 'scanlines' },
  { id: 'neon-pulse',   label: 'Neon Pulse',   color: '#e040fb', preview: 'pulse' },
  { id: 'holographic',  label: 'Holographic',  color: '#00d4ff', preview: 'holo' },
]

function Toggle({ enabled, onChange, label, sublabel, icon: Icon, offIcon: OffIcon }: {
  enabled: boolean
  onChange: (v: boolean) => void
  label: string
  sublabel: string
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  offIcon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: enabled ? 'var(--crimson-10)' : 'rgba(255,255,255,0.03)', border: `1px solid ${enabled ? 'var(--crimson-20)' : 'rgba(255,255,255,0.06)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
          {enabled ? <Icon size={14} style={{ color: 'var(--crimson)' }} /> : <OffIcon size={14} style={{ color: '#52525b' }} />}
        </div>
        <div>
          <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: '#f4f4f5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
          <div style={{ fontSize: '10px', color: '#52525b', marginTop: '2px' }}>{sublabel}</div>
        </div>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        style={{
          width: '44px', height: '24px', borderRadius: '12px',
          background: enabled ? 'var(--crimson)' : 'rgba(255,255,255,0.08)',
          border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
          boxShadow: enabled ? '0 0 8px var(--crimson-40)' : 'none'
        }}
      >
        <motion.div
          animate={{ x: enabled ? 22 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          style={{ position: 'absolute', top: '2px', width: '20px', height: '20px', borderRadius: '50%', background: 'white' }}
        />
      </button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="v-card" style={{ padding: '20px 24px', marginBottom: '20px' }}>
      <div style={{ fontSize: '9px', fontFamily: 'monospace', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--crimson)', marginBottom: '16px' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function AlertThresholdsEditor() {
  const [thresholds, setThresholds] = useState<AlertThresholds>(() => {
    try { return { ...DEFAULT_THRESHOLDS, ...JSON.parse(localStorage.getItem(ALERT_THRESHOLDS_KEY) ?? '{}') } } catch { return DEFAULT_THRESHOLDS }
  })
  const [saved, setSaved] = useState(false)

  const save = () => {
    localStorage.setItem(ALERT_THRESHOLDS_KEY, JSON.stringify(thresholds))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    notify('Alerts', 'Thresholds saved', 'success')
  }

  const metrics: { key: keyof AlertThresholds; label: string; sublabel: string; color: string }[] = [
    { key: 'cpu', label: 'CPU Load', sublabel: 'Alert when CPU% exceeds this value', color: '#f87171' },
    { key: 'ram', label: 'RAM Usage', sublabel: 'Alert when RAM% exceeds this value', color: '#60a5fa' },
    { key: 'gpu', label: 'GPU VRAM', sublabel: 'Alert when VRAM% exceeds this value', color: '#a78bfa' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '16px' }}>
        {metrics.map(({ key, label, sublabel, color }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: '#f4f4f5', letterSpacing: '0.03em' }}>{label}</div>
              <div style={{ fontSize: '10px', color: '#52525b', marginTop: '2px' }}>{sublabel}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <input
                type="range"
                min={0}
                max={100}
                value={thresholds[key]}
                onChange={e => setThresholds(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                style={{ width: '120px', accentColor: color }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', width: '52px' }}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={thresholds[key]}
                  onChange={e => setThresholds(prev => ({ ...prev, [key]: Math.max(0, Math.min(100, Number(e.target.value))) }))}
                  style={{
                    width: '40px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '5px', padding: '3px 6px', fontSize: '11px', fontFamily: 'monospace',
                    color: thresholds[key] === 0 ? '#4b5563' : color, textAlign: 'right',
                  }}
                />
                <span style={{ fontSize: '10px', color: '#4b5563' }}>%</span>
              </div>
              {thresholds[key] === 0 && (
                <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#3f3f46', textTransform: 'uppercase', letterSpacing: '0.1em', width: '32px' }}>OFF</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {saved ? (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--signal)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Check size={10} /> Thresholds saved
          </motion.span>
        ) : <span />}
        <button
          onClick={save}
          style={{ padding: '7px 18px', borderRadius: '8px', fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', background: 'var(--crimson-10)', border: '1px solid var(--crimson-25)', color: 'var(--crimson)' }}
        >
          Save Thresholds
        </button>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { theme, setTheme, soundEnabled, setSoundEnabled, animationsEnabled, setAnimationsEnabled, playSound } = useTheme()
  const [chwdOutput, setChwdOutput] = useState('')
  const [chwdBusy, setChwdBusy] = useState(false)
  const [mirrorBusy, setMirrorBusy] = useState(false)
  const [mirrorOutput, setMirrorOutput] = useState('')
  const [fprintdInfo, setFprintdInfo] = useState<{ active: boolean; devices: string } | null>(null)
  const [snapperBusy, setSnapperBusy] = useState(false)

  const createSnapshot = async (desc?: string) => {
    setSnapperBusy(true)
    const res = await window.electron.systemSnapperSnapshot(desc)
    setSnapperBusy(false)
    if (res.success) {
      notify('Safety', `Snapshot created: ${desc || 'Manual'}`, 'success')
    } else {
      notify('Safety', `Snapshot failed: ${res.error}`, 'error')
    }
    return res.success
  }

  useEffect(() => {
    window.electron?.fprintdStatus?.().then(r => {
      if (r) setFprintdInfo({ active: r.active, devices: r.devices })
    })
  }, [])

  const runChwdDetect = async () => {
    setChwdBusy(true); setChwdOutput('')
    const r = await window.electron.chwdDetect()
    setChwdOutput(r.output ?? r.error ?? '')
    setChwdBusy(false)
  }

  const runRateMirrors = async () => {
    setMirrorBusy(true); setMirrorOutput('')
    const r = await window.electron.cachyosRateMirrors()
    setMirrorOutput(r.output ?? r.error ?? '')
    setMirrorBusy(false)
  }

  const handleTheme = (t: ThemeType) => {
    setTheme(t)
    playSound('click')
  }

  return (
    <div style={{ maxWidth: '680px' }}>

      {/* Interface */}
      <Section title="// Interface">
        {/* Theme */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Palette size={12} />
            Theme
          </div>

          {/* Colour accents */}
          <div style={{ fontSize: '8px', fontFamily: 'monospace', color: '#3f3f46', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>Colour Accents</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px' }}>
            {COLOR_THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => handleTheme(t.id)}
                style={{
                  padding: '12px 8px', borderRadius: '12px', border: `1px solid ${theme.name === t.id ? t.color : 'rgba(255,255,255,0.05)'}`,
                  background: theme.name === t.id ? `${t.color}15` : 'rgba(255,255,255,0.02)',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
                }}
              >
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: t.color, boxShadow: theme.name === t.id ? `0 0 10px ${t.color}80` : 'none' }} />
                <span style={{ fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: theme.name === t.id ? t.color : '#52525b' }}>
                  {t.label}
                </span>
                {theme.name === t.id && <Check size={10} style={{ color: t.color }} />}
              </button>
            ))}
          </div>

          {/* Visual / animated themes */}
          <div style={{ fontSize: '8px', fontFamily: 'monospace', color: '#3f3f46', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Sparkles size={9} style={{ color: '#52525b' }} /> Visual FX
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {VISUAL_THEMES.map(t => {
              const isActive = theme.name === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => handleTheme(t.id)}
                  style={{
                    padding: '14px 8px', borderRadius: '12px',
                    border: `1px solid ${isActive ? t.color : 'rgba(255,255,255,0.05)'}`,
                    background: isActive ? `${t.color}12` : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', transition: 'all 0.2s', position: 'relative', overflow: 'hidden'
                  }}
                >
                  {/* Animated preview swatch */}
                  {t.preview === 'scanlines' && (
                    <div style={{ width: '36px', height: '20px', borderRadius: '4px', background: t.color, position: 'relative', overflow: 'hidden', boxShadow: isActive ? `0 0 10px ${t.color}80` : 'none' }}>
                      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, transparent 0px, transparent 1px, rgba(0,0,0,0.35) 1px, rgba(0,0,0,0.35) 2px)' }} />
                    </div>
                  )}
                  {t.preview === 'pulse' && (
                    <div style={{ width: '36px', height: '20px', borderRadius: '4px', background: `${t.color}20`, border: `1px solid ${t.color}`, boxShadow: isActive ? `0 0 12px ${t.color}60, 0 0 24px ${t.color}30` : `0 0 6px ${t.color}40` }} />
                  )}
                  {t.preview === 'holo' && (
                    <div style={{ width: '36px', height: '20px', borderRadius: '4px', background: 'linear-gradient(135deg, #ff0080, #7f00ff, #00d4ff, #00ff88)', opacity: isActive ? 1 : 0.6 }} />
                  )}
                  <span style={{ fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: isActive ? t.color : '#52525b', lineHeight: 1.3, textAlign: 'center' }}>
                    {t.label}
                  </span>
                  {isActive && <Check size={10} style={{ color: t.color }} />}
                  <div style={{ position: 'absolute', top: '5px', right: '5px', fontSize: '7px', fontFamily: 'monospace', color: '#3f3f46', background: 'rgba(255,255,255,0.04)', padding: '1px 4px', borderRadius: '3px' }}>FX</div>
                </button>
              )
            })}
          </div>
        </div>

        <Toggle
          enabled={soundEnabled}
          onChange={setSoundEnabled}
          label="Sound Effects"
          sublabel="Haptic audio feedback on interactions"
          icon={Volume2}
          offIcon={VolumeX}
        />
        <Toggle
          enabled={animationsEnabled}
          onChange={setAnimationsEnabled}
          label="UI Animations"
          sublabel="Page transitions and motion effects"
          icon={Zap}
          offIcon={ZapOff}
        />
      </Section>

      {/* System Safety */}
      <Section title="// System Safety">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={14} style={{ color: 'var(--crimson)' }} />
            <div>
              <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: '#f4f4f5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Btrfs Safety Net (Snapper)</div>
              <div style={{ fontSize: '10px', color: '#52525b', marginTop: '2px' }}>Create a pre-change snapshot of your root filesystem</div>
            </div>
          </div>
          <button
            onClick={() => createSnapshot()}
            disabled={snapperBusy}
            style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: snapperBusy ? '#52525b' : 'var(--crimson)', background: 'var(--crimson-05)', border: '1px solid var(--crimson-15)', borderRadius: '6px', padding: '5px 12px', cursor: snapperBusy ? 'default' : 'pointer' }}
          >
            {snapperBusy ? 'Creating...' : 'Snapshot Now'}
          </button>
        </div>
        <p style={{ fontSize: '10px', color: '#52525b', marginLeft: '24px' }}>
          Vortex creates automatic "pre" snapshots before package installs or system overrides. You can revert these via the CachyOS GRUB menu or <code style={{ color: '#71717a' }}>snapper</code> CLI.
        </p>
      </Section>

      {/* CachyOS Hardware */}
      <Section title="// CachyOS Hardware">
        {/* chwd */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Cpu size={14} style={{ color: 'var(--crimson)' }} />
              <div>
                <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: '#f4f4f5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hardware Detection (chwd)</div>
                <div style={{ fontSize: '10px', color: '#52525b', marginTop: '2px' }}>Detect and install optimal hardware drivers</div>
              </div>
            </div>
            <button
              onClick={runChwdDetect}
              disabled={chwdBusy}
              style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: chwdBusy ? '#52525b' : 'var(--crimson)', background: 'var(--crimson-05)', border: '1px solid var(--crimson-15)', borderRadius: '6px', padding: '5px 12px', cursor: chwdBusy ? 'default' : 'pointer' }}
            >
              {chwdBusy ? 'Scanning...' : 'Detect'}
            </button>
          </div>
          {chwdOutput && (
            <pre style={{ fontSize: '9px', fontFamily: 'monospace', color: '#71717a', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '10px', maxHeight: '140px', overflow: 'auto', margin: 0, whiteSpace: 'pre-wrap' }}>
              {chwdOutput}
            </pre>
          )}
        </div>

        {/* cachyos-rate-mirrors */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Globe size={14} style={{ color: 'var(--crimson)' }} />
              <div>
                <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: '#f4f4f5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mirror Ranking</div>
                <div style={{ fontSize: '10px', color: '#52525b', marginTop: '2px' }}>Rate and update CachyOS mirrors by latency</div>
              </div>
            </div>
            <button
              onClick={runRateMirrors}
              disabled={mirrorBusy}
              style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: mirrorBusy ? '#52525b' : 'var(--crimson)', background: 'var(--crimson-05)', border: '1px solid var(--crimson-15)', borderRadius: '6px', padding: '5px 12px', cursor: mirrorBusy ? 'default' : 'pointer' }}
            >
              {mirrorBusy ? 'Rating...' : 'Rate Mirrors'}
            </button>
          </div>
          {mirrorOutput && (
            <pre style={{ fontSize: '9px', fontFamily: 'monospace', color: '#71717a', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '10px', maxHeight: '100px', overflow: 'auto', margin: 0, whiteSpace: 'pre-wrap' }}>
              {mirrorOutput}
            </pre>
          )}
        </div>

        {/* fprintd */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Fingerprint size={14} style={{ color: fprintdInfo?.active ? 'var(--crimson)' : '#52525b' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: '#f4f4f5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fingerprint (fprintd)</div>
              <div style={{ fontSize: '10px', color: '#52525b', marginTop: '2px' }}>
                {fprintdInfo ? (fprintdInfo.active ? `Active · ${fprintdInfo.devices}` : fprintdInfo.devices) : 'Checking...'}
              </div>
            </div>
            <div style={{ fontSize: '9px', fontFamily: 'monospace', letterSpacing: '0.1em', color: fprintdInfo?.active ? '#10b981' : '#3f3f46', textTransform: 'uppercase' }}>
              {fprintdInfo ? (fprintdInfo.active ? 'Active' : 'Inactive') : '—'}
            </div>
          </div>
        </div>
      </Section>

      {/* Resource Alerts */}
      <Section title="// Resource Alerts">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <Bell size={14} style={{ color: '#71717a' }} />
          <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Alert Thresholds
          </span>
        </div>
        <p style={{ fontSize: '10px', color: '#52525b', marginBottom: '16px', marginLeft: '26px' }}>
          Vortex fires in-app and desktop notifications when a metric exceeds its threshold. Set to 0 to disable a metric. Alerts have a 5-minute cooldown per metric.
        </p>
        <AlertThresholdsEditor />
      </Section>

      {/* About */}
      <Section title="// About">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {[
            ['Application', 'Vortex V2'],
            ['Version', 'v2.0.1-beta'],
            ['Runtime', 'Electron 41 / Node 24'],
            ['Frontend', 'React 19 + Vite 8'],
            ['Styling', 'Tailwind 4 + Framer Motion'],
          ].map(([k, v]) => (
            <div key={k} style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#52525b', marginBottom: '4px' }}>{k}</div>
              <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#a1a1aa' }}>{v}</div>
            </div>
          ))}
        </div>
      </Section>

    </div>
  )
}
