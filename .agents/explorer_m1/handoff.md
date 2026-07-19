# Vortex Agentic V2 — Analysis and Architectural Integration Plan

## Core Architecture Overview

Vortex Agentic V2 is a hybrid React 19 / Electron 41.3 desktop suite optimized for CachyOS Linux environments. The application utilizes a decoupled client-server pattern:
- **Main Process (Node 24 / Electron 41.3)**: Handles low-level system commands, database storage, IPC routing, local RAG vector indexing, and background process orchestration. Key modules are segregated by responsibility: `main.ts` (entry), `system.ts` (system API), `ollama.ts` (LLM communication), `db.ts` (SQLite persistence), `pty.ts` (pseudoterminals), and `rag.ts` (vector embeddings).
- **Renderer Process (React 19 / Vite 8 / Tailwind 4)**: Executes the visual environment in an isolated sandbox. It communicates with Node/Electron solely via a secure `window.electron` API proxy injected by `electron/preload.ts`.
- **Navigation & Views**: Renders views dynamically inside `src/App.tsx` through a central `VIEW_MAP` config. Sidebar categories are defined in `src/components/Sidebar.tsx` as `navCategories`.
- **Package Management**: Bundled dependencies are declared in `package.json`. Native modules (e.g., `better-sqlite3`) are compiled manually via `npm run rebuild:native` (`scripts/rebuild-native.sh`) to lock against Electron headers and utilize `-march=znver4` flags, preventing standard `electron-builder` overrides.

---

## Technical Observations

1. **Missing Typings**: The existing codebase has functional Docker controls (`dockerList`, `dockerControl`, `dockerLogs` inside `electron/preload.ts`) and Ollama helper `ollamaQuickChat`, but these are completely missing from the TypeScript interface declarations in `src/types/electron.d.ts`.
2. **Privilege Elevation**: Elevated system actions (such as firewall modifications or package installs) utilize standard command executor wrappers using `pkexec bash -c '<command>'` in `electron/system.ts`.
3. **LLM Interface**: The `ollama-quick-chat` IPC channel in `electron/ollama.ts` is fully implemented and can be leveraged for one-shot diagnostics (Log Analysis) without declaring redundant chat endpoints.
4. **Snapper Integration**: Btrfs Snapper operations are currently mapped in `SnapshotView.tsx` but do not support lower-level filesystem checks (scrubbing, balancing, defragmentation).
5. **State Persistency**: Configuration storage (e.g., paths for vault backups, user theme, alert limits) is split between React's `localStorage` and SQLite (`vortex.db`).

---

## Detailed Architectural Plan (R1 - R6)

### R1: Smart Disk & Cache Cleaner
Enhance `CleanerView.tsx` and add new systemic scan functionality to determine reclaimable cache bytes before execution.
- **Backend API Handlers (`electron/system.ts`)**:
  - `system-cleanup-analyze`: Scans system components and calculates sizes of:
    - Pacman Cache (using `paccache -d -k 1` dry run or folder analysis).
    - Browser cache directories (Chrome, Firefox, Brave).
    - Trash bin files (`~/.local/share/Trash`).
    - Flatpak unreferenced runtimes (`flatpak uninstall --unused --dry-run`).
    - User caches (sizes of top 10 folders in `~/.cache`).
  - `system-cleanup-execute`: Runs cleaner routines on checked categories.
- **IPC Signatures (`src/types/electron.d.ts`)**:
  ```typescript
  systemCleanupAnalyze: () => Promise<{ success: boolean; categories: { name: string; sizeBytes: number; paths: string[] }[]; error?: string }>
  systemCleanupExecute: (categories: string[]) => Promise<{ success: boolean; logs: string; error?: string }>
  ```
- **UI Design**: A "Scan Files" action button. Checkboxes display categories alongside sizing (e.g., "Web Browser Caches: 850 MB"). Includes a "Top Cache Folders" section listing the top 10 subdirectories in `~/.cache` with single-click delete buttons.

