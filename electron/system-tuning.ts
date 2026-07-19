import { ipcMain } from 'electron'
import { execPromise } from './system-common'

const BORE_PROFILES: Record<string, Record<string, number>> = {
  desktop:   { 'kernel.sched_burst_penalty_scale': 1280, 'kernel.sched_burst_smoothness_long': 1, 'kernel.sched_burst_smoothness_short': 0, 'kernel.sched_burst_fork_atavistic': 2, 'kernel.sched_burst_parity_threshold': 2, 'kernel.sched_burst_cache_lifetime': 60000000 },
  balanced:  { 'kernel.sched_burst_penalty_scale': 1024, 'kernel.sched_burst_smoothness_long': 1, 'kernel.sched_burst_smoothness_short': 0, 'kernel.sched_burst_fork_atavistic': 2, 'kernel.sched_burst_parity_threshold': 2, 'kernel.sched_burst_cache_lifetime': 60000000 },
  gaming:    { 'kernel.sched_burst_penalty_scale': 640,  'kernel.sched_burst_smoothness_long': 1, 'kernel.sched_burst_smoothness_short': 0, 'kernel.sched_burst_fork_atavistic': 0, 'kernel.sched_burst_parity_threshold': 2, 'kernel.sched_burst_cache_lifetime': 60000000 },
}

export async function runGameModeToggle(enable: boolean) {
  const logs: string[] = []
  try {
    if (enable) {
      logs.push('> Switching to LAVD gaming scheduler...')
      await execPromise('busctl call org.scx.Loader /org/scx/Loader org.scx.Loader SwitchScheduler su "lavd" 0').catch(() => {})
      logs.push('> System optimized for Gaming.')
    } else {
      logs.push('> Reverting to default scheduler...')
      await execPromise('busctl call org.scx.Loader /org/scx/Loader org.scx.Loader StopScheduler').catch(() => {})
      logs.push('> System restored to Balanced mode.')
    }
    return { success: true, log: logs.join('\n') }
  } catch (e: any) {
    return { success: false, log: `Game Mode Error: ${e.message}` }
  }
}

export function setupTuningHandlers() {
  ipcMain.handle('scx-status', async () => {
    try {
      const [curSched, curMode, state] = await Promise.all([
        execPromise("busctl get-property org.scx.Loader /org/scx/Loader org.scx.Loader CurrentScheduler 2>/dev/null || echo 's \"unknown\"'"),
        execPromise("busctl get-property org.scx.Loader /org/scx/Loader org.scx.Loader SchedulerMode 2>/dev/null || echo 'u 0'"),
        execPromise('cat /sys/kernel/sched_ext/state 2>/dev/null || echo "disabled"'),
      ])
      const schedulerName = (curSched.stdout.match(/"([^"]+)"/) || [])[1] ?? 'unknown'
      const modeVal = parseInt((curMode.stdout.match(/\d+/) || ['0'])[0], 10)
      const stateStr = state.stdout.trim()
      const { stdout: supported } = await execPromise("busctl get-property org.scx.Loader /org/scx/Loader org.scx.Loader SupportedSchedulers 2>/dev/null || echo 'as 0'")
      const schedulers = (supported.match(/"([^"]+)"/g) || []).map((s: string) => s.replace(/"/g, ''))
      return { success: true, scheduler: schedulerName, mode: modeVal, state: stateStr, schedulers }
    } catch (e: any) {
      return { success: false, scheduler: 'unknown', mode: 0, state: 'disabled', schedulers: [], error: e.message }
    }
  })

  ipcMain.handle('scx-set-scheduler', async (_, { name, mode = 0 }: { name: string; mode?: number }) => {
    if (!/^[\w]+$/.test(name)) return { success: false, error: 'Invalid scheduler name' }
    const safeMode = Math.max(0, Math.min(3, parseInt(String(mode), 10)))
    try {
      await execPromise(`busctl call org.scx.Loader /org/scx/Loader org.scx.Loader SwitchScheduler su "${name}" ${safeMode}`)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('scx-stop', async () => {
    try {
      await execPromise('busctl call org.scx.Loader /org/scx/Loader org.scx.Loader StopScheduler')
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('scx-metrics', async () => {
    try {
      const { stdout: state } = await execPromise('cat /sys/kernel/sched_ext/state 2>/dev/null || echo "disabled"')
      const { stdout: seq } = await execPromise('cat /sys/kernel/sched_ext/enable_seq 2>/dev/null || echo "0"')
      const { stdout: rejected } = await execPromise('cat /sys/kernel/sched_ext/nr_rejected 2>/dev/null || echo "0"')
      return { success: true, state: state.trim(), enableSeq: parseInt(seq.trim(), 10), nrRejected: parseInt(rejected.trim(), 10) }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('bore-set-profile', async (_, profile: string) => {
    if (!Object.prototype.hasOwnProperty.call(BORE_PROFILES, profile)) {
      return { success: false, error: 'Invalid profile' }
    }
    const params = BORE_PROFILES[profile]
    const results: string[] = []
    let anyApplied = false
    for (const [key, val] of Object.entries(params)) {
      try {
        await execPromise(`sysctl -w ${key}=${val}`)
        results.push(`${key}=${val}`)
        anyApplied = true
      } catch {
        results.push(`${key}: not available`)
      }
    }
    return { success: anyApplied, output: results.join('\n'), partial: results.some(r => r.includes('not available')) }
  })

  ipcMain.handle('game-mode-toggle', async (_, enable: boolean) => {
    return await runGameModeToggle(enable)
  })
}
