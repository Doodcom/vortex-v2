import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import Sidebar from './components/Sidebar'
import Header from './components/Header'
import CommandPalette from './components/CommandPalette'
import ShortcutsOverlay from './components/ShortcutsOverlay'
import StatusBar from './components/StatusBar'
import { useTheme } from './components/ThemeProvider'

const DashboardView = lazy(() => import('./components/DashboardView'))
const UpdatesView = lazy(() => import('./components/UpdatesView'))
const CleanerView = lazy(() => import('./components/CleanerView'))
const OptimizerView = lazy(() => import('./components/OptimizerView'))
const TerminalView = lazy(() => import('./components/TerminalView'))
const SettingsPage = lazy(() => import('./components/SettingsPage'))
const ServiceView = lazy(() => import('./components/ServiceView'))
const ProcessView = lazy(() => import('./components/ProcessView'))
const NetworkView = lazy(() => import('./components/NetworkView'))
const BootView = lazy(() => import('./components/BootView'))
const DiskView = lazy(() => import('./components/DiskView'))
const AuditView = lazy(() => import('./components/AuditView'))
const PackagesView = lazy(() => import('./components/PackagesView'))
const LogView = lazy(() => import('./components/LogView'))
const SnapshotView = lazy(() => import('./components/SnapshotView'))
const HistoryView = lazy(() => import('./components/HistoryView'))
const DockerView = lazy(() => import('./components/DockerView'))
const AutomationHubView = lazy(() => import('./components/AutomationHubView'))
const SshView = lazy(() => import('./components/SshView'))
const FirewallView = lazy(() => import('./components/FirewallView'))
const VaultView = lazy(() => import('./components/VaultView'))
const HealthReportView = lazy(() => import('./components/HealthReportView'))
const SchedulerView = lazy(() => import('./components/SchedulerView'))
const DepGraph = lazy(() => import('./components/DepGraph'))
import { navItems } from './lib/navigation'
import { ALERT_THRESHOLDS_KEY, DEFAULT_THRESHOLDS, type AlertThresholds } from './lib/alerts'
import { notify } from './lib/notifications'
import type { SystemStats } from './types/electron'

interface ActiveViewProps {
  onNavigate?: (tab: string) => void
  onExplore?: (name: string) => void
  initialPackage?: string | null
  stats?: SystemStats | null
  initialTab?: 'workflows' | 'cron' | 'startup'
}

interface PackageDepTree {
  name: string
  version: string
  direct: string[]
  optional: string[]
  required: string[]
  depDetails: Record<string, string[]>
}


const VIEW_MAP: Record<string, React.ComponentType<ActiveViewProps>> = {
  dashboard: DashboardView,
  updates: UpdatesView,
  optimizer: OptimizerView,
  cleaner: CleanerView,
  packages: PackagesView,
  depgraph: DepGraphWrapper,
  processes: ProcessView,
  services: ServiceView,
  docker: DockerView,
  network: NetworkView,
  boot: BootView,
  disk: DiskView,
  audit: AuditView,
  logs: LogView,
  snapshots: SnapshotView,
  history: HistoryView,
  scheduler: SchedulerView,
  automations: AutomationHubView,
  cron: AutomationHubView,
  startup: AutomationHubView,
  ssh: SshView,
  firewall: FirewallView,
  vault: VaultView,
  health: HealthReportView,
  settings: SettingsPage,
  terminal: TerminalView
}