### R2: Log Analysis & Auto-Remediation
Inspect logs for system errors and query Ollama for root causes, returning structured commands that fix the issues.
- **Backend API Handlers (`electron/system.ts` & `electron/ollama.ts`)**:
  - Log retrieval: Uses the existing `journal-get-logs` or system error log fetcher (`journalctl -p 3 -n 100`).
  - `log-remediation-analyze`: Feeds log snippet to `ollama-quick-chat` using a system prompt demanding JSON format:
    ```json
    {
      "problem": "Brief description of the failure",
      "diagnosis": "Technical explanation",
      "remediationCommand": "Bash command to resolve the issue (or null)",
      "remediationSafety": "safe" | "needs-confirmation" | "dangerous"
    }
    ```
  - `log-remediation-apply`: Runs the command with standard terminal logging, requiring `pkexec` if elevated.
- **IPC Signatures**:
  ```typescript
  logRemediationAnalyze: (p: { unit?: string; lines?: number }) => Promise<{ success: boolean; diagnosis?: string; problem?: string; remediationCommand?: string; remediationSafety?: 'safe' | 'needs-confirmation' | 'dangerous'; error?: string }>
  logRemediationApply: (p: { command: string }) => Promise<{ success: boolean; output?: string; error?: string }>
  ```
- **UI Design**: A new standalone view `LogAnalysisView.tsx` under the "Diagnostics" sidebar category. Users choose a system unit or recent logs, click "Analyze with AI", and inspect cards detailing the problem, explanation, and command. Action buttons execute the repair with confirmation modals reflecting safety criteria.

### R3: Flatpak & AppImage Support
Extend package operations to sandboxed execution engines.
- **Backend API Handlers (`electron/system.ts`)**:
  - Flatpak: Exec commands `flatpak list --parsable`, `flatpak search --parsable`, `flatpak install -y`, `flatpak uninstall -y`, and `flatpak update -y` (using `runStreamingCmd` for live install output).
  - AppImage: Scan folders (e.g., `~/Applications`, `~/Downloads`) for `.AppImage` files.
  - AppImage Registry: Create a standard `.desktop` shortcut file inside `~/.local/share/applications/` to register the application, make it executable (`chmod +x`), and launch it.
- **IPC Signatures**:
  ```typescript
  flatpakList: () => Promise<{ success: boolean; apps: { id: string; name: string; version: string; summary: string }[]; error?: string }>
  flatpakSearch: (query: string) => Promise<{ success: boolean; results: { id: string; name: string; version: string; description: string }[]; error?: string }>
  flatpakInstall: (id: string) => Promise<{ success: boolean; error?: string }>
  flatpakUninstall: (id: string) => Promise<{ success: boolean; error?: string }>
  appimageList: () => Promise<{ success: boolean; apps: { filename: string; path: string; registered: boolean; executable: boolean }[]; error?: string }>
  appimageRegister: (path: string) => Promise<{ success: boolean; error?: string }>
  appimageUnregister: (path: string) => Promise<{ success: boolean; error?: string }>
  appimageMakeExecutable: (path: string) => Promise<{ success: boolean; error?: string }>
  ```
- **UI Design**: Refactor `PackagesView.tsx` into a tabbed layout: Tab 1: System (Pacman/AUR), Tab 2: Flatpak Manager (lists installed, searches Flathub), Tab 3: AppImage Hub (scans folders, lists apps, executes toggles for registration, launch).

### R4: Cloud Sync for Dotfile Vault
Add remote backup capability to secure configurations off-host.
- **Backend API Handlers (`electron/system.ts` & `electron/db.ts`)**:
  - Database Table: Create `vault_sync_config` storing credentials/provider targets.
  - Sync actions: Upload and download files to/from Git repositories (via SSH credentials), WebDAV (e.g. Nextcloud), or S3 buckets.
  - Comparing backups: Inspect file names in local `~/Vortex-Backups` versus files on the remote server.
- **IPC Signatures**:
  ```typescript
  vaultGetSyncConfig: () => Promise<{ success: boolean; config: { provider: string; url: string; user?: string; path?: string } | null }>
  vaultSaveSyncConfig: (config: any) => Promise<{ success: boolean; error?: string }>
  vaultSyncBackup: (p: { filename: string }) => Promise<{ success: boolean; error?: string }>
  vaultListRemote: () => Promise<{ success: boolean; backups: { filename: string; size?: number; mtime?: number }[]; error?: string }>
  vaultDownloadRemote: (p: { filename: string }) => Promise<{ success: boolean; error?: string }>
  ```
