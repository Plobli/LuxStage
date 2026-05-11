import * as db from '../db.js'
import { readJsonBody, json } from '../helpers.js'
import { broadcast } from '../sse.js'

const SHOW_BARS         = /^\/api\/shows\/([^/]+)\/bars$/
const SHOW_BARS_REORDER = /^\/api\/shows\/([^/]+)\/bars\/reorder$/
const SHOW_BAR          = /^\/api\/shows\/([^/]+)\/bars\/([^/]+)$/
const SHOW_BAR_FIXTURE  = /^\/api\/shows\/([^/]+)\/bars\/([^/]+)\/fixtures$/
const SHOW_BAR_FIX_DEL  = /^\/api\/shows\/([^/]+)\/bars\/([^/]+)\/fixtures\/([^/]+)$/

export async function barRoutes(req, res, pathname) {
  const { method } = req
  let m

  if (m = SHOW_BARS.exec(pathname)) {
    const slug = m[1]
    if (method === 'GET') return json(res, 200, db.readBars(slug))
    if (method === 'POST') {
      const body = await readJsonBody(req, res); if (body === null) return
      const barId = db.writeBar(slug, body)
      broadcast(slug, 'bars-updated', {})
      return json(res, 201, { id: barId })
    }
  }

  if (m = SHOW_BARS_REORDER.exec(pathname)) {
    const slug = m[1]
    if (method === 'PUT') {
      const body = await readJsonBody(req, res); if (body === null) return
      db.reorderBars(slug, body.order ?? [])
      broadcast(slug, 'bars-updated', {})
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_BAR.exec(pathname)) {
    const slug = m[1]; const barId = m[2]
    if (method === 'PUT') {
      const body = await readJsonBody(req, res); if (body === null) return
      db.writeBar(slug, { ...body, id: barId })
      broadcast(slug, 'bars-updated', {})
      return json(res, 200, { ok: true })
    }
    if (method === 'DELETE') {
      db.deleteBar(barId)
      broadcast(slug, 'bars-updated', {})
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_BAR_FIXTURE.exec(pathname)) {
    const slug = m[1]; const barId = m[2]
    if (method === 'POST') {
      const body = await readJsonBody(req, res); if (body === null) return
      const { channelId, position } = body
      if (!channelId) return json(res, 400, { error: 'channelId erforderlich' })
      db.writeBarFixture(barId, channelId, position ?? 0)
      broadcast(slug, 'bars-updated', {})
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_BAR_FIX_DEL.exec(pathname)) {
    const slug = m[1]; const barId = m[2]; const channelId = m[3]
    if (method === 'DELETE') {
      db.removeBarFixture(barId, channelId)
      broadcast(slug, 'bars-updated', {})
      return json(res, 200, { ok: true })
    }
  }

  return null
}
