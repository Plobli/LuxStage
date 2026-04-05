import { readFileSync } from 'node:fs'
import { readBody, json, send, notFound, parseUrl } from './helpers.js'
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)))
import { login, requireAuth, requireAdmin } from './auth.js'
import * as db from './db.js'
import { randomBytes } from 'node:crypto'
import { listHistory, getHistoryEntry, restoreHistoryEntry } from './history.js'
import * as photos from './photos.js'
import { subscribe, broadcast, getPresence } from './sse.js'
import { streamBackup } from './backup.js'
import { generatePDF } from './pdf.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { config } from './config.js'

export async function router(req, res) {
  const { method } = req
  const { pathname, params } = parseUrl(req.url)

  try {
    // ── Health ─────────────────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/api/health') {
      return json(res, 200, { ok: true })
    }

    // ── Auth ───────────────────────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/auth/login') {
      const body = await readBody(req)
      const { username, password } = JSON.parse(body)
      const token = login(username, password)
      if (!token) return json(res, 401, { error: 'Ungültige Anmeldedaten' })
      return json(res, 200, { token })
    }

    // ── Auth — Passwort ändern ─────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/auth/change-password') {
      const user = requireAuth(req, res); if (!user) return
      const body = await readBody(req)
      const { currentPassword, newPassword } = JSON.parse(body)
      if (!newPassword || newPassword.length < 4) return json(res, 400, { error: 'Passwort zu kurz' })
      // Aktuelles Passwort prüfen
      const configUser = config.users.find(u => u.username === user.username)
      const effectivePassword = db.getDbPassword(user.username) ?? configUser?.password
      if (effectivePassword !== currentPassword) return json(res, 403, { error: 'Aktuelles Passwort falsch' })
      db.changePassword(user.username, newPassword)
      return json(res, 200, { ok: true })
    }

    // ── Auth — Passwort zurücksetzen (nur Admin) ───────────────────────────
    if (method === 'POST' && pathname === '/api/auth/reset-password') {
      const admin = requireAdmin(req, res); if (!admin) return
      const body = await readBody(req)
      const { username } = JSON.parse(body)
      const allUsers = db.listUsers(config.users)
      if (!allUsers.find(u => u.username === username)) return json(res, 404, { error: 'Benutzer nicht gefunden' })
      const newPassword = randomBytes(6).toString('hex')
      db.changePassword(username, newPassword)
      return json(res, 200, { newPassword })
    }

    // ── Benutzer — Liste ───────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/api/users') {
      const admin = requireAdmin(req, res); if (!admin) return
      return json(res, 200, db.listUsers(config.users))
    }

    // ── Benutzer — Anlegen ─────────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/users') {
      const admin = requireAdmin(req, res); if (!admin) return
      const body = await readBody(req)
      const { username, password, role } = JSON.parse(body)
      if (!username || !/^[a-zA-Z0-9_-]+$/.test(username)) return json(res, 400, { error: 'Ungültiger Benutzername' })
      if (!password || password.length < 4) return json(res, 400, { error: 'Passwort zu kurz' })
      if (!['admin', 'techniker'].includes(role)) return json(res, 400, { error: 'Ungültige Rolle' })
      db.createUser(username, password, role)
      return json(res, 201, { ok: true })
    }

    // ── Benutzer — Löschen ─────────────────────────────────────────────────
    if (method === 'DELETE' && pathname.match(/^\/api\/users\/([^/]+)$/)) {
      const admin = requireAdmin(req, res); if (!admin) return
      const username = pathname.split('/')[3]
      if (username === admin.username) return json(res, 400, { error: 'Eigenen Account kann man nicht löschen' })
      db.deleteUser(username)
      return json(res, 200, { ok: true })
    }

    // ── Shows — Liste ──────────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/api/shows') {
      const user = requireAuth(req, res); if (!user) return
      const shows = db.listShows()
      return json(res, 200, shows.map(({ id: _id, ...s }) => ({ id: s.slug, ...s })))
    }

    // ── Shows — Archiv-Liste (muss vor dem Regex-Handler stehen) ──────────
    if (method === 'GET' && pathname === '/api/shows/archived') {
      const user = requireAuth(req, res); if (!user) return
      const shows = db.listArchivedShows()
      return json(res, 200, shows.map(({ id: _id, ...s }) => ({ id: s.slug, ...s })))
    }

    // ── Shows — Einzelne Show lesen ────────────────────────────────────────
    if (method === 'GET' && pathname.match(/^\/api\/shows\/([^/]+)$/)) {
      const user = requireAuth(req, res); if (!user) return
      const slug = pathname.split('/')[3]
      const show = db.readShow(slug)
      if (!show) return notFound(res)
      const channels = db.readChannels(slug).map(({ show_id: _, sort_order: __, ...ch }) => ch)
      const lock = db.getLock(slug)
      return json(res, 200, {
        id: show.slug,
        name: show.name,
        datum: show.datum,
        template: show.template,
        untertitel: show.untertitel,
        spielzeit: show.spielzeit,
        setupMarkdown: show.setup_markdown ?? '',
        eosActiveChannels: show.eos_active_channels ? JSON.parse(show.eos_active_channels) : null,
        channels,
        lock,
      })
    }

    // ── Shows — Erstellen ──────────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/shows') {
      const user = requireAuth(req, res); if (!user) return
      const body = await readBody(req)
      const { id, name, datum, template, untertitel, spielzeit, channels } = JSON.parse(body)
      if (!id || !/^[a-z0-9_-]+$/i.test(id)) return json(res, 400, { error: 'Ungültige ID' })
      db.createShow(id, { name, datum, template, untertitel, spielzeit })
      if (Array.isArray(channels) && channels.length) db.writeChannels(id, channels)
      return json(res, 201, { id })
    }

    // ── Shows — Metadaten speichern ────────────────────────────────────────
    if (method === 'PUT' && pathname.match(/^\/api\/shows\/([^/]+)\/meta$/)) {
      const user = requireAuth(req, res); if (!user) return
      const slug = pathname.split('/')[3]
      const body = await readBody(req)
      const { setupMarkdown, eosActiveChannels, ...rest } = JSON.parse(body)
      const fields = { ...rest }
      if (setupMarkdown !== undefined) fields.setup_markdown = setupMarkdown
      if (eosActiveChannels !== undefined) fields.eos_active_channels = JSON.stringify(eosActiveChannels)
      db.writeShow(slug, fields)
      return json(res, 200, { ok: true })
    }

    // ── Shows — Kanäle lesen ───────────────────────────────────────────────
    if (method === 'GET' && pathname.match(/^\/api\/shows\/([^/]+)\/channels$/)) {
      const user = requireAuth(req, res); if (!user) return
      const slug = pathname.split('/')[3]
      const channels = db.readChannels(slug).map(({ show_id: _, sort_order: __, ...ch }) => ch)
      return json(res, 200, channels)
    }

    // ── Shows — Kanäle speichern ───────────────────────────────────────────
    if (method === 'PUT' && pathname.match(/^\/api\/shows\/([^/]+)\/channels$/)) {
      const user = requireAuth(req, res); if (!user) return
      const slug = pathname.split('/')[3]
      const body = await readBody(req)
      const channels = JSON.parse(body)
      db.writeChannels(slug, channels)
      broadcast(slug, 'channels-updated', { updatedBy: user.username })
      return json(res, 200, { ok: true })
    }

    // ── Shows — SSE abonnieren ─────────────────────────────────────────────
    if (method === 'GET' && pathname.match(/^\/api\/shows\/([^/]+)\/events$/)) {
      const user = requireAuth(req, res); if (!user) return
      const id = pathname.split('/')[3]
      const device = params.device || 'web'
      subscribe(id, res, user.username, device)
      return // res bleibt offen
    }

    // ── Shows — Presence abfragen ──────────────────────────────────────────
    if (method === 'GET' && pathname.match(/^\/api\/shows\/([^/]+)\/presence$/)) {
      const user = requireAuth(req, res); if (!user) return
      const id = pathname.split('/')[3]
      return json(res, 200, { users: getPresence(id) })
    }

    // ── Shows — Wiederherstellen ───────────────────────────────────────────
    if (method === 'POST' && pathname.match(/^\/api\/shows\/([^/]+)\/restore$/)) {
      const user = requireAuth(req, res); if (!user) return
      const slug = pathname.split('/')[3]
      db.restoreShow(slug)
      return json(res, 200, { ok: true })
    }

    // ── Shows — Archivieren ────────────────────────────────────────────────
    if (method === 'DELETE' && pathname.match(/^\/api\/shows\/([^/]+)$/)) {
      const user = requireAuth(req, res); if (!user) return
      const slug = pathname.split('/')[3]
      db.archiveShow(slug)
      return json(res, 200, { ok: true })
    }

    if (method === 'DELETE' && pathname.match(/^\/api\/shows\/([^/]+)\/permanent$/)) {
      const user = requireAuth(req, res); if (!user) return
      const slug = pathname.split('/')[3]
      db.deleteShow(slug)
      return json(res, 200, { ok: true })
    }

    // ── Locking ────────────────────────────────────────────────────────────
    if (method === 'POST' && pathname.match(/^\/api\/shows\/([^/]+)\/lock$/)) {
      const user = requireAuth(req, res); if (!user) return
      const slug = pathname.split('/')[3]
      const result = db.acquireLock(slug, user.username)
      return json(res, result.ok ? 200 : 423, result)
    }

    if (method === 'DELETE' && pathname.match(/^\/api\/shows\/([^/]+)\/lock$/)) {
      const user = requireAuth(req, res); if (!user) return
      const slug = pathname.split('/')[3]
      db.releaseLock(slug, user.username)
      return json(res, 200, { ok: true })
    }

    if (method === 'PUT' && pathname.match(/^\/api\/shows\/([^/]+)\/lock$/)) {
      const user = requireAuth(req, res); if (!user) return
      const slug = pathname.split('/')[3]
      db.touchLock(slug, user.username)
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
      const slug = parts[3], filename = path.basename(parts[5])
      const filePath = photos.getPhotoPath(slug, filename)
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
      const user = requireAuth(req, res); if (!user) return
      const list = db.listTemplates()
      return json(res, 200, list)
    }

    if (method === 'GET' && pathname.match(/^\/api\/templates\/([^/]+)\/channels$/)) {
      const user = requireAuth(req, res); if (!user) return
      const name = pathname.split('/')[3]
      const channels = db.readTemplate(name).map(({ template_id: _, sort_order: __, ...ch }) => ch)
      return json(res, 200, channels)
    }

    if (method === 'GET' && pathname.match(/^\/api\/templates\/([^/]+)\/sections$/)) {
      const user = requireAuth(req, res); if (!user) return
      const name = pathname.split('/')[3]
      const sections = db.readTemplateSections(name)
      return json(res, 200, sections)
    }

    if (method === 'PUT' && pathname.match(/^\/api\/templates\/([^/]+)\/sections$/)) {
      const user = requireAdmin(req, res); if (!user) return
      const name = pathname.split('/')[3]
      const body = await readBody(req)
      const { sections } = JSON.parse(body)
      db.writeTemplateSections(name, sections)
      return json(res, 200, { ok: true })
    }

    if (method === 'GET' && pathname.match(/^\/api\/templates\/(.+)$/)) {
      const user = requireAuth(req, res); if (!user) return
      const name = pathname.slice('/api/templates/'.length)
      const channels = db.readTemplate(name).map(({ template_id: _, sort_order: __, ...ch }) => ch)
      return json(res, 200, channels)
    }

    if (method === 'PUT' && pathname.match(/^\/api\/templates\/(.+)$/)) {
      const user = requireAdmin(req, res); if (!user) return
      const name = pathname.slice('/api/templates/'.length)
      const body = await readBody(req)
      const channels = JSON.parse(body)
      db.writeTemplate(name, channels)
      const existing = db.readTemplateSections(name)
      if (!existing.length) {
        db.writeTemplateSections(name, [
          { id: randomUUID(), title: 'Aufbau', type: 'markdown', order: 0, fields: [] },
          { id: randomUUID(), title: 'Besonderheiten', type: 'markdown', order: 1, fields: [] },
        ])
      }
      return json(res, 200, { ok: true })
    }

    if (method === 'DELETE' && pathname.match(/^\/api\/templates\/(.+)$/)) {
      const user = requireAdmin(req, res); if (!user) return
      const name = pathname.slice('/api/templates/'.length)
      db.deleteTemplate(name)
      db.deleteTemplateSections(name)
      return json(res, 200, { ok: true })
    }

    // ── Show Sections ──────────────────────────────────────────────────────
    if (method === 'GET' && pathname.match(/^\/api\/shows\/([^/]+)\/sections$/)) {
      const user = requireAuth(req, res); if (!user) return
      const slug = pathname.split('/')[3]
      const map = db.readShowSections(slug)
      const sections = [...map.entries()].map(([id, content]) => ({ id, content }))
      return json(res, 200, sections)
    }

    if (method === 'PUT' && pathname.match(/^\/api\/shows\/([^/]+)\/sections$/)) {
      const user = requireAuth(req, res); if (!user) return
      const slug = pathname.split('/')[3]
      const body = await readBody(req)
      const sections = JSON.parse(body) // [{ id, content }]
      const map = new Map(sections.map(s => [s.id, s.content]))
      db.writeShowSections(slug, map)
      broadcast(slug, 'sections-updated', { updatedBy: user.username })
      return json(res, 200, { ok: true })
    }

    // ── Show Section Defs ──────────────────────────────────────────────────
    if (method === 'GET' && pathname.match(/^\/api\/shows\/([^/]+)\/section-defs$/)) {
      const user = requireAuth(req, res); if (!user) return
      const slug = pathname.split('/')[3]
      const sections = db.readShowSectionDefs(slug)
      return json(res, 200, sections)
    }

    if (method === 'PUT' && pathname.match(/^\/api\/shows\/([^/]+)\/section-defs$/)) {
      const user = requireAuth(req, res); if (!user) return
      const slug = pathname.split('/')[3]
      const body = await readBody(req)
      const { sections } = JSON.parse(body)
      db.writeShowSectionDefs(slug, sections)
      return json(res, 200, { ok: true })
    }

    // ── PDF Export ────────────────────────────────────────────────────────
    if (method === 'GET' && pathname.match(/^\/api\/shows\/([^/]+)\/pdf$/)) {
      const user = requireAuth(req, res); if (!user) return
      const slug = pathname.split('/')[3]
      const show = db.readShow(slug)
      if (!show) return notFound(res)
      const channels = db.readChannels(slug)
      const sectionsMap = db.readShowSections(slug)
      const templateSections = db.readShowSectionDefs(slug)
      generatePDF(
        show,
        channels,
        sectionsMap,
        templateSections,
        res
      )
      return
    }

    // ── History ────────────────────────────────────────────────────────────────
    if (method === 'GET' && pathname.match(/^\/api\/shows\/([^/]+)\/history$/)) {
      const user = requireAuth(req, res); if (!user) return
      const slug = pathname.split('/')[3]
      return json(res, 200, listHistory(slug))
    }

    if (method === 'GET' && pathname.match(/^\/api\/shows\/([^/]+)\/history\/([^/]+)$/)) {
      const user = requireAuth(req, res); if (!user) return
      const parts = pathname.split('/')
      const slug = parts[3], historyId = parts[5]
      const entry = getHistoryEntry(slug, historyId)
      if (!entry) return notFound(res)
      return json(res, 200, { ...entry, channels: JSON.parse(entry.channels), sections: JSON.parse(entry.sections) })
    }

    if (method === 'POST' && pathname.match(/^\/api\/shows\/([^/]+)\/history\/([^/]+)\/restore$/)) {
      const user = requireAuth(req, res); if (!user) return
      const parts = pathname.split('/')
      const slug = parts[3], historyId = parts[5]
      const lock = db.getLock(slug)
      if (lock && lock.user !== user.username) return json(res, 423, { lockedBy: lock.user })
      const ok = restoreHistoryEntry(slug, historyId)
      if (!ok) return notFound(res)
      return json(res, 200, { ok: true })
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
      const { execFileSync } = await import('node:child_process')
      let diskFree = null
      try { diskFree = execFileSync('df', ['-h', config.dataPath]).toString().split('\n')[1] } catch {}
      return json(res, 200, {
        version,
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
        // Assets mit Hash (in /assets/) → 1 Jahr cachen; index.html → nie cachen
        const cacheControl = pathname.startsWith('/assets/')
          ? 'public, max-age=31536000, immutable'
          : 'no-cache'
        res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': cacheControl })
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

