export interface SystemNetworkStats {
  rx_sec: number;
  tx_sec: number;
  iface: string;
}

export interface SystemGPUStats {
  model: string;
  utilizationGpu: number;
  utilizationMemory: number;
  memoryTotal: number;
  memoryUsed: number;
  temperatureGpu: number;
  powerDraw: number;
  powerLimit: number;
  fanSpeed: number;
  clockCore: number;
}

export interface SystemStats {
  cpu: {
    manufacturer: string;
    brand: string;
    speed: number;
    cores: number;
    load: number;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    active: number;
  };
  storage: {
    used: number;
    size: number;
    use: number;
  };
  network: SystemNetworkStats;
  gpu: SystemGPUStats | null;
}

export interface NetworkStatItem {
  iface: string;
  rx_sec: number;
  tx_sec: number;
  rx_bytes: number;
  tx_bytes: number;
  operstate: string;
  ip4: string;
  mac: string;
  type: string;
}

export interface NetworkConnectionItem {
  protocol: string;
  localaddr: string;
  localport: string;
  peeraddr: string;
  peerport: string;
  state: string;
  pid: number;
  process: string;
}

export interface ProcessListItem {
  pid: number;
  name: string;
  cpu: number;
  mem: number;
  memRss: number;
  command: string;
  user: string;
  state: string;
  started: string;
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  cpu_percent: number;
  mem_usage: number;
  mem_limit: number;
  net_io: {
    rx: number;
    tx: number;
  };
}

export interface SystemdUnit {
  unit: string;
  load: string;
  active: string;
  sub: string;
  description: string;
}

export interface DiskLayoutItem {
  device: string;
  name: string;
  type: string;
  size: number;
  vendor: string;
  model: string;
  serial: string;
  firmwareRevision: string;
  smartStatus: string;
}

export interface DiskFilesystemItem {
  fs: string;
  type: string;
  size: number;
  used: number;
  use: number;
  mount: string;
}

export interface ContextMenuProps {
  x: number;
  y: number;
  editFlags?: {
    canCut?: boolean;
    canCopy?: boolean;
    canPaste?: boolean;
  };
}

export interface PullProgress {
  status: string;
  completed?: number;
  total?: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface OrchAgentEvent {
  agentId: number;
  role: string;
  status: 'working' | 'done';
  output?: string;
}

export interface AgentStepEvent {
  type: 'call' | 'result';
  name: string;
  args?: unknown;
  result?: string;
  stepId: number;
}

export interface NotificationEntry {
  id?: number | string;
  title: string;
  body: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp?: string | number;
}

export interface ElectronEventMap {
  'vortex-notify': (entry: NotificationEntry) => void;
  'pty-data': (data: { tabId: string; text: string }) => void;
  'pty-done': (data: { tabId: string; exitCode: number }) => void;
  'update-log': (text: string) => void;
  'ollama-stream': (chunk: string) => void;
  'ollama-pull-progress': (progress: PullProgress) => void;
  'ollama-token': (token: string) => void;
  'ollama-done': () => void;
  'ollama-error': (err: string) => void;
  'ollama-token-usage': (usage: TokenUsage) => void;
  'ollama-orch-agent': (data: OrchAgentEvent) => void;
  'ollama-agent-step': (data: AgentStepEvent) => void;
}

export interface ElectronAPI {
  execCommand: (command: string) => Promise<{
    success: boolean
    stdout: string
    stderr: string
    exitCode: number
  }>
  getSystemStats: () => Promise<SystemStats>
  windowControl: (action: 'minimize' | 'maximize' | 'close') => void
  
  // Ollama

  // System
  systemCheckUpdates: () => Promise<{ repo: string[]; aur: string[] }>
  systemUpgrade: () => Promise<{ success: boolean; output: string; error?: string }>
  systemCheckFirmware: () => Promise<{ available: boolean; updates: { device: string; current: string; version?: string; summary: string }[] }>
  systemFirmwareUpdate: () => Promise<{ success: boolean; log: string }>
  systemCleanup: (type: 'cache' | 'orphans' | 'logs' | 'all') => Promise<{ success: boolean; output: string; error?: string }>
  systemCleanupAnalyze: () => Promise<{ success: boolean; categories: { name: string; sizeBytes: number; paths: string[] }[]; error?: string }>
  systemCleanupExecute: (categories: string[]) => Promise<{ success: boolean; logs: string; error?: string }>
  systemOptimize: (type: 'ssd' | 'services' | 'performance') => Promise<{ success: boolean; output?: string; error?: string }>
  systemGetLogs: (lines?: number) => Promise<string>
  systemGetErrorLogs: (lines?: number) => Promise<string>

