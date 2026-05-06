import * as db from '../db.js'
import { readJsonBody, json } from '../helpers.js'
import { broadcast } from '../sse.js'

const SHOW_TOWERS      = /^\/api\/shows\/([^/]+)\/towers$/
const SHOW_TOWER       = /^\/api\/shows\/([^/]+)\/towers\/([^/]+)$/
const SHOW_TOWER_SLOT  = /^\/api\/shows\/([^/]+)\/towers\/([^/]+)\/slots\/(\d+)$/

export async function towerRoutes(req, res, pathname) {
  const { method } = req
  let m

  if (m = SHOW_TOWERS.exec(pathname)) {
    const slug = m[1]
    if (method === 'GET') {
      return json(res, 200, db.readTowers(slug))
    }
    if (method === 'POST') {
      const body = await readJsonBody(req, res); if (body === null) return
      const towerId = db.writeTower(slug, body)
      db.ensureTowerSlots(towerId, body.slot_count ?? 4)
      broadcast(slug, 'towers-updated', {})
      return json(res, 201, { id: towerId })
    }
  }

  if (m = SHOW_TOWER.exec(pathname)) {
    const slug = m[1]
    const towerId = m[2]
    if (method === 'PUT') {
      const body = await readJsonBody(req, res); if (body === null) return
      db.writeTower(slug, { ...body, id: towerId })
      db.ensureTowerSlots(towerId, body.slot_count ?? 4)
      broadcast(slug, 'towers-updated', {})
      return json(res, 200, { ok: true })
    }
    if (method === 'DELETE') {
      db.deleteTower(towerId)
      broadcast(slug, 'towers-updated', {})
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_TOWER_SLOT.exec(pathname)) {
    const slug = m[1]
    const towerId = m[2]
    const slotIndex = parseInt(m[3])
    if (method === 'PATCH') {
      const body = await readJsonBody(req, res); if (body === null) return
      const { channelId } = body
      if (channelId) {
        db.writeTowerSlot(towerId, slotIndex, channelId)
      } else {
        db.clearTowerSlot(towerId, slotIndex)
      }
      broadcast(slug, 'towers-updated', {})
      return json(res, 200, { ok: true })
    }
  }

  return null
}