- **UI Design**: Add a collapsible "Cloud Sync Settings" panel to `VaultView.tsx`. Update the backup list with status tags ("Local Only", "Cloud Synced", "Remote Only") and context buttons ("Sync Up", "Pull Down").

### R5: Advanced BTRFS Maintenance
Expose low-level filesystem tuning beyond snapper snapshot commands.
- **Backend API Handlers (`electron/system.ts`)**:
  - Scrubbing: `btrfs scrub start /`, `btrfs scrub status /`, `btrfs scrub cancel /`.
  - Balancing: `btrfs balance start -dusage=50 -musage=50 /` (reclaims unallocated chunks).
  - Defragmentation: `btrfs filesystem defragment -r /`.
  - Information Parsing: Reads `btrfs filesystem usage /` output to parse allocations.
- **IPC Signatures**:
  ```typescript
  btrfsScrub: (action: 'start' | 'status' | 'cancel') => Promise<{ success: boolean; status?: string; progress?: number; errors?: number; error?: string }>
  btrfsBalance: (action: 'start' | 'status' | 'cancel', dusage?: number, musage?: number) => Promise<{ success: boolean; status?: string; error?: string }>
  btrfsDefrag: (path: string, recursive: boolean) => Promise<{ success: boolean; error?: string }>
  btrfsUsage: () => Promise<{ success: boolean; dataAlloc: number; metaAlloc: number; unallocated: number; error?: string }>
  ```
- **UI Design**: Expand `SnapshotView.tsx` to include a "Filesystem Tuning" sub-tab showing interactive scrub progress loops, balance sliders (target reclaim thresholds), defrag path inputs, and a custom bar indicating data/metadata block allocations.

### R6: Visual Docker Compose Builder
Provide an interface to assemble compose architectures and execute deployments.
- **Backend API Handlers (`electron/system.ts`)**:
  - File generation: Writes `.yml` config to `~/Vortex-Compose/<project_name>/docker-compose.yml`.
  - Management: Run streaming processes `docker compose up -d` and `docker compose down`.
  - Scanning: Check subdirectories in `~/Vortex-Compose/` for active containers and service endpoints.
- **IPC Signatures**:
  ```typescript
  dockerComposeDeploy: (p: { projectName: string; yamlContent: string }) => Promise<{ success: boolean; log: string; error?: string }>
  dockerComposeDown: (p: { projectName: string }) => Promise<{ success: boolean; log: string; error?: string }>
  dockerComposeList: () => Promise<{ success: boolean; projects: { name: string; path: string; status: string; services: string[] }[]; error?: string }>
  ```
- **UI Design**: A new component view `DockerComposeBuilderView.tsx` under the "System" category. Features a drag-and-card canvas to configure services (image, ports, env variables, volume mappings), a side-by-side live YAML renderer compiled with Shiki highlighting, and a terminal runner output tab to watch deployment progress.

---

## File Modification Maps

