import { exec } from 'child_process'
import { promisify } from 'util'
import { ipcMain, Notification, type BrowserWindow } from 'electron'
import { runGameModeToggle } from './system'

const execPromise = promisify(exec)

const HEALTH_INTERVAL = 5 * 60 * 1000       // disk + failed units every 5 min
const UPDATE_CHECK_INTERVAL = 6 * 60 * 60 * 1000 // pending updates every 6 h
const DISK_WARN_PCT = 90

class VortexGuardian {
  private isEnabled: boolean = false
  private interval: NodeJS.Timeout | null = null
  private lastGameState: boolean = false
  private win: BrowserWindow | null = null

  // Common gaming related processes to watch for
  private GAME_PROCESSES = [
    'steam', 'steamwebhelper', 'lutris', 'heroic', 'bottles', 
    'wine-preloader', 'gamescope', 'mangohud', 'retroarch'
  ]

  constructor() {}

  private healthInterval: NodeJS.Timeout | null = null
  private updateInterval: NodeJS.Timeout | null = null
  private diskWarned = false
  private knownFailedUnits = new Set<string>()
  private lastUpdateCount = 0

  public init(window: BrowserWindow) {
    this.win = window
    this.setupIpc()
    this.startHealthMonitor()
    console.log('[Guardian] Watchdog Initialized')
  }

  // Always-on background health checks — native notifications reach the user
  // even while the window is hidden in the tray.
  private startHealthMonitor() {
    if (this.healthInterval) return
    this.healthInterval = setInterval(() => this.checkHealth(), HEALTH_INTERVAL)
    this.updateInterval = setInterval(() => this.checkUpdates(), UPDATE_CHECK_INTERVAL)
    setTimeout(() => { this.checkHealth(); this.checkUpdates() }, 30_000) // first pass after boot settles
  }

  private async checkHealth() {
    // Root filesystem usage
    try {
      const { stdout } = await execPromise("df --output=pcent / | tail -1")
      const pct = parseInt(stdout.trim().replace('%', ''), 10)
      if (pct >= DISK_WARN_PCT && !this.diskWarned) {
        this.diskWarned = true
        this.alert('Disk Almost Full', `Root filesystem is at ${pct}%. Open Cleaner to reclaim space.`)
      } else if (pct < DISK_WARN_PCT - 5) {
        this.diskWarned = false // re-arm once usage drops clear of the threshold
      }
    } catch { /* df unavailable — skip */ }

    // Failed systemd units (system scope) — alert only on newly failed units
    try {
      const { stdout } = await execPromise('systemctl --failed --no-legend --plain')
      const failed = stdout.split('\n').map(l => l.trim().split(/\s+/)[0]).filter(Boolean)
      const fresh = failed.filter(u => !this.knownFailedUnits.has(u))
      this.knownFailedUnits = new Set(failed)
      if (fresh.length > 0) {
        this.alert('Systemd Unit Failed', fresh.join(', '))
      }
    } catch { /* no failed units returns exit 0; real errors skipped */ }
  }

  private async checkUpdates() {
    try {
      const { stdout } = await execPromise('checkupdates 2>/dev/null | wc -l')
      const count = parseInt(stdout.trim(), 10) || 0
      // Only notify when the count grows meaningfully, not on every tick
      if (count >= 20 && count > this.lastUpdateCount) {
        this.alert('Updates Pending', `${count} package updates available. Open Updates to review.`)
      }
      this.lastUpdateCount = count
    } catch { /* checkupdates exits 2 when no updates — fine */ }
  }

  private alert(title: string, body: string) {
    console.log(`[Guardian] ALERT: ${title} — ${body}`)
    if (Notification.isSupported()) {
      new Notification({ title: `Vortex — ${title}`, body }).show()
    }
    this.notifyRenderer(`Guardian: ${title}`, body, 'error')
  }

  private setupIpc() {
    ipcMain.handle('guardian-toggle', (_, enable: boolean) => {
      this.isEnabled = enable
      if (enable) this.start()
      else this.stop()
      return { success: true, enabled: this.isEnabled }
    })

    ipcMain.handle('guardian-status', () => ({
      enabled: this.isEnabled,
      activeOptimization: this.lastGameState ? 'Gaming' : 'Balanced'
    }))
  }

  private start() {
    if (this.interval) return
    console.log('[Guardian] Auto-Pilot Engaged')
    this.interval = setInterval(() => this.checkSystem(), 5000) // Check every 5 seconds
    this.checkSystem() // Immediate check
  }

  private stop() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    console.log('[Guardian] Auto-Pilot Disengaged')
  }

  private async checkSystem() {
    if (!this.isEnabled) return

    try {
      // 1. Detect Gaming Activity
      const { stdout: psOut } = await execPromise('ps -e -o comm=')
      const runningProcs = psOut.split('\n').map(p => p.trim().toLowerCase())
      
      const isGaming = this.GAME_PROCESSES.some(game => runningProcs.includes(game))

      if (isGaming && !this.lastGameState) {
        console.log('[Guardian] Game Detected! Activating Zero-Latency Mode...')
        this.notifyRenderer('Guardian: Game Detected', 'Optimizing hardware for Zero-Latency gaming...', 'success')
        
        await runGameModeToggle(true)
        this.lastGameState = true
      } 
      else if (!isGaming && this.lastGameState) {
        console.log('[Guardian] Game Closed. Reverting to Balanced Mode...')
        this.notifyRenderer('Guardian: Session Ended', 'Restoring AI tasks to all cores.', 'info')
        
        await runGameModeToggle(false)
        this.lastGameState = false
      }

      // 2. Thermal/Stress Check (Optional: Could expand to throttle Ollama if CPU > 85C)
      // This is a placeholder for 2026 Thermal Throttling logic
    } catch (e) {
      console.error('[Guardian] Error during check:', e)
    }
  }

  private notifyRenderer(title: string, message: string, type: 'success' | 'info' | 'error') {
    if (this.win) {
      this.win.webContents.send('vortex-notify', { title, message, type })
    }
  }
}

export const guardian = new VortexGuardian()
