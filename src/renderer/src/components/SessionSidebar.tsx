import { useState } from 'react'
import type { SavedSession } from '../App'

interface Props {
  sessions: SavedSession[]
  collapsed: boolean
  onToggleCollapse: () => void
  onNewConnection: () => void
  onOpenSession: (s: SavedSession) => void
  onDeleteSession: (id: string) => void
}

export default function SessionSidebar({ sessions, collapsed, onToggleCollapse, onNewConnection, onOpenSession, onDeleteSession }: Props) {
  const [filter, setFilter] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; session: SavedSession } | null>(null)

  const grouped = sessions
    .filter(s => s.name.toLowerCase().includes(filter.toLowerCase()) || s.host.toLowerCase().includes(filter.toLowerCase()))
    .reduce<Record<string, SavedSession[]>>((acc, s) => {
      const g = s.group || 'Ungrouped'
      ;(acc[g] = acc[g] || []).push(s)
      return acc
    }, {})

  const handleContextMenu = (e: React.MouseEvent, session: SavedSession) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, session })
  }

  return (
    <>
      <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          {!collapsed && <span className="sidebar-title">Sessions</span>}
          <button className="sidebar-toggle" onClick={onToggleCollapse} title={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? '»' : '«'}
          </button>
        </div>

        {!collapsed && (
          <>
            <button className="btn-new-connection" onClick={onNewConnection}>+ New Connection</button>
            <input
              className="sidebar-search"
              placeholder="Filter sessions…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
            <div className="session-list">
              {Object.entries(grouped).map(([group, items]) => (
                <div key={group} className="session-group">
                  <div className="session-group-label">{group}</div>
                  {items.map(s => (
                    <div
                      key={s.id}
                      className="session-item"
                      onClick={() => onOpenSession(s)}
                      onContextMenu={e => handleContextMenu(e, s)}
                      title={`${s.username}@${s.host}:${s.port}`}
                    >
                      <span className="session-icon">{s.authType === 'key' ? '🔑' : '🔒'}</span>
                      <div className="session-info">
                        <span className="session-name">{s.name}</span>
                        <span className="session-host">{s.host}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              {sessions.length === 0 && (
                <div className="sidebar-empty">No saved sessions yet</div>
              )}
            </div>
          </>
        )}
      </div>

      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <button onClick={() => { onOpenSession(contextMenu.session); setContextMenu(null) }}>Connect</button>
          <button className="danger" onClick={() => { onDeleteSession(contextMenu.session.id); setContextMenu(null) }}>Delete</button>
        </div>
      )}

      {contextMenu && <div className="context-overlay" onClick={() => setContextMenu(null)} />}
    </>
  )
}
