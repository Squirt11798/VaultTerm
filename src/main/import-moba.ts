/**
 * Parser for MobaXterm .mobaconf export files.
 * Extracts SSH sessions (type #109#) from [Bookmarks] / [Bookmarks_N] sections.
 * Passwords are never present in MobaXterm exports — only key paths.
 */

import { readFileSync } from 'fs'

export interface MobaSession {
  name: string
  host: string
  port: number
  username: string
  authType: 'password' | 'key'
  keyPath: string   // empty string if password auth
  group: string
}

export interface MobaImportResult {
  sessions: MobaSession[]
  skipped: number   // non-SSH or unparseable entries
}

export function parseMobaConf(filePath: string): MobaImportResult {
  const content = readFileSync(filePath, { encoding: 'utf-8' })
  return parseMobaConfContent(content)
}

export function parseMobaConfContent(content: string): MobaImportResult {
  const sessions: MobaSession[] = []
  let skipped = 0

  const lines = content.split(/\r?\n/)
  let inBookmarks = false
  let currentGroup = ''

  for (const raw of lines) {
    const line = raw.trim()

    // ── Section header ───────────────────────────────────────────────────────
    if (line.startsWith('[') && line.endsWith(']')) {
      const section = line.slice(1, -1)
      inBookmarks = section === 'Bookmarks' || /^Bookmarks_\d+$/.test(section)
      if (inBookmarks) currentGroup = ''  // reset; SubRep will override
      continue
    }

    if (!inBookmarks || line === '') continue

    // ── SubRep sets group name for this section ───────────────────────────────
    if (line.startsWith('SubRep=')) {
      currentGroup = line.slice(7).trim()
      continue
    }

    // Skip metadata keys
    if (/^(ImgNum|mobauser)=/.test(line)) continue

    // ── Session entry: Name=<data> ────────────────────────────────────────────
    const eqIdx = line.indexOf('=')
    if (eqIdx === -1) continue

    const sessionName = line.slice(0, eqIdx).trim()
    const sessionData = line.slice(eqIdx + 1)

    // Only handle SSH sessions (#109#)
    const m = sessionData.match(/^#109#([^#]+)/)
    if (!m) { skipped++; continue }

    // Split the params block on '%'
    // Layout: 0=flag 1=host 2=port 3=username ... 14=keypath
    const parts = m[1].split('%')
    const host     = (parts[1] ?? '').trim()
    const portStr  = (parts[2] ?? '22').trim()
    const username = (parts[3] ?? '').trim()
    const rawKey   = (parts[14] ?? '').trim()

    if (!host || !username) { skipped++; continue }

    const port = parseInt(portStr, 10) || 22
    if (port < 1 || port > 65535) { skipped++; continue }

    // Normalise MobaXterm's portable drive placeholder to C:\
    const keyPath = rawKey.replace(/^_CurrentDrive_:/i, 'C:')

    sessions.push({
      name: sessionName,
      host,
      port,
      username,
      authType: keyPath ? 'key' : 'password',
      keyPath,
      group: currentGroup
    })
  }

  return { sessions, skipped }
}