  // Voice/Speech


  // DB / Persistence — Sessions
  // DB / Persistence — Messages

  // PTY / Terminal
  ptyGetDefaultTab: () => Promise<string>
  ptyCreate: () => Promise<string>
  ptyClose: (tabId: string) => Promise<{ success: boolean }>
  ptySetActive: (tabId: string) => Promise<{ success: boolean }>
  ptyWrite: (payload: { tabId?: string; command: string } | string) => Promise<{ success: boolean; error?: string }>
  ptyGetBuffer: (tabId?: string) => Promise<string>

  // Packages
  packageDetectHelper: () => Promise<string>
  packageSearch: (query: string) => Promise<{ repo: string; name: string; version: string; description: string; installed: boolean; source: string }[]>
  packageListAur: () => Promise<{ name: string; version: string }[]>
  packageInfo: (name: string) => Promise<Record<string, string> | null>
  packageInstall: (p: { name: string; helper: string }) => Promise<{ success: boolean; output?: string; error?: string }>
  packageRemove: (name: string) => Promise<{ success: boolean; output?: string; error?: string }>

  // Flatpak
  flatpakList: () => Promise<{ success: boolean; apps: { id: string; name: string; version: string; summary: string }[]; error?: string }>
  flatpakSearch: (query: string) => Promise<{ success: boolean; results: { id: string; name: string; version: string; description: string }[]; error?: string }>
  flatpakInstall: (appId: string) => Promise<{ success: boolean; error?: string }>
  flatpakUninstall: (appId: string) => Promise<{ success: boolean; error?: string }>
  flatpakCheckUpdates: () => Promise<{ success: boolean; updates: { id: string; name: string; version: string }[]; error?: string }>
  flatpakUpdateAll: () => Promise<{ success: boolean; error?: string }>

  // AppImage
  appimageList: () => Promise<{ success: boolean; apps: { filename: string; path: string; registered: boolean; executable: boolean }[]; error?: string }>
  appimageRegister: (path: string) => Promise<{ success: boolean; error?: string }>
  appimageUnregister: (path: string) => Promise<{ success: boolean; error?: string }>
  appimageMakeExecutable: (path: string) => Promise<{ success: boolean; error?: string }>

  // Network
  networkStats: () => Promise<NetworkStatItem[]>
  networkConnections: () => Promise<NetworkConnectionItem[]>

  // Processes
  processList: () => Promise<ProcessListItem[]>
  processKill: (p: { pid: number; signal?: string }) => Promise<{ success: boolean; error?: string }>

  // Docker
  dockerList: () => Promise<DockerContainer[] | { error: string }>
  dockerControl: (p: { id: string; action: string }) => Promise<{ success: boolean; error?: string }>
  dockerLogs: (p: { id: string; lines?: number }) => Promise<string>

  // Systemd
  systemdListUnits: () => Promise<SystemdUnit[]>
  systemdControlUnit: (p: { unit: string; action: string }) => Promise<{ success: boolean; output?: string; error?: string }>
  systemdUnitLogs: (p: { unit: string; lines?: number }) => Promise<string>

  // Boot analyser
  systemAnalyzeBoot: () => Promise<{ summary: string; units: { time_ms: number; unit: string }[] }>

  // Disk monitor
  diskInfo: () => Promise<{ layout: DiskLayoutItem[]; filesystems: DiskFilesystemItem[] }>
  diskSmart: (device: string) => Promise<{ health: string; temp: number | null; raw: string }>

  // Assets

  // Dependency tree
  packageDepTree: (name: string) => Promise<{ name: string; version: string; direct: string[]; optional: string[]; required: string[]; depDetails: Record<string, string[]> } | null>

