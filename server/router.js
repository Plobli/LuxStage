import { readBody, json, send, notFound, parseUrl } from './helpers.js'
import { login, requireAuth, requireAdmin } from './auth.js'
import * as io from './io.js'
import * as photos from './photos.js'
import { subscribe, broadcast } from './sse.js'
import { streamBackup } from './backup.js'
import { generatePDF } from './pdf.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from './config.js'

export async function router(req, res) {
  const { method } = req
  const { pathname, params } = parseUrl(req.url)

  try {
    // ── Auth ───────────────────────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/auth/login') {
      const body = await readBody(req)
      const { username, password } = JSON.parse(body)
      const token = login(username, password)
      if (!token) return json(res, 401, { error: 'Ungültige Anmeldedaten' })
      return json(res, 200, { token })
    }

    // ── Shows — Liste ──────────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/api/shows') {
      const user = requireAuth(req, res); if (!user) return
      const ids = await io.listShows()
      // Frontmatter für jede Show lesen (name, datum, venue)
      const shows = await Promise.all(ids.map(async id => {
        try {
          const content = await io.readShow(id)
          const fm = parseFrontmatter(content)
          return { id, ...fm }
        } catch { return { id } }
      }))
      return json(res, 200, shows)
    }

    // ── Shows — Einzelne Show lesen ────────────────────────────────────────
    if (method === 'GET' && pathname.match(/^\/api\/shows\/([^/]+)$/)) {
      const user = requireAuth(req, res); if (!user) return
      const id = pathname.split('/')[3]
      const [content, channels, lock] = await Promise.all([
        io.readShow(id),
        io.readChannels(id),
        io.getLock(id),
      ])
      return json(res, 200, { id, content, channels, lock })
    }

    // ── Shows — Erstellen ──────────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/shows') {
      const user = requireAuth(req, res); if (!user) return
      const body = await readBody(req)
      const { id, content, channels } = JSON.parse(body)
      if (!id || !/^[a-z0-9_-]+$/i.test(id)) return json(res, 400, { error: 'Ungültige ID' })
      await io.ensureDir(io.paths.showDir(id))
      await io.writeAtomic(io.paths.showMd(id), content || defaultShowContent(id))
      await io.writeAtomic(io.paths.showCsv(id), channels || 'channel;address;device;position;color;notes\n')
      return json(res, 201, { id })
    }

    // ── Shows — Metadaten + Aufbau speichern ───────────────────────────────
    if (method === 'PUT' && pathname.match(/^\/api\/shows\/([^/]+)\/content$/)) {
      const user = requireAuth(req, res); if (!user) return
      const id = pathname.split('/')[3]
      const body = await readBody(req)
      const { content } = JSON.parse(body)
      await io.writeShow(id, content)
      return json(res, 200, { ok: true })
    }

    // ── Shows — Kanäle lesen ───────────────────────────────────────────────
    if (method === 'GET' && pathname.match(/^\/api\/shows\/([^/]+)\/channels$/)) {
      const user = requireAuth(req, res); if (!user) return
      const id = pathname.split('/')[3]
      const csv = await io.readChannels(id)
      return json(res, 200, { csv })
    }

    // ── Shows — Kanäle speichern ───────────────────────────────────────────
    if (method === 'PUT' && pathname.match(/^\/api\/shows\/([^/]+)\/channels$/)) {
      const user = requireAuth(req, res); if (!user) return
      const id = pathname.split('/')[3]
      const body = await readBody(req)
      const { csv } = JSON.parse(body)
      await io.writeChannels(id, csv)
      broadcast(id, 'channels-updated', { updatedBy: user.username })
      return json(res, 200, { ok: true })
    }

    // ── Shows — SSE abonnieren ─────────────────────────────────────────────
    if (method === 'GET' && pathname.match(/^\/api\/shows\/([^/]+)\/events$/)) {
      const user = requireAuth(req, res); if (!user) return
      const id = pathname.split('/')[3]
      subscribe(id, res)
      return // res bleibt offen
    }

    // ── Shows — Archivieren ────────────────────────────────────────────────
    if (method === 'DELETE' && pathname.match(/^\/api\/shows\/([^/]+)$/)) {
      const user = requireAuth(req, res); if (!user) return
      const id = pathname.split('/')[3]
      await io.archiveShow(id)
      return json(res, 200, { ok: true })
    }

    // ── Locking ────────────────────────────────────────────────────────────
    if (method === 'POST' && pathname.match(/^\/api\/shows\/([^/]+)\/lock$/)) {
      const user = requireAuth(req, res); if (!user) return
      const id = pathname.split('/')[3]
      const result = await io.acquireLock(id, user.username)
      return json(res, result.ok ? 200 : 423, result)
    }

    if (method === 'DELETE' && pathname.match(/^\/api\/shows\/([^/]+)\/lock$/)) {
      const user = requireAuth(req, res); if (!user) return
      const id = pathname.split('/')[3]
      await io.releaseLock(id, user.username)
      return json(res, 200, { ok: true })
    }

    if (method === 'PUT' && pathname.match(/^\/api\/shows\/([^/]+)\/lock$/)) {
      const user = requireAuth(req, res); if (!user) return
      const id = pathname.split('/')[3]
      await io.touchLock(id, user.username)
      return json(res, 200, { ok: true })
    }

    // ── Fotos — Liste ──────────────────────────────────────────────────────
    if (method === 'GET' && pathname.match(/^\/api\/shows\/([^/]+)\/photos$/)) {
      const user = requireAuth(req, res); if (!user) return
      const id = pathname.split('/')[3]
      const list = await photos.listPhotos(id)
      return json(res, 200, list)
    }

    // ── Fotos — Upload ─────────────────────────────────────────────────────
    if (method === 'POST' && pathname.match(/^\/api\/shows\/([^/]+)\/photos$/)) {
      const user = requireAuth(req, res); if (!user) return
      const id = pathname.split('/')[3]
      const ct = req.headers['content-type'] || ''
      const boundaryMatch = ct.match(/boundary=(.+)/)
      if (!boundaryMatch) return json(res, 400, { error: 'Kein Boundary' })
      const body = await photos.parseMultipart(req)
      const parts = photos.extractFileFromMultipart(body, boundaryMatch[1])
      const saved = []
      for (const part of parts) {
        const name = await photos.savePhoto(id, part.filename, part.data)
        saved.push(name)
      }
      return json(res, 201, { saved })
    }

    // ── Fotos — Löschen ────────────────────────────────────────────────────
    if (method === 'DELETE' && pathname.match(/^\/api\/shows\/([^/]+)\/photos\/(.+)$/)) {
      const user = requireAuth(req, res); if (!user) return
      const parts = pathname.split('/')
      const id = parts[3], filename = parts[5]
      await photos.deletePhoto(id, filename)
      return json(res, 200, { ok: true })
    }

    // ── Fotos — Ausliefern ─────────────────────────────────────────────────
    if (method === 'GET' && pathname.match(/^\/api\/shows\/([^/]+)\/photos\/(.+)$/)) {
      const user = requireAuth(req, res); if (!user) return
      const parts = pathname.split('/')
      const id = parts[3], filename = path.basename(parts[5])
      const filePath = path.join(io.paths.showPhotos(id), filename)
      try {
        const stat = await fs.promises.stat(filePath)
        res.writeHead(200, {
          'Content-Type': 'image/jpeg',
          'Content-Length': stat.size,
          'Cache-Control': 'public, max-age=86400',
        })
        fs.createReadStream(filePath).pipe(res)
      } catch { return notFound(res) }
      return
    }

    // ── Templates ──────────────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/api/templates') {
      const user = requireAdmin(req, res); if (!user) return
      const list = await io.listTemplates()
      return json(res, 200, list)
    }

    if (method === 'GET' && pathname.match(/^\/api\/templates\/(.+)$/)) {
      const user = requireAdmin(req, res); if (!user) return
      const name = pathname.slice('/api/templates/'.length)
      const csv = await io.readTemplate(name)
      return json(res, 200, { csv })
    }

    if (method === 'PUT' && pathname.match(/^\/api\/templates\/(.+)$/)) {
      const user = requireAdmin(req, res); if (!user) return
      const name = pathname.slice('/api/templates/'.length)
      const body = await readBody(req)
      const { csv } = JSON.parse(body)
      await io.writeTemplate(name, csv)
      return json(res, 200, { ok: true })
    }

    if (method === 'DELETE' && pathname.match(/^\/api\/templates\/(.+)$/)) {
      const user = requireAdmin(req, res); if (!user) return
      const name = pathname.slice('/api/templates/'.length)
      await io.deleteTemplate(name)
      return json(res, 200, { ok: true })
    }

    // ── PDF Export ────────────────────────────────────────────────────────
    if (method === 'GET' && pathname.match(/^\/api\/shows\/([^/]+)\/pdf$/)) {
      const user = requireAuth(req, res); if (!user) return
      const id = pathname.split('/')[3]
      const [content, csv] = await Promise.all([io.readShow(id), io.readChannels(id)])
      generatePDF(content, csv, res)
      return
    }

    // ── Backup ─────────────────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/api/backup') {
      const user = requireAdmin(req, res); if (!user) return
      streamBackup(res)
      return
    }

    // ── Status ─────────────────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/api/status') {
      const user = requireAuth(req, res); if (!user) return
      const { execSync } = await import('node:child_process')
      let diskFree = null
      try { diskFree = execSync('df -h ' + config.dataPath).toString().split('\n')[1] } catch {}
      return json(res, 200, {
        version: '1.1.0',
        dataPath: config.dataPath,
        diskFree,
      })
    }

    // ── Update (Admin) ─────────────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/update') {
      const user = requireAdmin(req, res); if (!user) return
      const { exec } = await import('node:child_process')
      exec('git pull && npm install', { cwd: path.join(config.dataPath, '..') }, (err, stdout) => {
        if (err) return json(res, 500, { error: err.message })
        json(res, 200, { output: stdout })
        // Server neu starten nach kurzer Pause
        setTimeout(() => process.exit(0), 500)
      })
      return
    }

    // ── Static (Web-App) ───────────────────────────────────────────────────
    if (method === 'GET') {
      const distPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web-app', 'dist')
      let filePath = path.join(distPath, pathname === '/' ? 'index.html' : pathname)
      // Sicherheitscheck: kein Pfad-Traversal
      if (!filePath.startsWith(distPath)) return notFound(res)
      try {
        const stat = await fs.promises.stat(filePath)
        if (stat.isDirectory()) filePath = path.join(filePath, 'index.html')
        const ext = path.extname(filePath)
        const mime = {
          '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
          '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
        }[ext] || 'application/octet-stream'
        res.writeHead(200, { 'Content-Type': mime })
        fs.createReadStream(filePath).pipe(res)
      } catch {
        // SPA Fallback
        try {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          fs.createReadStream(path.join(distPath, 'index.html')).pipe(res)
        } catch { notFound(res) }
      }
      return
    }

    notFound(res)
  } catch (err) {
    console.error(err)
    json(res, 500, { error: 'Interner Fehler' })
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const result = {}
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':')
    if (key && rest.length) result[key.trim()] = rest.join(':').trim().replace(/^"|"$/g, '')
  }
  return result
}

function defaultShowContent(id) {
  return `---\nname: ${id}\nvenue: \ndatum: ${new Date().toISOString().slice(0, 10)}\n---\n\n## Setup\n\n## Hängerei\n`
}
