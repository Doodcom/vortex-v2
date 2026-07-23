/* eslint-disable @typescript-eslint/no-explicit-any, no-empty, @typescript-eslint/no-unused-vars, no-useless-escape */
import { ipcMain } from 'electron'
import { join } from 'path'
import { homedir, tmpdir } from 'os'
import { writeFileSync, readFileSync, statSync, rmSync } from 'fs'
import { execPromise, detectAurHelper, createSystemHelpers } from './system-common'

export function setupMaintenanceHandlers(win: any) {
  const { notify, streamLog, runStreamingCmd } = createSystemHelpers(win)

  // 9. system-check-updates
  ipcMain.handle('system-check-updates', async () => {
    const [repo, aur, flatpak] = await Promise.all([
      execPromise('checkupdates')
        .then(({ stdout }) => stdout.trim().split('\n').filter(Boolean))
        .catch(() => [] as string[]),
      (async () => {
        for (const helper of ['paru', 'yay']) {
          try {
            const { stdout } = await execPromise(`${helper} -Qua`)
            return stdout.trim().split('\n').filter(Boolean)
          } catch {}
        }
        return [] as string[]
      })(),
      execPromise('flatpak remote-ls --updates --columns=name,version')
        .then(({ stdout }) => stdout.trim().split('\n').filter(Boolean))
        .catch(() => [] as string[])
    ])
    return { repo, aur, flatpak }
  })

  // 10. system-upgrade
  ipcMain.handle('system-upgrade', async () => {
    // 2026 Best Practice: Auto-snapshot before full system upgrade
    try { await execPromise('pkexec snapper --no-dbus -c root create -t pre -p -d "Vortex system upgrade"') } catch {}

    const helper = await detectAurHelper()
    streamLog(`> Starting system upgrade via ${helper}...`)

    let cmd = 'pkexec'
    let args = ['pacman', '-Syu', '--noconfirm']

    if (helper === 'yay' || helper === 'paru') {
      cmd = helper
      args = ['-Syu', '--noconfirm', '--sudo', 'pkexec']
    }

    const res = await runStreamingCmd(cmd, args)
    if (!res.success) {
      return { success: false, log: 'Upgrade failed or cancelled.' }
    }

    streamLog('> Updating Flatpak applications...')
    const flatpakRes = await runStreamingCmd('flatpak', ['update', '-y'])
    return { success: flatpakRes.success, log: flatpakRes.success ? 'Upgrade completed.' : 'Package upgrade succeeded, but Flatpak update failed.' }
  })

  // 10b. system-check-firmware (fwupd — device/BIOS/SSD firmware, not covered by pacman)
  ipcMain.handle('system-check-firmware', async () => {
    const hasFwupd = await execPromise('command -v fwupdmgr').then(() => true).catch(() => false)
    if (!hasFwupd) return { available: false, updates: [] as any[] }

    // Refresh metadata from LVFS; non-fatal if offline or rate-limited
    await execPromise('fwupdmgr refresh --force').catch(() => {})

    const updates: { device: string; current: string; version?: string; summary: string }[] = []
    try {
      // Exits non-zero when nothing is available — caught below → empty list
      const { stdout } = await execPromise('fwupdmgr get-updates --json')
      const parsed = JSON.parse(stdout)
      for (const dev of parsed.Devices || []) {
        const rel = (dev.Releases || [])[0]
        updates.push({
          device: dev.Name || 'Unknown device',
          current: dev.Version || '?',
          version: rel?.Version,
          summary: rel?.Summary || dev.Summary || ''
        })
      }
    } catch {}
    return { available: true, updates }
  })

  // 10c. system-firmware-update (apply all pending firmware via fwupd)
  ipcMain.handle('system-firmware-update', async () => {
    streamLog('> Applying device firmware updates via fwupd...')
    // Run as root via pkexec so fwupd skips the interactive polkit prompt.
    // --no-reboot-check: staged updates are scheduled rather than erroring here.
    const res = await runStreamingCmd('pkexec', ['fwupdmgr', 'update', '-y', '--no-reboot-check'])
    return {
      success: res.success,
      log: res.success
        ? 'Firmware update complete. A reboot may be required to flash staged updates.'
        : 'Firmware update failed, cancelled, or nothing to apply.'
    }
  })

  // 11. system-cleanup
  ipcMain.handle('system-cleanup', async (_, type: 'cache' | 'orphans' | 'logs' | 'all') => {
    const commands: Record<string, string> = {
      cache: 'paccache -r -k 1',
      orphans: 'pacman -Qtdq && pacman -Rns $(pacman -Qtdq) || echo "No orphans to remove"',
      logs: 'journalctl --vacuum-time=3d',
      all: 'paccache -r -k 1 && journalctl --vacuum-time=3d'
    }

    if (!Object.prototype.hasOwnProperty.call(commands, type)) {
      return { success: false, error: 'Invalid cleanup type' }
    }

    try {
      const { stdout, stderr } = await execPromise(`pkexec bash -c '${commands[type]}'`)
      return { success: true, output: stdout || stderr }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 12. system-cleanup-analyze
  ipcMain.handle('system-cleanup-analyze', async () => {
    try {
      const categories: { name: string; sizeBytes: number; paths: string[] }[] = []

      // 1. System logs size
      let logsSize = 0
      try {
        const { stdout: jSize } = await execPromise('journalctl --disk-usage')
        const m = jSize.match(/(\d+(?:\.\d+)?)\s*([KMG]?)B?/i)
        if (m) {
          const val = parseFloat(m[1])
          const unit = m[2].toUpperCase()
          const multiplier = unit === 'G' ? 1024 * 1024 * 1024 : unit === 'M' ? 1024 * 1024 : unit === 'K' ? 1024 : 1
          logsSize = Math.round(val * multiplier)
        }
      } catch {}
      categories.push({ name: 'System Logs', sizeBytes: logsSize, paths: ['/var/log/journal'] })

      // 2. Pacman cache size
      let pacmanSize = 0
      try {
        const { stdout: pSize } = await execPromise('du -sb /var/cache/pacman/pkg')
        pacmanSize = parseInt(pSize.split('\t')[0]) || 0
      } catch {}
      categories.push({ name: 'Pacman Cache', sizeBytes: pacmanSize, paths: ['/var/cache/pacman/pkg'] })

      // 3. User cache (~/.cache) top folders
      const cacheDir = join(homedir(), '.cache')
      try {
        const { stdout } = await execPromise(`du -d 1 -b "${cacheDir}"`)
        const lines = stdout.trim().split('\n')
        const folders = []
        for (const line of lines) {
          const parts = line.split('\t')
          if (parts.length < 2) continue
          const sizeBytes = parseInt(parts[0]) || 0
          const p = parts[1].trim()
          if (p === cacheDir) continue // skip root cache dir
          try {
            const stat = statSync(p)
            if (stat.isDirectory()) {
              const name = p.split('/').pop() || ''
              folders.push({
                name: `Cache: ${name}`,
                sizeBytes,
                paths: [p]
              })
            }
          } catch {}
        }
        folders.sort((a, b) => b.sizeBytes - a.sizeBytes)
        categories.push(...folders.slice(0, 10))
      } catch {}

      return { success: true, categories }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // 13. system-cleanup-execute
  ipcMain.handle('system-cleanup-execute', async (_, categories: string[]) => {
    try {
      let output = ''
      for (const cat of categories) {
        if (cat === 'System Logs') {
          const { stdout, stderr } = await execPromise('pkexec journalctl --vacuum-time=3d')
          output += `System Logs: ${stdout || stderr}\n`
        } else if (cat === 'Pacman Cache') {
          const { stdout, stderr } = await execPromise('pkexec paccache -r -k 1')
          output += `Pacman Cache: ${stdout || stderr}\n`
        } else if (cat.startsWith('Cache: ')) {
          const folderName = cat.replace('Cache: ', '')
          const path = join(homedir(), '.cache', folderName)
          if (path.startsWith(join(homedir(), '.cache')) && !path.includes('..')) {
            rmSync(path, { recursive: true, force: true })
            output += `Cleaned User Cache folder: ${path}\n`
          } else {
            output += `Security block: attempted to clean invalid path ${path}\n`
          }
        }
      }
      return { success: true, logs: output }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // 16. system-optimize
  ipcMain.handle('system-optimize', async (_, type: 'ssd' | 'services' | 'performance') => {
    const commands: Record<string, string> = {
      ssd: 'fstrim -av',
      services: 'systemctl reset-failed',
      performance: 'cpupower frequency-set -g performance'
    }

    if (!Object.prototype.hasOwnProperty.call(commands, type)) {
      return { success: false, error: 'Invalid optimize type' }
    }

    try {
      const cmd = type === 'services' ? commands[type] : `pkexec ${commands[type]}`
      const { stdout, stderr } = await execPromise(cmd)
      return { success: true, output: stdout || stderr }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 17. system-get-logs
  ipcMain.handle('system-get-logs', async (_, lines = 50) => {
    const safeLines = Math.max(10, Math.min(10000, parseInt(String(lines), 10) || 50))
    try {
      const { stdout } = await execPromise(`journalctl -n ${safeLines} --no-pager`)
      return stdout
    } catch (error: any) {
      return `Failed to fetch logs: ${error.message}`
    }
  })

  // 18. system-get-error-logs
  ipcMain.handle('system-get-error-logs', async (_, lines = 50) => {
    const safeLines = Math.max(10, Math.min(10000, parseInt(String(lines), 10) || 50))
    try {
      const { stdout } = await execPromise(`journalctl -p 3 -n ${safeLines} --no-pager`)
      return stdout
    } catch (error: any) {
      return `Failed to fetch error logs: ${error.message}`
    }
  })

  // 19. journal-get-logs
  ipcMain.handle('journal-get-logs', async (_, opts: { unit?: string; priority?: string; lines?: number; keyword?: string; since?: string } = {}) => {
    try {
      const args = ['journalctl', '--no-pager', '--output=short-iso']
      if (opts.unit)     args.push('-u', opts.unit.replace(/[^a-zA-Z0-9@._-]/g, ''))
      if (opts.priority) args.push('-p', String(parseInt(opts.priority)))
      if (opts.since)    args.push(`--since="${opts.since.replace(/[^0-9a-zA-Z :.\-]/g, '')}"`)
      if (opts.lines)    args.push('-n', String(opts.lines))
      if (opts.keyword)  args.push(`-g`, opts.keyword.replace(/['"]/g, ''))
      const { stdout } = await execPromise(args.join(' '))
      return { success: true, lines: stdout.trim().split('\n').filter(Boolean) }
    } catch (e: any) { return { success: false, error: e.message, lines: [] } }
  })

  // 20. system-analyze-boot
  ipcMain.handle('system-analyze-boot', async () => {
    try {
      const [summaryRes, blameRes] = await Promise.all([
        execPromise('systemd-analyze').catch(() => ({ stdout: '' })),
        execPromise('systemd-analyze blame --no-pager').catch(() => ({ stdout: '' }))
      ])
      const units: { time_ms: number; unit: string }[] = []
      blameRes.stdout.trim().split('\n').filter(Boolean).forEach(line => {
        const m = line.trim().match(/^([\d.]+)(ms|s|min)\s+(.+)/)
        if (!m) return
        let ms = parseFloat(m[1])
        if (m[2] === 's') ms *= 1000
        if (m[2] === 'min') ms *= 60000
        units.push({ time_ms: Math.round(ms), unit: m[3].trim() })
      })
      return { summary: summaryRes.stdout.trim(), units }
    } catch (e: any) {
      return { summary: e.message, units: [] }
    }
  })
}
