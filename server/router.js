import { readFileSync } from 'node:fs'
import { readBody, readJsonBody, json, send, notFound, parseUrl } from './helpers.js'
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)))
import { login, signToken, requireAuth, requireAdmin } from './auth.js'
import * as db from './db.js'
import { randomBytes } from 'node:crypto'
import { listHistory, getHistoryEntry, restoreHistoryEntry } from './history.js'
import * as photos from './photos.js'
import { subscribe, broadcast, getPresence } from './sse.js'
import { streamBackup, restoreBackup } from './backup.js'
import { generatePDF } from './pdf.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { config } from './config.js'

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
      const ip = (req.headers['x-forwarded-for']?.split(',')[0].trim()) || req.socket.remoteAddress || 'unknown'
      if (isRateLimited(ip)) return json(res, 429, { error: 'Zu viele Versuche. Bitte warten.' })
      const body = await readJsonBody(req, res); if (body === null) return
      const { username, password } = body
      const token = await login(username, password)
      if (!token) { recordFailedLogin(ip); return json(res, 401, { error: 'Ungültige Anmeldedaten' }) }
      return json(res, 200, { token })
    }

    // ── Auth — Token erneuern ─────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/auth/refresh') {
      const user = requireAuth(req, res); if (!user) return
      return json(res, 200, { token: signToken(user.username, user.role) })
    }

    // ── Auth — Passwort ändern ─────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/auth/change-password') {
      const user = requireAuth(req, res); if (!user) return
      const body = await readJsonBody(req, res); if (body === null) return
      const { currentPassword, newPassword } = body
      if (!newPassword || newPassword.length < 8) return json(res, 400, { error: 'Passwort zu kurz (min. 8 Zeichen)' })
      // Aktuelles Passwort prüfen
      const configUser = config.users.find(u => u.username === user.username)
      const storedPassword = db.getDbPassword(user.username) ?? configUser?.password
      const pwOk = storedPassword?.startsWith('$2')
        ? await (await import('bcrypt')).compare(currentPassword, storedPassword)
        : currentPassword === storedPassword
      if (!pwOk) return json(res, 403, { error: 'Aktuelles Passwort falsch' })
      await db.changePassword(user.username, newPassword)
      return json(res, 200, { ok: true })
    }

    // ── Auth — Passwort zurücksetzen (nur Admin) ───────────────────────────
    if (method === 'POST' && pathname === '/api/auth/reset-password') {
      const admin = requireAdmin(req, res); if (!admin) return
      const body = await readJsonBody(req, res); if (body === null) return
      const { username } = body
      const allUsers = db.listUsers(config.users)
      if (!allUsers.find(u => u.username === username)) return json(res, 404, { error: 'Benutzer nicht gefunden' })
      const newPassword = randomBytes(6).toString('hex')
      await db.changePassword(username, newPassword)
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
      const isEnvOnly = !db.getDbPassword(username) && config.users.find(u => u.username === username)
      if (isEnvOnly) return json(res, 422, { error: 'Env-User können nur über die Serverkonfiguration entfernt werden' })
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
      const saved = []
      for (const part of parts) {
        const name = await photos.savePhoto(id, part.filename, part.data)
        saved.push(name)
      }
      return json(res, 201, { saved })
    }

    // ── Fotos — Löschen ────────────────────────────────────────────────────
    if (method === 'DELETE' && pathname.match(/^\/api\/shows\/([^/]+)\/photos\/(.+)$/)) {
      const user = requireAdmin(req, res); if (!user) return
      const parts = pathname.split('/')
      const id = parts[3], filename = parts[5]
      await photos.deletePhoto(id, filename)
      db.deletePhotoDescription(id, filename)
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
      const body = await readJsonBody(req, res); if (body === null) return
      const { caption } = body
      db.writePhotoDescription(id, filename, caption ?? '')
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
      const body = await readJsonBody(req, res); if (body === null) return
      const { sections } = body
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
      const sections = await readJsonBody(req, res); if (sections === null) return
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
      const user = requireAdmin(req, res); if (!user) return
      const slug = pathname.split('/')[3]
      const body = await readJsonBody(req, res); if (body === null) return
      const { sections } = body
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
      const photoFilenames = await photos.listPhotos(slug)
      const captionsMap = db.readPhotoDescriptions(slug)
      const photoEntries = photoFilenames.map(f => ({
        path: photos.getPhotoPath(slug, f),
        caption: captionsMap[f] ?? '',
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
      const run = (cmd) => new Promise((resolve, reject) => {
        execFile('/bin/bash', ['-c', `${nvmInit} && ${cmd}`], { maxBuffer: 1024 * 1024 }, (err, stdout) => {
          if (err) { reject(err) } else { resolve(stdout.trim()) }
        })
      })
      try {
        await run(`git -C "${repoDir}" fetch --prune --quiet`)
        const out = await run(`git -C "${repoDir}" branch -r`)
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
      const run = (cmd) => new Promise((resolve, reject) => {
        execFile('/bin/bash', ['-c', `${nvmInit} && ${cmd}`], { maxBuffer: 1024 * 1024 }, (err, stdout) => {
          if (err) { reject(err) } else { resolve(stdout.trim()) }
        })
      })
      const branch = params.branch || 'main'
      if (!/^[a-zA-Z0-9_./-]+$/.test(branch)) return json(res, 400, { error: 'Ungültiger Branch-Name' })
      try {
        await run(`git -C "${repoDir}" fetch --no-tags origin "${branch}" --quiet`)
        const behind = await run(`git -C "${repoDir}" rev-list HEAD..origin/${branch} --count`)
        const commits = parseInt(behind, 10)
        if (commits === 0) return json(res, 200, { available: false, branch })
        const log = await run(`git -C "${repoDir}" log HEAD..origin/${branch} --oneline --no-decorate`)
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

      // nvm-Pfad ermitteln damit npm in non-login shells verfügbar ist
      const nvmDir = process.env.NVM_DIR || path.join(process.env.HOME, '.nvm')
      const nvmInit = `export NVM_DIR="${nvmDir}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"`
      const run = (cmd) => new Promise((resolve, reject) => {
        execFile('/bin/bash', ['-c', `${nvmInit} && ${cmd}`], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
          if (err) { err.stderr = stderr; reject(err) } else { resolve(stdout) }
        })
      })

      let oldCommit = ''
      const log = []
      const step = (msg) => { log.push(msg); console.log('[update]', msg) }

      const rollback = async (reason) => {
        step(`Rollback: ${reason}`)
        try { await run(`git -C "${repoDir}" reset --hard "${oldCommit}"`) } catch {}
        // dist-new aufräumen falls vorhanden
        try { await fsp.rm(distNew, { recursive: true, force: true }) } catch {}
        // dist-old zurückspielen falls dist durch den Update-Prozess bereits verschoben wurde
        try {
          const distOldExists = await fsp.access(distOld).then(() => true).catch(() => false)
          if (distOldExists) {
            await fsp.rm(distDir, { recursive: true, force: true }).catch(() => {})
            await fsp.rename(distOld, distDir)
          }
        } catch {}
        json(res, 500, { error: reason, log })
      }

      try {
        // 1. Git-Konfiguration sicherstellen (einmalig, Pi hat ggf. keine Identität)
        await run(`git -C "${repoDir}" config pull.ff only`).catch(() => {})
        await run(`git -C "${repoDir}" config user.email "luxstage@localhost"`).catch(() => {})
        await run(`git -C "${repoDir}" config user.name "LuxStage"`).catch(() => {})

        // 2. Aktuellen Commit merken
        oldCommit = (await run(`git -C "${repoDir}" rev-parse HEAD`)).trim()
        step(`Aktueller Commit: ${oldCommit.slice(0, 8)}`)

        // 3. DB-Snapshot (non-blocking, WAL-sicher)
        await run(`cp "${dbPath}" "${dbSnap}"`)
        step('DB-Snapshot erstellt')

        // 4. Lokalen Branch auf Remote zurücksetzen (verhindert Divergenz durch Cherry-picks etc.)
        await run(`git -C "${repoDir}" fetch --no-tags origin "${branch}"`)
        await run(`git -C "${repoDir}" reset --hard "origin/${branch}"`)
        step(`git reset --hard origin/${branch}`)
        const pullOut = 'Reset auf Remote-Stand'
        step(`git pull (${branch}): ${pullOut}`)

        const newCommit = (await run(`git -C "${repoDir}" rev-parse HEAD`)).trim()
        if (newCommit === oldCommit) {
          step('Bereits aktuell')
        }

        // 4. Abhängigkeiten installieren
        await run(`npm install --prefix "${repoDir}/server"`)
        step('Server-Abhängigkeiten installiert')

        await run(`npm install --include=dev --prefix "${repoDir}/web-app"`)
        step('Web-App-Abhängigkeiten installiert')

        // 5. Build in dist-new (laufende dist/ bleibt unangetastet)
        await fsp.rm(distNew, { recursive: true, force: true }).catch(() => {})
        const buildEnv = { ...process.env, VITE_OUTDIR: 'dist-new' }
        await new Promise((resolve, reject) => {
          execFile('/bin/bash', ['-c',
            `${nvmInit} && cd "${repoDir}/web-app" && npm run build -- --outDir dist-new`
          ], { env: buildEnv, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) { err.stderr = stderr; reject(err) } else { resolve(stdout) }
          })
        })
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

        // 8. Antwort senden, dann Neustart (erfordert PM2)
        if (!process.env.pm_id) step('WARNUNG: Kein PM2 erkannt — manueller Neustart erforderlich!')
        json(res, 200, { log })
        step('Neustart...')
        setTimeout(() => process.exit(0), 500)

      } catch (err) {
        await rollback(err.message + (err.stderr ? '\n' + err.stderr : ''))
      }
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

