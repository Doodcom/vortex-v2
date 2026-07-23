import { useState, useEffect, useCallback } from 'react'
import { Package, Search, Download, Trash2, RefreshCw, Check, X, ChevronDown, ChevronRight, GitBranch, Play } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { notify } from '../lib/notifications'
import DepGraph, { type DepTree } from './DepGraph'

interface PkgResult { repo: string; name: string; version: string; description: string; installed: boolean; source: string }
interface AurPkg    { name: string; version: string }

type ActionState = 'idle' | 'pending' | 'running'

interface PackagesViewProps {
  onExplore?: (name: string) => void
}

export default function PackagesView({ onExplore }: PackagesViewProps) {
  const [activeTab, setActiveTab] = useState<'system' | 'flatpak' | 'appimage'>('system')
  const [helper, setHelper]     = useState('pacman')
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<PkgResult[]>([])
  const [aurPkgs, setAurPkgs]   = useState<AurPkg[]>([])
  const [searching, setSearching] = useState(false)
  const [loadingAur, setLoadingAur] = useState(true)
  const [action, setAction]     = useState<{ name: string; type: 'install' | 'remove'; state: ActionState }>({ name: '', type: 'install', state: 'idle' })
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pkgInfo, setPkgInfo]   = useState<Record<string, Record<string, string>>>({})
  const [loadingInfo, setLoadingInfo] = useState<string | null>(null)
  const [depGraph, setDepGraph]       = useState<string | null>(null)
  const [depTrees, setDepTrees]       = useState<Record<string, DepTree>>({})
  const [loadingDep, setLoadingDep]   = useState<string | null>(null)

  // Flatpak state
  const [flatpakInstalled, setFlatpakInstalled] = useState<{ id: string; name: string; version: string; summary: string }[]>([])
  const [flatpakSearchQuery, setFlatpakSearchQuery] = useState('')
  const [flatpakSearchResults, setFlatpakSearchResults] = useState<{ id: string; name: string; version: string; description: string }[]>([])
  const [flatpakSearching, setFlatpakSearching] = useState(false)
  const [flatpakLoadingInstalled, setFlatpakLoadingInstalled] = useState(false)
  const [flatpakAction, setFlatpakAction] = useState<{ id: string; type: 'install' | 'uninstall' | 'idle' }>({ id: '', type: 'idle' })
  const [flatpakUpdates, setFlatpakUpdates] = useState<{ id: string; name: string; version: string }[]>([])
  const [flatpakUpdatingAll, setFlatpakUpdatingAll] = useState(false)

  // AppImage state
  const [appimages, setAppimages] = useState<{ filename: string; path: string; registered: boolean; executable: boolean }[]>([])
  const [loadingAppimages, setLoadingAppimages] = useState(false)
  const [appimageAction, setAppimageAction] = useState<{ path: string; type: 'register' | 'unregister' | 'chmod' | 'launch' | 'idle' }>({ path: '', type: 'idle' })

  const loadFlatpaks = async () => {
    setFlatpakLoadingInstalled(true)
    const res = await window.electron.flatpakList()
    if (res.success) {
      setFlatpakInstalled(res.apps)
    } else {
      notify('Failed to load Flatpaks', res.error ?? '', 'error')
    }
    setFlatpakLoadingInstalled(false)
  }

  const checkFlatpakUpdates = async () => {
    const res = await window.electron.flatpakCheckUpdates()
    if (res.success) setFlatpakUpdates(res.updates)
  }

  const updateAllFlatpaks = async () => {
    setFlatpakUpdatingAll(true)
    const res = await window.electron.flatpakUpdateAll()
    setFlatpakUpdatingAll(false)
    if (res.success) {
      notify('Flatpaks Updated', `${flatpakUpdates.length} app(s) updated`, 'success')
      loadFlatpaks()
      checkFlatpakUpdates()
    } else {
      notify('Update Failed', res.error ?? '', 'error')
    }
  }

  const searchFlatpaks = async () => {
    if (!flatpakSearchQuery.trim()) return
    setFlatpakSearching(true)
    const res = await window.electron.flatpakSearch(flatpakSearchQuery)
    if (res.success) {
      setFlatpakSearchResults(res.results)
    } else {
      notify('Search Failed', res.error ?? '', 'error')
    }
    setFlatpakSearching(false)
  }

  const installFlatpak = async (id: string) => {
    setFlatpakAction({ id, type: 'install' })
    const res = await window.electron.flatpakInstall(id)
    setFlatpakAction({ id: '', type: 'idle' })
    if (res.success) {
      notify('Flatpak Installed', id, 'success')
      loadFlatpaks()
    } else {
      notify('Installation Failed', res.error ?? id, 'error')
    }
  }

  const uninstallFlatpak = async (id: string) => {
    setFlatpakAction({ id, type: 'uninstall' })
    const res = await window.electron.flatpakUninstall(id)
    setFlatpakAction({ id: '', type: 'idle' })
    if (res.success) {
      notify('Flatpak Uninstalled', id, 'success')
      loadFlatpaks()
    } else {
      notify('Uninstall Failed', res.error ?? id, 'error')
    }
  }

  const loadAppimages = async () => {
    setLoadingAppimages(true)
    const res = await window.electron.appimageList()
    if (res.success) {
      setAppimages(res.apps)
    } else {
      notify('Failed to load AppImages', res.error ?? '', 'error')
    }
    setLoadingAppimages(false)
  }

  const registerAppImage = async (path: string) => {
    setAppimageAction({ path, type: 'register' })
    const res = await window.electron.appimageRegister(path)
    setAppimageAction({ path: '', type: 'idle' })
    if (res.success) {
      notify('AppImage Registered', 'Desktop shortcut created', 'success')
      loadAppimages()
    } else {
      notify('Failed to Register', res.error ?? '', 'error')
    }
  }

  const unregisterAppImage = async (path: string) => {
    setAppimageAction({ path, type: 'unregister' })
    const res = await window.electron.appimageUnregister(path)
    setAppimageAction({ path: '', type: 'idle' })
    if (res.success) {
      notify('AppImage Unregistered', 'Desktop shortcut removed', 'success')
      loadAppimages()
    } else {
      notify('Failed to Unregister', res.error ?? '', 'error')
    }
  }

  const makeExecutable = async (path: string) => {
    setAppimageAction({ path, type: 'chmod' })
    const res = await window.electron.appimageMakeExecutable(path)
    setAppimageAction({ path: '', type: 'idle' })
    if (res.success) {
      notify('AppImage Executable', 'Chmod +x applied successfully', 'success')
      loadAppimages()
    } else {
      notify('Failed to make executable', res.error ?? '', 'error')
    }
  }

  const launchAppImage = async (path: string) => {
    setAppimageAction({ path, type: 'launch' })
    const res = await window.electron.appsLaunch({ exec: path })
    setAppimageAction({ path: '', type: 'idle' })
    if (res.success) {
      notify('AppImage Launched', 'Process spawned', 'success')
    } else {
      notify('Failed to Launch', res.error ?? '', 'error')
    }
  }

  useEffect(() => {
    const el = window.electron
    if (!el) return
    el.packageDetectHelper().then((h: string) => setHelper(h))
    el.packageListAur().then((pkgs: AurPkg[]) => { setAurPkgs(pkgs); setLoadingAur(false) })
  }, [])

  useEffect(() => {
    if (activeTab === 'flatpak') {
      setTimeout(() => {
        loadFlatpaks()
        checkFlatpakUpdates()
      }, 0)
    } else if (activeTab === 'appimage') {
      setTimeout(() => {
        loadAppimages()
      }, 0)
    }
  }, [activeTab])

  const loadDepTree = useCallback(async (name: string) => {
    if (depTrees[name]) { setDepGraph(name); return }
    setDepGraph(name)
    setLoadingDep(name)
    const tree = await window.electron.packageDepTree(name)
    if (tree) setDepTrees(prev => ({ ...prev, [name]: tree }))
    setLoadingDep(null)
  }, [depTrees])

  const toggleInfo = useCallback(async (name: string) => {
    if (expanded === name) { setExpanded(null); setDepGraph(null); return }
    setExpanded(name)
    if (pkgInfo[name]) return
    setLoadingInfo(name)
    const info = await window.electron.packageInfo(name)
    if (info) setPkgInfo(prev => ({ ...prev, [name]: info }))
    setLoadingInfo(null)
  }, [expanded, pkgInfo])

  const search = useCallback(async () => {
    if (!query.trim() || !window.electron) return
    setSearching(true)
    setResults([])
    const res = await window.electron.packageSearch(query)
    setResults(res)
    setSearching(false)
  }, [query])

  const installPkg = async (name: string) => {
    setAction({ name, type: 'install', state: 'running' })
    const res = await window.electron.packageInstall({ name, helper })
    setAction({ name, type: 'install', state: 'idle' })
    if (res.success) {
      notify('Package Installed', name, 'success')
      setResults(prev => prev.map(p => p.name === name ? { ...p, installed: true } : p))
    } else {
      notify('Install Failed', res.error ?? name, 'error')
    }
  }

  const removePkg = async (name: string) => {
    setAction({ name, type: 'remove', state: 'running' })
    const res = await window.electron.packageRemove(name)
    setAction({ name, type: 'remove', state: 'idle' })
    if (res.success) {
      notify('Package Removed', name, 'success')
      setResults(prev => prev.map(p => p.name === name ? { ...p, installed: false } : p))
      setAurPkgs(prev => prev.filter(p => p.name !== name))
    } else {
      notify('Remove Failed', res.error ?? name, 'error')
    }
  }

  const refreshAur = async () => {
    setLoadingAur(true)
    const pkgs = await window.electron.packageListAur()
    setAurPkgs(pkgs)
    setLoadingAur(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px', marginBottom: '8px' }}>
        <button
          onClick={() => setActiveTab('system')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            background: activeTab === 'system' ? 'var(--crimson)' : 'rgba(255,255,255,0.02)',
            border: activeTab === 'system' ? 'none' : '1px solid rgba(255,255,255,0.06)',
            color: 'white',
            fontFamily: 'monospace',
            fontSize: '11px',
            textTransform: 'uppercase',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          System Packages
        </button>
        <button
          onClick={() => setActiveTab('flatpak')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            background: activeTab === 'flatpak' ? 'var(--crimson)' : 'rgba(255,255,255,0.02)',
            border: activeTab === 'flatpak' ? 'none' : '1px solid rgba(255,255,255,0.06)',
            color: 'white',
            fontFamily: 'monospace',
            fontSize: '11px',
            textTransform: 'uppercase',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Flatpaks
        </button>
        <button
          onClick={() => setActiveTab('appimage')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            background: activeTab === 'appimage' ? 'var(--crimson)' : 'rgba(255,255,255,0.02)',
            border: activeTab === 'appimage' ? 'none' : '1px solid rgba(255,255,255,0.06)',
            color: 'white',
            fontFamily: 'monospace',
            fontSize: '11px',
            textTransform: 'uppercase',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          AppImages
        </button>
      </div>

      {activeTab === 'system' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* AUR Helper badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '6px 14px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--crimson)' }}>
              AUR_Helper: {helper}
            </div>
            <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#52525b', textTransform: 'uppercase' }}>
              {aurPkgs.length} AUR packages installed
            </div>
          </div>

          {/* Search bar */}
          <div className="v-card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Search size={16} style={{ color: '#52525b', flexShrink: 0 }} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()}
                placeholder="Search packages (official repos)..."
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#f4f4f5', fontSize: '14px', fontFamily: 'monospace' }}
              />
              <button
                onClick={search}
                disabled={searching || !query.trim()}
                style={{ padding: '8px 20px', borderRadius: '10px', background: 'var(--crimson)', border: 'none', color: 'white', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', fontWeight: 'bold', cursor: searching || !query.trim() ? 'default' : 'pointer', opacity: searching || !query.trim() ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {searching ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
                Search
              </button>
            </div>
          </div>

          {/* Search results */}
          {results.length > 0 && (
            <div className="v-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Package size={13} style={{ color: '#52525b' }} />
                <span style={{ fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#a1a1aa', fontWeight: 'bold' }}>
                  Results ({results.length})
                </span>
              </div>

              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {results.map((pkg, i) => (
                  <div key={`${pkg.repo}/${pkg.name}`}>
                    <div
                      onClick={() => toggleInfo(pkg.name)}
                      style={{ display: 'grid', gridTemplateColumns: '80px 180px 120px 1fr 130px', gap: '0 12px', padding: '9px 16px', cursor: 'pointer', borderBottom: expanded === pkg.name ? 'none' : '1px solid rgba(255,255,255,0.02)', alignItems: 'center', background: expanded === pkg.name ? 'rgba(255,255,255,0.02)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.003)' }}
                    >
                      <span style={{ fontSize: '8px', fontFamily: 'monospace', color: '#52525b', textTransform: 'uppercase' }}>{pkg.repo}</span>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#f4f4f5', fontWeight: pkg.installed ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {expanded === pkg.name ? <ChevronDown size={10} style={{ flexShrink: 0 }} /> : <ChevronRight size={10} style={{ flexShrink: 0 }} />}
                        {pkg.name}
                      </span>
                      <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#52525b' }}>{pkg.version}</span>
                      <span style={{ fontSize: '10px', color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pkg.description}</span>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        {pkg.installed ? (
                          <>
                            <span style={{ fontSize: '8px', fontFamily: 'monospace', color: 'var(--signal)', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Check size={9} /> Installed
                            </span>
                            <button onClick={e => { e.stopPropagation(); removePkg(pkg.name) }} disabled={action.state === 'running' && action.name === pkg.name}
                              style={{ padding: '2px 8px', borderRadius: '6px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: 'var(--crimson)', fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {action.state === 'running' && action.name === pkg.name && action.type === 'remove' ? <RefreshCw size={9} className="animate-spin" /> : <Trash2 size={9} />} Remove
                            </button>
                          </>
                        ) : (
                          <button onClick={e => { e.stopPropagation(); installPkg(pkg.name) }} disabled={action.state === 'running' && action.name === pkg.name}
                            style={{ padding: '2px 10px', borderRadius: '6px', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)', color: 'var(--signal)', fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {action.state === 'running' && action.name === pkg.name && action.type === 'install' ? <RefreshCw size={9} className="animate-spin" /> : <Download size={9} />} Install
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Package info panel */}
                    <AnimatePresence>
                      {expanded === pkg.name && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          style={{ overflow: 'hidden', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px 18px' }}>
                            {loadingInfo === pkg.name ? (
                              <div style={{ color: '#52525b', fontFamily: 'monospace', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <RefreshCw size={10} className="animate-spin" /> Loading package info...
                              </div>
                            ) : pkgInfo[pkg.name] ? (
                              <>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px 24px', marginBottom: 14 }}>
                                  {(['Version', 'Installed Size', 'Download Size', 'Packager', 'Build Date', 'Install Date', 'Depends On', 'Optional Deps', 'Required By', 'Description'] as const).map(key => {
                                    const val = pkgInfo[pkg.name][key]
                                    if (!val || val === 'None') return null
                                    return (
                                      <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <span style={{ fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3f3f46' }}>{key}</span>
                                        <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#a1a1aa', wordBreak: 'break-word' }}>{val}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                                <button onClick={() => depGraph === pkg.name ? setDepGraph(null) : loadDepTree(pkg.name)}
                                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '8px', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer', background: depGraph === pkg.name ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${depGraph === pkg.name ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`, color: depGraph === pkg.name ? 'var(--crimson)' : '#52525b', marginBottom: depGraph === pkg.name ? 14 : 0 }}>
                                  <GitBranch size={10} /> Dep Graph
                                </button>
                                {onExplore && (
                                  <button onClick={() => onExplore(pkg.name)}
                                    style={{ marginLeft: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '8px', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)', color: 'var(--signal)' }}>
                                    <GitBranch size={10} /> Full Graph View
                                  </button>
                                )}
                                {depGraph === pkg.name && depTrees[pkg.name] && (
                                  <DepGraph tree={depTrees[pkg.name]} loading={loadingDep === pkg.name} onDrillDown={name => loadDepTree(name)} />
                                )}
                                {depGraph === pkg.name && !depTrees[pkg.name] && loadingDep === pkg.name && (
                                  <div style={{ color: '#52525b', fontFamily: 'monospace', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <RefreshCw size={10} className="animate-spin" /> Loading dep tree...
                                  </div>
                                )}
                              </>
                            ) : (
                              <div style={{ color: '#52525b', fontFamily: 'monospace', fontSize: '10px', fontStyle: 'italic' }}>
                                {pkg.description}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AUR installed */}
          <div className="v-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Package size={13} style={{ color: 'var(--crimson)' }} />
                <span style={{ fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#a1a1aa', fontWeight: 'bold' }}>
                  AUR Installed ({aurPkgs.length})
                </span>
              </div>
              <button onClick={refreshAur} style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#52525b', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <RefreshCw size={10} className={loadingAur ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>

            <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
              {loadingAur ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#3f3f46', fontFamily: 'monospace', fontSize: '11px', fontStyle: 'italic' }}>
                  <RefreshCw size={12} className="animate-spin" style={{ display: 'inline', marginRight: '8px' }} /> Loading AUR packages...
                </div>
              ) : aurPkgs.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#3f3f46', fontFamily: 'monospace', fontSize: '11px', fontStyle: 'italic' }}>No AUR packages installed.</div>
              ) : aurPkgs.map((pkg, i) => (
                <div key={pkg.name} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 100px', gap: '0 12px', padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.02)', alignItems: 'center', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.003)', cursor: 'pointer' }}
                  onClick={() => toggleInfo(pkg.name)}>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#d4d4d8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {expanded === pkg.name ? <ChevronDown size={10} style={{ color: '#52525b' }} /> : <ChevronRight size={10} style={{ color: '#3f3f46' }} />}
                    {pkg.name}
                  </span>
                  <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#52525b' }}>{pkg.version}</span>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => removePkg(pkg.name)}
                      disabled={action.state === 'running' && action.name === pkg.name}
                      style={{ padding: '2px 8px', borderRadius: '6px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)', color: '#52525b', fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--crimson)')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#52525b')}
                    >
                      {action.state === 'running' && action.name === pkg.name
                        ? <RefreshCw size={8} className="animate-spin" />
                        : <X size={8} />
                      }
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'flatpak' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Search bar */}
          <div className="v-card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Search size={16} style={{ color: '#52525b', flexShrink: 0 }} />
              <input
                value={flatpakSearchQuery}
                onChange={e => setFlatpakSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchFlatpaks()}
                placeholder="Search Flathub (e.g. org.mozilla.firefox)..."
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#f4f4f5', fontSize: '14px', fontFamily: 'monospace' }}
              />
              <button
                onClick={searchFlatpaks}
                disabled={flatpakSearching || !flatpakSearchQuery.trim()}
                style={{ padding: '8px 20px', borderRadius: '10px', background: 'var(--crimson)', border: 'none', color: 'white', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', fontWeight: 'bold', cursor: flatpakSearching || !flatpakSearchQuery.trim() ? 'default' : 'pointer', opacity: flatpakSearching || !flatpakSearchQuery.trim() ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {flatpakSearching ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
                Search Flathub
              </button>
            </div>
          </div>

          {/* Search results */}
          {flatpakSearchResults.length > 0 && (
            <div className="v-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#a1a1aa', fontWeight: 'bold' }}>
                  Flathub Search Results ({flatpakSearchResults.length})
                </span>
              </div>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {flatpakSearchResults.map((app, i) => {
                  const isInstalled = flatpakInstalled.some(installed => installed.id === app.id)
                  const isPending = flatpakAction.id === app.id
                  return (
                    <div key={app.id} style={{ display: 'grid', gridTemplateColumns: '250px 150px 1fr 130px', gap: '12px', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.02)', alignItems: 'center', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.003)' }}>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#f4f4f5', fontWeight: 'bold' }}>{app.name}</span>
                      <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#52525b' }}>{app.id}</span>
                      <span style={{ fontSize: '10px', color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.description}</span>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        {isInstalled ? (
                          <button
                            onClick={() => uninstallFlatpak(app.id)}
                            disabled={isPending}
                            style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: 'var(--crimson)', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            {isPending && flatpakAction.type === 'uninstall' ? <RefreshCw size={9} className="animate-spin" /> : <Trash2 size={9} />}
                            Uninstall
                          </button>
                        ) : (
                          <button
                            onClick={() => installFlatpak(app.id)}
                            disabled={isPending}
                            style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)', color: 'var(--signal)', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            {isPending && flatpakAction.type === 'install' ? <RefreshCw size={9} className="animate-spin" /> : <Download size={9} />}
                            Install
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Installed Flatpaks */}
          <div className="v-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#a1a1aa', fontWeight: 'bold' }}>
                Installed Flatpaks ({flatpakInstalled.length})
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {flatpakUpdates.length > 0 && (
                  <button
                    onClick={updateAllFlatpaks}
                    disabled={flatpakUpdatingAll}
                    style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)', color: 'var(--signal)', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', fontWeight: 'bold', cursor: flatpakUpdatingAll ? 'default' : 'pointer', opacity: flatpakUpdatingAll ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <RefreshCw size={10} className={flatpakUpdatingAll ? 'animate-spin' : ''} /> Update All ({flatpakUpdates.length})
                  </button>
                )}
                <button onClick={loadFlatpaks} style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#52525b', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <RefreshCw size={10} className={flatpakLoadingInstalled ? 'animate-spin' : ''} /> Refresh List
                </button>
              </div>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {flatpakLoadingInstalled ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#3f3f46', fontFamily: 'monospace', fontSize: '11px', fontStyle: 'italic' }}>
                  <RefreshCw size={12} className="animate-spin" style={{ display: 'inline', marginRight: '8px' }} /> Loading installed flatpaks...
                </div>
              ) : flatpakInstalled.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#3f3f46', fontFamily: 'monospace', fontSize: '11px', fontStyle: 'italic' }}>No Flatpaks installed.</div>
              ) : flatpakInstalled.map((app, i) => {
                const isPending = flatpakAction.id === app.id
                return (
                  <div key={app.id} style={{ display: 'grid', gridTemplateColumns: '250px 150px 1fr 130px', gap: '12px', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.02)', alignItems: 'center', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.003)' }}>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#d4d4d8', fontWeight: 'bold' }}>{app.name}</span>
                    <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#52525b' }}>{app.id}</span>
                    <span style={{ fontSize: '10px', color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.summary}</span>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => uninstallFlatpak(app.id)}
                        disabled={isPending}
                        style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)', color: '#52525b', fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--crimson)')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#52525b')}
                      >
                        {isPending && flatpakAction.type === 'uninstall' ? <RefreshCw size={9} className="animate-spin" /> : <Trash2 size={9} />}
                        Uninstall
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'appimage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={loadAppimages} style={{ padding: '6px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: 'white', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={12} className={loadingAppimages ? 'animate-spin' : ''} /> Scan Directories
            </button>
          </div>

          <div className="v-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#a1a1aa', fontWeight: 'bold' }}>
                AppImages Found in ~/Applications & ~/Downloads ({appimages.length})
              </span>
            </div>
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {loadingAppimages ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#3f3f46', fontFamily: 'monospace', fontSize: '11px', fontStyle: 'italic' }}>
                  <RefreshCw size={12} className="animate-spin" style={{ display: 'inline', marginRight: '8px' }} /> Scanning for AppImages...
                </div>
              ) : appimages.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#3f3f46', fontFamily: 'monospace', fontSize: '11px', fontStyle: 'italic' }}>
                  No AppImages found. Place `.AppImage` files in `~/Applications` or `~/Downloads`.
                </div>
              ) : appimages.map((app, i) => {
                const isPending = appimageAction.path === app.path
                return (
                  <div key={app.path} style={{ display: 'grid', gridTemplateColumns: '250px 130px 130px 240px', gap: '12px', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.02)', alignItems: 'center', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.003)' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#f4f4f5', fontWeight: 'bold', wordBreak: 'break-all' }}>{app.filename}</div>
                      <div style={{ fontSize: '8px', fontFamily: 'monospace', color: '#52525b', marginTop: '2px', wordBreak: 'break-all' }}>{app.path}</div>
                    </div>
                    
                    {/* Executable Status */}
                    <div>
                      {app.executable ? (
                        <span style={{ fontSize: '8px', fontFamily: 'monospace', color: 'var(--signal)', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)' }}>
                          Executable
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                          <span style={{ fontSize: '8px', fontFamily: 'monospace', color: 'var(--crimson)', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                            Not Executable
                          </span>
                          <button
                            onClick={() => makeExecutable(app.path)}
                            disabled={isPending}
                            style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#a1a1aa', fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer' }}
                          >
                            {isPending && appimageAction.type === 'chmod' ? <RefreshCw size={8} className="animate-spin" /> : 'Make Executable'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Registration Status */}
                    <div>
                      {app.registered ? (
                        <span style={{ fontSize: '8px', fontFamily: 'monospace', color: 'var(--signal)', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)' }}>
                          Registered
                        </span>
                      ) : (
                        <span style={{ fontSize: '8px', fontFamily: 'monospace', color: '#52525b', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          Unregistered
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      {app.registered ? (
                        <button
                          onClick={() => unregisterAppImage(app.path)}
                          disabled={isPending}
                          style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: 'var(--crimson)', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer' }}
                        >
                          {isPending && appimageAction.type === 'unregister' ? <RefreshCw size={9} className="animate-spin" /> : 'Unregister'}
                        </button>
                      ) : (
                        <button
                          onClick={() => registerAppImage(app.path)}
                          disabled={isPending}
                          style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: 'white', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: 'pointer' }}
                        >
                          {isPending && appimageAction.type === 'register' ? <RefreshCw size={9} className="animate-spin" /> : 'Register'}
                        </button>
                      )}

                      <button
                        onClick={() => launchAppImage(app.path)}
                        disabled={isPending || !app.executable}
                        style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)', color: 'var(--signal)', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', cursor: isPending || !app.executable ? 'default' : 'pointer', opacity: !app.executable ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        {isPending && appimageAction.type === 'launch' ? <RefreshCw size={9} className="animate-spin" /> : <Play size={9} />}
                        Launch
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
