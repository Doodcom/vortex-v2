/* eslint-disable @typescript-eslint/no-explicit-any, no-empty, @typescript-eslint/no-unused-vars, no-useless-escape */
import { ipcMain } from 'electron'
import si from 'systeminformation'
import { writeFileSync, readFileSync } from 'fs'
import { execPromise, detectAurHelper, createSystemHelpers } from './system-common'

export function setupHardwareHandlers(win: any) {
  const { notify, streamLog, runStreamingCmd } = createSystemHelpers(win)

  ipcMain.handle('network-stats', async () => {
    const [ifaces, stats] = await Promise.all([si.networkInterfaces(), si.networkStats()])
    const ifaceMap: Record<string, any> = {}
    const ifaceArr = Array.isArray(ifaces) ? ifaces : [ifaces]
    ifaceArr.forEach((i: any) => { ifaceMap[i.iface] = i })
    return (Array.isArray(stats) ? stats : [stats]).map((s: any) => ({
      iface:     s.iface,
      rx_sec:    s.rx_sec   ?? 0,
      tx_sec:    s.tx_sec   ?? 0,
      rx_bytes:  s.rx_bytes ?? 0,
      tx_bytes:  s.tx_bytes ?? 0,
      operstate: ifaceMap[s.iface]?.operstate ?? 'unknown',
      ip4:       ifaceMap[s.iface]?.ip4       ?? '',
      mac:       ifaceMap[s.iface]?.mac       ?? '',
      type:      ifaceMap[s.iface]?.type      ?? '',
    }))
  })

  ipcMain.handle('network-connections', async () => {
    const [conns, procs] = await Promise.all([si.networkConnections(), si.processes()])
    const pidMap: Record<number, string> = {}
    procs.list?.forEach((p: any) => { pidMap[p.pid] = p.name })
    return conns.map((c: any) => ({
      protocol:  c.protocol,
      localaddr: c.localAddress,
      localport: String(c.localPort),
      peeraddr:  c.peerAddress,
      peerport:  String(c.peerPort),
      state:     c.state,
      pid:       c.pid ?? 0,
      process:   pidMap[c.pid] ?? '',
    }))
  })

  ipcMain.handle('process-list', async () => {
    const { list } = await si.processes()
    return list.map((p: any) => ({
      pid:    p.pid,
      name:   p.name,
      cpu:    p.cpu    ?? 0,
      mem:    p.mem    ?? 0,
      memRss: p.memRss ?? 0,
      command: p.command ?? p.name,
      user:   p.user   ?? '',
      state:  p.state  ?? '',
      started: p.started ?? '',
    }))
  })

  ipcMain.handle('process-kill', async (_, { pid, signal = 'SIGTERM' }: { pid: number; signal?: string }) => {
    try {
      await execPromise(`kill -${signal} ${pid}`)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('systemd-list-units', async () => {
    try {
      const { stdout } = await execPromise('systemctl list-units --type=service --all --no-pager --plain --no-legend')
      return stdout.trim().split('\n').filter(Boolean).map(line => {
        const parts = line.trim().split(/\s+/)
        return {
          unit:        parts[0] ?? '',
          load:        parts[1] ?? '',
          active:      parts[2] ?? '',
          sub:         parts[3] ?? '',
          description: parts.slice(4).join(' '),
        }
      })
    } catch (e: any) {
      return []
    }
  })

  ipcMain.handle('systemd-control-unit', async (_, { unit, action }: { unit: string; action: string }) => {
    try {
      const safe = unit.replace(/[^a-zA-Z0-9@._-]/g, '')
      const safeAction = ['start','stop','restart','enable','disable','reload'].includes(action) ? action : 'status'
      const { stdout, stderr } = await execPromise(`pkexec systemctl ${safeAction} ${safe}`)
      return { success: true, output: stdout || stderr }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('systemd-unit-logs', async (_, { unit, lines = 50 }: { unit: string; lines?: number }) => {
    try {
      const safe = unit.replace(/[^a-zA-Z0-9@._-]/g, '')
      const { stdout } = await execPromise(`journalctl -u ${safe} -n ${lines} --no-pager`)
      return stdout
    } catch (e: any) {
      return `Failed to fetch logs: ${e.message}`
    }
  })

  ipcMain.handle('disk-info', async () => {
    const [layout, fsSize] = await Promise.all([si.diskLayout(), si.fsSize()])
    return {
      layout: layout.map((d: any) => ({
        device:     d.device,
        name:       d.name,
        type:       d.type,
        size:       d.size,
        vendor:     d.vendor,
        model:      d.model,
        serial:     d.serialNum,
        firmwareRevision: d.firmwareRevision,
        smartStatus: d.smartStatus,
      })),
      filesystems: fsSize.map((f: any) => ({
        fs:    f.fs,
        type:  f.type,
        size:  f.size,
        used:  f.used,
        use:   f.use,
        mount: f.mount,
      })),
    }
  })

  ipcMain.handle('disk-smart', async (_, device: string) => {
    try {
      const safe = device.replace(/[^a-zA-Z0-9/_-]/g, '')
      const { stdout } = await execPromise(`pkexec smartctl -H -A ${safe}`)
      const health = /SMART overall-health.*: PASSED/i.test(stdout) ? 'PASSED'
                   : /SMART overall-health.*: FAILED/i.test(stdout) ? 'FAILED' : 'UNKNOWN'
      const tempMatch = stdout.match(/Temperature[^0-9]*(\d+)\s+\(/i)
      const temp = tempMatch ? parseInt(tempMatch[1]) : null
      return { health, temp }
    } catch {
      return { health: 'UNKNOWN', temp: null }
    }
  })

  ipcMain.handle('power-get-profile', async () => {
    try {
      const { stdout } = await execPromise('powerprofilesctl get')
      return { profile: stdout.trim() }
    } catch {
      try {
        const { stdout } = await execPromise('cat /sys/firmware/acpi/platform_profile')
        return { profile: stdout.trim() }
      } catch { return { profile: 'balanced' } }
    }
  })

  ipcMain.handle('power-set-profile', async (_, profile: string) => {
    const safe = ['power-saver', 'balanced', 'performance'].includes(profile) ? profile : 'balanced'
    try {
      await execPromise(`powerprofilesctl set ${safe}`)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('chwd-detect', async () => {
    try {
      const { stdout } = await execPromise('chwd --list 2>&1')
      return { success: true, output: stdout }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('chwd-install', async (_, profile: string) => {
    // profile must contain only alphanum, dash, dot, underscore
    if (!/^[\w.\-]+$/.test(profile)) return { success: false, error: 'Invalid profile name' }
    try {
      const { stdout, stderr } = await execPromise(`pkexec chwd --install ${profile}`)
      return { success: true, output: stdout || stderr }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('fprintd-status', async () => {
    try {
      const { stdout: svcState } = await execPromise('systemctl is-active fprintd.service 2>&1 || true')
      const active = svcState.trim() === 'active'
      let devices = 'fprintd not installed'
      try {
        const { stdout: pkgCheck } = await execPromise('pacman -Q fprintd 2>/dev/null || true')
        if (pkgCheck.trim()) {
          devices = active ? 'Service active — no enrolled fingers detected' : 'Package installed but service inactive'
        }
      } catch {}
      return { success: true, active, devices }
    } catch (e: any) {
      return { success: true, active: false, devices: 'fprintd not installed' }
    }
  })

  ipcMain.handle('gpu-vram-stats', async () => {
    try {
      const { stdout } = await execPromise(
        'nvidia-smi --query-gpu=memory.used,memory.total,memory.free,utilization.gpu --format=csv,noheader,nounits'
      )
      const parts = stdout.trim().split(',').map(s => parseInt(s.trim(), 10))
      const [used, total, free, gpuUtil] = parts
      return { success: true, used, total, free, gpuUtil }
    } catch {
      return { success: false, used: 0, total: 0, free: 0, gpuUtil: 0 }
    }
  })

  ipcMain.handle('system-audit-arch', async () => {
    try {
      // Logic: List all installed packages and their repos.
      // Packages NOT in cachyos-v4 (or -v3) but present in generic repos are candidates.
      const { stdout } = await execPromise("pacman -Sl | grep -v '\[installed\]' -v 'cachyos-v4' -v 'cachyos-v3' | grep '\[installed\]' || true")
      const lines = stdout.trim().split('\n').filter(Boolean)
      
      const packages = lines.map(line => {
        const [repo, name] = line.split(/\s+/)
        return { name, repo, isGeneric: !repo.includes('v4') && !repo.includes('v3') }
      }).filter(p => p.isGeneric).slice(0, 15) // Limit to top 15 for UI clarity

      return { success: true, packages }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('system-rebuild-native', async (_, pkgName: string) => {
    try {
      const safePkg = pkgName.replace(/[^a-zA-Z0-9._\-+]/g, '')
      if (!safePkg) return { success: false, log: 'Invalid package name' }
      const helper = await detectAurHelper()
      const cmd = helper !== 'pacman'
        ? `${helper} -S --rebuild --noconfirm ${safePkg}`
        : `pacman -S --noconfirm ${safePkg}`
      const res = await runStreamingCmd('bash', ['-c', cmd])
      return { success: res.success, log: res.log }
    } catch (e: any) {
      return { success: false, log: e.message }
    }
  })

}
