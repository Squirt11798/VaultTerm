/**
 * Application settings store — non-secret UI/behavior preferences persisted to
 * settings.json in the user data dir. Distinct from the credential vault.
 */

import { ipcMain, app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

export interface AppSettings {
  theme: string          // 'olive' | 'desert' | 'navy' | 'light'
  fontFamily: string     // terminal + UI mono font
  fontSize: number       // terminal font size (px)
  defaultGroup: string   // pre-selected group for new connections
}

const DEFAULTS: AppSettings = {
  theme: 'olive',
  fontFamily: '"Cascadia Code", "Fira Code", "Consolas", monospace',
  fontSize: 14,
  defaultGroup: ''
}

const settingsPath = (): string => join(app.getPath('userData'), 'settings.json')

function load(): AppSettings {
  try {
    if (!existsSync(settingsPath())) return { ...DEFAULTS }
    const raw = JSON.parse(readFileSync(settingsPath(), 'utf-8'))
    return { ...DEFAULTS, ...raw }
  } catch {
    return { ...DEFAULTS }
  }
}

function save(s: AppSettings): void {
  writeFileSync(settingsPath(), JSON.stringify(s, null, 2), 'utf-8')
}

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', () => load())

  ipcMain.handle('settings:set', (_e, patch: Partial<AppSettings>) => {
    const current = load()
    const next: AppSettings = { ...current, ...patch }
    // Coerce/validate
    next.fontSize = Math.min(28, Math.max(8, parseInt(String(next.fontSize), 10) || DEFAULTS.fontSize))
    if (typeof next.theme !== 'string' || !next.theme) next.theme = DEFAULTS.theme
    if (typeof next.fontFamily !== 'string' || !next.fontFamily.trim()) next.fontFamily = DEFAULTS.fontFamily
    if (typeof next.defaultGroup !== 'string') next.defaultGroup = ''
    save(next)
    return next
  })
}
