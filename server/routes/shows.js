import * as db from '../db.js'
import { requireAdmin } from '../auth.js'
import { readJsonBody, json, notFound } from '../helpers.js'
import { subscribe, broadcast, getPresence } from '../sse.js'

const SHOW_LIST     = /^\/api\/shows$/
const SHOW_ARCHIVED = /^\/api\/shows\/archived$/
const SHOW_ID       = /^\/api\/shows\/([^/]+)$/
const SHOW_META     = /^\/api\/shows\/([^/]+)\/meta$/
const SHOW_RESTORE  = /^\/api\/shows\/([^/]+)\/restore$/
const SHOW_PERM     = /^\/api\/shows\/([^/]+)\/permanent$/
const SHOW_LOCK     = /^\/api\/shows\/([^/]+)\/lock$/
const SHOW_EVENTS   = /^\/api\/shows\/([^/]+)\/events$/
const SHOW_PRESENCE = /^\/api\/shows\/([^/]+)\/presence$/

export async function showRoutes(req, res, pathname, params) {
  const { method } = req
  let m

  if (method === 'GET' && SHOW_LIST.test(pathname)) {
    const shows = db.listShows()
    return json(res, 200, shows.map(({ id: _id, ...s }) => ({ id: s.slug, ...s })))
  }

  if (method === 'GET' && SHOW_ARCHIVED.test(pathname)) {
    const user = req.user
    const shows = db.listArchivedShows()
    return json(res, 200, shows.map(({ id: _id, ...s }) => ({ id: s.slug, ...s })))
  }

  if (method === 'POST' && SHOW_LIST.test(pathname)) {
    const user = req.user
    const body = await readJsonBody(req, res); if (body === null) return
    const { id, name, datum, template, untertitel, spielzeit, channels } = body
    if (!id || !/^[a-z0-9_-]+$/i.test(id)) return json(res, 400, { error: 'Ungültige ID' })
    db.createShow(id, { name, datum, template, untertitel, spielzeit })
    if (Array.isArray(channels) && channels.length) db.writeChannels(id, channels)
    return json(res, 201, { id })
  }

  if (m = SHOW_META.exec(pathname)) {
    const slug = m[1]
    if (method === 'PUT') {
      const user = req.user
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
  }

  if (m = SHOW_RESTORE.exec(pathname)) {
    const slug = m[1]
    if (method === 'POST') {
      const user = req.user
      db.restoreShow(slug)
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_PERM.exec(pathname)) {
    const slug = m[1]
    if (method === 'DELETE') {
      const user = requireAdmin(req, res); if (!user) return
      db.deleteShow(slug)
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_LOCK.exec(pathname)) {
    const slug = m[1]
    if (method === 'POST') {
      const user = req.user
      const result = db.acquireLock(slug, user.username)
      return json(res, result.ok ? 200 : 423, result)
    }
    if (method === 'DELETE') {
      const user = req.user
      db.releaseLock(slug, user.username)
      return json(res, 200, { ok: true })
    }
    if (method === 'PUT') {
      const user = req.user
      db.touchLock(slug, user.username)
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_EVENTS.exec(pathname)) {
    if (method === 'GET') {
      const user = req.user
      const id = m[1]
      const device = params.device || 'web'
      subscribe(id, res, user.username, device, db.getChecks)
      return
    }
  }

  if (m = SHOW_PRESENCE.exec(pathname)) {
    if (method === 'GET') {
      return json(res, 200, { users: getPresence(m[1]) })
    }
  }

  if (m = SHOW_ID.exec(pathname)) {
    const slug = m[1]
    if (method === 'GET') {
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
    if (method === 'DELETE') {
      db.archiveShow(slug)
      return json(res, 200, { ok: true })
    }
  }

  return null
}
