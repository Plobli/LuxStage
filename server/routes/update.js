import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { requireAdmin } from '../auth.js'
import { readJsonBody, json } from '../helpers.js'
import { config } from '../config.js'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import unzipper from 'unzipper'
import { execFile } from 'node:child_process'

const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const GITHUB_REPO = 'Plobli/LuxStage'

function run(cmd, env = {}, maxBuffer = 1024 * 1024) {
  return new Promise((resolve, reject) =>
    execFile('/bin/bash', ['-c', cmd],
      { maxBuffer, env: { ...process.env, ...env } },
      (err, stdout, stderr) => {
        if (err) { err.stderr = stderr; reject(err) } else { resolve(stdout.trim()) }
      }
    )
  )
}

export async function updateRoutes(req, res, pathname, params) {
  const { method } = req

  if (method === 'GET' && pathname === '/api/update/branches') {
    const user = requireAdmin(req, res); if (!user) return
    try {
      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases`, {
        headers: { 'User-Agent': 'LuxStage-Updater' }
      })
      if (!response.ok) throw new Error('GitHub API Error')
      const releases = await response.json()
      const branches = releases.map(r => r.tag_name)
      return json(res, 200, { branches: branches.length ? branches : ['main'] })
    } catch (err) {
      return json(res, 200, { branches: ['main'], error: err.message })
    }
  }

  if (method === 'GET' && pathname === '/api/update/check') {
    const user = requireAdmin(req, res); if (!user) return
    const tag = params.branch || 'main'
    try {
      const pkg = JSON.parse(await fsp.readFile(path.join(repoDir, 'server', 'package.json'), 'utf8'))
      const currentVer = pkg.version

      if (tag === 'main') {
         return json(res, 200, { available: false, branch: tag, error: "Wähle ein Release (z.B. v1.21.0) für das Update aus." })
      }
      
      const cleanTag = tag.replace(/^v/, '')
      const isNewer = cleanTag !== currentVer
      
      if (!isNewer) return json(res, 200, { available: false, branch: tag })
      
      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${tag}`, {
        headers: { 'User-Agent': 'LuxStage-Updater' }
      })
      if (!response.ok) throw new Error('Release nicht gefunden')
      const release = await response.json()
      
      return json(res, 200, { available: true, commits: 1, log: release.name + '\n' + (release.body || ''), branch: tag })
    } catch (err) {
      return json(res, 200, { available: false, branch: tag, error: err.message })
    }
  }

  if (method === 'POST' && pathname === '/api/update') {
    const user = requireAdmin(req, res); if (!user) return
    const dbPath   = path.join(config.dataPath, 'luxstage.db')
    const dbSnap   = path.join(config.dataPath, 'luxstage-preupdate.db')
    const tmpZip   = path.join(repoDir, 'tmp-release.zip')

    const bodyJson = await readJsonBody(req, res); if (bodyJson === null) return
    const tag = bodyJson.branch || 'main'
    if (!/^[a-zA-Z0-9_.-]+$/.test(tag)) return json(res, 400, { error: 'Ungültiger Tag-Name' })

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })
    const sendEvent = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    const log = []
    const step = (msg) => { log.push(msg); console.log('[update]', msg); sendEvent('log', { msg }) }

    try {
      if (tag === 'main') throw new Error('Release-basiertes Update erfordert einen GitHub Tag (z.B. v1.0.0).')
      
      step(`Starte Update auf Version ${tag}...`)
      await fsp.copyFile(dbPath, dbSnap).catch(() => {})
      step('DB-Snapshot erstellt')

      const zipUrl = `https://github.com/${GITHUB_REPO}/releases/download/${tag}/luxstage-release.zip`
      step(`Lade Release herunter...`)
      
      const response = await fetch(zipUrl)
      if (!response.ok) throw new Error(`Download fehlgeschlagen: HTTP ${response.status}`)
      
      const buffer = await response.arrayBuffer()
      await fsp.writeFile(tmpZip, Buffer.from(buffer))
      
      step('Entpacke Dateien über das aktuelle Verzeichnis...')
      await new Promise((resolve, reject) => {
         fs.createReadStream(tmpZip).pipe(unzipper.Extract({ path: repoDir }))
           .on('close', resolve)
           .on('error', reject)
      })
      step('Dateien erfolgreich entpackt.')

      step('Installiere Server-Abhängigkeiten...')
      await run(`cd "${path.join(repoDir, 'server')}" && npm install --omit=dev`)
      
      step('Aufräumen...')
      await fsp.unlink(tmpZip).catch(()=>{})
      await fsp.unlink(dbSnap).catch(()=>{})

      step('Neustart...')
      sendEvent('done', { log })
      res.end()
      setTimeout(() => process.exit(0), 500)
    } catch (err) {
      step(`Fehler: ${err.message}`)
      await fsp.unlink(tmpZip).catch(()=>{})
      sendEvent('done', { error: err.message, log })
      res.end()
    }
    return
  }

  return null
}
