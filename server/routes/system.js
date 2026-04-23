import { readFileSync } from 'node:fs'
import { requireAdmin } from '../auth.js'
import { json } from '../helpers.js'
import { streamBackup, restoreBackup } from '../backup.js'
import { config } from '../config.js'
import { execSync } from 'node:child_process'

let { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url)))
try {
  const buildNum = execSync('git rev-list --count HEAD', { stdio: 'pipe' }).toString().trim()
  version = `${version} Build ${buildNum}`
} catch {
  // Bei einem Prod-Release fehlt der .git Ordner im ZIP, daher wird der Catch-Block erreicht 
  // und die Version bleibt wie in der package.json definiert (z.B. "2026.4.1").
}

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
