import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { exec } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import os from 'node:os'
import si from 'systeminformation'
import { setupSystemHandlers } from './system'
import { setupDbHandlers, startResourcePoller } from './db'
import { setupPtyHandlers } from './pty'
import { guardian } from './VortexGuardian'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null
let tray: Tray | null = null
let isQuiting = false

function createTray() {
  // Prefer the packaged red-V icon; fall back to the legacy user-local one.
  const candidates = [
    '/usr/share/icons/hicolor/128x128/apps/vortex-v2.png',
    path.join(process.env.HOME || os.homedir(), '.local/share/icons/hicolor/128x128/apps/vortex-v2.png'),
  ]
  const iconPath = candidates.find(p => existsSync(p)) ?? candidates[0]
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('Vortex')

  const menu = Menu.buildFromTemplate([
    {
      label: 'Show Vortex',
      click: () => {
        if (win) { win.show(); win.focus() }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        tray?.destroy()
        app.quit()
      }
    }
  ])
  tray.setContextMenu(menu)

  tray.on('click', () => {
    if (!win) return
    win.isVisible() ? win.hide() : win.show()
  })
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false,
    backgroundColor: '#08090b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.webContents.on('before-input-event', (_, input) => {
    if (input.type === 'keyDown' && input.key === 'F5') win?.webContents.reload()
    if (input.type === 'keyDown' && input.key === 'F12') win?.webContents.toggleDevTools()
  })

  // Hide to tray on close instead of quitting — purge VRAM so GPU is freed while minimised
  win.on('close', (e) => {
    if (!isQuiting) {
      e.preventDefault()
      win?.hide()
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(process.env.DIST!, 'index.html'))
  }

  if (win) {
    setupSystemHandlers(win)
    setupDbHandlers()
    startResourcePoller()
    setupPtyHandlers(win)
    guardian.init(win)
  }
}

ipcMain.handle('exec-command', async (_, command: string) => {
  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      resolve({
        success: !error,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: error?.code || 0
      })
    })
  })
})

ipcMain.handle('open-external', async (_, url: string) => {
  await shell.openExternal(url)
  return { success: true }
})

ipcMain.handle('get-system-stats', async () => {
  const [cpu, mem, load, fsSize, networkStats, graphics] = await Promise.all([
    si.cpu(),
    si.mem(),
    si.currentLoad(),
    si.fsSize(),
    si.networkStats(),
    si.graphics()
  ])

  const mainDisk = fsSize.find((d: any) => d.mount === '/') || fsSize[0]
  const gpu = graphics.controllers[0] ?? null

  return {
    cpu: {
      manufacturer: cpu.manufacturer,
      brand: cpu.brand,
      speed: cpu.speed,
      cores: cpu.cores,
      load: load.currentLoad
    },
    memory: {
      total: mem.total,
      free: mem.free,
      used: mem.used,
      active: mem.active
    },
    storage: {
      used: mainDisk?.used || 0,
      size: mainDisk?.size || 0,
      use: mainDisk?.use || 0
    },
    network: {
      rx_sec: networkStats[0]?.rx_sec || 0,
      tx_sec: networkStats[0]?.tx_sec || 0,
      iface: networkStats[0]?.iface || 'detecting'
    },
    gpu: gpu ? {
      model:            gpu.model ?? gpu.name ?? 'GPU',
      utilizationGpu:   gpu.utilizationGpu   ?? 0,
      utilizationMemory: gpu.utilizationMemory ?? 0,
      memoryTotal:      gpu.memoryTotal ?? gpu.vram ?? 0,
      memoryUsed:       gpu.memoryUsed  ?? 0,
      temperatureGpu:   gpu.temperatureGpu ?? 0,
      powerDraw:        gpu.powerDraw   ?? 0,
      powerLimit:       gpu.powerLimit  ?? 0,
      fanSpeed:         gpu.fanSpeed    ?? 0,
      clockCore:        gpu.clockCore   ?? 0,
    } : null
  }
})

ipcMain.handle('dialog-open-file', async () => {
  if (!win) return null
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: 'Text / Code', extensions: ['txt','md','json','yaml','yml','toml','sh','bash','py','js','ts','tsx','jsx','rs','go','c','cpp','h','css','html','xml','csv','log','conf','cfg','ini','env'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  try {
    const raw = readFileSync(filePath, 'utf8')
    const MAX = 20_000
    return { name: path.basename(filePath), path: filePath, content: raw.slice(0, MAX), truncated: raw.length > MAX }
  } catch (e: any) {
    return { error: e.message }
  }
})

ipcMain.on('window-control', (_, action: 'minimize' | 'maximize' | 'close') => {
  if (!win) return
  switch (action) {
    case 'minimize': win.minimize(); break
    case 'maximize': win.isMaximized() ? win.unmaximize() : win.maximize(); break
    case 'close': win.hide(); break  // hide to tray instead of closing
  }
})

app.on('window-all-closed', () => {
  // Do not quit — app lives in the tray
})

app.on('before-quit', () => {
  isQuiting = true
})

ipcMain.handle('show-context-menu', (event, props) => {
  const contents = event.sender
  const menu = Menu.buildFromTemplate([
    { label: 'Cut', role: 'cut', enabled: props.editFlags?.canCut },
    { label: 'Copy', role: 'copy', enabled: props.editFlags?.canCopy },
    { label: 'Paste', role: 'paste', enabled: props.editFlags?.canPaste },
    { type: 'separator' },
    { label: 'Select All', role: 'selectAll' },
    { type: 'separator' },
    {
      label: 'Inspect Element',
      click: () => contents.inspectElement(props.x, props.y)
    }
  ])
  menu.popup()
})

app.on('web-contents-created', (_, contents) => {
  contents.on('context-menu', (_, props) => {
    const menu = Menu.buildFromTemplate([
      { label: 'Cut', role: 'cut', enabled: props.editFlags.canCut },
      { label: 'Copy', role: 'copy', enabled: props.editFlags.canCopy },
      { label: 'Paste', role: 'paste', enabled: props.editFlags.canPaste },
      { type: 'separator' },
      { label: 'Select All', role: 'selectAll' },
      { type: 'separator' },
      {
        label: 'Inspect Element',
        click: () => contents.inspectElement(props.x, props.y)
      }
    ])
    menu.popup()
  })
})


app.whenReady().then(async () => {
  if (process.argv.includes('--dry-run')) {
    console.log('[Main] Dry-run confirmation: --dry-run detected. Exiting now.')
    app.quit()
    return
  }
  createWindow()
  createTray()
})
