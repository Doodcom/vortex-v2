import { useState, useCallback, useEffect } from 'react'
import { Archive, Plus, Trash2, RotateCcw, RefreshCw, X, FolderOpen, Save, Cloud, UploadCloud, DownloadCloud } from 'lucide-react'
import { notify } from '../lib/notifications'
import { kvGetJson, kvSetJson } from '../lib/kv'

const VAULT_PATHS_KEY = 'vortex-vault-paths'

const DEFAULT_PATHS = [
  '~/.bashrc', '~/.zshrc', '~/.config/fish/config.fish',
  '~/.gitconfig', '~/.ssh/config', '~/.config/nvim',
  '~/.config/hypr', '~/.config/waybar', '~/.config/kitty',
]

interface Backup { filename: string; ts: number; path: string }
interface CombinedBackup {
  filename: string;
  ts: number;
  path: string;
  isLocal: boolean;
  isRemote: boolean;
  status: 'Local Only' | 'Cloud Synced' | 'Remote Only';
}

export default function VaultView() {
  const [paths, setPaths] = useState<string[]>(DEFAULT_PATHS)
  const [newPath, setNewPath] = useState('')
  const [backups, setBackups] = useState<Backup[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  // Cloud sync state
  const [remoteName, setRemoteName] = useState('')
  const [remotePath, setRemotePath] = useState('')
  const [remoteBackups, setRemoteBackups] = useState<{ filename: string }[]>([])
  const [syncConfigured, setSyncConfigured] = useState(false)
  const [loadingRemote, setLoadingRemote] = useState(false)
  const [syncingBackup, setSyncingBackup] = useState<string | null>(null)
  const [downloadingBackup, setDownloadingBackup] = useState<string | null>(null)
  const [savingConfig, setSavingConfig] = useState(false)
  const [selectedRemoteOption, setSelectedRemoteOption] = useState('manual')

  useEffect(() => {
    kvGetJson<string[] | null>(VAULT_PATHS_KEY, null).then(p => { if (p) setPaths(p) })
  }, [])

  const savePaths = (p: string[]) => { setPaths(p); kvSetJson(VAULT_PATHS_KEY, p) }

  const addPath = () => {
    const t = newPath.trim()
    if (!t || paths.includes(t)) return
    savePaths([...paths, t])
    setNewPath('')
  }

  const removePath = (p: string) => savePaths(paths.filter(x => x !== p))

  const loadBackups = useCallback(async () => {
    setLoading(true)
    const res = await window.electron.vaultListBackups()
    if (res.success) setBackups(res.backups)

    // Load remote config and list remote backups if configured
    const configRes = await window.electron.vaultGetSyncConfig()
    if (configRes.success && configRes.config) {
      setSyncConfigured(true)
      setRemoteName(configRes.config.remoteName)
      setRemotePath(configRes.config.remotePath)
      
      setLoadingRemote(true)
      const remoteRes = await window.electron.vaultListRemote()
      if (remoteRes.success) {
        setRemoteBackups(remoteRes.backups)
      } else {
        setRemoteBackups([])
      }
      setLoadingRemote(false)
    } else {
      setSyncConfigured(false)
      setRemoteBackups([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    window.electron.vaultGetSyncConfig().then(res => {
      if (res.success && res.config) {
        const name = res.config.remoteName
        setRemoteName(name)
        setRemotePath(res.config.remotePath)
        setSyncConfigured(true)
        if (['gdrive:', 'dropbox:', 'onedrive:', 's3:'].includes(name)) {
          setSelectedRemoteOption(name)
        } else {
          setSelectedRemoteOption('manual')
        }
      }
    })
  }, [])

  useEffect(() => {
    setTimeout(() => {
      loadBackups()
    }, 0)
  }, [loadBackups])

  const createBackup = async () => {
    if (paths.length === 0) return
    setCreating(true)
    const res = await window.electron.vaultCreate({ paths })
    setCreating(false)
    if (res.success) { notify('Vault', `Backup created: ${res.filename}`, 'success'); loadBackups() }
    else notify('Vault', `Backup failed: ${res.error}`, 'error')
  }

  const restore = async (filename: string) => {
    const res = await window.electron.vaultRestore({ filename })
    setConfirmRestore(null)
    if (res.success) notify('Vault', `Restored from ${filename}`, 'success')
    else notify('Vault', `Restore failed: ${res.error}`, 'error')
  }

  const deleteBackup = async (filename: string) => {
    const res = await window.electron.vaultDelete({ filename })
    setConfirmDel(null)
    if (res.success) { notify('Vault', 'Backup deleted', 'success'); setBackups(prev => prev.filter(b => b.filename !== filename)) }
    else notify('Vault', `Delete failed: ${res.error}`, 'error')
  }

  // Save Config
  const saveConfig = async () => {
    setSavingConfig(true)
    const name = selectedRemoteOption === 'manual' ? remoteName : selectedRemoteOption
    const res = await window.electron.vaultSaveSyncConfig({ remoteName: name, remotePath })
    setSavingConfig(false)
    if (res.success) {
      notify('Vault Cloud Sync', 'Configuration saved successfully', 'success')
      loadBackups()
    } else {
      notify('Failed to save config', res.error ?? '', 'error')
    }
  }

  // Upload to cloud
  const uploadToCloud = async (filename: string) => {
    setSyncingBackup(filename)
    const res = await window.electron.vaultSyncBackup({ filename })
    setSyncingBackup(null)
    if (res.success) {
      notify('Cloud Sync', `Successfully uploaded ${filename} to cloud`, 'success')
      loadBackups()
    } else {
      notify('Upload Failed', res.error ?? '', 'error')
    }
  }

  // Download from cloud
  const downloadFromCloud = async (filename: string) => {
    setDownloadingBackup(filename)
    const res = await window.electron.vaultDownloadRemote({ filename })
    setDownloadingBackup(null)
    if (res.success) {
      notify('Cloud Sync', `Successfully downloaded ${filename} to local`, 'success')
      loadBackups()
    } else {
      notify('Download Failed', res.error ?? '', 'error')
    }
  }

  // Combined local & remote backups
  const combinedBackups = (() => {
    const list: CombinedBackup[] = []
    
    // Add local backups
    backups.forEach(b => {
      const isRemote = remoteBackups.some(r => r.filename === b.filename)
      list.push({
        filename: b.filename,
        ts: b.ts,
        path: b.path,
        isLocal: true,
        isRemote,
        status: isRemote ? 'Cloud Synced' : 'Local Only'
      })
    })

    // Add remote only backups
    remoteBackups.forEach(r => {
      if (!backups.some(b => b.filename === r.filename)) {
        list.push({
          filename: r.filename,
          ts: 0,
          path: '',
          isLocal: false,
          isRemote: true,
          status: 'Remote Only'
        })
      }
    })

    // Sort newest first lexicographically by filename (containing timestamp)
    list.sort((a, b) => b.filename.localeCompare(a.filename))
    return list
  })()

  return (
    <div style={{ maxWidth: '750px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Left: file list */}
        <div>
          <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FolderOpen size={12} /> Files to Back Up
          </div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            <input
              value={newPath}
              onChange={e => setNewPath(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPath()}
              placeholder="~/.config/something"
              style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '5px 8px', fontSize: '11px', fontFamily: 'monospace', color: '#e2e8f0', outline: 'none' }}
            />
            <button onClick={addPath} style={{ padding: '5px 10px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', cursor: 'pointer' }}>
              <Plus size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '280px', overflowY: 'auto', marginBottom: '14px' }}>
            {paths.map(p => (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                <span style={{ flex: 1, fontSize: '11px', fontFamily: 'monospace', color: '#a1a1aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p}</span>
                <button onClick={() => removePath(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', flexShrink: 0 }}><X size={11} /></button>
              </div>
            ))}
          </div>
          <button
            onClick={createBackup}
            disabled={creating || paths.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'center', padding: '9px 0', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: creating || paths.length === 0 ? 'default' : 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--crimson)', opacity: paths.length === 0 ? 0.4 : 1 }}
          >
            <Save size={13} /> {creating ? 'Archiving…' : 'Create Backup Now'}
          </button>
        </div>

        {/* Right: backups list */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Archive size={12} /> Saved Backups
            </div>
            <button onClick={loadBackups} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563' }}><RefreshCw size={11} className={loading || loadingRemote ? 'animate-spin' : ''} /></button>
          </div>
          {loading ? (
            <div style={{ fontSize: '11px', color: '#3f3f46', fontFamily: 'monospace', fontStyle: 'italic' }}>Loading local & remote backups…</div>
          ) : combinedBackups.length === 0 ? (
            <div style={{ fontSize: '11px', color: '#3f3f46', fontFamily: 'monospace', fontStyle: 'italic' }}>No backups yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '360px', overflowY: 'auto' }}>
              {combinedBackups.map(b => (
                <div key={b.filename} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', gap: '8px' }}>
                    <div style={{ fontSize: '10px', color: '#a1a1aa', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={b.filename}>
                      {b.filename}
                    </div>
                    {/* Status Badge */}
                    <span style={{
                      fontSize: '8px',
                      fontFamily: 'monospace',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      fontWeight: 'bold',
                      flexShrink: 0,
                      background: b.status === 'Cloud Synced' ? 'rgba(34,197,94,0.08)' : b.status === 'Local Only' ? 'rgba(59,130,246,0.08)' : 'rgba(249,115,22,0.08)',
                      border: b.status === 'Cloud Synced' ? '1px solid rgba(34,197,94,0.2)' : b.status === 'Local Only' ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(249,115,22,0.2)',
                      color: b.status === 'Cloud Synced' ? '#4ade80' : b.status === 'Local Only' ? '#60a5fa' : '#fb923c'
                    }}>
                      {b.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '9px', color: '#4b5563', marginBottom: '8px' }}>
                    {b.ts ? new Date(b.ts).toLocaleString() : 'Remote Only (Not Downloaded)'}
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    {b.isLocal && (
                      <>
                        {confirmRestore === b.filename ? (
                          <>
                            <button onClick={() => restore(b.filename)} style={{ flex: 1, padding: '4px', borderRadius: '5px', fontSize: '9px', fontFamily: 'monospace', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', cursor: 'pointer' }}>Confirm Restore</button>
                            <button onClick={() => setConfirmRestore(null)} style={{ padding: '4px 8px', borderRadius: '5px', fontSize: '9px', background: 'none', border: '1px solid rgba(255,255,255,0.07)', color: '#52525b', cursor: 'pointer' }}>×</button>
                          </>
                        ) : confirmDel === b.filename ? (
                          <>
                            <button onClick={() => deleteBackup(b.filename)} style={{ flex: 1, padding: '4px', borderRadius: '5px', fontSize: '9px', fontFamily: 'monospace', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', cursor: 'pointer' }}>Confirm Delete</button>
                            <button onClick={() => setConfirmDel(null)} style={{ padding: '4px 8px', borderRadius: '5px', fontSize: '9px', background: 'none', border: '1px solid rgba(255,255,255,0.07)', color: '#52525b', cursor: 'pointer' }}>×</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => setConfirmRestore(b.filename)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '4px', borderRadius: '5px', fontSize: '9px', fontFamily: 'monospace', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.18)', color: '#22d3ee', cursor: 'pointer' }}>
                              <RotateCcw size={9} /> Restore
                            </button>
                            <button onClick={() => setConfirmDel(b.filename)} style={{ padding: '4px 8px', borderRadius: '5px', fontSize: '9px', background: 'none', border: '1px solid rgba(255,255,255,0.07)', color: '#4b5563', cursor: 'pointer' }}>
                              <Trash2 size={10} />
                            </button>
                          </>
                        )}
                      </>
                    )}

                    {/* Sync Actions */}
                    {syncConfigured && b.status === 'Local Only' && (
                      <button
                        onClick={() => uploadToCloud(b.filename)}
                        disabled={syncingBackup === b.filename}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          padding: '4px',
                          borderRadius: '5px',
                          fontSize: '9px',
                          fontFamily: 'monospace',
                          background: 'rgba(59,130,246,0.08)',
                          border: '1px solid rgba(59,130,246,0.18)',
                          color: '#60a5fa',
                          cursor: syncingBackup === b.filename ? 'default' : 'pointer'
                        }}
                      >
                        {syncingBackup === b.filename ? <RefreshCw size={9} className="animate-spin" /> : <UploadCloud size={10} />}
                        {syncingBackup === b.filename ? 'Syncing...' : 'Sync to Cloud'}
                      </button>
                    )}

                    {b.status === 'Remote Only' && (
                      <button
                        onClick={() => downloadFromCloud(b.filename)}
                        disabled={downloadingBackup === b.filename}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          padding: '4px',
                          borderRadius: '5px',
                          fontSize: '9px',
                          fontFamily: 'monospace',
                          background: 'rgba(249,115,22,0.08)',
                          border: '1px solid rgba(249,115,22,0.18)',
                          color: '#fb923c',
                          cursor: downloadingBackup === b.filename ? 'default' : 'pointer'
                        }}
                      >
                        {downloadingBackup === b.filename ? <RefreshCw size={9} className="animate-spin" /> : <DownloadCloud size={10} />}
                        {downloadingBackup === b.filename ? 'Downloading...' : 'Download to Local'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cloud Sync Settings */}
      <div className="v-card" style={{ padding: '16px 20px', marginTop: '10px' }}>
        <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Cloud size={14} style={{ color: 'var(--crimson)' }} /> Cloud Sync Settings (rclone)
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '12px', alignItems: 'end' }}>
          {/* Remote Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#52525b', textTransform: 'uppercase' }}>Rclone Remote</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={selectedRemoteOption}
                onChange={e => {
                  setSelectedRemoteOption(e.target.value)
                  if (e.target.value !== 'manual') {
                    setRemoteName(e.target.value)
                  } else {
                    setRemoteName('')
                  }
                }}
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '6px',
                  padding: '6px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: '#e2e8f0',
                  outline: 'none'
                }}
              >
                <option value="manual">Manual Input</option>
                <option value="gdrive:">Google Drive (gdrive:)</option>
                <option value="dropbox:">Dropbox (dropbox:)</option>
                <option value="onedrive:">OneDrive (onedrive:)</option>
                <option value="s3:">Amazon S3 (s3:)</option>
              </select>

              {selectedRemoteOption === 'manual' && (
                <input
                  value={remoteName}
                  onChange={e => setRemoteName(e.target.value)}
                  placeholder="remote-name:"
                  style={{
                    flex: 1,
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    color: '#e2e8f0',
                    outline: 'none'
                  }}
                />
              )}
            </div>
          </div>

          {/* Remote Path */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#52525b', textTransform: 'uppercase' }}>Remote Path</span>
            <input
              value={remotePath}
              onChange={e => setRemotePath(e.target.value)}
              placeholder="e.g. Vortex-Vault"
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#e2e8f0',
                outline: 'none'
              }}
            />
          </div>

          {/* Save Button */}
          <button
            onClick={saveConfig}
            disabled={savingConfig || !remoteName.trim()}
            style={{
              width: '100%',
              padding: '8px 0',
              borderRadius: '6px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: 'var(--crimson)',
              fontSize: '10px',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              cursor: savingConfig || !remoteName.trim() ? 'default' : 'pointer',
              opacity: !remoteName.trim() ? 0.4 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            {savingConfig ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
            Save Config
          </button>
        </div>
      </div>
    </div>
  )
}
