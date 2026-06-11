import { useState, useEffect, useCallback } from 'react'
import SessionSidebar from './components/SessionSidebar'
import Terminal from './components/Terminal'
import SftpPanel from './components/SftpPanel'
import ConnectModal from './components/ConnectModal'

export interface Tab {
  id: string          // connection id from ssh-manager
  label: string
  host: string
  showSftp: boolean
}

export interface SavedSession {
  id: string
  name: string
  host: string
  port: number
  username: string
  authType: 'password' | 'key'
  group: string
  createdAt: string
}

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SavedSession[]>([])
  const [showConnect, setShowConnect] = useState(false)
  const [connectPrefill, setConnectPrefill] = useState<SavedSession | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const loadSessions = useCallback(async () => {
    const list = await window.api.sessions.list()
    setSessions(list as SavedSession[])
  }, [])

  useEffect(() => {
    loadSessions()
    const unsub = window.api.ssh.onClosed((connId) => {
      setTabs(prev => prev.filter(t => t.id !== connId))
      setActiveTab(prev => prev === connId ? null : prev)
    })
    return unsub
  }, [loadSessions])

  const openConnection = useCallback(async (opts: {
    sessionId?: string
    host: string
    port: number
    username: string
    authType: 'password' | 'key'
    password?: string
    privateKeyPath?: string
    passphrase?: string
    label: string
  }) => {
    try {
      const { id } = await window.api.ssh.connect(opts)
      const tab: Tab = {
        id,
        label: opts.label,
        host: opts.host,
        showSftp: false
      }
      setTabs(prev => [...prev, tab])
      setActiveTab(id)
      setShowConnect(false)
    } catch (err: unknown) {
      alert(`Connection failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [])

  const closeTab = useCallback(async (connId: string) => {
    await window.api.ssh.disconnect(connId)
    setTabs(prev => {
      const next = prev.filter(t => t.id !== connId)
      if (activeTab === connId) setActiveTab(next[next.length - 1]?.id ?? null)
      return next
    })
  }, [activeTab])

  const toggleSftp = useCallback((connId: string) => {
    setTabs(prev => prev.map(t => t.id === connId ? { ...t, showSftp: !t.showSftp } : t))
  }, [])

  const activeTabData = tabs.find(t => t.id === activeTab)

  return (
    <div className="app">
      {/* Custom title bar */}
      <div className="titlebar" onDoubleClick={() => window.api.window.maximize()}>
        <div className="titlebar-drag" />
        <span className="titlebar-title">VaultTerm</span>
        <div className="titlebar-controls">
          <button onClick={() => window.api.window.minimize()}>─</button>
          <button onClick={() => window.api.window.maximize()}>□</button>
          <button className="close-btn" onClick={() => window.api.window.close()}>✕</button>
        </div>
      </div>

      <div className="workspace">
        {/* Session sidebar */}
        <SessionSidebar
          sessions={sessions}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(v => !v)}
          onNewConnection={() => { setConnectPrefill(null); setShowConnect(true) }}
          onOpenSession={(s) => { setConnectPrefill(s); setShowConnect(true) }}
          onDeleteSession={async (id) => { await window.api.sessions.delete(id); loadSessions() }}
        />

        {/* Main area */}
        <div className="main-area">
          {/* Tab bar */}
          {tabs.length > 0 && (
            <div className="tab-bar">
              {tabs.map(tab => (
                <div
                  key={tab.id}
                  className={`tab ${tab.id === activeTab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="tab-label">{tab.label}</span>
                  <button
                    className="tab-sftp-btn"
                    title="Toggle SFTP panel"
                    onClick={e => { e.stopPropagation(); toggleSftp(tab.id) }}
                  >⇄</button>
                  <button
                    className="tab-close"
                    onClick={e => { e.stopPropagation(); closeTab(tab.id) }}
                  >✕</button>
                </div>
              ))}
              <button className="tab-new" onClick={() => { setConnectPrefill(null); setShowConnect(true) }}>+</button>
            </div>
          )}

          {/* Terminal + SFTP panes */}
          {tabs.map(tab => (
            <div key={tab.id} className={`tab-content ${tab.id === activeTab ? 'visible' : 'hidden'}`}>
              <div className={`pane-wrapper ${tab.showSftp ? 'split' : ''}`}>
                <Terminal connId={tab.id} active={tab.id === activeTab} />
                {tab.showSftp && <SftpPanel connId={tab.id} />}
              </div>
            </div>
          ))}

          {tabs.length === 0 && (
            <div className="empty-state">
              <div className="empty-logo">⚡</div>
              <h2>VaultTerm</h2>
              <p>No active connections</p>
              <button className="btn-primary" onClick={() => { setConnectPrefill(null); setShowConnect(true) }}>
                New Connection
              </button>
            </div>
          )}
        </div>
      </div>

      {showConnect && (
        <ConnectModal
          prefill={connectPrefill}
          onConnect={openConnection}
          onSave={async (session) => { await window.api.sessions.save(session); loadSessions() }}
          onClose={() => setShowConnect(false)}
        />
      )}
    </div>
  )
}
