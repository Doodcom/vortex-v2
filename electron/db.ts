import Database from 'better-sqlite3'
import path from 'node:path'
import { app, ipcMain } from 'electron'
import si from 'systeminformation'

export let db: Database.Database

export function setupDbHandlers() {
  const dbPath = path.join(app.getPath('userData'), 'vortex.db')
  db = new Database(dbPath)

  db.exec(`
    CREATE TABLE IF NOT EXISTS vault_sync_config (
      id          INTEGER PRIMARY KEY CHECK (id = 1),
      remote_name TEXT NOT NULL,
      remote_path TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      command    TEXT    NOT NULL,
      exit_code  INTEGER,
      source     TEXT    NOT NULL DEFAULT 'terminal',
      session_id INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS kv_store (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS resource_history (
      ts     INTEGER NOT NULL,
      cpu    REAL    NOT NULL DEFAULT 0,
      ram    REAL    NOT NULL DEFAULT 0,
      gpu    REAL    NOT NULL DEFAULT 0,
      disk   REAL    NOT NULL DEFAULT 0,
      net_rx REAL    NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_rh_ts ON resource_history (ts);
  `)

  // ── Audit Log ─────────────────────────────────────────────────────────────
  ipcMain.handle('db-log-command', (_, entry: { command: string; exit_code?: number; source?: string; session_id?: number }) => {
    db.prepare('INSERT INTO audit_log (command, exit_code, source, session_id) VALUES (?, ?, ?, ?)').run(
      entry.command, entry.exit_code ?? null, entry.source ?? 'terminal', entry.session_id ?? null
    )
    return { success: true }
  })

  ipcMain.handle('db-get-audit-log', (_, limit = 300) => {
    return db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?').all(limit)
  })

  ipcMain.handle('db-clear-audit-log', () => {
    db.prepare('DELETE FROM audit_log').run()
    return { success: true }
  })

  // ── Key-Value Store ───────────────────────────────────────────────────────
  // Durable app settings/data that must survive cache cleaning (unlike localStorage).
  ipcMain.handle('kv-get', (_, key: string) =>
    (db.prepare('SELECT value FROM kv_store WHERE key = ?').get(key) as { value: string } | undefined)?.value ?? null
  )
  ipcMain.handle('kv-set', (_, { key, value }: { key: string; value: string }) => {
    db.prepare(
      'INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, unixepoch()) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()'
    ).run(key, value)
    return { success: true }
  })
  ipcMain.handle('kv-delete', (_, key: string) => {
    db.prepare('DELETE FROM kv_store WHERE key = ?').run(key)
    return { success: true }
  })

  // ── Resource History ───────────────────────────────────────────────────────
  ipcMain.handle('db-get-resource-history', (_, hours: number = 24) => {
    const since = Math.floor(Date.now() / 1000) - hours * 3600
    return db.prepare('SELECT ts, cpu, ram, gpu, disk, net_rx FROM resource_history WHERE ts >= ? ORDER BY ts ASC').all(since)
  })
}

export function kvGetSync(key: string): string | null {
  if (!db) return null
  return (db.prepare('SELECT value FROM kv_store WHERE key = ?').get(key) as { value: string } | undefined)?.value ?? null
}

export function kvSetSync(key: string, value: string): void {
  if (!db) return
  db.prepare(
    'INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, unixepoch()) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()'
  ).run(key, value)
}

export function kvDeleteSync(key: string): void {
  if (!db) return
  db.prepare('DELETE FROM kv_store WHERE key = ?').run(key)
}

export function logAuditCommand(command: string, exitCode: number | null, source: string): void {
  if (!db) return
  db.prepare('INSERT INTO audit_log (command, exit_code, source) VALUES (?, ?, ?)').run(command, exitCode, source)
}

export function logResourceSample(cpu: number, ram: number, gpu: number, disk: number, net_rx: number): void {
  if (!db) return
  const ts = Math.floor(Date.now() / 1000)
  db.prepare('INSERT INTO resource_history (ts, cpu, ram, gpu, disk, net_rx) VALUES (?, ?, ?, ?, ?, ?)').run(ts, cpu, ram, gpu, disk, net_rx)
  // Prune entries older than 25h to keep DB lean
  db.prepare('DELETE FROM resource_history WHERE ts < ?').run(ts - 90000)
}

let _pollerTimer: ReturnType<typeof setInterval> | null = null

export function startResourcePoller(): void {
  if (_pollerTimer) return
  const collect = async () => {
    try {
      const [cpuLoad, mem, fsSize, netStats, gpu] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.networkStats(),
        si.graphics(),
      ])
      const cpu    = cpuLoad.currentLoad ?? 0
      const ram    = mem.total ? (mem.used / mem.total) * 100 : 0
      const rootFs = fsSize.find((f: any) => f.mount === '/') ?? fsSize[0]
      const disk   = rootFs?.use ?? 0
      const net_rx = (netStats[0]?.rx_sec ?? 0) / 1_000_000
      const gpuCtl = gpu?.controllers?.[0]
      const gpuPct = gpuCtl?.utilizationGpu ?? 0
      logResourceSample(cpu, ram, gpuPct, disk, net_rx)
    } catch { /* ignore collection errors */ }
  }
  collect()
  _pollerTimer = setInterval(collect, 30_000)
}

