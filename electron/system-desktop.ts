import { ipcMain } from 'electron'
import { readdirSync, readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import { homedir } from 'os'
import { spawn } from 'child_process'
import axios from 'axios'
import { execPromise } from './system-common'

export function setupDesktopHandlers(_win: any) {
  ipcMain.handle('apps-list', async () => {
    try {
      const dirs = [
        `${homedir()}/.local/share/applications`,
        '/usr/share/applications',
        '/usr/local/share/applications',
      ]
      const apps: { name: string; exec: string; comment: string; categories: string; icon: string; path: string }[] = []
      const seen = new Set<string>()
      for (const dir of dirs) {
        try {
          const files = readdirSync(dir).filter(f => f.endsWith('.desktop'))
          for (const file of files) {
            try {
              const content = readFileSync(join(dir, file), 'utf-8')
              const get = (key: string) => {
                const m = content.match(new RegExp(`^${key}=(.+)$`, 'm'))
                return m ? m[1].trim() : ''
              }
              if (get('NoDisplay') === 'true' || get('Hidden') === 'true') continue
              const name = get('Name')
              if (!name || seen.has(name)) continue
              seen.add(name)
              apps.push({ name, exec: get('Exec'), comment: get('Comment'), categories: get('Categories'), icon: get('Icon'), path: join(dir, file) })
            } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
      }
      apps.sort((a, b) => a.name.localeCompare(b.name))
      return { success: true, apps }
    } catch (e: any) {
      return { success: false, apps: [], error: e.message }
    }
  })

  ipcMain.handle('apps-launch', async (_, { exec }: { exec: string }) => {
    try {
      const clean = exec.replace(/%[uUfFdDnNickvm]/g, '').trim()
      spawn('bash', ['-c', clean], { detached: true, stdio: 'ignore' }).unref()
      return { success: true }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('arch-news-fetch', async () => {
    try {
      const { data } = await axios.get('https://archlinux.org/feeds/news/', { timeout: 8000, responseType: 'text' })
      const items: { title: string; link: string; date: string; summary: string }[] = []
      const itemRe = /<item>([\s\S]*?)<\/item>/g
      let m: RegExpExecArray | null
      while ((m = itemRe.exec(data)) !== null) {
        const block = m[1]
        const title = (block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/) ?? [])[1] ?? ''
        const link  = (block.match(/<link>(.*?)<\/link>/) ?? [])[1] ?? ''
        const date  = (block.match(/<pubDate>(.*?)<\/pubDate>/) ?? [])[1] ?? ''
        const desc  = (block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) ?? [])[1] ?? ''
        const summary = desc.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 300)
        items.push({ title: title.trim(), link: link.trim(), date: date.trim(), summary })
      }
      return { success: true, items: items.slice(0, 10) }
    } catch (e: any) {
      return { success: false, items: [], error: e.message }
    }
  })

  ipcMain.handle('startup-list', async () => {
    const autostartDir = join(homedir(), '.config', 'autostart')
    const desktopEntries: any[] = []
    if (existsSync(autostartDir)) {
      try {
        readdirSync(autostartDir).filter(f => f.endsWith('.desktop')).forEach(file => {
          const path = join(autostartDir, file)
          try {
            const content = readFileSync(path, 'utf8')
            const get = (key: string) => content.match(new RegExp(`^${key}=(.*)`, 'm'))?.[1]?.trim() ?? ''
            const hiddenRaw = get('Hidden')
            const enabledRaw = get('X-GNOME-Autostart-enabled')
            desktopEntries.push({
              filename: file,
              path,
              name:    get('Name') || file,
              exec:    get('Exec'),
              comment: get('Comment'),
              icon:    get('Icon'),
              enabled: enabledRaw !== 'false' && hiddenRaw !== 'true',
            })
          } catch { /* ignore */ }
        })
      } catch { /* ignore */ }
    }

    let systemdServices: any[] = []
    try {
      const { stdout } = await execPromise('systemctl --user list-units --type=service --all --no-pager --plain --no-legend')
      systemdServices = stdout.trim().split('\n').filter(Boolean).map(line => {
        const parts = line.trim().split(/\s+/)
        return { unit: parts[0] ?? '', active: parts[2] ?? '', description: parts.slice(4).join(' ') }
      })
    } catch { /* ignore */ }

    return { desktopEntries, systemdServices }
  })

  ipcMain.handle('startup-toggle-desktop', async (_, { path: filePath, enabled }: { path: string; enabled: boolean }) => {
    try {
      const allowed = join(homedir(), '.config', 'autostart')
      if (!resolve(filePath).startsWith(allowed)) return { success: false, error: 'Path outside allowed directory' }
      let content = readFileSync(filePath, 'utf8')
      if (content.includes('X-GNOME-Autostart-enabled=')) {
        content = content.replace(/^X-GNOME-Autostart-enabled=.*/m, `X-GNOME-Autostart-enabled=${enabled}`)
      } else {
        content = content.replace(/^\[Desktop Entry\]/m, `[Desktop Entry]\nX-GNOME-Autostart-enabled=${enabled}`)
      }
      if (content.includes('Hidden=')) {
        content = content.replace(/^Hidden=.*/m, `Hidden=${!enabled}`)
      } else {
        content = content.replace(/^\[Desktop Entry\]/m, `[Desktop Entry]\nHidden=${!enabled}`)
      }
      writeFileSync(filePath, content, 'utf8')
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('startup-delete-desktop', async (_, filePath: string) => {
    try {
      const allowed = join(homedir(), '.config', 'autostart')
      if (!resolve(filePath).startsWith(allowed)) return { success: false, error: 'Path outside allowed directory' }
      unlinkSync(filePath)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('startup-toggle-systemd', async (_, { unit, enable }: { unit: string; enable: boolean }) => {
    try {
      const safe = unit.replace(/[^a-zA-Z0-9@._-]/g, '')
      await execPromise(`systemctl --user ${enable ? 'enable' : 'disable'} ${safe}`)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('startup-add-desktop', async (_, { name, exec: execCmd, comment }: { name: string; exec: string; comment?: string }) => {
    try {
      if (!name.trim() || !execCmd.trim()) return { success: false, error: 'Name and Exec are required' }
      const autostartDir = join(homedir(), '.config', 'autostart')
      if (!existsSync(autostartDir)) mkdirSync(autostartDir, { recursive: true })
      const filename = name.trim().replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase() + '.desktop'
      const filePath = join(autostartDir, filename)
      const lines = ['[Desktop Entry]', 'Type=Application', `Name=${name.trim()}`, `Exec=${execCmd.trim()}`]
      if (comment?.trim()) lines.push(`Comment=${comment.trim()}`)
      lines.push('X-GNOME-Autostart-enabled=true', '')
      writeFileSync(filePath, lines.join('\n'), 'utf8')
      return { success: true, path: filePath }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })
}
