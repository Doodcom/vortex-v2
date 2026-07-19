/* eslint-disable @typescript-eslint/no-explicit-any, no-empty, @typescript-eslint/no-unused-vars */
import { ipcMain } from 'electron'
import { join, resolve } from 'path'
import { homedir } from 'os'
import { readdirSync, existsSync, writeFileSync, unlinkSync, statSync, mkdirSync } from 'fs'
import { execPromise, detectAurHelper, createSystemHelpers } from './system-common'

export function setupPackagesHandlers(win: any) {
  const { notify, streamLog, runStreamingCmd } = createSystemHelpers(win)

  // 46. package-detect-helper
  ipcMain.handle('package-detect-helper', async () => detectAurHelper())

  // 47. package-search
  ipcMain.handle('package-search', async (_, query: string) => {
    const q = query.replace(/[^a-zA-Z0-9._+-]/g, '')
    try {
      const { stdout } = await execPromise(`pacman -Ss ${q}`)
      const results: any[] = []
      const lines = stdout.trim().split('\n')
      let i = 0
      while (i < lines.length) {
        const header = lines[i++]
        const desc = (lines[i] || '').trim()
        if (!header.includes('/')) { i++; continue }
        const [repoPkg, versionRaw] = header.split(/\s+/)
        const [repo, name] = repoPkg.split('/')
        const installed = versionRaw?.includes('[installed]') || (lines[i - 1] || '').includes('[installed]')
        results.push({ repo: repo ?? 'repo', name: name ?? repoPkg, version: versionRaw?.replace(/\[.*?\]/g, '').trim() ?? '', description: desc, installed, source: 'repo' })
        i++
      }
      return results
    } catch { return [] }
  })

  // 48. package-list-aur
  ipcMain.handle('package-list-aur', async () => {
    for (const helper of ['paru', 'yay']) {
      try {
        const { stdout } = await execPromise(`${helper} -Qm`)
        return stdout.trim().split('\n').filter(Boolean).map(line => {
          const [name, version] = line.split(/\s+/)
          return { name, version: version ?? '' }
        })
      } catch {}
    }
    return []
  })

  // 49. package-info
  ipcMain.handle('package-info', async (_, name: string) => {
    const safe = name.replace(/[^a-zA-Z0-9._+-]/g, '')
    try {
      const { stdout } = await execPromise(`pacman -Si ${safe}`).catch(() => execPromise(`pacman -Qi ${safe}`))
      const info: Record<string, string> = {}
      stdout.split('\n').forEach(line => {
        const m = line.match(/^([^:]+)\s*:\s*(.+)/)
        if (m) info[m[1].trim()] = m[2].trim()
      })
      return info
    } catch { return null }
  })

  // 50. package-install
  ipcMain.handle('package-install', async (_, { name, helper }: { name: string; helper: string }) => {
    const safe = name.replace(/[^a-zA-Z0-9._+-]/g, '')
    
    // 2026 Shelly Integration: Try native CachyOS GUI first
    try {
      const { stdout: hasShelly } = await execPromise('which shelly 2>/dev/null || true')
      if (hasShelly.trim()) {
        // Invoke Shelly via D-Bus for themed progress GUI
        await execPromise(`busctl call io.cachyos.Shelly /io/cachyos/Shelly io.cachyos.Shelly Install s "${safe}"`)
        return { success: true, output: `Installation of ${safe} handed off to Shelly.` }
      }
    } catch (e) {
      console.log('[Vortex] Shelly D-Bus handoff failed, falling back to CLI:', e)
    }

    const safeHelper = ['paru', 'yay', 'pacman'].includes(helper) ? helper : 'pacman'
    const cmd = safeHelper === 'pacman'
      ? `pkexec pacman -S --noconfirm ${safe}`
      : `${safeHelper} -S --noconfirm ${safe}`
    const res = await runStreamingCmd('bash', ['-c', cmd])
    return { success: res.success, output: res.log }
  })

  // 51. package-remove
  ipcMain.handle('package-remove', async (_, name: string) => {
    const safe = name.replace(/[^a-zA-Z0-9._+-]/g, '')
    
    // Try Shelly for removal too
    try {
      const { stdout: hasShelly } = await execPromise('which shelly 2>/dev/null || true')
      if (hasShelly.trim()) {
        await execPromise(`busctl call io.cachyos.Shelly /io/cachyos/Shelly io.cachyos.Shelly Remove s "${safe}"`)
        return { success: true, output: `Removal of ${safe} handed off to Shelly.` }
      }
    } catch {}

    const res = await runStreamingCmd('bash', ['-c', `pkexec pacman -Rns --noconfirm ${safe}`])
    return { success: res.success, output: res.log }
  })

  // 52. package-dep-tree
  ipcMain.handle('package-dep-tree', async (_, name: string) => {
    const safe = name.replace(/[^a-zA-Z0-9._+-]/g, '')
    try {
      const { stdout } = await execPromise(`pactree -l ${safe}`)
      const lines = stdout.trim().split('\n').filter(Boolean)
      if (!lines.length) return null
      const root = { name: lines[0], children: [] as any[] }
      const stack: any[] = [root]
      for (let i = 1; i < lines.length; i++) {
        const node = { name: lines[i].trim(), children: [] as any[] }
        if (stack.length > 1) stack[stack.length - 2].children.push(node)
        else root.children.push(node)
      }
      return root
    } catch { return null }
  })

  // 53. flatpak-list
  ipcMain.handle('flatpak-list', async () => {
    try {
      const { stdout } = await execPromise('flatpak list --columns=application,name,version,summary --parsable')
      const apps = stdout.trim().split('\n').filter(Boolean).map(line => {
        const [id, name, version, summary] = line.split('\t')
        return { id, name, version: version || '', summary: summary || '' }
      })
      return { success: true, apps }
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message, apps: [] }
    }
  })

  // 54. flatpak-search
  ipcMain.handle('flatpak-search', async (_, query: string) => {
    try {
      const safeQuery = query.replace(/[^a-zA-Z0-9._-]/g, '')
      if (!safeQuery) return { success: true, results: [] }
      const { stdout } = await execPromise(`flatpak search --columns=application,name,version,description --parsable "${safeQuery}"`)
      const results = stdout.trim().split('\n').filter(Boolean).map(line => {
        const [id, name, version, description] = line.split('\t')
        return { id, name, version: version || '', description: description || '' }
      })
      return { success: true, results }
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message, results: [] }
    }
  })

  // 55. flatpak-install
  ipcMain.handle('flatpak-install', async (_, appId: string) => {
    try {
      const safeAppId = appId.replace(/[^a-zA-Z0-9._-]/g, '')
      if (!safeAppId) throw new Error('Invalid App ID')
      streamLog(`> Installing Flatpak application: ${safeAppId}...`)
      const res = await runStreamingCmd('flatpak', ['install', '-y', safeAppId])
      return { success: res.success, error: res.success ? undefined : res.log }
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message }
    }
  })

  // 56. flatpak-uninstall
  ipcMain.handle('flatpak-uninstall', async (_, appId: string) => {
    try {
      const safeAppId = appId.replace(/[^a-zA-Z0-9._-]/g, '')
      if (!safeAppId) throw new Error('Invalid App ID')
      streamLog(`> Uninstalling Flatpak application: ${safeAppId}...`)
      const res = await runStreamingCmd('flatpak', ['uninstall', '-y', safeAppId])
      return { success: res.success, error: res.success ? undefined : res.log }
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message }
    }
  })

  // 57. appimage-list
  ipcMain.handle('appimage-list', async () => {
    try {
      const folders = [join(homedir(), 'Applications'), join(homedir(), 'Downloads')]
      const apps: { filename: string; path: string; registered: boolean; executable: boolean }[] = []
      
      for (const dir of folders) {
        if (!existsSync(dir)) continue
        const files = readdirSync(dir)
        for (const file of files) {
          if (file.toLowerCase().endsWith('.appimage')) {
            const p = join(dir, file)
            let isExec = false
            try {
              const stat = statSync(p)
              isExec = (stat.mode & 0o111) !== 0
            } catch {
              /* ignore */
            }
            const desktopPath = join(homedir(), '.local/share/applications', `vortex-appimage-${file}.desktop`)
            const registered = existsSync(desktopPath)
            apps.push({ filename: file, path: p, registered, executable: isExec })
          }
        }
      }
      return { success: true, apps }
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message, apps: [] }
    }
  })

  // 58. appimage-register
  ipcMain.handle('appimage-register', async (_, path: string) => {
    try {
      const resolved = resolve(path)
      const allowedDirs = [join(homedir(), 'Applications'), join(homedir(), 'Downloads')]
      if (!allowedDirs.some(dir => resolved.startsWith(dir))) {
        throw new Error('Access denied: path is outside Applications or Downloads directory')
      }
      const filename = path.split('/').pop() || ''
      if (!filename.toLowerCase().endsWith('.appimage')) {
        throw new Error('Invalid file type: not an AppImage')
      }
      const cleanName = filename.replace(/\.appimage$/i, '').replace(/[\s.-]+/g, ' ')
      const desktopContent = `[Desktop Entry]
Type=Application
Name=${cleanName}
Exec="${resolved}"
Icon=application-x-executable
Terminal=false
Categories=Utility;
`
      const appsDir = join(homedir(), '.local/share/applications')
      if (!existsSync(appsDir)) {
        mkdirSync(appsDir, { recursive: true })
      }
      const target = join(appsDir, `vortex-appimage-${filename}.desktop`)
      writeFileSync(target, desktopContent, 'utf-8')
      return { success: true }
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message }
    }
  })

  // 59. appimage-unregister
  ipcMain.handle('appimage-unregister', async (_, path: string) => {
    try {
      const filename = path.split('/').pop() || ''
      const target = join(homedir(), '.local/share/applications', `vortex-appimage-${filename}.desktop`)
      if (existsSync(target)) {
        unlinkSync(target)
      }
      return { success: true }
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message }
    }
  })

  // 60. appimage-make-executable
  ipcMain.handle('appimage-make-executable', async (_, path: string) => {
    try {
      const resolved = resolve(path)
      const allowedDirs = [join(homedir(), 'Applications'), join(homedir(), 'Downloads')]
      if (!allowedDirs.some(dir => resolved.startsWith(dir))) {
        throw new Error('Access denied: path is outside Applications or Downloads directory')
      }
      await execPromise(`chmod +x "${resolved}"`)
      return { success: true }
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message }
    }
  })
}
