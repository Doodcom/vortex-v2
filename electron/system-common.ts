/* eslint-disable @typescript-eslint/no-explicit-any */
import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import { db } from './db'

export { db }

export const execPromise = promisify(exec)

export async function detectAurHelper(candidates = ['paru', 'yay', 'trizen']): Promise<string> {
  for (const h of candidates) {
    try {
      await execPromise(`which ${h}`)
      return h
    } catch {
      // Ignore errors for non-existent candidate helpers
    }
  }
  return 'pacman'
}

export function createSystemHelpers(win: any) {
  const notify = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    win.webContents.send('notification', { title, message, type })
  }

  const streamLog = (text: string) => {
    win.webContents.send('update-log', text)
  }

  // Helper for streaming command execution
  const runStreamingCmd = (cmd: string, args: string[], options: any = {}) => {
    return new Promise<{ success: boolean; log: string }>((resolve) => {
      let fullLog = ''
      let pendingLog = ''
      let lastSend = Date.now()
      const MAX_LOG_SIZE = 100_000 // Prevent memory leaks

      const child = spawn(cmd, args, {
        ...options,
        env: { ...process.env, ...options.env, DISPLAY: process.env.DISPLAY || ':0' }
      })

      const flush = () => {
        if (pendingLog) {
          // Clean up progress bars and excessive noise
          const clean = pendingLog.replace(/\r/g, '\n').split('\n').filter(l => l.trim()).join('\n')
          if (clean) streamLog(clean)
          pendingLog = ''
          lastSend = Date.now()
        }
      }

      const MAX_PENDING = 8_000
      const throttleSend = (text: string) => {
        pendingLog += text
        // Prevent unbounded growth between flushes (e.g. ollama progress bursts)
        if (pendingLog.length > MAX_PENDING) pendingLog = pendingLog.slice(-MAX_PENDING)
        if (fullLog.length < MAX_LOG_SIZE) fullLog += text

        if (Date.now() - lastSend > 200) { // 5fps cap for UI updates
          flush()
        }
      }

      child.stdout?.on('data', (data) => throttleSend(data.toString()))
      child.stderr?.on('data', (data) => throttleSend(`[ERR] ${data.toString()}`))

      child.on('close', (code) => {
        flush()
        resolve({ success: code === 0, log: fullLog })
      })

      child.on('error', (err) => {
        flush()
        streamLog(`Fatal: ${err.message}`)
        resolve({ success: false, log: err.message })
      })
    })
  }

  return {
    notify,
    streamLog,
    runStreamingCmd
  }
}
