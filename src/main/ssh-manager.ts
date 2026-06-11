import { ipcMain, BrowserWindow } from 'electron'
import { Client, SFTPWrapper } from 'ssh2'
import { readFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { getDecryptedCredentials } from './credential-store'

interface Connection {
  id: string
  client: Client
  sftp: SFTPWrapper | null
  sessionId: string | null  // saved session id, if launched from one
}

const connections = new Map<string, Connection>()

function send(win: BrowserWindow, channel: string, ...args: unknown[]): void {
  if (!win.isDestroyed()) win.webContents.send(channel, ...args)
}

export function registerSshHandlers(win: BrowserWindow): void {

  ipcMain.handle('ssh:connect', async (_e, opts: {
    sessionId?: string       // connect from saved session
    host?: string            // or connect ad-hoc
    port?: number
    username?: string
    password?: string
    privateKeyPath?: string
    passphrase?: string
  }) => {
    let host: string
    let port: number
    let username: string
    let password: string | undefined
    let privateKey: Buffer | undefined
    let passphrase: string | undefined

    if (opts.sessionId) {
      // Load from vault
      const creds = getDecryptedCredentials(opts.sessionId)
      if (!creds) throw new Error('Session not found')
      // We need the non-secret fields too — caller must supply host/port/username
      // (they come from the session list which strips secrets)
      host = opts.host!
      port = opts.port ?? 22
      username = opts.username!
      password = creds.password || undefined
      privateKey = creds.privateKey ? Buffer.from(creds.privateKey) : undefined
      passphrase = creds.passphrase || undefined
    } else {
      host = opts.host!
      port = opts.port ?? 22
      username = opts.username!
      password = opts.password
      if (opts.privateKeyPath) {
        privateKey = readFileSync(opts.privateKeyPath)
      }
      passphrase = opts.passphrase
    }

    const connId = randomUUID()

    return new Promise<{ id: string }>((resolve, reject) => {
      const client = new Client()

      client.on('ready', () => {
        client.shell({ term: 'xterm-256color' }, (err, stream) => {
          if (err) { client.end(); return reject(err) }

          connections.set(connId, { id: connId, client, sftp: null, sessionId: opts.sessionId ?? null })

          stream.on('data', (data: Buffer) => {
            send(win, 'ssh:data', connId, data.toString('binary'))
          })

          stream.stderr.on('data', (data: Buffer) => {
            send(win, 'ssh:data', connId, data.toString('binary'))
          })

          stream.on('close', () => {
            connections.delete(connId)
            send(win, 'ssh:closed', connId)
          })

          // Store stream on connection for writes/resize
          ;(connections.get(connId) as Connection & { stream: typeof stream }).stream = stream

          resolve({ id: connId })
        })
      })

      client.on('error', (err) => {
        connections.delete(connId)
        reject(err)
      })

      const connectConfig: Parameters<Client['connect']>[0] = {
        host,
        port,
        username,
        readyTimeout: 20000,
        keepaliveInterval: 10000
      }

      if (privateKey) {
        connectConfig.privateKey = privateKey
        if (passphrase) connectConfig.passphrase = passphrase
      } else if (password) {
        connectConfig.password = password
      }

      client.connect(connectConfig)
    })
  })

  ipcMain.on('ssh:data', (_e, connId: string, data: string) => {
    const conn = connections.get(connId) as (Connection & { stream: { write(d: string): void } }) | undefined
    conn?.stream?.write(data)
  })

  ipcMain.on('ssh:resize', (_e, connId: string, cols: number, rows: number) => {
    const conn = connections.get(connId) as (Connection & { stream: { setWindow(r: number, c: number, h: number, w: number): void } }) | undefined
    conn?.stream?.setWindow(rows, cols, 0, 0)
  })

  ipcMain.handle('ssh:disconnect', (_e, connId: string) => {
    const conn = connections.get(connId)
    if (conn) {
      conn.client.end()
      connections.delete(connId)
    }
  })

  // ── SFTP ────────────────────────────────────────────────────────────────────

  function getSftp(connId: string): Promise<SFTPWrapper> {
    const conn = connections.get(connId)
    if (!conn) return Promise.reject(new Error('Not connected'))
    if (conn.sftp) return Promise.resolve(conn.sftp)
    return new Promise((resolve, reject) => {
      conn.client.sftp((err, sftp) => {
        if (err) return reject(err)
        conn.sftp = sftp
        resolve(sftp)
      })
    })
  }

  ipcMain.handle('sftp:list', async (_e, connId: string, remotePath: string) => {
    const sftp = await getSftp(connId)
    return new Promise((resolve, reject) => {
      sftp.readdir(remotePath, (err, list) => {
        if (err) return reject(err)
        resolve(list.map(f => ({
          name: f.filename,
          longname: f.longname,
          size: f.attrs.size,
          mtime: f.attrs.mtime,
          isDir: (f.attrs.mode! & 0o170000) === 0o040000,
          permissions: f.attrs.mode
        })))
      })
    })
  })

  ipcMain.handle('sftp:download', async (_e, connId: string, remotePath: string, localPath: string) => {
    const sftp = await getSftp(connId)
    return new Promise<void>((resolve, reject) => {
      sftp.fastGet(remotePath, localPath, {}, (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  })

  ipcMain.handle('sftp:upload', async (_e, connId: string, localPath: string, remotePath: string) => {
    const sftp = await getSftp(connId)
    return new Promise<void>((resolve, reject) => {
      sftp.fastPut(localPath, remotePath, {}, (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  })

  ipcMain.handle('sftp:mkdir', async (_e, connId: string, remotePath: string) => {
    const sftp = await getSftp(connId)
    return new Promise<void>((resolve, reject) => {
      sftp.mkdir(remotePath, (err) => err ? reject(err) : resolve())
    })
  })

  ipcMain.handle('sftp:delete', async (_e, connId: string, remotePath: string, isDir: boolean) => {
    const sftp = await getSftp(connId)
    return new Promise<void>((resolve, reject) => {
      const fn = isDir ? sftp.rmdir.bind(sftp) : sftp.unlink.bind(sftp)
      fn(remotePath, (err) => err ? reject(err) : resolve())
    })
  })

  ipcMain.handle('sftp:rename', async (_e, connId: string, oldPath: string, newPath: string) => {
    const sftp = await getSftp(connId)
    return new Promise<void>((resolve, reject) => {
      sftp.rename(oldPath, newPath, (err) => err ? reject(err) : resolve())
    })
  })

  ipcMain.handle('sftp:pwd', async (_e, connId: string) => {
    const sftp = await getSftp(connId)
    return new Promise<string>((resolve, reject) => {
      sftp.realpath('.', (err, absPath) => err ? reject(err) : resolve(absPath))
    })
  })
}