export default function App() {
  const { animationsEnabled } = useTheme()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(() => parseInt(localStorage.getItem('vortex-sidebar-width') ?? '256', 10))
  const [explorePkg, setExplorePkg] = useState<string | null>(null)
  const isDraggingRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragStartWidthRef = useRef(256)
  const alertCooldownRef = useRef<Record<string, number>>({ cpu: 0, ram: 0, gpu: 0 })

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!isSidebarExpanded) return
    e.preventDefault()
    isDraggingRef.current = true
    dragStartXRef.current = e.clientX
    dragStartWidthRef.current = sidebarWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [isSidebarExpanded, sidebarWidth])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      const delta = e.clientX - dragStartXRef.current
      const w = Math.max(180, Math.min(380, dragStartWidthRef.current + delta))
      const el = document.querySelector('.v-sidebar') as HTMLElement | null
      if (el) { el.style.width = `${w}px`; el.style.transition = 'none' }
    }
    const onUp = () => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      const el = document.querySelector('.v-sidebar') as HTMLElement | null
      if (el) {
        const w = parseInt(el.style.width, 10) || dragStartWidthRef.current
        el.style.transition = ''
        setSidebarWidth(w)
        localStorage.setItem('vortex-sidebar-width', String(w))
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA'

      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        const n = parseInt(e.key)
        if (n >= 1 && n <= navItems.length) {
          e.preventDefault()
          setActiveTab(navItems[n - 1].id)
          return
        }
        if (e.key === '`' && !isTyping) {
          e.preventDefault()
          setActiveTab('terminal')
          setTimeout(() => window.dispatchEvent(new CustomEvent('vortex-focus-terminal')), 50)
          return
        }
        if (e.key === 'p') {
          e.preventDefault()
          setIsCommandPaletteOpen(true)
          return
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Renderer-side context menu listener (aggresive restoration)
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      if (window.electron) {
        // Build basic props to mimic Electron's native context-menu event
        const props = {
          x: e.clientX,
          y: e.clientY,
          editFlags: {
            canCut: true,
            canCopy: true,
            canPaste: true
          }
        }
        window.electron.showContextMenu(props)
      }
    }
    window.addEventListener('contextmenu', handleContextMenu)
    return () => window.removeEventListener('contextmenu', handleContextMenu)
  }, [])

  useEffect(() => {
    const COOLDOWN = 5 * 60 * 1000
    const checkAlerts = (s: SystemStats | null, gpuUsedPct: number) => {
      const now = Date.now()
      let thresholds: AlertThresholds = DEFAULT_THRESHOLDS
      try { thresholds = { ...DEFAULT_THRESHOLDS, ...JSON.parse(localStorage.getItem(ALERT_THRESHOLDS_KEY) ?? '{}') } } catch (err) { void err }

      const metrics: { key: keyof AlertThresholds; value: number; label: string }[] = [
        { key: 'cpu', value: s?.cpu?.load ?? 0, label: 'CPU' },
        { key: 'ram', value: s?.memory ? (s.memory.used / s.memory.total) * 100 : 0, label: 'RAM' },
        { key: 'gpu', value: gpuUsedPct, label: 'GPU VRAM' },
      ]
      for (const { key, value, label } of metrics) {
        const limit = thresholds[key]
        if (limit === 0) continue
        if (value >= limit && now - (alertCooldownRef.current[key] ?? 0) > COOLDOWN) {
          alertCooldownRef.current[key] = now
          notify(`${label} Alert`, `${label} usage is ${Math.round(value)}% (threshold: ${limit}%)`, 'warning')
        }
      }
    }

    let lastGpuPct = 0
    const fetchStats = async () => {
      if (!window.electron) return
      try {
        const s = await window.electron.getSystemStats()
        setStats(s)
        try {
          const g = await window.electron.gpuVramStats()
          if (g?.success && g.total > 0) lastGpuPct = (g.used / g.total) * 100
        } catch (err) { void err }
        checkAlerts(s, lastGpuPct)
      } catch (e) {
        console.error('Failed to fetch stats:', e)
      }
    }
    fetchStats()
    const id = setInterval(fetchStats, 2000)
    return () => clearInterval(id)
  }, [])

  const handleSetActiveTab = useCallback((id: string) => {
    setActiveTab(id)
  }, [])

  const renderActiveView = () => {
    const Component = VIEW_MAP[activeTab] || (() => <div className="p-20 opacity-30 italic font-mono">View_Missing: {activeTab}</div>)
    
    // Inject special props for specific components
    const specialProps: Partial<ActiveViewProps> = {}
    if (activeTab === 'dashboard') specialProps.onNavigate = setActiveTab
    if (activeTab === 'packages') specialProps.onExplore = (name: string) => { setExplorePkg(name); setActiveTab('depgraph') }
    if (activeTab === 'depgraph') specialProps.initialPackage = explorePkg
    if (activeTab === 'dashboard' || activeTab === 'docker') specialProps.stats = stats
    if (activeTab === 'cron') specialProps.initialTab = 'cron'
    if (activeTab === 'startup') specialProps.initialTab = 'startup'

    return (
      <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', fontFamily: 'monospace', fontSize: '11px', color: '#52525b' }}>Loading module…</div>}>
        <Component {...(specialProps as ActiveViewProps)} />
      </Suspense>
    )
  }

  return (
    <div className="v-app" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
      
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleSetActiveTab}
        isExpanded={isSidebarExpanded}
        setIsExpanded={setIsSidebarExpanded}
        cpuLoad={stats?.cpu?.load ?? 0}
        sidebarWidth={sidebarWidth}
      />
      {/* Drag handle */}
      {isSidebarExpanded && (
        <div
          onMouseDown={handleDragStart}
          style={{ width: '4px', flexShrink: 0, cursor: 'col-resize', background: 'transparent', position: 'relative', zIndex: 20, transition: 'background 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(239,68,68,0.25)' }}
          onMouseLeave={e => { if (!isDraggingRef.current) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
        />
      )}

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        setIsOpen={setIsCommandPaletteOpen}
        onNavigate={setActiveTab}
      />
      <ShortcutsOverlay isOpen={isShortcutsOpen} setIsOpen={setIsShortcutsOpen} />

      <main className="v-main">
        <Header stats={stats} />

        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: 'var(--ink-900)' }}>
          {/* Subtle Grid Pattern */}
          <div style={{ 
            position: 'absolute', inset: 0, opacity: 0.03, pointerEvents: 'none',
            backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' 
          }} />

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: animationsEnabled ? 0 : 1, x: animationsEnabled ? 20 : 0 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: animationsEnabled ? 0 : 1, x: animationsEnabled ? -20 : 0 }}
              transition={{ duration: animationsEnabled ? 0.3 : 0, ease: "easeOut" }}
              style={{ height: '100%', width: '100%', padding: '32px', overflowY: 'auto', position: 'relative', zIndex: 10, boxSizing: 'border-box' }}
            >
              <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <header style={{ marginBottom: '32px' }}>
                  <h1 className="v-h1">
                    {activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace('-', ' ')}
                    <span style={{ WebkitTextFillColor: 'var(--crimson)', opacity: 0.5, marginLeft: '10px', fontStyle: 'normal', fontWeight: 300 }}>/</span>
                  </h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontFamily: 'monospace', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#334155' }}>
                    <span className="animate-pulse-dot" style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--signal)', flexShrink: 0 }} />
                    <span>System Online</span>
                  </div>
                </header>
                
                {renderActiveView()}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
        <StatusBar stats={stats} />
      </main>
    </div>
  )
}

function DepGraphWrapper({ initialPackage }: { initialPackage?: string | null }) {
  const [tree, setTree] = useState<PackageDepTree | null>(null)
  const [loading, setLoading] = useState(false)
  const [target, setTarget] = useState(initialPackage ?? 'linux')

  useEffect(() => {
    async function fetch() {
      if (!window.electron) return
      setLoading(true)
      const res = await window.electron.packageGetTree(target)
      setTree(res)
      setLoading(false)
    }
    fetch()
  }, [target])

  if (!tree && loading) return <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'monospace', color: '#52525b' }}>Analysing dependency tree...</div>
  if (!tree) return <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'monospace', color: '#52525b' }}>Failed to load dependency data.</div>

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', margin: 0 }}>Dependency Visualiser</h2>
        <p style={{ fontSize: '11px', color: '#52525b', marginTop: '4px' }}>Deep-scan of package relationships for <span style={{ color: 'var(--crimson)' }}>{target}</span></p>
      </div>
      <DepGraph tree={tree} loading={loading} onDrillDown={setTarget} />
    </div>
  )
}
