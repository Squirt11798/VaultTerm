import { useState } from 'react'

interface Props {
  onImported: () => void
  onClose: () => void
}

interface PreviewSession {
  name: string
  host: string
  port: number
  username: string
  authType: 'password' | 'key'
  keyPath: string
  group: string
}

type Step = 'idle' | 'preview' | 'done' | 'error'

export default function ImportMobaModal({ onImported, onClose }: Props) {
  const [step, setStep] = useState<Step>('idle')
  const [sessions, setSessions] = useState<PreviewSession[]>([])
  const [filePath, setFilePath] = useState('')
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const browse = async () => {
    const fp = await window.api.dialog.openMobaConf()
    if (!fp) return
    setFilePath(fp)

    // Preview: call importMoba with dry-run flag — actually we need to
    // read the file to preview. We'll call a dedicated preview step.
    // For now: just pick file and go straight to importing after preview
    // by calling importMoba only on confirm. We preview via a separate
    // parse step — but that would need another IPC. Instead, keep it
    // simple: show the file path and let the user confirm, then import.
    setStep('preview')
  }

  const doImport = async () => {
    try {
      const res = await window.api.sessions.importMoba(filePath)
      setResult(res)
      setStep('done')
      onImported()
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setStep('error')
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal import-modal">
        <div className="modal-header">
          <h2>Import from MobaXterm</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {step === 'idle' && (
            <div className="import-step">
              <div className="import-icon">📥</div>
              <p>Import your saved sessions from a MobaXterm configuration export file (<code>.mobaconf</code>).</p>
              <ul className="import-notes">
                <li>Session names, hosts, ports, usernames, and groups are imported</li>
                <li>Sessions using private key auth will have their key path set — verify the path is correct after import</li>
                <li>Passwords are <strong>not</strong> included in MobaXterm exports — you will need to enter them on first connect</li>
                <li>Existing sessions are not modified or deduplicated</li>
              </ul>
              <p className="import-hint">Export from MobaXterm via <em>Settings → Configuration → Export all settings</em></p>
            </div>
          )}

          {step === 'preview' && (
            <div className="import-step">
              <div className="import-file-row">
                <span className="import-file-label">File:</span>
                <span className="import-file-path" title={filePath}>{filePath}</span>
              </div>
              <p className="import-confirm-text">
                Click <strong>Import</strong> to read this file and add all SSH sessions to CommConsole.
                Sessions with passwords will be imported without credentials — you will be prompted on first connect.
              </p>
            </div>
          )}

          {step === 'done' && result && (
            <div className="import-step import-done">
              <div className="import-icon">✅</div>
              <p><strong>{result.imported}</strong> session{result.imported !== 1 ? 's' : ''} imported successfully.</p>
              {result.skipped > 0 && (
                <p className="import-skipped">{result.skipped} non-SSH entries were skipped (RDP, Serial, etc.).</p>
              )}
              <p className="import-hint">Sessions using key auth may need their key path verified — open each session and browse to the correct key file if needed.</p>
            </div>
          )}

          {step === 'error' && (
            <div className="import-step import-error">
              <div className="import-icon">⚠️</div>
              <p>Import failed:</p>
              <pre className="import-error-msg">{errorMsg}</pre>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step === 'idle' && (
            <button className="btn-primary" onClick={browse}>Browse…</button>
          )}
          {step === 'preview' && (
            <>
              <button onClick={() => setStep('idle')} style={{ marginRight: 8 }}>← Back</button>
              <button className="btn-primary" onClick={doImport}>Import</button>
            </>
          )}
          {(step === 'done' || step === 'error') && (
            <button className="btn-primary" onClick={onClose}>Close</button>
          )}
        </div>
      </div>
    </div>
  )
}
