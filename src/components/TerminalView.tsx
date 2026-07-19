import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, X, KeyRound, Search, Columns2, Rows2, Maximize2 } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import TerminalSession from './TerminalSession'

// ── Destructive patterns ────────────────────────────────────────────────────
const DANGEROUS: Array<{ re: RegExp; reason: string }> = [
  { re: /rm\s+(-[^\s]*f[^\s]*\s+.*\/|.*\s+-[^\s]*f[^\s]*\s+.*\/)/, reason: 'Recursive force-remove from root path' },
  { re: /rm\s+(-[^\s]*r[^\s]*|-[^\s]*R[^\s]*)\s+(\/|~|\.\.\/|"\$HOME")/, reason: 'Recursive remove from home or root' },
  { re: /dd\s+.*of\s*=\s*\/dev\/(sd|nvme|hd|disk|vd)/i, reason: 'Writing directly to a block device' },
  { re: /mkfs/i, reason: 'Formatting a filesystem' },
  { re: />\s*\/dev\/(sd|nvme|hd)/i, reason: 'Redirecting output to a block device' },
  { re: /:\(\)\s*\{\s*:\s*\|/, reason: 'Fork bomb detected' },
  { re: /(curl|wget)\s+[^\s]+\s*\|\s*(ba)?sh/i, reason: 'Piping remote script to shell' },
  { re: /shred\s+.*\/dev\//i, reason: 'Shredding a device file' },
  { re: /wipefs/i, reason: 'Wiping filesystem signatures' },
]
function isDangerous(cmd: string): string | null {
  for (const { re, reason } of DANGEROUS) if (re.test(cmd)) return reason
  return null
}

interface TermEntry { id: number; command: string; dir: string; output: string; exitCode: number | null }

interface Tab {
  id: string
  name: string
  entries: TermEntry[]
  cwd: string
  history: string[]
  histIdx: number
  alive: boolean
  input: string
}

let nextId = 0
let tabNameCounter = 1

interface SavedSession {
  tabs: { id: string; name: string }[]
  histories: Record<string, string[]>
  activeTabId: string
}

const SESSION_KEY = 'vortex-term-sessions'

function loadSession(): SavedSession | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') } catch { return null }
}

function saveSession(tabs: Tab[], activeTabId: string) {
  const data: SavedSession = {
    tabs: tabs.map(t => ({ id: t.id, name: t.name })),
    histories: Object.fromEntries(tabs.map(t => [t.id, t.history])),
    activeTabId,
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(data))
}


export default function TerminalView() {
  const [tabs, setTabs]           = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string>('')
  const [paneIds, setPaneIds]     = useState<string[]>([]) // IDs of tabs visible as panes
  const [splitDir, setSplitDir]   = useState<'vertical' | 'horizontal'>('horizontal')
  const [splitRatio, setSplitRatio] = useState(50)
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [dangerPrompt, setDangerPrompt] = useState<{ cmd: string; reason: string; tabId: string } | null>(null)
  const [sudoPrompt, setSudoPrompt]   = useState<{ cmd: string; rest: string; tabId: string } | null>(null)
  
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const [sudoPassword, setSudoPassword] = useState('')
  const sudoPwRef = useRef<HTMLInputElement>(null)
  
  const [pastePrompt, setPastePrompt] = useState<{ text: string; tabId: string } | null>(null)
  const [hungTabId, setHungTabId] = useState<string | null>(null)
  const hungTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync paneIds with active tab if empty
  useEffect(() => {
    if (activeTabId && paneIds.length === 0) setPaneIds([activeTabId])
  }, [activeTabId, paneIds.length])

  // Ghost-text suggestion for active tab
  const getGhostSuffix = (id: string) => {
    const t = tabs.find(x => x.id === id)
    if (!t?.input.trim()) return ''
    const match = t.history.find(h => h.startsWith(t.input) && h !== t.input)
    return match ? match.slice(t.input.length) : ''
  }

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const stopResizing = useCallback(() => {
    setIsResizing(false)
  }, [])

  const resize = useCallback((e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    let ratio: number
    if (splitDir === 'horizontal') {
      ratio = ((e.clientY - rect.top) / rect.height) * 100
    } else {
      ratio = ((e.clientX - rect.left) / rect.width) * 100
    }
    setSplitRatio(Math.max(10, Math.min(90, ratio)))
  }, [isResizing, splitDir])

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize)
      window.addEventListener('mouseup', stopResizing)
    } else {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
    }
    return () => {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
    }
  }, [isResizing, resize])

  // Ctrl+F to toggle search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault()
        setShowSearch(v => {
          if (!v) setTimeout(() => searchRef.current?.focus(), 50)
          else setSearchQuery('')
          return !v
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Persist session whenever tabs or active tab change
  useEffect(() => {
    if (tabs.length > 0) saveSession(tabs, activeTabId)
  }, [tabs, activeTabId])

  // Init: restore from saved session or create fresh
  useEffect(() => {
    const el = (window as any).electron
    if (!el) return

    const init = async () => {
      const [liveTabs, defaultId, saved] = await Promise.all([
        el.ptyListTabs() as Promise<{ id: string; alive: boolean }[]>,
        el.ptyGetDefaultTab() as Promise<string>,
        Promise.resolve(loadSession()),
      ])

      const liveIds = new Set(liveTabs.map((t: { id: string }) => t.id))

      // Determine which tabs to restore: saved tabs still alive in main process
      const toRestore = saved
        ? saved.tabs.filter(t => liveIds.has(t.id))
        : [{ id: defaultId, name: 'Terminal 1' }]

      if (toRestore.length === 0) toRestore.push({ id: defaultId, name: 'Terminal 1' })

      // Fetch scrollback for each tab to restore as a visual entry
      const restoredTabs: Tab[] = await Promise.all(
        toRestore.map(async (t) => {
          const buf: string = await el.ptyGetBuffer(t.id)
          const history: string[] = saved?.histories?.[t.id] ?? []
          const entries = buf.trim()
            ? [{ id: nextId++, command: '(restored session)', dir: '~', output: buf, exitCode: 0 }]
            : []
          return { id: t.id, name: t.name, entries, cwd: '~', history, histIdx: -1, alive: true, input: '' }
        })
      )

      // Track highest tab number used
      const nums = restoredTabs.map(t => {
        const m = t.name.match(/Terminal (\d+)/)
        return m ? parseInt(m[1], 10) : 0
      })
      tabNameCounter = Math.max(...nums, restoredTabs.length) + 1

      const savedActiveId = saved?.activeTabId ?? defaultId
      const activeId = liveIds.has(savedActiveId) ? savedActiveId : restoredTabs[0].id

      setTabs(restoredTabs)
      setActiveTabId(activeId)
      setPaneIds([activeId])
    }

    init()

    const onData = ({ tabId, text }: { tabId: string; text: string }) => {
      setTabs(prev => prev.map(t => {
        if (t.id !== tabId) return t
        const ri = [...t.entries].reverse().findIndex(e => e.exitCode === null)
        if (ri === -1) return t
        const realIdx = t.entries.length - 1 - ri
        const entries = [...t.entries]
        entries[realIdx] = { ...entries[realIdx], output: entries[realIdx].output + text }
        return { ...t, entries }
      }))
    }

    const onDone = ({ tabId, exitCode, cwd: newCwd }: { tabId: string; exitCode: number; cwd: string }) => {
      if (hungTimerRef.current) { clearTimeout(hungTimerRef.current); hungTimerRef.current = null }
      setHungTabId(null)
      setTabs(prev => prev.map(t => {
        if (t.id !== tabId) return t
        const ri = [...t.entries].reverse().findIndex(e => e.exitCode === null)
        if (ri === -1) return { ...t, cwd: newCwd }
        const realIdx = t.entries.length - 1 - ri
        const entries = [...t.entries]
        entries[realIdx] = { ...entries[realIdx], exitCode }
        return { ...t, entries, cwd: newCwd }
      }))
    }

    el.on('pty-data', onData)
    el.on('pty-done', onDone)
    return () => { el.removeListener('pty-data'); el.removeListener('pty-done') }
  }, [])

  const createTab = useCallback(async () => {
    const el = (window as any).electron
    if (!el) return
    const tabId: string = await el.ptyCreate()
    const name = `Terminal ${tabNameCounter++}`
    setTabs(prev => [...prev, { id: tabId, name, entries: [], cwd: '~', history: [], histIdx: -1, alive: true, input: '' }])
    setActiveTabId(tabId)
    setPaneIds([tabId])
    await el.ptySetActive(tabId)
  }, [])

  const splitPane = async () => {
    const el = (window as any).electron
    if (!el) return
    const tabId: string = await el.ptyCreate()
    const name = `Terminal ${tabNameCounter++}`
    setTabs(prev => [...prev, { id: tabId, name, entries: [], cwd: '~', history: [], histIdx: -1, alive: true, input: '' }])
    setPaneIds(prev => [...prev, tabId].slice(-2)) // Max 2 panes for now
    setActiveTabId(tabId)
  }

  const closeTab = useCallback(async (tabId: string) => {
    const el = (window as any).electron
    if (!el) return
    const remaining = tabs.filter(t => t.id !== tabId)
    if (remaining.length === 0) return
    await el.ptyClose(tabId)
    setTabs(remaining)
    setPaneIds(prev => prev.filter(id => id !== tabId))
    if (activeTabId === tabId) {
      const next = remaining[remaining.length - 1]
      setActiveTabId(next.id)
    }
  }, [tabs, activeTabId])

  const handlePaste = (e: React.ClipboardEvent, tabId: string) => {
    const text = e.clipboardData.getData('text')
    if (text.includes('\n') || text.length > 512) {
      e.preventDefault()
      setPastePrompt({ text, tabId })
    }
  }

  const executeCommand = useCallback(async (cmd: string, tabId: string) => {
    setTabs(prev => prev.map(t => {
      if (t.id !== tabId) return t
      return {
        ...t, input: '',
        history: [cmd, ...t.history.filter(c => c !== cmd)].slice(0, 200),
        histIdx: -1,
        entries: [...t.entries, { id: nextId++, command: cmd, dir: t.cwd, output: '', exitCode: null }]
      }
    }))
    const el = (window as any).electron
    if (el?.dbLogCommand) {
        el.dbLogCommand({ command: cmd, source: 'terminal' })
    }
    if (hungTimerRef.current) clearTimeout(hungTimerRef.current)
    setHungTabId(null)
    hungTimerRef.current = setTimeout(() => setHungTabId(tabId), 30000)
    await el?.ptyWrite({ tabId, command: cmd })
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, tabId: string) => {
    const tab = tabs.find(t => t.id === tabId)
    if (!tab) return
    if (e.key === 'Enter') {
      const cmd = tab.input.trim()
      if (!cmd) return
      if (/^sudo\s+/.test(cmd)) {
        setSudoPrompt({ cmd, rest: cmd.replace(/^sudo\s+/, ''), tabId })
        setTimeout(() => sudoPwRef.current?.focus(), 50)
      } else if (isDangerous(cmd)) {
        setDangerPrompt({ cmd, reason: isDangerous(cmd)!, tabId })
      } else {
        executeCommand(cmd, tabId)
      }
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const n = Math.min(tab.histIdx + 1, tab.history.length - 1)
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, histIdx: n, input: tab.history[n] ?? '' } : t))
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const n = tab.histIdx - 1
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, histIdx: n < 0 ? -1 : n, input: n < 0 ? '' : (tab.history[n] ?? '') } : t))
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.4)', borderRadius: '24px', border: '1px solid var(--border)', overflow: 'hidden', position: 'relative' }}>
      
      {/* Modals (Sudo, Danger, Paste) - same as before, simplified for brevity */}
      <AnimatePresence>
        {dangerPrompt && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="v-card" style={{ width: '400px', padding: '30px', border: '1px solid rgba(239,68,68,0.5)', boxShadow: '0 0 40px rgba(239,68,68,0.2)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--crimson)', margin: '0 0 10px 0' }}>Destructive Command Detected</h3>
              <p style={{ fontSize: '11px', color: '#a1a1aa', margin: '0 0 20px 0' }}>{dangerPrompt.reason}. Are you sure you want to proceed?</p>
              <div style={{ background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '10px', color: '#f87171', marginBottom: '20px', wordBreak: 'break-all' }}>{dangerPrompt.cmd}</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setDangerPrompt(null)} style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => { executeCommand(dangerPrompt.cmd, dangerPrompt.tabId); setDangerPrompt(null) }} style={{ flex: 1, padding: '10px', background: 'rgba(239,68,68,0.2)', border: '1px solid var(--crimson)', color: 'var(--crimson)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Execute Anyway</button>
              </div>
            </div>
          </div>
        )}
        {sudoPrompt && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="v-card" style={{ width: '400px', padding: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <KeyRound size={20} className="text-signal" />
                <span style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Sudo Required</span>
              </div>
              <input ref={sudoPwRef} type="password" value={sudoPassword} onChange={e => setSudoPassword(e.target.value)} placeholder="Password..." 
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px', color: 'white', marginBottom: '15px' }} />
              <button onClick={() => { executeCommand(`printf '%s\\n' '${sudoPassword.replace(/'/g, "'\\''")}' | sudo -S ${sudoPrompt.rest}`, sudoPrompt.tabId); setSudoPrompt(null); setSudoPassword('') }} 
                style={{ width: '100%', padding: '10px', background: 'var(--signal)', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Authenticate</button>
            </div>
          </div>
        )}
        {pastePrompt && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="v-card" style={{ width: '500px', padding: '30px', border: '1px solid rgba(34,197,94,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
                <Maximize2 size={16} className="text-signal" />
                <span style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Multi-line Paste Warning</span>
              </div>
              <p style={{ fontSize: '11px', color: '#a1a1aa', margin: '0 0 20px 0' }}>You are about to paste {pastePrompt.text.split('\n').length} lines. This may execute commands immediately.</p>
              <div style={{ background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '10px', color: '#a1a1aa', marginBottom: '20px', maxHeight: '200px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>{pastePrompt.text}</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setPastePrompt(null)} style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => { 
                  const el = (window as any).electron
                  el?.ptyWrite({ tabId: pastePrompt.tabId, command: pastePrompt.text })
                  setPastePrompt(null)
                }} style={{ flex: 1, padding: '10px', background: 'rgba(34,197,94,0.2)', border: '1px solid var(--signal)', color: 'var(--signal)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Paste Anyway</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border)', padding: '0 8px' }}>
        <div style={{ display: 'flex', overflowX: 'auto', flex: 1 }}>
          {tabs.map(t => (
            <div key={t.id} onClick={() => { setActiveTabId(t.id); setPaneIds([t.id]) }}
              style={{ padding: '10px 16px', fontSize: '10px', fontFamily: 'monospace', cursor: 'pointer', borderBottom: activeTabId === t.id ? '2px solid var(--crimson)' : '2px solid transparent', color: activeTabId === t.id ? 'white' : '#52525b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: t.alive ? 'var(--signal)' : 'var(--crimson)' }} />
              {t.name}
              {tabs.length > 1 && <X size={10} onClick={e => { e.stopPropagation(); closeTab(t.id) }} />}
            </div>
          ))}
          <button onClick={createTab} style={{ background: 'none', border: 'none', color: '#3f3f46', cursor: 'pointer', padding: '10px' }}><Plus size={14} /></button>
        </div>
        
        <div style={{ display: 'flex', gap: '4px', padding: '0 8px', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={() => { setSplitDir('vertical'); splitPane() }} style={{ background: 'none', border: 'none', color: '#3f3f46', cursor: 'pointer', padding: '6px' }} title="Split Vertical"><Columns2 size={14} /></button>
          <button onClick={() => { setSplitDir('horizontal'); splitPane() }} style={{ background: 'none', border: 'none', color: '#3f3f46', cursor: 'pointer', padding: '6px' }} title="Split Horizontal"><Rows2 size={14} /></button>
          <button onClick={() => setPaneIds([activeTabId])} style={{ background: 'none', border: 'none', color: '#3f3f46', cursor: 'pointer', padding: '6px' }} title="Unsplit"><Maximize2 size={14} /></button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Search size={12} style={{ color: '#52525b' }} />
          <input ref={searchRef} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search output..." 
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: '11px', fontFamily: 'monospace' }} />
          <X size={12} onClick={() => setShowSearch(false)} style={{ cursor: 'pointer', color: '#52525b' }} />
        </div>
      )}

      {/* Main Panes View */}
      <div 
        ref={containerRef}
        style={{ flex: 1, display: 'flex', flexDirection: splitDir === 'horizontal' ? 'column' : 'row', gap: 0, background: 'var(--border)', minHeight: 0, position: 'relative' }}
      >
        {paneIds.map((pid, idx) => {
          const t = tabs.find(x => x.id === pid)
          if (!t) return null

          const isFirst = idx === 0
          const hasTwo = paneIds.length === 2
          
          let sizeStyle: React.CSSProperties = { flex: 1 }
          if (hasTwo) {
            const size = isFirst ? `${splitRatio}%` : `${100 - splitRatio}%`
            sizeStyle = { flex: `0 0 ${size}` }
          }

          return (
            <div key={pid} style={{ ...sizeStyle, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, position: 'relative' }}>
              {hungTabId === pid && (
                <div style={{ padding: '6px 14px', background: 'rgba(245,158,11,0.12)', borderBottom: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Command may be hung — press Ctrl+C to cancel
                  </span>
                  <button onClick={() => { (window as any).electron?.ptyWrite({ tabId: pid, command: '\x03' }); setHungTabId(null) }}
                    style={{ marginLeft: 'auto', fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}>
                    Send Ctrl+C
                  </button>
                </div>
              )}
              <TerminalSession
                {...t}
                active={activeTabId === pid}
                ghostSuffix={getGhostSuffix(pid)}
                matchedIds={searchQuery ? new Set(t.entries.filter(e => e.output.toLowerCase().includes(searchQuery.toLowerCase())).map(e => e.id)) : null}
                setInput={v => setTabs(prev => prev.map(x => x.id === pid ? { ...x, input: v } : x))}
                onExecute={cmd => executeCommand(cmd, pid)}
                onKeyDown={e => handleKeyDown(e, pid)}
                onPaste={e => handlePaste(e, pid)}
                onFocus={() => setActiveTabId(pid)}
                onClear={() => setTabs(prev => prev.map(x => x.id === pid ? { ...x, entries: [] } : x))}
              />
              {isFirst && hasTwo && (
                <div 
                  onMouseDown={startResizing}
                  style={{
                    position: 'absolute',
                    zIndex: 100,
                    cursor: splitDir === 'horizontal' ? 'ns-resize' : 'ew-resize',
                    background: isResizing ? 'var(--crimson)' : 'rgba(255,255,255,0.05)',
                    width: splitDir === 'vertical' ? '4px' : '100%',
                    height: splitDir === 'horizontal' ? '4px' : '100%',
                    right: splitDir === 'vertical' ? '-2px' : 0,
                    bottom: splitDir === 'horizontal' ? '-2px' : 0,
                    transition: 'background 0.2s'
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
