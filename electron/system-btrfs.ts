/* eslint-disable @typescript-eslint/no-explicit-any, no-empty, @typescript-eslint/no-unused-vars */
import { ipcMain } from 'electron'
import { execPromise, createSystemHelpers } from './system-common'

// Helper for parsing BTRFS sizes
function parseBtrfsSize(str: string): number {
  const m = str.match(/([0-9.]+)\s*([KMGTP]i?B|B)/i)
  if (!m) return 0
  const val = parseFloat(m[1])
  const unit = m[2].toUpperCase()
  const multipliers: Record<string, number> = {
    'B': 1,
    'KB': 1024,
    'KIB': 1024,
    'MB': 1024 * 1024,
    'MIB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'GIB': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024,
    'TIB': 1024 * 1024 * 1024 * 1024,
    'PB': 1024 * 1024 * 1024 * 1024 * 1024,
    'PIB': 1024 * 1024 * 1024 * 1024 * 1024,
  }
  return Math.round(val * (multipliers[unit] || 1))
}

export function setupBtrfsHandlers(win: any) {
  const { notify, streamLog, runStreamingCmd } = createSystemHelpers(win)

  // 61. btrfs-scrub
  ipcMain.handle('btrfs-scrub', async (_, action: string) => {
    try {
      if (action === 'start') {
        await execPromise('pkexec btrfs scrub start /')
        return { success: true, status: 'Scrub running' }
      } else if (action === 'status') {
        const { stdout } = await execPromise('btrfs scrub status /')
        // Parse progress percentage
        const progressMatch = stdout.match(/(\d+(?:\.\d+)?)%/)
        const progress = progressMatch ? parseFloat(progressMatch[1]) : undefined
        // Parse error count
        let errors = 0
        if (!stdout.includes('no errors found')) {
          const errMatch = stdout.match(/errors:\s*(\d+)/i) || stdout.match(/(\d+)\s+errors/i)
          if (errMatch) {
            errors = parseInt(errMatch[1], 10)
          }
        }
        return { success: true, status: stdout.trim(), progress, errors }
      } else {
        await execPromise('pkexec btrfs scrub cancel /')
        return { success: true, status: 'Scrub stopped' }
      }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // 62. btrfs-balance
  ipcMain.handle('btrfs-balance', async (_, action: string, dusage?: number, musage?: number) => {
    try {
      if (action === 'start') {
        const d = Math.max(10, Math.min(100, dusage !== undefined ? dusage : 50))
        const m = Math.max(10, Math.min(100, musage !== undefined ? musage : 50))
        await execPromise(`pkexec btrfs balance start --background -dusage=${d} -musage=${m} /`)
        return { success: true, status: 'Balance started' }
      } else if (action === 'status') {
        try {
          const { stdout } = await execPromise('pkexec btrfs balance status /')
          return { success: true, status: stdout.trim() }
        } catch (err: any) {
          if (err.stdout && err.stdout.includes('No balance active')) {
            return { success: true, status: err.stdout.trim() }
          }
          if (err.message && err.message.includes('No balance active')) {
            return { success: true, status: 'No balance active on /' }
          }
          throw err
        }
      } else {
        await execPromise('pkexec btrfs balance cancel /')
        return { success: true, status: 'Balance stopped' }
      }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // 63. btrfs-defrag
  ipcMain.handle('btrfs-defrag', async (_, path: string) => {
    try {
      const targetPath = path ? path.trim() : '/'
      if (/[;&|`$()<>]/g.test(targetPath)) {
        return { success: false, error: 'Invalid characters in path.' }
      }
      await execPromise(`pkexec btrfs filesystem defragment -r "${targetPath}"`)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // 64. btrfs-usage
  ipcMain.handle('btrfs-usage', async () => {
    try {
      const { stdout } = await execPromise('btrfs filesystem usage /')
      const lines = stdout.split('\n')
      
      const unallocLine = lines.find(l => l.includes('Device unallocated:'))
      let unallocated = 0
      if (unallocLine) {
        unallocated = parseBtrfsSize(unallocLine)
      }

      let dataAlloc = 0
      const dataLines = lines.filter(l => l.trim().startsWith('Data,'))
      for (const line of dataLines) {
        const m = line.match(/Size:\s*([0-9.]+\s*[A-Za-z]+)/)
        if (m) {
          dataAlloc += parseBtrfsSize(m[1])
        }
      }

      let metaAlloc = 0
      const metaLines = lines.filter(l => l.trim().startsWith('Metadata,'))
      for (const line of metaLines) {
        const m = line.match(/Size:\s*([0-9.]+\s*[A-Za-z]+)/)
        if (m) {
          metaAlloc += parseBtrfsSize(m[1])
        }
      }

      return {
        success: true,
        dataAlloc,
        metaAlloc,
        unallocated
      }
    } catch (e: any) {
      return { success: false, error: e.message, dataAlloc: 0, metaAlloc: 0, unallocated: 0 }
    }
  })

  // 65. system-snapper-snapshot
  ipcMain.handle('system-snapper-snapshot', async (_, desc?: string) => {
    const description = desc || 'Vortex pre-change snapshot'
    try {
      const { stdout } = await execPromise(`pkexec snapper --no-dbus -c root create -t pre -p -d "${description}"`)
      return { success: true, output: `Snapshot created: ${stdout.trim()}` }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // 66. system-snapper-list
  ipcMain.handle('system-snapper-list', async () => {
    try {
      const { stdout } = await execPromise('pkexec snapper --no-dbus --csvout --separator "|" -c root list --columns number,type,date,description,used-space')
      const lines = stdout.trim().split('\n').filter(Boolean)
      // Skip header if present
      if (lines[0]?.startsWith('number|')) lines.shift()
      
      const rows = lines.map(line => {
        const parts = line.split('|')
        return {
          id:          (parts[0] ?? '').trim(),
          type:        (parts[1] ?? '').trim(),
          date:        (parts[2] ?? '').trim(),
          description: (parts[3] ?? '').trim(),
          usedSpace:   (parts[4] ?? '').trim(),
        }
      })
      return { success: true, snapshots: rows }
    } catch (e: any) {
      return { success: false, error: e.message, snapshots: [] }
    }
  })

  // 67. system-snapper-create
  ipcMain.handle('system-snapper-create', async (_, { description }: { description: string }) => {
    const safe = description.replace(/"/g, "'")
    try {
      const { stdout } = await execPromise(`pkexec snapper --no-dbus -c root create -t single -d "${safe}"`)
      return { success: true, id: stdout.trim() }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // 68. system-snapper-delete
  ipcMain.handle('system-snapper-delete', async (_, { id }: { id: string }) => {
    if (!/^\d+$/.test(id)) return { success: false, error: 'Invalid snapshot ID' }
    try {
      await execPromise(`pkexec snapper --no-dbus -c root delete ${id}`)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // 69. system-snapper-rollback
  ipcMain.handle('system-snapper-rollback', async (_, { id }: { id: string }) => {
    if (!/^\d+$/.test(id)) return { success: false, error: 'Invalid snapshot ID' }
    try {
      // Creates a new snapshot of current state, sets target as default subvol for next boot
      const { stdout, stderr } = await execPromise(`pkexec snapper --no-dbus rollback ${id}`)
      return { success: true, output: (stdout + stderr).trim() }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })
}