  // Audit log
  dbLogCommand: (entry: { command: string; exit_code?: number; source?: string; session_id?: number }) => Promise<{ success: boolean }>
  dbGetAuditLog: (limit?: number) => Promise<{ id: number; command: string; exit_code: number | null; source: string; session_id: number | null; created_at: number }[]>
  dbClearAuditLog: () => Promise<{ success: boolean }>

  // Power profiles
  powerGetProfile: () => Promise<{ profile: string | null }>
  powerSetProfile: (profile: string) => Promise<{ success: boolean; error?: string }>

  // File picker
  dialogOpenFile: () => Promise<{ name: string; path: string; content: string; truncated: boolean } | { error: string } | null>

  // Journal log viewer
  journalGetLogs: (opts: { unit?: string; priority?: string; lines?: number; keyword?: string; since?: string }) => Promise<{ lines: string[]; error?: string }>

  // Startup apps manager
  startupList: () => Promise<{
    desktopEntries: { filename: string; path: string; name: string; exec: string; comment: string; icon: string; enabled: boolean }[]
    systemdServices: { unit: string; active: string; description: string }[]
  }>
  startupToggleDesktop: (p: { path: string; enabled: boolean }) => Promise<{ success: boolean; error?: string }>
  startupDeleteDesktop: (path: string) => Promise<{ success: boolean; error?: string }>
  startupToggleSystemd: (p: { unit: string; enable: boolean }) => Promise<{ success: boolean; error?: string }>
  startupAddDesktop: (p: { name: string; exec: string; comment?: string }) => Promise<{ success: boolean; error?: string; path?: string }>

  // AI Memory
  dbGetResourceHistory: (hours?: number) => Promise<{ ts: number; cpu: number; ram: number; gpu: number; disk: number; net_rx: number }[]>

  // GPU VRAM
  gpuVramStats: () => Promise<{ success: boolean; used: number; total: number; free: number; gpuUtil: number }>

  // I/O tuning

  // SCX sched-ext
  scxStatus: () => Promise<{ success: boolean; scheduler: string; mode: number; state: string; schedulers: string[]; error?: string }>
  scxSetScheduler: (p: { name: string; mode?: number }) => Promise<{ success: boolean; error?: string }>
  scxStop: () => Promise<{ success: boolean; error?: string }>
  scxMetrics: () => Promise<{ success: boolean; state: string; enableSeq: number; nrRejected: number; error?: string }>
  boreSetProfile: (profile: string) => Promise<{ success: boolean; output?: string; partial?: boolean; error?: string }>

  // Ollama VRAM & CPU tuning

  // CachyOS Hardware
  chwdDetect: () => Promise<{ success: boolean; output?: string; error?: string }>
  chwdInstall: (profile: string) => Promise<{ success: boolean; output?: string; error?: string }>
  cachyosRateMirrors: () => Promise<{ success: boolean; output?: string; error?: string }>
  fprintdStatus: () => Promise<{ success: boolean; active: boolean; devices: string }>
  systemSnapperSnapshot: (desc?: string) => Promise<{ success: boolean; output?: string; error?: string }>
  systemSnapperList: () => Promise<{ success: boolean; snapshots: { id: string; type: string; date: string; description: string; usedSpace: string }[]; error?: string }>
  systemSnapperCreate: (p: { description: string }) => Promise<{ success: boolean; id?: string; error?: string }>
  systemSnapperDelete: (p: { id: string }) => Promise<{ success: boolean; error?: string }>
  systemSnapperRollback: (p: { id: string }) => Promise<{ success: boolean; output?: string; error?: string }>
  gameModeToggle: (enable: boolean) => Promise<{ success: boolean; log: string }>
  systemAuditArch: () => Promise<{ success: boolean; packages: { name: string; repo: string; isGeneric: boolean }[]; error?: string }>
  systemRebuildNative: (pkg: string) => Promise<{ success: boolean; log: string }>
  guardianToggle: (enable: boolean) => Promise<{ success: boolean; enabled: boolean }>
  guardianStatus: () => Promise<{ enabled: boolean; activeOptimization: string }>

  // RAG

  // Desktop apps (used by Packages + Startup views)
  appsList: () => Promise<{ success: boolean; apps: { name: string; exec: string; comment: string; categories: string; icon: string; path: string }[]; error?: string }>
  appsLaunch: (p: { exec: string }) => Promise<{ success: boolean; error?: string }>

