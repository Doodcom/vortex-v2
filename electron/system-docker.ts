import { ipcMain } from 'electron'
import { execPromise } from './system-common'

export function setupDockerHandlers(_win: any) {
  ipcMain.handle('docker-list', async () => {
    try {
      const { stdout: psOut } = await execPromise(`docker ps -a --format '{{json .}}'`)
      const containers = psOut.trim().split('\n').filter(Boolean).map(line => {
        try { return JSON.parse(line) } catch { return null }
      }).filter(Boolean)

      const statsMap: Record<string, any> = {}
      try {
        const { stdout: statsOut } = await execPromise(`docker stats --no-stream --format '{{json .}}'`)
        statsOut.trim().split('\n').filter(Boolean).forEach(line => {
          try {
            const s = JSON.parse(line)
            statsMap[s.ID.slice(0, 12)] = s
          } catch { /* ignore */ }
        })
      } catch { /* ignore */ }

      return containers.map((c: any) => {
        const id12 = (c.ID || '').slice(0, 12)
        const stat = statsMap[id12] ?? {}
        const cpuStr: string = stat.CPUPerc ?? '0%'
        const cpu = parseFloat(cpuStr) || 0
        const memStr: string = stat.MemUsage ?? '0B / 0B'
        const [usedStr, limitStr] = memStr.split(' / ')
        const parseMem = (s: string) => {
          const m = s?.match(/([\d.]+)\s*(B|kB|MiB|GiB|MB|GB)/i)
          if (!m) return 0
          const v = parseFloat(m[1])
          const u = m[2].toLowerCase()
          if (u === 'gib' || u === 'gb') return v * 1024 * 1024 * 1024
          if (u === 'mib' || u === 'mb') return v * 1024 * 1024
          if (u === 'kb') return v * 1024
          return v
        }
        const netStr: string = stat.NetIO ?? '0B / 0B'
        const [rxStr, txStr] = netStr.split(' / ')
        return {
          id:         c.ID,
          name:       (c.Names || c.Name || '').replace(/^\//, ''),
          image:      c.Image,
          state:      c.State?.toLowerCase() ?? 'unknown',
          status:     c.Status,
          cpu_percent: cpu,
          mem_usage:   parseMem(usedStr),
          mem_limit:   parseMem(limitStr),
          net_io:     { rx: parseMem(rxStr), tx: parseMem(txStr) },
        }
      })
    } catch (e: any) {
      return { error: e.message }
    }
  })

  ipcMain.handle('docker-control', async (_, { id, action }: { id: string; action: string }) => {
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '')
    const safeAction = ['start', 'stop', 'restart', 'pause', 'unpause'].includes(action) ? action : 'stop'
    try {
      await execPromise(`docker ${safeAction} ${safeId}`)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('docker-logs', async (_, { id, lines = 100 }: { id: string; lines?: number }) => {
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '')
    try {
      const { stdout, stderr } = await execPromise(`docker logs --tail ${lines} ${safeId}`)
      return (stdout || '') + (stderr || '')
    } catch (e: any) {
      return `Failed to fetch logs: ${e.message}`
    }
  })
}
