import { ipcMain } from 'electron'
import { homedir } from 'os'
import { join } from 'path'
import { db } from './db'
import { execPromise } from './system-common'

export function setupSecurityHandlers(_win: any) {
  // Dotfile Vault
  ipcMain.handle('vault-list-backups', async () => {
    try {
      const dir = `${homedir()}/Vortex-Backups`
      await execPromise(`mkdir -p "${dir}"`)
      const { stdout } = await execPromise(`ls -t "${dir}" 2>/dev/null || true`)
      const files = stdout.split('\n').map(f => f.trim()).filter(f => f.endsWith('.tar.gz'))
      const backups = files.map(f => {
        const m = f.match(/^vault_(.+)\.tar\.gz$/)
        const tsStr = m ? m[1].replace(/_/g, ':').replace('T', 'T') : ''
        const ts = new Date(tsStr).getTime()
        return { filename: f, ts: isNaN(ts) ? 0 : ts, path: `${dir}/${f}` }
      })
      return { success: true, backups }
    } catch (e: any) { return { success: false, backups: [], error: e.message } }
  })

  ipcMain.handle('vault-create', async (_, { paths }: { paths: string[] }) => {
    try {
      const dir = `${homedir()}/Vortex-Backups`
      await execPromise(`mkdir -p "${dir}"`)
      const ts = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '')
      const outFile = `${dir}/vault_${ts}.tar.gz`
      const expandedPaths = paths.map(p => p.replace(/^~/, homedir()))
      const safeList = expandedPaths.map(p => `"${p.replace(/"/g, '\\"')}"`).join(' ')
      await execPromise(`tar -czf "${outFile}" ${safeList} 2>/dev/null || tar -czf "${outFile}" ${safeList}`)
      return { success: true, filename: `vault_${ts}.tar.gz` }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('vault-restore', async (_, { filename }: { filename: string }) => {
    try {
      const dir = `${homedir()}/Vortex-Backups`
      const safeFile = filename.replace(/[^a-zA-Z0-9._-]/g, '')
      const fullPath = `${dir}/${safeFile}`
      if (!fullPath.startsWith(dir)) throw new Error('Invalid filename')
      await execPromise(`tar -xzf "${fullPath}" -C /`)
      return { success: true }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('vault-delete', async (_, { filename }: { filename: string }) => {
    try {
      const dir = `${homedir()}/Vortex-Backups`
      const safeFile = filename.replace(/[^a-zA-Z0-9._-]/g, '')
      await execPromise(`rm -f "${dir}/${safeFile}"`)
      return { success: true }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  // UFW Firewall
  ipcMain.handle('ufw-status', async () => {
    try {
      const { stdout } = await execPromise('pkexec ufw status verbose')
      const lines = stdout.split('\n')
      const statusLine = lines.find(l => l.toLowerCase().startsWith('status:'))
      const enabled = statusLine?.toLowerCase().includes('active') ?? false
      const rules: { to: string; action: string; from: string; comment: string }[] = []
      let inRules = false
      for (const line of lines) {
        if (line.startsWith('--')) { inRules = true; continue }
        if (!inRules) continue
        const trimmed = line.trim()
        if (!trimmed) continue
        const m = trimmed.match(/^(\S+(?:\s+\(v6\))?)\s+(ALLOW|DENY|REJECT|LIMIT)\s+(.*?)(?:\s+#\s*(.*))?$/)
        if (m) rules.push({ to: m[1], action: m[2], from: m[3].trim() || 'Anywhere', comment: m[4] ?? '' })
      }
      return { success: true, enabled, rules, raw: stdout }
    } catch (e: any) {
      return { success: false, enabled: false, rules: [], raw: '', error: e.message }
    }
  })

  ipcMain.handle('ufw-enable', async (_, enable: boolean) => {
    try {
      const cmd = enable ? 'pkexec ufw enable' : 'pkexec ufw disable'
      const { stdout } = await execPromise(cmd)
      return { success: true, output: stdout.trim() }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('ufw-add-rule', async (_, rule: { port: string; proto: string; action: string; from: string; comment: string }) => {
    try {
      const safePort = rule.port.replace(/[^0-9:]/g, '')
      const safeFrom = rule.from.replace(/[^0-9./: ]/g, '')
      const proto = ['tcp', 'udp', 'any'].includes(rule.proto) ? rule.proto : 'any'
      const action = ['allow', 'deny', 'reject', 'limit'].includes(rule.action.toLowerCase()) ? rule.action.toLowerCase() : 'allow'
      const portSpec = proto === 'any' ? safePort : `${safePort}/${proto}`
      const fromSpec = safeFrom && safeFrom !== 'Anywhere' ? `from ${safeFrom} to any port ${safePort}` : portSpec
      const commentFlag = rule.comment.trim() ? ` comment '${rule.comment.replace(/'/g, '')}'` : ''
      await execPromise(`pkexec ufw ${action} ${fromSpec}${commentFlag}`)
      return { success: true }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('ufw-delete-rule', async (_, num: number) => {
    try {
      await execPromise(`pkexec bash -c "echo y | ufw delete ${Math.abs(Math.floor(num))}"`)
      return { success: true }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  // SSH Keys
  ipcMain.handle('ssh-list-keys', async () => {
    try {
      const sshDir = `${homedir()}/.ssh`
      const { stdout: lsOut } = await execPromise(`ls "${sshDir}" 2>/dev/null || true`)
      const files = lsOut.split('\n').map(f => f.trim()).filter(Boolean)
      const pubFiles = files.filter(f => f.endsWith('.pub'))
      const keys: { name: string; pubFile: string; privFile: string; type: string; fingerprint: string; comment: string; pubKey: string }[] = []
      for (const pub of pubFiles) {
        const name = pub.replace(/\.pub$/, '')
        const privExists = files.includes(name)
        const fullPub = `${sshDir}/${pub}`
        const { stdout: content } = await execPromise(`cat "${fullPub}" 2>/dev/null || true`)
        const parts = content.trim().split(' ')
        const type = parts[0] ?? ''
        const comment = parts[2] ?? ''
        const { stdout: fp } = await execPromise(`ssh-keygen -lf "${fullPub}" 2>/dev/null || true`)
        const fingerprint = fp.trim().split(' ').slice(0, 2).join(' ')
        keys.push({ name, pubFile: pub, privFile: privExists ? name : '', type, fingerprint, comment, pubKey: content.trim() })
      }
      return { success: true, keys }
    } catch (e: any) {
      return { success: false, keys: [], error: e.message }
    }
  })

  ipcMain.handle('ssh-generate-key', async (_, { type, bits, comment, filename }: { type: string; bits?: number; comment: string; filename: string }) => {
    try {
      const sshDir = `${homedir()}/.ssh`
      const safeName = filename.replace(/[^a-zA-Z0-9_-]/g, '_')
      const outFile = `${sshDir}/${safeName}`
      const bitsFlag = type === 'rsa' ? `-b ${bits ?? 4096}` : ''
      await execPromise(`ssh-keygen -t ${type} ${bitsFlag} -C "${comment.replace(/"/g, '')}" -f "${outFile}" -N ""`)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('ssh-delete-key', async (_, { name }: { name: string }) => {
    try {
      const sshDir = `${homedir()}/.ssh`
      const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_')
      await execPromise(`rm -f "${sshDir}/${safeName}" "${sshDir}/${safeName}.pub"`)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // Cron
  ipcMain.handle('cron-list', async () => {
    try {
      const { stdout } = await execPromise('crontab -l 2>/dev/null || true')
      const lines = stdout.split('\n')
      const entries: { id: string; raw: string; min: string; hour: string; dom: string; month: string; dow: string; command: string; comment: string; enabled: boolean }[] = []
      let pendingComment = ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) { pendingComment = ''; continue }
        if (trimmed.startsWith('#')) {
          pendingComment = trimmed.slice(1).trim()
          continue
        }
        if (trimmed.includes('=') && !trimmed.match(/^\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+/)) { pendingComment = ''; continue }
        const m = trimmed.match(/^(@\S+|\S+\s+\S+\s+\S+\s+\S+\s+\S+)\s+(.+)$/)
        if (!m) { pendingComment = ''; continue }
        const schedule = m[1].trim()
        const command = m[2].trim()
        let min = '*', hour = '*', dom = '*', month = '*', dow = '*'
        if (schedule.startsWith('@')) {
          min = schedule
        } else {
          const parts = schedule.split(/\s+/)
          ;[min, hour, dom, month, dow] = parts
        }
        entries.push({ id: Math.random().toString(36).slice(2), raw: trimmed, min, hour, dom, month, dow, command, comment: pendingComment, enabled: true })
        pendingComment = ''
      }
      return { success: true, entries }
    } catch (e: any) {
      return { success: false, entries: [], error: e.message }
    }
  })

  ipcMain.handle('cron-save', async (_, { entries }: { entries: { min: string; hour: string; dom: string; month: string; dow: string; command: string; comment: string }[] }) => {
    try {
      const lines = entries.map(e => {
        const comment = e.comment.trim() ? `# ${e.comment.trim()}\n` : ''
        const schedule = e.min.startsWith('@') ? e.min : `${e.min} ${e.hour} ${e.dom} ${e.month} ${e.dow}`
        return `${comment}${schedule} ${e.command}`
      })
      const crontab = lines.join('\n') + '\n'
      await execPromise(`echo ${JSON.stringify(crontab)} | crontab -`)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // Cloud Sync for Dotfile Vault
  ipcMain.handle('vault-get-sync-config', async () => {
    try {
      const config = db.prepare('SELECT remote_name, remote_path FROM vault_sync_config LIMIT 1').get() as { remote_name: string; remote_path: string } | undefined
      if (!config) {
        return { success: true, config: null }
      }
      return {
        success: true,
        config: {
          remoteName: config.remote_name,
          remotePath: config.remote_path
        }
      }
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message, config: null }
    }
  })

  ipcMain.handle('vault-save-sync-config', async (_, { remoteName, remotePath }: { remoteName: string; remotePath: string }) => {
    try {
      db.prepare('INSERT OR REPLACE INTO vault_sync_config (id, remote_name, remote_path) VALUES (1, ?, ?)').run(remoteName, remotePath)
      return { success: true }
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle('vault-sync-backup', async (_, { filename }: { filename: string }) => {
    try {
      const config = db.prepare('SELECT remote_name, remote_path FROM vault_sync_config LIMIT 1').get() as { remote_name: string; remote_path: string } | undefined
      if (!config) {
        throw new Error('Cloud sync not configured')
      }
      const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '')
      const localPath = join(homedir(), 'Vortex-Backups', safeFilename)
      const dest = config.remote_path ? `${config.remote_name}:${config.remote_path}` : `${config.remote_name}:`
      
      await execPromise(`rclone copy "${localPath}" "${dest}"`)
      return { success: true }
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle('vault-list-remote', async () => {
    try {
      const config = db.prepare('SELECT remote_name, remote_path FROM vault_sync_config LIMIT 1').get() as { remote_name: string; remote_path: string } | undefined
      if (!config) {
        throw new Error('Cloud sync not configured')
      }
      const remoteSrc = config.remote_path ? `${config.remote_name}:${config.remote_path}` : `${config.remote_name}:`
      const { stdout } = await execPromise(`rclone lsf "${remoteSrc}"`)
      const files = stdout.trim().split('\n').map(f => f.trim()).filter(f => f.endsWith('.tar.gz'))
      return {
        success: true,
        backups: files.map(f => ({ filename: f }))
      }
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message, backups: [] }
    }
  })

  ipcMain.handle('vault-download-remote', async (_, { filename }: { filename: string }) => {
    try {
      const config = db.prepare('SELECT remote_name, remote_path FROM vault_sync_config LIMIT 1').get() as { remote_name: string; remote_path: string } | undefined
      if (!config) {
        throw new Error('Cloud sync not configured')
      }
      const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '')
      const remoteSrc = config.remote_path ? `${config.remote_name}:${config.remote_path}/${safeFilename}` : `${config.remote_name}:${safeFilename}`
      const destDir = join(homedir(), 'Vortex-Backups')
      
      await execPromise(`rclone copy "${remoteSrc}" "${destDir}"`)
      return { success: true }
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message }
    }
  })
}