  // Arch News
  archNewsFetch: () => Promise<{ success: boolean; items: { title: string; link: string; date: string; summary: string }[]; error?: string }>

  // Dotfile Vault
  vaultListBackups: () => Promise<{ success: boolean; backups: { filename: string; ts: number; path: string }[]; error?: string }>
  vaultCreate: (p: { paths: string[] }) => Promise<{ success: boolean; filename?: string; error?: string }>
  vaultRestore: (p: { filename: string }) => Promise<{ success: boolean; error?: string }>
  vaultDelete: (p: { filename: string }) => Promise<{ success: boolean; error?: string }>

  // Vault Sync
  vaultGetSyncConfig: () => Promise<{ success: boolean; config: { remoteName: string; remotePath: string } | null; error?: string }>
  vaultSaveSyncConfig: (cfg: { remoteName: string; remotePath: string }) => Promise<{ success: boolean; error?: string }>
  vaultSyncBackup: (p: { filename: string }) => Promise<{ success: boolean; error?: string }>
  vaultListRemote: () => Promise<{ success: boolean; backups: { filename: string }[]; error?: string }>
  vaultDownloadRemote: (p: { filename: string }) => Promise<{ success: boolean; error?: string }>

  // UFW
  ufwStatus: () => Promise<{ success: boolean; enabled: boolean; rules: { to: string; action: string; from: string; comment: string }[]; raw: string; error?: string }>
  ufwEnable: (enable: boolean) => Promise<{ success: boolean; output?: string; error?: string }>
  ufwAddRule: (rule: { port: string; proto: string; action: string; from: string; comment: string }) => Promise<{ success: boolean; error?: string }>
  ufwDeleteRule: (num: number) => Promise<{ success: boolean; error?: string }>

  // SSH
  sshListKeys: () => Promise<{ success: boolean; keys: { name: string; pubFile: string; privFile: string; type: string; fingerprint: string; comment: string; pubKey: string }[]; error?: string }>
  sshGenerateKey: (p: { type: string; bits?: number; comment: string; filename: string }) => Promise<{ success: boolean; error?: string }>
  sshDeleteKey: (p: { name: string }) => Promise<{ success: boolean; error?: string }>

  // Cron
  cronList: () => Promise<{ success: boolean; entries: { id: string; min: string; hour: string; dom: string; month: string; dow: string; command: string; comment: string; enabled: boolean }[]; error?: string }>
  cronSave: (payload: { entries: { min: string; hour: string; dom: string; month: string; dow: string; command: string; comment: string }[] }) => Promise<{ success: boolean; error?: string }>

  // R5: Btrfs Maintenance
  btrfsScrub: (action: string) => Promise<{ success: boolean; status?: string; progress?: number; errors?: number; error?: string }>
  btrfsBalance: (action: string, dusage?: number, musage?: number) => Promise<{ success: boolean; status?: string; error?: string }>
  btrfsDefrag: (path: string) => Promise<{ success: boolean; error?: string }>
  btrfsUsage: () => Promise<{ success: boolean; dataAlloc: number; metaAlloc: number; unallocated: number; error?: string }>


  // Durable key-value store (sqlite-backed, survives cache cleaning)
  kvGet: (key: string) => Promise<string | null>
  kvSet: (key: string, value: string) => Promise<{ success: boolean }>
  kvDelete: (key: string) => Promise<{ success: boolean }>

  // Ring clip history (direct Ring cloud API)

  openExternal: (url: string) => Promise<{ success: boolean }>
  showContextMenu: (props: ContextMenuProps) => Promise<void>

  on: <K extends keyof ElectronEventMap>(channel: K, callback: ElectronEventMap[K]) => () => void
  removeListener: <K extends keyof ElectronEventMap>(channel: K, listener?: ElectronEventMap[K]) => void

  // Missing or new methods from preload.ts
  ptyListTabs: () => Promise<string[]>
  packageGetTree: (name: string) => Promise<{ name: string; version: string; direct: string[]; optional: string[]; required: string[]; depDetails: Record<string, string[]> } | null>
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
