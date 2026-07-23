import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  execCommand: (command: string) => ipcRenderer.invoke('exec-command', command),
  getSystemStats: () => ipcRenderer.invoke('get-system-stats'),
  windowControl: (action: 'minimize' | 'maximize' | 'close') => ipcRenderer.send('window-control', action),
  
  // System
  systemCheckUpdates: () => ipcRenderer.invoke('system-check-updates'),
  systemUpgrade: () => ipcRenderer.invoke('system-upgrade'),
  systemCheckFirmware: () => ipcRenderer.invoke('system-check-firmware'),
  systemFirmwareUpdate: () => ipcRenderer.invoke('system-firmware-update'),
  systemCleanup: (type: 'cache' | 'orphans' | 'logs' | 'all') => ipcRenderer.invoke('system-cleanup', type),
  systemCleanupAnalyze: () => ipcRenderer.invoke('system-cleanup-analyze'),
  systemCleanupExecute: (categories: string[]) => ipcRenderer.invoke('system-cleanup-execute', categories),
  systemOptimize: (type: 'ssd' | 'services' | 'performance') => ipcRenderer.invoke('system-optimize', type),
  systemGetLogs: (lines?: number) => ipcRenderer.invoke('system-get-logs', lines),
  systemGetErrorLogs: (lines?: number) => ipcRenderer.invoke('system-get-error-logs', lines),

  // DB / Audit Log
  dbLogCommand: (entry: { command: string; exit_code?: number; source?: string; session_id?: number }) => ipcRenderer.invoke('db-log-command', entry),
  dbGetAuditLog: (limit?: number) => ipcRenderer.invoke('db-get-audit-log', limit),
  dbClearAuditLog: () => ipcRenderer.invoke('db-clear-audit-log'),

  // PTY / Terminal
  ptyGetDefaultTab: () => ipcRenderer.invoke('pty-get-default-tab'),
  ptyListTabs: () => ipcRenderer.invoke('pty-list-tabs'),
  ptyCreate: () => ipcRenderer.invoke('pty-create'),
  ptyClose: (tabId: string) => ipcRenderer.invoke('pty-close', tabId),
  ptySetActive: (tabId: string) => ipcRenderer.invoke('pty-set-active', tabId),
  ptyWrite: (payload: { tabId?: string; command: string } | string) => ipcRenderer.invoke('pty-write', payload),
  ptyGetBuffer: (tabId?: string) => ipcRenderer.invoke('pty-get-buffer', tabId),

  // Network
  networkStats: () => ipcRenderer.invoke('network-stats'),
  networkConnections: () => ipcRenderer.invoke('network-connections'),

  // Processes
  processList: () => ipcRenderer.invoke('process-list'),
  processKill: (p: { pid: number; signal?: string }) => ipcRenderer.invoke('process-kill', p),

  // Systemd
  systemdListUnits: () => ipcRenderer.invoke('systemd-list-units'),
  systemdControlUnit: (p: { unit: string; action: string }) => ipcRenderer.invoke('systemd-control-unit', p),
  systemdUnitLogs: (p: { unit: string; lines?: number }) => ipcRenderer.invoke('systemd-unit-logs', p),

  // Packages
  packageDetectHelper: () => ipcRenderer.invoke('package-detect-helper'),
  packageSearch: (query: string) => ipcRenderer.invoke('package-search', query),
  packageListAur: () => ipcRenderer.invoke('package-list-aur'),
  packageInfo: (name: string) => ipcRenderer.invoke('package-info', name),
  packageInstall: (p: { name: string; helper: string }) => ipcRenderer.invoke('package-install', p),
  packageRemove: (name: string) => ipcRenderer.invoke('package-remove', name),

  // Flatpak
  flatpakList: () => ipcRenderer.invoke('flatpak-list'),
  flatpakSearch: (query: string) => ipcRenderer.invoke('flatpak-search', query),
  flatpakInstall: (appId: string) => ipcRenderer.invoke('flatpak-install', appId),
  flatpakUninstall: (appId: string) => ipcRenderer.invoke('flatpak-uninstall', appId),
  flatpakCheckUpdates: () => ipcRenderer.invoke('flatpak-check-updates'),
  flatpakUpdateAll: () => ipcRenderer.invoke('flatpak-update-all'),

  // AppImage
  appimageList: () => ipcRenderer.invoke('appimage-list'),
  appimageRegister: (path: string) => ipcRenderer.invoke('appimage-register', path),
  appimageUnregister: (path: string) => ipcRenderer.invoke('appimage-unregister', path),
  appimageMakeExecutable: (path: string) => ipcRenderer.invoke('appimage-make-executable', path),

  // Boot analyser
  systemAnalyzeBoot: () => ipcRenderer.invoke('system-analyze-boot'),

  // Disk monitor
  diskInfo: () => ipcRenderer.invoke('disk-info'),
  diskSmart: (device: string) => ipcRenderer.invoke('disk-smart', device),

  // Dependency tree
  packageDepTree: (name: string) => ipcRenderer.invoke('package-dep-tree', name),
  packageGetTree: (name: string) => ipcRenderer.invoke('package-dep-tree', name),

  // Power profiles
  powerGetProfile: () => ipcRenderer.invoke('power-get-profile'),
  powerSetProfile: (profile: string) => ipcRenderer.invoke('power-set-profile', profile),

  // File picker
  dialogOpenFile: () => ipcRenderer.invoke('dialog-open-file'),

  // Journal log viewer
  journalGetLogs: (opts: { unit?: string; priority?: string; lines?: number; keyword?: string; since?: string }) =>
    ipcRenderer.invoke('journal-get-logs', opts),

  // Startup apps manager
  startupList: () => ipcRenderer.invoke('startup-list'),
  startupToggleDesktop: (p: { path: string; enabled: boolean }) => ipcRenderer.invoke('startup-toggle-desktop', p),
  startupDeleteDesktop: (path: string) => ipcRenderer.invoke('startup-delete-desktop', path),
  startupToggleSystemd: (p: { unit: string; enable: boolean }) => ipcRenderer.invoke('startup-toggle-systemd', p),
  startupAddDesktop: (p: { name: string; exec: string; comment?: string }) => ipcRenderer.invoke('startup-add-desktop', p),

  dbGetResourceHistory: (hours?: number) => ipcRenderer.invoke('db-get-resource-history', hours),

  // Docker
  dockerList: () => ipcRenderer.invoke('docker-list'),
  dockerControl: (p: { id: string; action: string }) => ipcRenderer.invoke('docker-control', p),
  dockerLogs: (p: { id: string; lines?: number }) => ipcRenderer.invoke('docker-logs', p),
  gpuVramStats: () => ipcRenderer.invoke('gpu-vram-stats'),
  scxStatus: () => ipcRenderer.invoke('scx-status'),
  scxSetScheduler: (p: { name: string; mode?: number }) => ipcRenderer.invoke('scx-set-scheduler', p),
  scxStop: () => ipcRenderer.invoke('scx-stop'),
  scxMetrics: () => ipcRenderer.invoke('scx-metrics'),
  boreSetProfile: (profile: string) => ipcRenderer.invoke('bore-set-profile', profile),
  chwdDetect: () => ipcRenderer.invoke('chwd-detect'),
  chwdInstall: (profile: string) => ipcRenderer.invoke('chwd-install', profile),
  cachyosRateMirrors: () => ipcRenderer.invoke('cachyos-rate-mirrors'),
  fprintdStatus: () => ipcRenderer.invoke('fprintd-status'),
  systemSnapperSnapshot: (desc?: string) => ipcRenderer.invoke('system-snapper-snapshot', desc),
  systemSnapperList: () => ipcRenderer.invoke('system-snapper-list'),
  systemSnapperCreate: (p: { description: string }) => ipcRenderer.invoke('system-snapper-create', p),
  systemSnapperDelete: (p: { id: string }) => ipcRenderer.invoke('system-snapper-delete', p),
  systemSnapperRollback: (p: { id: string }) => ipcRenderer.invoke('system-snapper-rollback', p),
  gameModeToggle: (enable: boolean) => ipcRenderer.invoke('game-mode-toggle', enable),
  systemAuditArch: () => ipcRenderer.invoke('system-audit-arch'),
  systemRebuildNative: (pkg: string) => ipcRenderer.invoke('system-rebuild-native', pkg),
  guardianToggle: (enable: boolean) => ipcRenderer.invoke('guardian-toggle', enable),
  guardianStatus: () => ipcRenderer.invoke('guardian-status'),

  on: (channel: string, callback: (...args: any[]) => void) => {
    const listener = (_: any, ...args: any[]) => callback(...args)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  removeListener: (channel: string, listener?: (...args: any[]) => void) => {
    if (listener) ipcRenderer.removeListener(channel, listener)
    else ipcRenderer.removeAllListeners(channel)
  },
  // Desktop apps (used by Packages + Startup views)
  appsList: () => ipcRenderer.invoke('apps-list'),
  appsLaunch: (p: { exec: string }) => ipcRenderer.invoke('apps-launch', p),

  // Arch News
  archNewsFetch: () => ipcRenderer.invoke('arch-news-fetch'),

  // Dotfile Vault
  vaultListBackups: () => ipcRenderer.invoke('vault-list-backups'),
  vaultCreate: (p: { paths: string[] }) => ipcRenderer.invoke('vault-create', p),
  vaultRestore: (p: { filename: string }) => ipcRenderer.invoke('vault-restore', p),
  vaultDelete: (p: { filename: string }) => ipcRenderer.invoke('vault-delete', p),

  // Vault Sync
  vaultGetSyncConfig: () => ipcRenderer.invoke('vault-get-sync-config'),
  vaultSaveSyncConfig: (cfg: { remoteName: string; remotePath: string }) => ipcRenderer.invoke('vault-save-sync-config', cfg),
  vaultSyncBackup: (p: { filename: string }) => ipcRenderer.invoke('vault-sync-backup', p),
  vaultListRemote: () => ipcRenderer.invoke('vault-list-remote'),
  vaultDownloadRemote: (p: { filename: string }) => ipcRenderer.invoke('vault-download-remote', p),

  // UFW
  ufwStatus: () => ipcRenderer.invoke('ufw-status'),
  ufwEnable: (enable: boolean) => ipcRenderer.invoke('ufw-enable', enable),
  ufwAddRule: (rule: { port: string; proto: string; action: string; from: string; comment: string }) => ipcRenderer.invoke('ufw-add-rule', rule),
  ufwDeleteRule: (num: number) => ipcRenderer.invoke('ufw-delete-rule', num),

  // SSH
  sshListKeys: () => ipcRenderer.invoke('ssh-list-keys'),
  sshGenerateKey: (p: { type: string; bits?: number; comment: string; filename: string }) => ipcRenderer.invoke('ssh-generate-key', p),
  sshDeleteKey: (p: { name: string }) => ipcRenderer.invoke('ssh-delete-key', p),

  // Cron
  cronList: () => ipcRenderer.invoke('cron-list'),
  cronSave: (payload: { entries: any[] }) => ipcRenderer.invoke('cron-save', payload),

  // R5: Btrfs Maintenance
  btrfsScrub: (action: string) => ipcRenderer.invoke('btrfs-scrub', action),
  btrfsBalance: (action: string, dusage?: number, musage?: number) => ipcRenderer.invoke('btrfs-balance', action, dusage, musage),
  btrfsDefrag: (path: string) => ipcRenderer.invoke('btrfs-defrag', path),
  btrfsUsage: () => ipcRenderer.invoke('btrfs-usage'),


  // Durable key-value store (sqlite-backed, survives cache cleaning)
  kvGet: (key: string) => ipcRenderer.invoke('kv-get', key),
  kvSet: (key: string, value: string) => ipcRenderer.invoke('kv-set', { key, value }),
  kvDelete: (key: string) => ipcRenderer.invoke('kv-delete', key),

  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  showContextMenu: (props: any) => ipcRenderer.invoke('show-context-menu', props)
})
