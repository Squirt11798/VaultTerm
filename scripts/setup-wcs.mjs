/**
 * Pre-populates the electron-builder winCodeSign cache with only the Windows
 * tools (rcedit.exe, signtool.exe), skipping the macOS dylib symlinks that
 * cause 7zip to fail on Windows without Developer Mode enabled.
 */
import { execFileSync, execSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const WCS_VERSION  = 'winCodeSign-2.6.0'
const WCS_URL      = `https://github.com/electron-userland/electron-builder-binaries/releases/download/${WCS_VERSION}/${WCS_VERSION}.7z`
const localAppData = process.env.LOCALAPPDATA
const cacheDir     = join(localAppData, 'electron-builder', 'Cache', 'winCodeSign', WCS_VERSION)
const rceditPath   = join(cacheDir, 'rcedit-x64.exe')
const sevenZa      = join(root, 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe')
const tmpArchive   = join(process.env.TEMP, `${WCS_VERSION}.7z`)

if (existsSync(rceditPath)) {
  console.log('winCodeSign cache OK — skipping download')
  process.exit(0)
}

console.log('Downloading winCodeSign (Windows tools only — skipping macOS symlinks)...')
mkdirSync(cacheDir, { recursive: true })

execSync(`curl -L --silent --show-error -o "${tmpArchive}" "${WCS_URL}"`, { stdio: 'inherit' })
console.log('Extracting windows/ subfolder only...')

try {
  // Extract only the files we need — rcedit for icon embedding, signtool for optional signing
  // This completely avoids the darwin/ symlinks that cause extraction to fail on Windows
  execFileSync(sevenZa, [
    'x', tmpArchive, `-o${cacheDir}`,
    'rcedit-x64.exe', 'rcedit-ia32.exe',
    'windows-10', 'windows-6',
    '-y'
  ], { stdio: 'pipe' })
} catch {
  // 7zip may return non-zero even when extraction succeeded; check for the file below
}

if (!existsSync(rceditPath)) {
  console.error('ERROR: rcedit.exe not found after extraction:', rceditPath)
  process.exit(1)
}
console.log('winCodeSign ready:', rceditPath)