### 1. `electron/system.ts`
Appends backend executors for system scans, flatpak search, appimage mapping, backup sync adapters, btrfs commands, and docker compose runner utilities.
```typescript
// STUB IMPLEMENTATION ADDITIONS FOR electron/system.ts

import { promises as fsPromises } from 'fs'

export function setupSystemHandlers(win: any) {
  // ... existing code ...

  // R1: Smart Disk Cleaner
  ipcMain.handle('system-cleanup-analyze', async () => {
    try {
      const categories = []
      // 1. Journal logs size
      const { stdout: jSize } = await execPromise('journalctl --disk-usage')
      const jBytes = parseInt(jSize.match(/\d+/)?.[0] || '0') * (jSize.includes('M') ? 1024 * 1024 : 1024)
      categories.push({ name: 'System Logs', sizeBytes: jBytes, paths: ['/var/log/journal'] })

      // 2. Pacman cache size
      const { stdout: pSize } = await execPromise('du -sb /var/cache/pacman/pkg || echo 0')
      categories.push({ name: 'Pacman Cache', sizeBytes: parseInt(pSize.split('\t')[0]), paths: ['/var/cache/pacman/pkg'] })

      // 3. User cache (~/.cache) top folders
      const cacheDir = join(homedir(), '.cache')
      const files = await fsPromises.readdir(cacheDir)
      const folderSizes = []
      for (const file of files) {
        try {
          const p = join(cacheDir, file)
          const stat = await fsPromises.stat(p)
          if (stat.isDirectory()) {
            const { stdout } = await execPromise(`du -sb "${p}"`)
            folderSizes.push({ name: `Cache: ${file}`, sizeBytes: parseInt(stdout.split('\t')[0]), paths: [p] })
          }
        } catch {}
      }
      folderSizes.sort((a,b) => b.sizeBytes - a.sizeBytes)
      categories.push(...folderSizes.slice(0, 10))

      return { success: true, categories }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('system-cleanup-execute', async (_, categories: string[]) => {
    try {
      let output = ''
      for (const cat of categories) {
        if (cat === 'System Logs') {
          await execPromise('pkexec journalctl --vacuum-time=3d')
          output += 'Journal vacuumed to 3d.\n'
        } else if (cat === 'Pacman Cache') {
          await execPromise('pkexec paccache -r -k 1')
          output += 'Pacman cache cleared.\n'
        } else if (cat.startsWith('Cache: ')) {
          const path = join(homedir(), '.cache', cat.replace('Cache: ', ''))
          await fsPromises.rm(path, { recursive: true, force: true })
          output += `Cleaned ${path}\n`
        }
      }
      return { success: true, logs: output }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // R2: Log Remediation Application
  ipcMain.handle('log-remediation-apply', async (_, { command }) => {
    // Sanitisation against destructive shell patterns
    if (/rm\s+-rf\s+\/|>\s*\/dev\/sda|mkfs/.test(command)) {
      return { success: false, error: 'Command blocked by security supervisor.' }
    }
    try {
      const { stdout, stderr } = await execPromise(`pkexec bash -c '${command}'`)
      return { success: true, output: stdout || stderr }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // R3: Flatpak & AppImage
  ipcMain.handle('flatpak-list', async () => {
    try {
      const { stdout } = await execPromise('flatpak list --columns=application,name,version,summary --parsable')
      const apps = stdout.trim().split('\n').filter(Boolean).map(line => {
        const [id, name, version, summary] = line.split('\t')
        return { id, name, version, summary }
      })
      return { success: true, apps }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('appimage-list', async () => {
    try {
      const appsDir = join(homedir(), 'Applications')
      const apps = []
      if (existsSync(appsDir)) {
        const files = await fsPromises.readdir(appsDir)
        for (const f of files) {
          if (f.toLowerCase().endsWith('.appimage')) {
            const p = join(appsDir, f)
            const stat = await fsPromises.stat(p)
            const isExec = (stat.mode & 0o111) !== 0
            const desktopPath = join(homedir(), '.local/share/applications', `vortex-appimage-${f.replace(/\s+/g, '-')}.desktop`)
            apps.push({ filename: f, path: p, registered: existsSync(desktopPath), executable: isExec })
          }
        }
      }
      return { success: true, apps }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('appimage-register', async (_, path) => {
    try {
      const filename = path.split('/').pop()
      const cleanName = filename.replace(/\.AppImage$/i, '').replace(/[\s.-]+/g, ' ')
      const desktopContent = `[Desktop Entry]\nType=Application\nName=${cleanName}\nExec="${path}"\nIcon=application-x-executable\nTerminal=false\nCategories=Utility;`
      const target = join(homedir(), '.local/share/applications', `vortex-appimage-${filename.replace(/\s+/g, '-')}.desktop`)
      await fsPromises.writeFile(target, desktopContent, 'utf-8')
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // R5: Btrfs Scrubbing, Balancing, Defragmentation
  ipcMain.handle('btrfs-scrub', async (_, action) => {
    try {
      if (action === 'start') {
        await execPromise('pkexec btrfs scrub start /')
        return { success: true, status: 'Scrub running' }
      } else if (action === 'status') {
        const { stdout } = await execPromise('btrfs scrub status /')
        return { success: true, status: stdout }
      } else {
        await execPromise('pkexec btrfs scrub cancel /')
        return { success: true, status: 'Scrub stopped' }
      }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // R6: Docker Compose Deployer
  ipcMain.handle('docker-compose-deploy', async (_, { projectName, yamlContent }) => {
    const projectDir = join(homedir(), 'Vortex-Compose', projectName)
    try {
      await fsPromises.mkdir(projectDir, { recursive: true })
      await fsPromises.writeFile(join(projectDir, 'docker-compose.yml'), yamlContent, 'utf-8')
      return new Promise((resolve) => {
        runStreamingCmd('docker', ['compose', 'up', '-d'], { cwd: projectDir })
          .then(res => resolve({ success: res.success, log: res.log }))
      })
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })
}
```

