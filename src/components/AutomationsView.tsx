import { useState, useCallback, useEffect } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import { Plus, Play, Trash2, GripVertical, CheckCircle2, XCircle, Loader2, ChevronRight, Pencil, Save, X, Zap, Terminal, Package, RefreshCw, Cpu, Camera, HardDrive } from 'lucide-react'
import { kvGetJson, kvSetJson } from '../lib/kv'

const AUTOMATIONS_KEY = 'vortex-automations'

interface AutoStep {
  id: string
  templateId: string
  label: string
  command: string
  editable: boolean
  customCommand?: string
}

interface Automation {
  id: string
  name: string
  steps: AutoStep[]
  createdAt: number
}

type StepStatus = 'idle' | 'running' | 'done' | 'error'

interface RunState {
  stepStatuses: Record<string, StepStatus>
  stepOutputs: Record<string, string>
  running: boolean
  aborted: boolean
}

const TEMPLATES: { id: string; label: string; command: string; icon: any; color: string; editable: boolean }[] = [
  { id: 'repo-upgrade',    label: 'Repo Upgrade',       command: 'sudo pacman -Syu --noconfirm',                icon: Zap,       color: '#22d3ee', editable: false },
  { id: 'aur-upgrade',     label: 'AUR Upgrade',         command: 'paru -Sua --noconfirm',                       icon: Package,   color: '#a78bfa', editable: false },
  { id: 'full-upgrade',    label: 'Full System Upgrade', command: 'paru -Syu --noconfirm',                       icon: RefreshCw, color: '#f59e0b', editable: false },
  { id: 'clean-cache',     label: 'Clean Package Cache', command: 'paru -Sc --noconfirm',                        icon: Trash2,    color: '#f87171', editable: false },
  { id: 'clean-journal',   label: 'Vacuum Journal',      command: 'sudo journalctl --vacuum-time=7d',             icon: HardDrive, color: '#6b7280', editable: false },
  { id: 'rebuild-native',  label: 'Rebuild Native Pkgs', command: 'paru -S --rebuild $(paru -Qm | awk \'{print $1}\')',  icon: Cpu,       color: '#34d399', editable: false },
  { id: 'rate-mirrors',    label: 'Rate CachyOS Mirrors',command: 'sudo cachyos-rate-mirrors',                   icon: RefreshCw, color: '#60a5fa', editable: false },
  { id: 'snapshot',        label: 'Create Snapshot',     command: 'sudo snapper -c root create -t single -d "auto"', icon: Camera, color: '#fb923c', editable: false },
  { id: 'custom',          label: 'Custom Shell Command', command: '',                                            icon: Terminal,  color: '#94a3b8', editable: true },
]

function uid() { return Math.random().toString(36).slice(2, 9) }

