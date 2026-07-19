// Durable key-value storage backed by sqlite in the main process.
// localStorage lives in Electron's cache-adjacent storage and can be wiped
// by cache cleaners (including our own Cleaner) — anything that must persist
// goes through here instead.

export async function kvGet(key: string): Promise<string | null> {
  const v = await window.electron.kvGet(key)
  if (v !== null) return v
  // One-time migration: adopt any legacy localStorage value, then remove it.
  const legacy = localStorage.getItem(key)
  if (legacy !== null) {
    await window.electron.kvSet(key, legacy)
    localStorage.removeItem(key)
    return legacy
  }
  return null
}

export function kvSet(key: string, value: string): Promise<{ success: boolean }> {
  return window.electron.kvSet(key, value)
}

export async function kvGetJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await kvGet(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function kvSetJson(key: string, value: unknown): Promise<{ success: boolean }> {
  return kvSet(key, JSON.stringify(value))
}