### 2. `electron/preload.ts`
Registers all new handlers to the context bridge window environment.
```typescript
// APPEND OR EDIT EXPOSURE IN electron/preload.ts

contextBridge.exposeInMainWorld('electron', {
  // ... existing handlers ...

  // R1: Smart Disk Cleaner
  systemCleanupAnalyze: () => ipcRenderer.invoke('system-cleanup-analyze'),
  systemCleanupExecute: (cats: string[]) => ipcRenderer.invoke('system-cleanup-execute', cats),

  // R2: AI Log analysis & Remediation
  logRemediationAnalyze: (p: { unit?: string; lines?: number }) => ipcRenderer.invoke('log-remediation-analyze', p),
  logRemediationApply: (p: { command: string }) => ipcRenderer.invoke('log-remediation-apply', p),

  // R3: Flatpak & AppImage
  flatpakList: () => ipcRenderer.invoke('flatpak-list'),
  flatpakSearch: (q: string) => ipcRenderer.invoke('flatpak-search', q),
  flatpakInstall: (id: string) => ipcRenderer.invoke('flatpak-install', id),
  flatpakUninstall: (id: string) => ipcRenderer.invoke('flatpak-uninstall', id),
  appimageList: () => ipcRenderer.invoke('appimage-list'),
  appimageRegister: (p: string) => ipcRenderer.invoke('appimage-register', p),
  appimageUnregister: (p: string) => ipcRenderer.invoke('appimage-unregister', p),
  appimageMakeExecutable: (p: string) => ipcRenderer.invoke('appimage-make-executable', p),

  // R4: Dotfile Vault Cloud Sync
  vaultGetSyncConfig: () => ipcRenderer.invoke('vault-get-sync-config'),
  vaultSaveSyncConfig: (cfg: any) => ipcRenderer.invoke('vault-save-sync-config', cfg),
  vaultSyncBackup: (p: { filename: string }) => ipcRenderer.invoke('vault-sync-backup', p),
  vaultListRemote: () => ipcRenderer.invoke('vault-list-remote'),
  vaultDownloadRemote: (p: { filename: string }) => ipcRenderer.invoke('vault-download-remote', p),

  // R5: Btrfs Maintenance
  btrfsScrub: (action: string) => ipcRenderer.invoke('btrfs-scrub', action),
  btrfsBalance: (action: string, d?: number, m?: number) => ipcRenderer.invoke('btrfs-balance', action, d, m),
  btrfsDefrag: (p: string, rec: boolean) => ipcRenderer.invoke('btrfs-defrag', p, rec),
  btrfsUsage: () => ipcRenderer.invoke('btrfs-usage'),

  // R6: Docker Compose Builder
  dockerComposeDeploy: (p: { projectName: string; yamlContent: string }) => ipcRenderer.invoke('docker-compose-deploy', p),
  dockerComposeDown: (p: { projectName: string }) => ipcRenderer.invoke('docker-compose-down', p),
  dockerComposeList: () => ipcRenderer.invoke('docker-compose-list'),

  // Expose missing typings (Clean-up tasks)
  ollamaQuickChat: (payload: { model: string; system?: string; user: string }) => ipcRenderer.invoke('ollama-quick-chat', payload),
  dockerList: () => ipcRenderer.invoke('docker-list'),
  dockerControl: (p: { id: string; action: string }) => ipcRenderer.invoke('docker-control', p),
  dockerLogs: (p: { id: string; lines?: number }) => ipcRenderer.invoke('docker-logs', p),
})
```

