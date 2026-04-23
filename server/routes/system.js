import { readFileSync } from 'node:fs'
import { requireAdmin } from '../auth.js'
import { json } from '../helpers.js'
import { streamBackup, restoreBackup } from '../backup.js'
import { config } from '../config.js'

const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url)))

export async function systemRoutes(req, res, pathname) {
  const { method } = req

  if (method === 'GET' && pathname === '/api/health') {
    return json(res, 200, { ok: true })
  }

  if (method === 'GET' && pathname === '/api/status') {
    const { execFileSync } = await import('node:child_process')
    let diskFree = null
    try { diskFree = execFileSync('df', ['-h', config.dataPath]).toString().split('\n')[1] } catch {}
    return json(res, 200, { version, dataPath: config.dataPath, diskFree })
  }

  if (method === 'GET' && pathname === '/api/backup') {
    const user = requireAdmin(req, res); if (!user) return
    streamBackup(res)
    return
  }

  if (method === 'POST' && pathname === '/api/restore') {
    const user = requireAdmin(req, res); if (!user) return
    restoreBackup(req, res)
    return
  }

  return null
}
