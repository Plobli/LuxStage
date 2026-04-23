import * as db from '../db.js'
import { readJsonBody, json } from '../helpers.js'
import { broadcast } from '../sse.js'

const SHOW_CHANNELS = /^\/api\/shows\/([^/]+)\/channels$/
const SHOW_CHECKS   = /^\/api\/shows\/([^/]+)\/checks$/

export async function channelRoutes(req, res, pathname) {
  const { method } = req
  let m

  if (m = SHOW_CHANNELS.exec(pathname)) {
    const slug = m[1]
    if (method === 'GET') {
      const user = req.user
      const channels = db.readChannels(slug).map(({ show_id: _, sort_order: __, ...ch }) => ch)
      return json(res, 200, channels)
    }
    if (method === 'PUT') {
      const user = req.user
      const channels = await readJsonBody(req, res); if (channels === null) return
      db.writeChannels(slug, channels, user.username)
      broadcast(slug, 'channels-updated', { updatedBy: user.username })
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_CHECKS.exec(pathname)) {
    const slug = m[1]
    if (method === 'GET') {
      const user = req.user
      return json(res, 200, { checks: db.getChecks(slug) })
    }
    if (method === 'DELETE') {
      const user = req.user
      db.clearChecks(slug)
      broadcast(slug, 'checks-updated', { checks: [] })
      return json(res, 200, { ok: true })
    }
    if (method === 'PATCH') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const { channelId, checked } = body
      if (!channelId || typeof checked !== 'boolean') return json(res, 400, { error: 'channelId und checked erforderlich' })
      db.setCheck(slug, channelId, checked, user.username)
      broadcast(slug, 'checks-updated', { checks: db.getChecks(slug) })
      return json(res, 200, { ok: true })
    }
  }

  return null
}