### 3. `src/types/electron.d.ts`
Declares correct types for compile safety.
```typescript
// APPEND TO INTS IN src/types/electron.d.ts

export interface ElectronAPI {
  // ... existing ...

  // Missing bindings declarations
  ollamaQuickChat: (payload: { model: string; system?: string; user: string }) => Promise<{ success: boolean; content: string; error?: string }>
  dockerList: () => Promise<any[]>
  dockerControl: (p: { id: string; action: string }) => Promise<{ success: boolean; error?: string }>
  dockerLogs: (p: { id: string; lines?: number }) => Promise<string>

  // R1: Smart Cleaner
  systemCleanupAnalyze: () => Promise<{ success: boolean; categories: { name: string; sizeBytes: number; paths: string[] }[]; error?: string }>
  systemCleanupExecute: (categories: string[]) => Promise<{ success: boolean; logs: string; error?: string }>

  // R2: AI Log analysis & Remediation
  logRemediationAnalyze: (p: { unit?: string; lines?: number }) => Promise<{ success: boolean; diagnosis?: string; problem?: string; remediationCommand?: string; remediationSafety?: 'safe' | 'needs-confirmation' | 'dangerous'; error?: string }>
  logRemediationApply: (p: { command: string }) => Promise<{ success: boolean; output?: string; error?: string }>

  // R3: Flatpak & AppImage
  flatpakList: () => Promise<{ success: boolean; apps: { id: string; name: string; version: string; summary: string }[]; error?: string }>
  flatpakSearch: (query: string) => Promise<{ success: boolean; results: { id: string; name: string; version: string; description: string }[]; error?: string }>
  flatpakInstall: (id: string) => Promise<{ success: boolean; error?: string }>
  flatpakUninstall: (id: string) => Promise<{ success: boolean; error?: string }>
  appimageList: () => Promise<{ success: boolean; apps: { filename: string; path: string; registered: boolean; executable: boolean }[]; error?: string }>
  appimageRegister: (path: string) => Promise<{ success: boolean; error?: string }>
  appimageUnregister: (path: string) => Promise<{ success: boolean; error?: string }>
  appimageMakeExecutable: (path: string) => Promise<{ success: boolean; error?: string }>

  // R4: Dotfile Vault Cloud Sync
  vaultGetSyncConfig: () => Promise<{ success: boolean; config: { provider: string; url: string; user?: string; path?: string } | null }>
  vaultSaveSyncConfig: (config: any) => Promise<{ success: boolean; error?: string }>
  vaultSyncBackup: (p: { filename: string }) => Promise<{ success: boolean; error?: string }>
  vaultListRemote: () => Promise<{ success: boolean; backups: { filename: string; size?: number; mtime?: number }[]; error?: string }>
  vaultDownloadRemote: (p: { filename: string }) => Promise<{ success: boolean; error?: string }>

  // R5: Btrfs Maintenance
  btrfsScrub: (action: string) => Promise<{ success: boolean; status?: string; progress?: number; errors?: number; error?: string }>
  btrfsBalance: (action: string, d?: number, m?: number) => Promise<{ success: boolean; status?: string; error?: string }>
  btrfsDefrag: (path: string, recursive: boolean) => Promise<{ success: boolean; error?: string }>
  btrfsUsage: () => Promise<{ success: boolean; dataAlloc: number; metaAlloc: number; unallocated: number; error?: string }>

  // R6: Docker Compose
  dockerComposeDeploy: (p: { projectName: string; yamlContent: string }) => Promise<{ success: boolean; log: string; error?: string }>
  dockerComposeDown: (p: { projectName: string }) => Promise<{ success: boolean; log: string; error?: string }>
  dockerComposeList: () => Promise<{ success: boolean; projects: { name: string; path: string; status: string; services: string[] }[]; error?: string }>
}
```

### 4. `src/App.tsx`
Add routing bindings for the two new standalone views: `LogAnalysisView` and `DockerComposeBuilderView`.
```typescript
// INJECT MODIFICATIONS TO src/App.tsx

import LogAnalysisView from './components/LogAnalysisView'
import DockerComposeBuilderView from './components/DockerComposeBuilderView'

const VIEW_MAP: Record<string, any> = {
  // ... existing ...
  logs: LogView,
  'log-analysis': LogAnalysisView, // R2
  'compose-builder': DockerComposeBuilderView, // R6
  // ... rest of map ...
}
```

