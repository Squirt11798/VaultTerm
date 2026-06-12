import { useState, useEffect } from 'react'

export interface AppSettings {
  theme: string
  fontFamily: string
  fontSize: number
  defaultGroup: string
}

interface Props {
  settings: AppSettings
  groups: string[]
  onApply: (patch: Partial<AppSettings>) => void   // live preview
  onClose: () => void
}

const THEMES: Array<{ value: string; label: string; swatch: string }> = [
  { value: 'olive',  label: 'Olive Drab', swatch: '#b9a44a' },
  { value: 'desert', label: 'Desert',     swatch: '#c79a5a' },
  { value: 'navy',   label: 'Navy',       swatch: '#5b8fc4' },
  { value: 'light',  label: 'Light',      swatch: '#8a6d1f' }
]

const FONTS = [
  '"Cascadia Code", "Fira Code", "Consolas", monospace',
  '"Fira Code", monospace',
  '"JetBrains Mono", monospace',
  'Consolas, monospace',
  '"Courier New", monospace',
  'monospace'
]

export default function SettingsModal({ settings, groups, onApply, onClose }: Props) {
  const [local, setLocal] = useState<AppSettings>(settings)

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  // Live-preview each change immediately
  const patch = (p: Partial<AppSettings>) => {
    const next = { ...local, ...p }
    setLocal(next)
    onApply(p)
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-row">
            <label>Theme</label>
            <div className="theme-grid">
              {THEMES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  className={`theme-card ${local.theme === t.value ? 'selected' : ''}`}
                  onClick={() => patch({ theme: t.value })}
                >
                  <span className="theme-dot" style={{ background: t.swatch }} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-row two-col">
            <div>
              <label>Terminal Font</label>
              <select className="form-select" value={local.fontFamily} onChange={e => patch({ fontFamily: e.target.value })}>
                {FONTS.map(f => (
                  <option key={f} value={f}>{f.replace(/"/g, '').split(',')[0]}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Font Size</label>
              <select className="form-select" value={String(local.fontSize)} onChange={e => patch({ fontSize: parseInt(e.target.value, 10) })}>
                {[10, 11, 12, 13, 14, 15, 16, 18, 20, 22].map(s => (
                  <option key={s} value={s}>{s}px</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <label>Default Group for New Connections</label>
            <select className="form-select" value={local.defaultGroup} onChange={e => patch({ defaultGroup: e.target.value })}>
              <option value="">Ungrouped</option>
              {groups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <p className="settings-preview-note">Changes apply instantly and are saved automatically.</p>
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
