import { ipcMain, BrowserWindow } from 'electron'
import { spawn, ChildProcess } from 'node:child_process'
import os from 'node:os'

const DONE_RE = /\x01VORTEX_DONE\x01(\d+)\x01([^\x01]*)\x01/
const ANSI_RE = /\x1B(?:\[[0-9;]*[mGKHFJA-Za-z]|\][^\x07]*\x07|[()][A-Z0-9])/g

function stripAnsi(s: string) { return s.replace(ANSI_RE, '') }

interface TabShell {
  shell: ChildProcess | null
  scrollback: string[]
  alive: boolean
}

const tabs = new Map<string, TabShell>()
let tabCounter = 0
let lastActiveTabId = ''
const MAX_SCROLLBACK = 300

export function setupPtyHandlers(win: BrowserWindow) {
  function spawnShell(tabId: string) {
    const entry = tabs.get(tabId)
    if (!entry) return

    const shell = spawn('bash', [], {
      env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', FORCE_COLOR: '3', CLICOLOR_FORCE: '1', PS1: '' },
      cwd: os.homedir(),
    })
    entry.shell = shell
    entry.alive = true

    shell.stdout?.on('data', (d: Buffer) => {
      const raw = d.toString()
      entry.scrollback.push(...stripAnsi(raw).split('\n'))
      if (entry.scrollback.length > MAX_SCROLLBACK * 2) entry.scrollback.splice(0, entry.scrollback.length - MAX_SCROLLBACK)
      win.webContents.send('pty-data', { tabId, text: raw })
    })

    shell.stderr?.on('data', (d: Buffer) => {
      const raw = d.toString()
      const match = raw.match(DONE_RE)
      if (match) {
        win.webContents.send('pty-done', { tabId, exitCode: parseInt(match[1], 10), cwd: match[2] })
        const rest = raw.replace(DONE_RE, '').trim()
        if (rest) {
          entry.scrollback.push(...stripAnsi(rest).split('\n'))
          win.webContents.send('pty-data', { tabId, text: rest })
        }
      } else {
        entry.scrollback.push(...stripAnsi(raw).split('\n'))
        win.webContents.send('pty-data', { tabId, text: raw })
      }
    })

    shell.on('exit', () => {
      entry.alive = false
      win.webContents.send('pty-exit', { tabId })
      if (tabs.has(tabId)) setTimeout(() => spawnShell(tabId), 800)
    })
  }

  function createTab(): string {
    const tabId = `tab-${++tabCounter}`
    tabs.set(tabId, { shell: null, scrollback: [], alive: false })
    spawnShell(tabId)
    if (!lastActiveTabId) lastActiveTabId = tabId
    return tabId
  }

  const defaultTabId = createTab()
  lastActiveTabId = defaultTabId

  ipcMain.handle('pty-get-default-tab', () => defaultTabId)

  ipcMain.handle('pty-list-tabs', () =>
    [...tabs.entries()].map(([id, entry]) => ({ id, alive: entry.alive }))
  )

  ipcMain.handle('pty-create', () => createTab())

  ipcMain.handle('pty-close', (_, tabId: string) => {
    const entry = tabs.get(tabId)
    if (!entry) return { success: false }
    try { entry.shell?.kill() } catch {}
    tabs.delete(tabId)
    if (lastActiveTabId === tabId) {
      lastActiveTabId = [...tabs.keys()][0] ?? ''
    }
    return { success: true }
  })

  ipcMain.handle('pty-set-active', (_, tabId: string) => {
    if (tabs.has(tabId)) lastActiveTabId = tabId
    return { success: true }
  })

  ipcMain.handle('pty-write', (_, payload: { tabId?: string; command: string } | string) => {
    const tabId = typeof payload === 'string' ? lastActiveTabId : (payload.tabId ?? lastActiveTabId)
    const command = typeof payload === 'string' ? payload : payload.command
    const entry = tabs.get(tabId)
    if (!entry?.shell?.stdin?.writable) return { success: false, error: 'Shell not ready' }
    lastActiveTabId = tabId
    const wrapped = `(${command}) ; printf '\\001VORTEX_DONE\\001%d\\001%s\\001\\n' "$?" "$(pwd)" >&2\n`
    entry.shell.stdin.write(wrapped)
    return { success: true }
  })

  ipcMain.handle('pty-get-buffer', (_, tabId?: string) => {
    const id = tabId ?? lastActiveTabId
    const entry = tabs.get(id)
    return entry ? entry.scrollback.slice(-MAX_SCROLLBACK).join('\n') : ''
  })
}