function StepRow({ step, onRemove, onCommandChange, status, output }: {
  step: AutoStep
  onRemove: () => void
  onCommandChange: (cmd: string) => void
  status: StepStatus
  output?: string
}) {
  const controls = useDragControls()
  const tpl = TEMPLATES.find(t => t.id === step.templateId) ?? TEMPLATES[TEMPLATES.length - 1]
  const Icon = tpl.icon

  return (
    <Reorder.Item value={step} dragListener={false} dragControls={controls} style={{ listStyle: 'none' }}>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '6px',
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '8px', padding: '10px 12px',
        borderLeft: `3px solid ${tpl.color}22`,
        opacity: status === 'idle' ? 1 : 0.95,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            onPointerDown={(e) => controls.start(e)}
            style={{ cursor: 'grab', color: '#374151', flexShrink: 0, display: 'flex', alignItems: 'center' }}
          >
            <GripVertical size={14} />
          </div>
          <div style={{ width: '22px', height: '22px', borderRadius: '5px', background: tpl.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={12} style={{ color: tpl.color }} />
          </div>
          <span style={{ flex: 1, fontSize: '12px', color: '#e2e8f0', fontWeight: 500 }}>{step.label}</span>
          <StatusBadge status={status} />
          <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', padding: '2px' }}>
            <X size={12} />
          </button>
        </div>
        {step.editable && (
          <input
            value={step.customCommand ?? ''}
            onChange={e => onCommandChange(e.target.value)}
            placeholder="Enter shell command…"
            style={{
              marginLeft: '22px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontFamily: 'monospace',
              color: '#94a3b8', width: 'calc(100% - 22px)', boxSizing: 'border-box',
            }}
          />
        )}
        {output && (
          <pre style={{
            marginLeft: '22px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '4px', padding: '6px 8px', fontSize: '10px', fontFamily: 'monospace',
            color: status === 'error' ? '#f87171' : '#6ee7b7', maxHeight: '80px', overflow: 'auto',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: '4px 0 0 22px',
          }}>
            {output.trim()}
          </pre>
        )}
      </div>
    </Reorder.Item>
  )
}

function StatusBadge({ status }: { status: StepStatus }) {
  if (status === 'idle') return null
  if (status === 'running') return <Loader2 size={14} style={{ color: '#60a5fa', animation: 'spin 1s linear infinite' }} />
  if (status === 'done') return <CheckCircle2 size={14} style={{ color: '#34d399' }} />
  return <XCircle size={14} style={{ color: '#f87171' }} />
}

export default function AutomationsView() {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [runState, setRunState] = useState<RunState | null>(null)
  const abortRef = { current: false }

  const selected = automations.find(a => a.id === selectedId) ?? null

  useEffect(() => {
    kvGetJson<Automation[]>(AUTOMATIONS_KEY, []).then(setAutomations)
  }, [])

  const persist = useCallback((list: Automation[]) => {
    setAutomations(list)
    kvSetJson(AUTOMATIONS_KEY, list)
  }, [])

  function createNew() {
    const a: Automation = { id: uid(), name: 'New Automation', steps: [], createdAt: Date.now() }
    const next = [...automations, a]
    persist(next)
    setSelectedId(a.id)
  }

  function deleteAutomation(id: string) {
    persist(automations.filter(a => a.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  function updateSelected(patch: Partial<Automation>) {
    if (!selectedId) return
    const next = automations.map(a => a.id === selectedId ? { ...a, ...patch } : a)
    persist(next)
  }

  function addStep(tpl: typeof TEMPLATES[0]) {
    if (!selected) return
    const step: AutoStep = {
      id: uid(),
      templateId: tpl.id,
      label: tpl.label,
      command: tpl.command,
      editable: tpl.editable,
      customCommand: tpl.editable ? '' : undefined,
    }
    updateSelected({ steps: [...selected.steps, step] })
  }

  function removeStep(stepId: string) {
    if (!selected) return
    updateSelected({ steps: selected.steps.filter(s => s.id !== stepId) })
  }

  function updateStepCommand(stepId: string, cmd: string) {
    if (!selected) return
    updateSelected({ steps: selected.steps.map(s => s.id === stepId ? { ...s, customCommand: cmd } : s) })
  }

  function reorderSteps(newSteps: AutoStep[]) {
    updateSelected({ steps: newSteps })
  }

  async function runAutomation() {
    if (!selected || !selected.steps.length || runState?.running) return
    abortRef.current = false

    const statuses: Record<string, StepStatus> = {}
    const outputs: Record<string, string> = {}
    selected.steps.forEach(s => { statuses[s.id] = 'idle'; outputs[s.id] = '' })

    setRunState({ stepStatuses: { ...statuses }, stepOutputs: { ...outputs }, running: true, aborted: false })

    for (const step of selected.steps) {
      if (abortRef.current) break
      const cmd = step.editable ? (step.customCommand ?? '') : step.command
      if (!cmd.trim()) {
        setRunState(prev => prev ? {
          ...prev,
          stepStatuses: { ...prev.stepStatuses, [step.id]: 'error' },
          stepOutputs: { ...prev.stepOutputs, [step.id]: 'No command specified' },
        } : prev)
        continue
      }

      setRunState(prev => prev ? {
        ...prev, stepStatuses: { ...prev.stepStatuses, [step.id]: 'running' }
      } : prev)

      try {
        const res = await (window as any).electron.execCommand(cmd)
        const out = (res.stdout + (res.stderr ? '\n' + res.stderr : '')).trim()
        const ok = res.exitCode === 0
        setRunState(prev => prev ? {
          ...prev,
          stepStatuses: { ...prev.stepStatuses, [step.id]: ok ? 'done' : 'error' },
          stepOutputs: { ...prev.stepOutputs, [step.id]: out },
        } : prev)
        if (!ok) break
      } catch (e: any) {
        setRunState(prev => prev ? {
          ...prev,
          stepStatuses: { ...prev.stepStatuses, [step.id]: 'error' },
          stepOutputs: { ...prev.stepOutputs, [step.id]: e.message ?? 'Unknown error' },
        } : prev)
        break
      }
    }

    setRunState(prev => prev ? { ...prev, running: false } : prev)
  }

  function stopRun() { abortRef.current = true }

  const runStatus = runState
    ? Object.values(runState.stepStatuses).some(s => s === 'error') ? 'error'
    : Object.values(runState.stepStatuses).every(s => s === 'done') ? 'done'
    : runState.running ? 'running' : 'idle'
    : 'idle'

  return (
    <div style={{ display: 'flex', gap: '20px', height: 'calc(100vh - 260px)', minHeight: '500px' }}>

      {/* Left: list of automations */}
      <div style={{ width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#52525b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Saved</span>
          <button onClick={createNew} style={{
            display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', padding: '4px 8px',
            cursor: 'pointer', color: '#f87171', fontSize: '11px',
          }}>
            <Plus size={11} /> New
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {automations.length === 0 && (
            <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: '11px', color: '#3f3f46', fontStyle: 'italic' }}>
              No automations yet.<br />Click New to create one.
            </div>
          )}
          {automations.map(a => (
            <button
              key={a.id}
              onClick={() => { setSelectedId(a.id); setRunState(null) }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                background: selectedId === a.id ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${selectedId === a.id ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: '7px', padding: '8px 10px', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <ChevronRight size={12} style={{ color: selectedId === a.id ? '#ef4444' : '#4b5563', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: '12px', color: selectedId === a.id ? '#fca5a5' : '#a1a1aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.name}
              </span>
              <span style={{ fontSize: '10px', color: '#3f3f46', flexShrink: 0 }}>{a.steps.length}s</span>
              <button
                onClick={e => { e.stopPropagation(); deleteAutomation(a.id) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', padding: '1px', flexShrink: 0 }}
              >
                <Trash2 size={11} />
              </button>
            </button>
          ))}
        </div>
      </div>

      {/* Right: editor + runner */}
      {!selected ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3f3f46', fontSize: '13px', fontStyle: 'italic' }}>
          Select or create an automation to edit
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', gap: '16px', overflow: 'hidden' }}>

          {/* Editor */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
            {/* Name row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {editingName ? (
                <>
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { updateSelected({ name: nameInput }); setEditingName(false) } if (e.key === 'Escape') setEditingName(false) }}
                    style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '5px 10px', fontSize: '13px', color: 'white', fontWeight: 600 }}
                  />
                  <button onClick={() => { updateSelected({ name: nameInput }); setEditingName(false) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#34d399' }}><Save size={14} /></button>
                  <button onClick={() => setEditingName(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563' }}><X size={14} /></button>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'white', flex: 1 }}>{selected.name}</span>
                  <button onClick={() => { setNameInput(selected.name); setEditingName(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563' }}><Pencil size={12} /></button>
                </>
              )}

              {/* Run / Stop */}
              <button
                onClick={runState?.running ? stopRun : runAutomation}
                disabled={selected.steps.length === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: runState?.running ? 'rgba(239,68,68,0.15)' : 'rgba(34,211,238,0.12)',
                  border: `1px solid ${runState?.running ? 'rgba(239,68,68,0.4)' : 'rgba(34,211,238,0.3)'}`,
                  borderRadius: '7px', padding: '5px 14px', cursor: selected.steps.length === 0 ? 'not-allowed' : 'pointer',
                  color: runState?.running ? '#f87171' : '#22d3ee', fontSize: '12px', fontWeight: 600,
                  opacity: selected.steps.length === 0 ? 0.4 : 1,
                }}
              >
                {runState?.running ? <><X size={13} /> Stop</> : <><Play size={13} /> Run</>}
              </button>
            </div>

            {/* Run status banner */}
            {runState && !runState.running && (
              <div style={{
                padding: '7px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                background: runStatus === 'done' ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
                border: `1px solid ${runStatus === 'done' ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)'}`,
                color: runStatus === 'done' ? '#34d399' : '#f87171',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                {runStatus === 'done' ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                {runStatus === 'done' ? 'All steps completed successfully' : 'Automation stopped — a step failed'}
              </div>
            )}

            {/* Steps */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
              {selected.steps.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', fontSize: '12px', color: '#3f3f46', fontStyle: 'italic', border: '2px dashed rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                  Add steps from the palette →
                </div>
              ) : (
                <Reorder.Group axis="y" values={selected.steps} onReorder={reorderSteps} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selected.steps.map(step => (
                    <StepRow
                      key={step.id}
                      step={step}
                      onRemove={() => removeStep(step.id)}
                      onCommandChange={cmd => updateStepCommand(step.id, cmd)}
                      status={runState?.stepStatuses[step.id] ?? 'idle'}
                      output={runState?.stepOutputs[step.id]}
                    />
                  ))}
                </Reorder.Group>
              )}
            </div>
          </div>

          {/* Step palette */}
          <div style={{ width: '190px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#52525b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>Step Palette</span>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {TEMPLATES.map(tpl => {
                const Icon = tpl.icon
                return (
                  <button
                    key={tpl.id}
                    onClick={() => addStep(tpl)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                      borderLeft: `3px solid ${tpl.color}55`,
                      borderRadius: '7px', padding: '7px 10px', cursor: 'pointer', textAlign: 'left', width: '100%',
                    }}
                  >
                    <Icon size={12} style={{ color: tpl.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', color: '#a1a1aa' }}>{tpl.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
