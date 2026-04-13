import { readFileSync } from 'node:fs'
import { readBody, readBodyBuffer, readJsonBody, json, send, notFound, parseUrl } from './helpers.js'
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)))
import { login, signToken, requireAuth, requireAdmin, issueDownloadToken } from './auth.js'
import * as db from './db.js'
import * as floorplan from './floorplan.js'
import { randomBytes } from 'node:crypto'
import { listHistory, getHistoryEntry, restoreHistoryEntry, takeSnapshotNow } from './history.js'
import * as photos from './photos.js'
import { ocrShowplan, ocrShowplanDocument } from './ocr.js'
import { subscribe, broadcast, getPresence } from './sse.js'
import { streamBackup, restoreBackup } from './backup.js'
import { generatePDF } from './pdf.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { config } from './config.js'

function mimeFromFilename(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase()
  return { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp' }[ext] || 'application/octet-stream'
}

// ── Rate Limiter (Login) ────────────────────────────────────────────────────
const loginAttempts = new Map()
const MAX_LOGIN_ATTEMPTS = 10
const LOGIN_WINDOW_MS = 15 * 60 * 1000

function isRateLimited(ip) {
  const now = Date.now()
  const entry = loginAttempts.get(ip)
  if (!entry) return false
  if (now - entry.firstAt > LOGIN_WINDOW_MS) { loginAttempts.delete(ip); return false }
  return entry.count >= MAX_LOGIN_ATTEMPTS
}

function recordFailedLogin(ip) {
  const now = Date.now()
  const entry = loginAttempts.get(ip)
  if (!entry || now - entry.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAt: now })
  } else {
    loginAttempts.set(ip, { ...entry, count: entry.count + 1 })
  }
}

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
      // X-Forwarded-For auswerten wenn hinter einem Reverse-Proxy (z.B. Caddy)
      let ip = req.socket.remoteAddress || 'unknown'
      // Nur dem X-Forwarded-For vertrauen, wenn die Verbindung vom lokalen Reverse-Proxy kommt
      if ((ip === '127.0.0.1' || ip === '::1') && req.headers['x-forwarded-for']) {
        ip = req.headers['x-forwarded-for'].split(',')[0].trim()
      }
      if (isRateLimited(ip)) return json(res, 429, { error: 'Zu viele Versuche. Bitte warten.' })
      const body = await readJsonBody(req, res); if (body === null) return
      const { username, password } = body
      const loginResult = await login(username, password)
      if (!loginResult) { recordFailedLogin(ip); return json(res, 401, { error: 'Ungültige Anmeldedaten' }) }
      return json(res, 200, loginResult)
    }

    // ── Auth — Token erneuern ─────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/auth/refresh') {
      const user = requireAuth(req, res); if (!user) return
      return json(res, 200, { token: signToken(user.username, user.role) })
    }

    // ── Auth — Einmal-Download-Token (für PDF, Fotos, Backup) ─────────────
    if (method === 'POST' && pathname === '/api/auth/download-token') {
      const user = requireAuth(req, res); if (!user) return
      return json(res, 200, { token: issueDownloadToken(user.username, user.role) })
    }

    // ── Auth — Passwort ändern ─────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/auth/change-password') {
      const user = requireAuth(req, res); if (!user) return
      const body = await readJsonBody(req, res); if (body === null) return
      const { currentPassword, newPassword } = body
      if (!newPassword || newPassword.length < 8) return json(res, 400, { error: 'Passwort zu kurz (min. 8 Zeichen)' })
      // Aktuelles Passwort prüfen
      const storedPassword = db.getDbPassword(user.username)
      const pwOk = storedPassword?.startsWith('$2')
        ? await (await import('bcrypt')).compare(currentPassword, storedPassword)
        : currentPassword === storedPassword
      if (!pwOk) return json(res, 403, { error: 'Aktuelles Passwort falsch' })
      await db.changePassword(user.username, newPassword, 0)
      return json(res, 200, { ok: true })
    }

    // ── Auth — Passwort zurücksetzen (nur Admin) ───────────────────────────
    if (method === 'POST' && pathname === '/api/auth/reset-password') {
      const admin = requireAdmin(req, res); if (!admin) return
      const body = await readJsonBody(req, res); if (body === null) return
      const { username } = body
      const allUsers = db.listUsers()
      if (!allUsers.find(u => u.username === username)) return json(res, 404, { error: 'Benutzer nicht gefunden' })
      const newPassword = randomBytes(6).toString('hex')
      await db.changePassword(username, newPassword, 1)
      return json(res, 200, { newPassword })
    }

    // ── Benutzer — Liste ───────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/api/users') {
      const admin = requireAdmin(req, res); if (!admin) return
      return json(res, 200, db.listUsers())
    }

    // ── Benutzer — Anlegen ─────────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/users') {
      const admin = requireAdmin(req, res); if (!admin) return
      const body = await readJsonBody(req, res); if (body === null) return
      const { username, password, role } = body
      if (!username || !/^[a-zA-Z0-9_-]+$/.test(username)) return json(res, 400, { error: 'Ungültiger Benutzername' })
      if (!password || password.length < 8) return json(res, 400, { error: 'Passwort zu kurz (min. 8 Zeichen)' })
      if (!['admin', 'techniker'].includes(role)) return json(res, 400, { error: 'Ungültige Rolle' })
      await db.createUser(username, password, role)
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
      const body = await readJsonBody(req, res); if (body === null) return
      const { id, name, datum, template, untertitel, spielzeit, channels } = body
      if (!id || !/^[a-z0-9_-]+$/i.test(id)) return json(res, 400, { error: 'Ungültige ID' })
      db.createShow(id, { name, datum, template, untertitel, spielzeit })
      if (Array.isArray(channels) && channels.length) db.writeChannels(id, channels)
      return json(res, 201, { id })
    }

    // ── Shows — Metadaten speichern ────────────────────────────────────────
    if (method === 'PUT' && pathname.match(/^\/api\/shows\/([^/]+)\/meta$/)) {
      const user = requireAuth(req, res); if (!user) return
      const slug = pathname.split('/')[3]
      const body = await readJsonBody(req, res); if (body === null) return
      const { setupMarkdown, eosActiveChannels, ...rest } = body
      const fields = { ...rest }
      if (setupMarkdown !== undefined) fields.setup_markdown = setupMarkdown
      if (eosActiveChannels !== undefined) fields.eos_active_channels = JSON.stringify(eosActiveChannels)
      fields.last_edited_by = user.username
      fields.last_edited_at = Date.now()
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
      const channels = await readJsonBody(req, res); if (channels === null) return
      db.writeChannels(slug, channels, user.username)
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
      const user = requireAdmin(req, res); if (!user) return
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
      const saved = await Promise.all(parts.map(part => photos.savePhoto(id, part.filename, part.data)))
      return json(res, 201, { saved })
    }

    // ── Fotos — Löschen ────────────────────────────────────────────────────
    if (method === 'DELETE' && pathname.match(/^\/api\/shows\/([^/]+)\/photos\/(.+)$/)) {
      const user = requireAdmin(req, res); if (!user) return
      const parts = pathname.split('/')
      const id = parts[3], filename = path.basename(parts[5])
      await photos.deletePhoto(id, filename)
      db.deletePhotoDescription(id, filename)
      return json(res, 200, { ok: true })
    }

    // ── Foto-Reihenfolge — Speichern ──────────────────────────────────────
    if (method === 'PUT' && pathname.match(/^\/api\/shows\/([^/]+)\/photo-order$/)) {
      const user = requireAdmin(req, res); if (!user) return
      const id = pathname.split('/')[3]
      const body = JSON.parse(await readBody(req))
      await photos.savePhotoOrder(id, body.order)
      return json(res, 200, { ok: true })
    }

    // ── Foto-Beschreibungen — Alle lesen ───────────────────────────────────
    if (method === 'GET' && pathname.match(/^\/api\/shows\/([^/]+)\/photo-captions$/)) {
      const user = requireAuth(req, res); if (!user) return
      const id = pathname.split('/')[3]
      return json(res, 200, db.readPhotoDescriptions(id))
    }

    // ── Foto-Beschreibung — Speichern ──────────────────────────────────────
    if (method === 'PUT' && pathname.match(/^\/api\/shows\/([^/]+)\/photo-captions\/(.+)$/)) {
      const user = requireAuth(req, res); if (!user) return
      const parts = pathname.split('/')
      const id = parts[3], filename = decodeURIComponent(parts[5])
      if (filename !== path.basename(filename) || filename.includes('..')) {
        return json(res, 400, { error: 'Ungültiger Dateiname' })
      }
      const body = await readJsonBody(req, res); if (body === null) return
      const { caption, channelNumber } = body
      db.writePhotoDescription(id, filename, caption ?? '', channelNumber ?? '')
      return json(res, 200, { ok: true })
    }

    // ── OCR — Showplan aus Fotos, PDF oder Docx erkennen ─────────────────
    if (method === 'POST' && pathname === '/api/ocr/showplan') {
      const user = requireAuth(req, res); if (!user) return
      const ct = req.headers['content-type'] || ''
      const boundaryMatch = ct.match(/boundary=(.+)/)
      if (!boundaryMatch) return json(res, 400, { error: 'Kein Boundary' })
      const body = await photos.parseMultipart(req)
      const parts = photos.extractFileFromMultipart(body, boundaryMatch[1])
      if (!parts.length) return json(res, 400, { error: 'Keine Datei gefunden' })

      const docMimeMap = {
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }
      const imgMimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }

      // Prüfen ob erstes File ein Dokument (PDF/Docx) ist
      const firstExt = parts[0].filename.split('.').pop().toLowerCase()
      const docMime = docMimeMap[firstExt]

      try {
        let result
        if (docMime) {
          // PDF oder Docx — nur erste Datei verwenden
          result = await ocrShowplanDocument(parts[0].data, docMime)
        } else {
          // Bilder
          const images = parts.map(({ data, filename }) => {
            const ext = filename.split('.').pop().toLowerCase()
            return { buffer: data, mimeType: imgMimeMap[ext] || 'image/jpeg' }
          })
          result = await ocrShowplan(images)
        }
        return json(res, 200, result)
      } catch (err) {
        console.error('OCR-Fehler:', err.message)
        return json(res, 500, { error: err.message, rawOutput: err.rawOutput ?? null })
      }
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
          'Content-Type': mimeFromFilename(filename) || 'image/jpeg',
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
      const name = decodeURIComponent(pathname.split('/')[3])
      const channels = db.readTemplate(name).map(({ template_id: _, sort_order: __, ...ch }) => ch)
      return json(res, 200, channels)
    }

    if (method === 'GET' && pathname.match(/^\/api\/templates\/([^/]+)\/sections$/)) {
      const user = requireAuth(req, res); if (!user) return
      const name = decodeURIComponent(pathname.split('/')[3])
      const sections = db.readTemplateSections(name)
      return json(res, 200, sections)
    }

    if (method === 'PUT' && pathname.match(/^\/api\/templates\/([^/]+)\/sections$/)) {
      const user = requireAdmin(req, res); if (!user) return
      const name = decodeURIComponent(pathname.split('/')[3])
      const body = await readJsonBody(req, res); if (body === null) return
      const { sections } = body
      db.writeTemplateSections(name, sections)
      return json(res, 200, { ok: true })
    }

    if (method === 'GET' && pathname.match(/^\/api\/templates\/(.+)$/)) {
      const user = requireAuth(req, res); if (!user) return
      const name = decodeURIComponent(pathname.slice('/api/templates/'.length))
      if (!/^[a-zA-Z0-9_\- ]{1,100}$/.test(name)) return json(res, 400, { error: 'Ungültiger Template-Name' })
      const channels = db.readTemplate(name).map(({ template_id: _, sort_order: __, ...ch }) => ch)
      return json(res, 200, channels)
    }

    if (method === 'PUT' && pathname.match(/^\/api\/templates\/(.+)$/)) {
      const user = requireAdmin(req, res); if (!user) return
      const name = decodeURIComponent(pathname.slice('/api/templates/'.length))
      if (!/^[a-zA-Z0-9_\- ]{1,100}$/.test(name)) return json(res, 400, { error: 'Ungültiger Template-Name' })
      const channels = await readJsonBody(req, res); if (channels === null) return
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
      const name = decodeURIComponent(pathname.slice('/api/templates/'.length))
      if (!/^[a-zA-Z0-9_\- ]{1,100}$/.test(name)) return json(res, 400, { error: 'Ungültiger Template-Name' })
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
      const sections = await readJsonBody(req, res); if (sections === null) return
      const map = new Map(sections.map(s => [s.id, s.content]))
      db.writeShowSections(slug, map, user.username)
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
      const user = requireAdmin(req, res); if (!user) return
      const slug = pathname.split('/')[3]
      const body = await readJsonBody(req, res); if (body === null) return
      const { sections } = body
      db.writeShowSectionDefs(slug, sections, user.username)
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
      const photoFilenames = await photos.listPhotos(slug)
      const captionsMap = db.readPhotoDescriptions(slug)
      const photoEntries = photoFilenames.map(f => ({
        path: photos.getPhotoPath(slug, f),
        caption: captionsMap[f]?.caption ?? '',
      }))
      generatePDF(
        show,
        channels,
        sectionsMap,
        templateSections,
        photoEntries,
        res
      )
      return
    }

    // ── History ────────────────────────────────────────────────────────────────
    if (method === 'POST' && pathname.match(/^\/api\/shows\/([^/]+)\/history\/snapshot$/)) {
      const user = requireAuth(req, res); if (!user) return
      const slug = pathname.split('/')[3]
      takeSnapshotNow(slug)
      return json(res, 200, { ok: true })
    }

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

    if (method === 'POST' && pathname === '/api/restore') {
      const user = requireAdmin(req, res); if (!user) return
      restoreBackup(req, res)
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

    // ── Update: Remote-Branches (Admin) ───────────────────────────────────
    if (method === 'GET' && pathname === '/api/update/branches') {
      const user = requireAdmin(req, res); if (!user) return
      const { execFile } = await import('node:child_process')
      const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
      const nvmDir = process.env.NVM_DIR || path.join(process.env.HOME, '.nvm')
      const nvmInit = `export NVM_DIR="${nvmDir}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"`
      const run = (cmd, env = {}) => new Promise((resolve, reject) => {
        execFile('/bin/bash', ['-c', `${nvmInit} && ${cmd}`], { maxBuffer: 1024 * 1024, env: { ...process.env, ...env } }, (err, stdout) => {
          if (err) { reject(err) } else { resolve(stdout.trim()) }
        })
      })
      try {
        await run('git -C "$REPO_DIR" fetch --prune --quiet', { REPO_DIR: repoDir })
        const out = await run('git -C "$REPO_DIR" branch -r', { REPO_DIR: repoDir })
        const branches = out.split('\n')
          .map(b => b.trim().replace(/^origin\//, ''))
          .filter(b => b && !b.startsWith('HEAD'))
        return json(res, 200, { branches })
      } catch (err) {
        return json(res, 200, { branches: ['main'], error: err.message })
      }
    }

    // ── Update-Check (Admin) ───────────────────────────────────────────────
    if (method === 'GET' && pathname === '/api/update/check') {
      const user = requireAdmin(req, res); if (!user) return
      const { execFile } = await import('node:child_process')
      const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
      const nvmDir = process.env.NVM_DIR || path.join(process.env.HOME, '.nvm')
      const nvmInit = `export NVM_DIR="${nvmDir}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"`
      const run = (cmd, env = {}) => new Promise((resolve, reject) => {
        execFile('/bin/bash', ['-c', `${nvmInit} && ${cmd}`], { maxBuffer: 1024 * 1024, env: { ...process.env, ...env } }, (err, stdout) => {
          if (err) { reject(err) } else { resolve(stdout.trim()) }
        })
      })
      const branch = params.branch || 'main'
      if (!/^[a-zA-Z0-9_./-]+$/.test(branch)) return json(res, 400, { error: 'Ungültiger Branch-Name' })
      try {
        await run('git -C "$REPO_DIR" fetch --no-tags origin "$TARGET_BRANCH" --quiet', { REPO_DIR: repoDir, TARGET_BRANCH: branch })
        const behind = await run('git -C "$REPO_DIR" rev-list "HEAD..origin/$TARGET_BRANCH" --count', { REPO_DIR: repoDir, TARGET_BRANCH: branch })
        const commits = parseInt(behind, 10)
        if (commits === 0) return json(res, 200, { available: false, branch })
        const log = await run('git -C "$REPO_DIR" log HEAD..origin/"$TARGET_BRANCH" --oneline --no-decorate', { REPO_DIR: repoDir, TARGET_BRANCH: branch })
        return json(res, 200, { available: true, commits, log, branch })
      } catch (err) {
        return json(res, 200, { available: false, branch, error: err.message })
      }
    }

    // ── Update (Admin) ─────────────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/update') {
      const user = requireAdmin(req, res); if (!user) return
      const { execFile } = await import('node:child_process')
      const fsp = await import('node:fs/promises')
      const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
      const distDir = path.join(repoDir, 'web-app', 'dist')
      const distNew = path.join(repoDir, 'web-app', 'dist-new')
      const distOld = path.join(repoDir, 'web-app', 'dist-old')
      const dbPath  = path.join(config.dataPath, 'luxstage.db')
      const dbSnap  = path.join(config.dataPath, 'luxstage-preupdate.db')

      const bodyJson = await readJsonBody(req, res); if (bodyJson === null) return
      const branch = bodyJson.branch || 'main'
      if (!/^[a-zA-Z0-9_./-]+$/.test(branch)) return json(res, 400, { error: 'Ungültiger Branch-Name' })

      // SSE-Stream öffnen
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      })
      const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

      // nvm-Pfad ermitteln damit npm in non-login shells verfügbar ist
      const nvmDir = process.env.NVM_DIR || path.join(process.env.HOME, '.nvm')
      const nvmInit = `export NVM_DIR="${nvmDir}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"`
      const run = (cmd, env = {}) => new Promise((resolve, reject) => {
        execFile('/bin/bash', ['-c', `${nvmInit} && ${cmd}`], { maxBuffer: 10 * 1024 * 1024, env: { ...process.env, ...env } }, (err, stdout, stderr) => {
          if (err) { err.stderr = stderr; reject(err) } else { resolve(stdout) }
        })
      })

      let oldCommit = ''
      const log = []
      const step = (msg) => { log.push(msg); console.log('[update]', msg); send('log', { msg }) }

      const rollback = async (reason) => {
        step(`Rollback: ${reason}`)
        try { await run('git -C "$REPO_DIR" reset --hard "$OLD_COMMIT"', { REPO_DIR: repoDir, OLD_COMMIT: oldCommit }) } catch {}
        try { await fsp.rm(distNew, { recursive: true, force: true }) } catch {}
        try {
          const distOldExists = await fsp.access(distOld).then(() => true).catch(() => false)
          if (distOldExists) {
            await fsp.rm(distDir, { recursive: true, force: true }).catch(() => {})
            await fsp.rename(distOld, distDir)
          }
        } catch {}
        send('done', { error: reason, log })
        res.end()
      }

      const baseEnv = { REPO_DIR: repoDir, TARGET_BRANCH: branch }
      try {
        // 1. Git-Konfiguration sicherstellen (einmalig, Pi hat ggf. keine Identität)
        await run('git -C "$REPO_DIR" config pull.ff only', baseEnv).catch(() => {})
        await run('git -C "$REPO_DIR" config user.email "luxstage@localhost"', baseEnv).catch(() => {})
        await run('git -C "$REPO_DIR" config user.name "LuxStage"', baseEnv).catch(() => {})

        // 2. Aktuellen Commit merken
        oldCommit = (await run('git -C "$REPO_DIR" rev-parse HEAD', baseEnv)).trim()
        step(`Aktueller Commit: ${oldCommit.slice(0, 8)}`)

        // 3. DB-Snapshot (non-blocking, WAL-sicher)
        await run('cp "$DB_PATH" "$DB_SNAP"', { DB_PATH: dbPath, DB_SNAP: dbSnap })
        step('DB-Snapshot erstellt')

        // 4. Lokalen Branch auf Remote zurücksetzen (verhindert Divergenz durch Cherry-picks etc.)
        await run('git -C "$REPO_DIR" fetch --no-tags origin "$TARGET_BRANCH"', baseEnv)
        await run('git -C "$REPO_DIR" reset --hard "origin/$TARGET_BRANCH"', baseEnv)
        step(`git reset --hard origin/${branch}`)
        const pullOut = 'Reset auf Remote-Stand'
        step(`git pull (${branch}): ${pullOut}`)

        const newCommit = (await run('git -C "$REPO_DIR" rev-parse HEAD', baseEnv)).trim()
        if (newCommit === oldCommit) {
          step('Bereits aktuell')
        }

        // 4. Abhängigkeiten installieren
        await run('npm install --prefix "$REPO_DIR/server"', baseEnv)
        step('Server-Abhängigkeiten installiert')

        await run('npm install --include=dev --prefix "$REPO_DIR/web-app"', baseEnv)
        step('Web-App-Abhängigkeiten installiert')

        // 5. Build in dist-new (laufende dist/ bleibt unangetastet)
        await fsp.rm(distNew, { recursive: true, force: true }).catch(() => {})
        await run('cd "$REPO_DIR/web-app" && npm run build -- --outDir dist-new', { ...baseEnv, VITE_OUTDIR: 'dist-new' })
        step('Web-App gebaut')

        // Prüfen ob index.html im Build vorhanden (Minimalcheck)
        await fsp.access(path.join(distNew, 'index.html'))
        step('Build-Validierung OK')

        // 6. Atomarer dist-Tausch: dist → dist-old, dist-new → dist
        await fsp.rm(distOld, { recursive: true, force: true }).catch(() => {})
        const distExists = await fsp.access(distDir).then(() => true).catch(() => false)
        if (distExists) await fsp.rename(distDir, distOld)
        await fsp.rename(distNew, distDir)
        step('dist atomar ersetzt')

        // 7. dist-old + DB-Snapshot aufräumen
        fsp.rm(distOld, { recursive: true, force: true }).catch(() => {})
        fsp.unlink(dbSnap).catch(() => {})

        // 8. Erfolg senden, dann Neustart
        step('Neustart...')
        send('done', { log })
        res.end()
        setTimeout(() => process.exit(0), 500)

      } catch (err) {
        await rollback(err.message + (err.stderr ? '\n' + err.stderr : ''))
      }
      return
    }

    // ── Grundriss — Bild-Serving (öffentlich mit Token) ───────────────────────
    if (method === 'GET' && pathname.startsWith('/api/floorplans/images/')) {
      const user = requireAuth(req, res); if (!user) return
      const imgPath = pathname.replace('/api/floorplans/images/', '')
      const served = await floorplan.serveFloorplanImage(imgPath, res)
      if (!served) return notFound(res)
      return
    }

    // ── Template — Grundriss-Bild abrufen ─────────────────────────────────────
    if (method === 'GET' && pathname.match(/^\/api\/templates\/([^/]+)\/floorplan$/)) {
      const user = requireAuth(req, res); if (!user) return
      const templateName = decodeURIComponent(pathname.split('/')[3])
      const tpl = db.getTemplateByName(templateName)
      if (!tpl) return notFound(res)
      const fp = db.getTemplateFloorplan(tpl.id)
      return json(res, 200, { image_url: fp ? floorplan.floorplanUrl(fp.image_path) : null })
    }

    // ── Template — Grundriss-Bild hochladen ───────────────────────────────────
    if (method === 'POST' && pathname.match(/^\/api\/templates\/([^/]+)\/floorplan\/image$/)) {
      const user = requireAuth(req, res); if (!user) return
      const templateName = decodeURIComponent(pathname.split('/')[3])
      const tpl = db.getTemplateByName(templateName)
      if (!tpl) return notFound(res)
      let body
      try { body = await readBodyBuffer(req, 50 * 1024 * 1024) } catch {
        return json(res, 413, { error: 'Bild zu groß (max. 50 MB)' })
      }
      const ct = req.headers['content-type'] || ''
      const boundaryMatch = ct.match(/boundary=(.+)/)
      if (!boundaryMatch) return json(res, 400, { error: 'Kein Boundary' })
      const parts = photos.extractFileFromMultipart(body, boundaryMatch[1])
      const part = parts?.[0]
      if (!part?.data) return json(res, 400, { error: 'Kein Bild gefunden' })
      const mimeType = part.mimeType || mimeFromFilename(part.filename)
      try {
        const imgPath = await floorplan.saveFloorplanImage(tpl.id, part.filename, part.data, mimeType)
        db.upsertTemplateFloorplan(tpl.id, imgPath)
        return json(res, 200, { image_url: floorplan.floorplanUrl(imgPath) })
      } catch (e) {
        return json(res, 400, { error: e.message })
      }
    }

    // ── Template — Grundriss-Bild löschen ─────────────────────────────────────
    if (method === 'DELETE' && pathname.match(/^\/api\/templates\/([^/]+)\/floorplan\/image$/)) {
      const user = requireAuth(req, res); if (!user) return
      const templateName = decodeURIComponent(pathname.split('/')[3])
      const tpl = db.getTemplateByName(templateName)
      if (!tpl) return notFound(res)
      const fp = db.getTemplateFloorplan(tpl.id)
      if (fp?.image_path) await floorplan.deleteFloorplanImage(fp.image_path)
      db.upsertTemplateFloorplan(tpl.id, null)
      return json(res, 200, { ok: true })
    }

    // ── Show — Grundriss-Bild löschen ────────────────────────────────────────
    if (method === 'DELETE' && pathname.match(/^\/api\/shows\/([^/]+)\/floorplan\/image$/)) {
      const user = requireAuth(req, res); if (!user) return
      const showId = pathname.split('/')[3]
      const show = db.readShow(showId)
      if (!show) return notFound(res)
      const layer = db.getShowFloorplan(show.id)
      if (layer?.image_path) await floorplan.deleteFloorplanImage(layer.image_path)
      db.upsertShowFloorplanImage(show.id, null)
      return json(res, 200, { ok: true })
    }

    // ── Show — Grundriss-Bild hochladen ──────────────────────────────────────
    if (method === 'POST' && pathname.match(/^\/api\/shows\/([^/]+)\/floorplan\/image$/)) {
      const user = requireAuth(req, res); if (!user) return
      const showId = pathname.split('/')[3]
      const show = db.readShow(showId)
      if (!show) return notFound(res)
      let body
      try { body = await readBodyBuffer(req, 50 * 1024 * 1024) } catch {
        return json(res, 413, { error: 'Bild zu groß (max. 50 MB)' })
      }
      const ct = req.headers['content-type'] || ''
      const boundaryMatch = ct.match(/boundary=(.+)/)
      if (!boundaryMatch) return json(res, 400, { error: 'Kein Boundary' })
      const parts = photos.extractFileFromMultipart(body, boundaryMatch[1])
      const part = parts?.[0]
      if (!part?.data) return json(res, 400, { error: 'Kein Bild gefunden' })
      const mimeType = part.mimeType || mimeFromFilename(part.filename)
      try {
        const imgPath = await floorplan.saveFloorplanImage(show.id, part.filename, part.data, mimeType)
        db.upsertShowFloorplanImage(show.id, imgPath)
        return json(res, 200, { image_url: floorplan.floorplanUrl(imgPath) })
      } catch (e) {
        return json(res, 400, { error: e.message })
      }
    }

    // ── Show — Grundriss abrufen ───────────────────────────────────────────────
    if (method === 'GET' && pathname.match(/^\/api\/shows\/([^/]+)\/floorplan$/)) {
      const user = requireAuth(req, res); if (!user) return
      const showId = pathname.split('/')[3]
      const show = db.readShow(showId)
      if (!show) return notFound(res)
      const layer = db.getShowFloorplan(show.id)
      let imageUrl = null
      // Show-specific image takes priority over template image
      if (layer?.image_path) {
        imageUrl = floorplan.floorplanUrl(layer.image_path)
      } else if (show.template) {
        const tpl = db.getTemplateByName(show.template)
        if (tpl) {
          const fp = db.getTemplateFloorplan(tpl.id)
          if (fp?.image_path) imageUrl = floorplan.floorplanUrl(fp.image_path)
        }
      }
      return json(res, 200, { image_url: imageUrl, canvas_data: layer?.canvas_data ?? null })
    }

    // ── Show — Grundriss-Canvas speichern ────────────────────────────────────
    if (method === 'PUT' && pathname.match(/^\/api\/shows\/([^/]+)\/floorplan$/)) {
      const user = requireAuth(req, res); if (!user) return
      const showId = pathname.split('/')[3]
      const show = db.readShow(showId)
      if (!show) return notFound(res)
      const body = await readJsonBody(req, res); if (body === null) return
      const { canvas_data } = body
      if (typeof canvas_data !== 'string') return json(res, 400, { error: 'canvas_data fehlt' })
      db.upsertShowFloorplanData(show.id, canvas_data)
      return json(res, 200, { ok: true })
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