### 5. `src/components/Sidebar.tsx`
Mount the navigation interfaces onto the sidebar layout categories.
```typescript
// INJECT MODIFICATIONS TO src/components/Sidebar.tsx

const navCategories = [
  // ... Overview ...
  // ... AI Suite ...
  // ... Performance ...
  {
    label: 'System',
    items: [
      { id: 'terminal', label: 'Terminal', icon: TerminalIcon },
      { id: 'processes', label: 'Processes', icon: Activity },
      { id: 'services',  label: 'Services',  icon: Server },
      { id: 'packages', label: 'Packages', icon: Package },
      { id: 'depgraph', label: 'Dep Graph', icon: Layers },
      { id: 'docker',    label: 'Docker',      icon: Box },
      { id: 'compose-builder', label: 'Compose Builder', icon: Layers }, // R6 Integration
    ]
  },
  {
    label: 'Diagnostics',
    items: [
      { id: 'network',   label: 'Network',   icon: Wifi },
      { id: 'disk',      label: 'Disk Monitor',  icon: HardDrive },
      { id: 'boot',      label: 'Boot Analyser', icon: Clock },
      { id: 'history',   label: 'Sys History',   icon: LineChart },
      { id: 'health',    label: 'Health Report', icon: HeartPulse },
      { id: 'log-analysis', label: 'AI Log Advisor', icon: BotMessageSquare }, // R2 Integration
      { id: 'audit',     label: 'Audit Log',     icon: ShieldCheck },
      { id: 'env',       label: 'Env Variables', icon: Variable },
      { id: 'logs',      label: 'Log Viewer',    icon: ScrollText },
      { id: 'startup',   label: 'Startup Apps',  icon: Power },
    ]
  },
  // ... rest of sidebar configurations ...
]
```

---

## 5-Component Handoff Report

### 1. Observation
- Preload exposed commands (`dockerList` etc. in `electron/preload.ts:130`) are not defined in `src/types/electron.d.ts`.
- Command execution elevation is achieved via `pkexec bash -c '<args>'` inside `electron/system.ts`.
- The database wrapper (`electron/db.ts:12`) mounts standard SQL schemas upon app startup, allowing for straightforward sync configurations extensions if SQLite tables are desired.
- In-app syntax highlights are managed by Shiki v4 (`src/App.tsx:187`) calling `codeToHtml(code, { lang, theme })` without relying on outdated highlighter factory constructs.

### 2. Logic Chain
- Adding visual cards/toggles into `CleanerView.tsx`, `PackagesView.tsx`, `VaultView.tsx`, and `SnapshotView.tsx` will keep diagnostic and package tasks unified, avoiding layout bloat.
- Creating isolated components `LogAnalysisView.tsx` and `DockerComposeBuilderView.tsx` keeps large AI analysis prompt structures and raw YAML builder compilers separated from existing generic logs and container list views.
- Because `ollama-quick-chat` returns responses from the local LLM model synchronously, we can route JSON prompts through it to return robust diagnostic decisions cleanly.
- Restricting execution triggers using standard command checking avoids the introduction of new shell execution security loops.

### 3. Caveats
- Btrfs commands (`btrfs-progs`) and snapper profiles must be configured correctly on the underlying host system, or these specific views will output graceful availability flags.
- Docker compose builder actions assume `docker-compose` or `docker compose` CLI is installed globally and accessible in the system path.
- Local LLM prompt parsing relies on Ollama running on `127.0.0.1:11434` with an active model (e.g. `llama3`). A model missing check must alert the user.

### 4. Conclusion
Integrating these six key features will expand Vortex Agentic V2 into an advanced Linux workstation manager. The plan details the complete IPC signature definitions, layout maps, and code stubs required for implementation.

### 5. Verification Method
- Code compilation checks: Run `npx tsc --noEmit` to confirm no TypeScript interface syntax errors occur.
- Linter checks: Run `npm run lint` to verify coding styling.
- Production package building: Execute `npm run build` followed by `npm run build:electron` to confirm native bundle compilation.
