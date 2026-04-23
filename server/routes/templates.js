import { randomUUID } from 'node:crypto'
import * as db from '../db.js'
import * as floorplan from '../floorplan.js'
import * as photosLib from '../photos.js'
import { requireAdmin } from '../auth.js'
import { readJsonBody, readBodyBuffer, json, notFound } from '../helpers.js'

const TPL_LIST        = /^\/api\/templates$/
const TPL_CHANNELS    = /^\/api\/templates\/([^/]+)\/channels$/
const TPL_SECTIONS    = /^\/api\/templates\/([^/]+)\/sections$/
const TPL_FP          = /^\/api\/templates\/([^/]+)\/floorplan$/
const TPL_FP_IMAGE    = /^\/api\/templates\/([^/]+)\/floorplan\/image$/
const TPL_ID          = /^\/api\/templates\/(.+)$/

function mimeFromFilename(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase()
  return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }['.' + ext]
    || 'application/octet-stream'
}

export async function templateRoutes(req, res, pathname) {
  const { method } = req
  let m

  if (method === 'GET' && TPL_LIST.test(pathname)) {
    return json(res, 200, db.listTemplates())
  }

  if (m = TPL_FP_IMAGE.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    const tpl = db.getTemplateByName(templateName)
    if (!tpl) return notFound(res)

    if (method === 'POST') {
      let body
      try { body = await readBodyBuffer(req, 50 * 1024 * 1024) } catch {
        return json(res, 413, { error: 'Bild zu groß (max. 50 MB)' })
      }
      const ct = req.headers['content-type'] || ''
      const boundaryMatch = ct.match(/boundary=(.+)/)
      if (!boundaryMatch) return json(res, 400, { error: 'Kein Boundary' })
      const parts = photosLib.extractFileFromMultipart(body, boundaryMatch[1])
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

    if (method === 'DELETE') {
      const fp = db.getTemplateFloorplan(tpl.id)
      if (fp?.image_path) await floorplan.deleteFloorplanImage(fp.image_path)
      db.upsertTemplateFloorplan(tpl.id, null)
      return json(res, 200, { ok: true })
    }
  }

  if (m = TPL_FP.exec(pathname)) {
    if (method === 'GET') {
      const templateName = decodeURIComponent(m[1])
      const tpl = db.getTemplateByName(templateName)
      if (!tpl) return notFound(res)
      const fp = db.getTemplateFloorplan(tpl.id)
      return json(res, 200, { image_url: fp ? floorplan.floorplanUrl(fp.image_path) : null })
    }
  }

  if (m = TPL_CHANNELS.exec(pathname)) {
    const name = decodeURIComponent(m[1])
    if (method === 'GET') {
      const channels = db.readTemplate(name).map(({ template_id: _, sort_order: __, ...ch }) => ch)
      return json(res, 200, channels)
    }
  }

  if (m = TPL_SECTIONS.exec(pathname)) {
    const name = decodeURIComponent(m[1])
    if (method === 'GET') {
      return json(res, 200, db.readTemplateSections(name))
    }
    if (method === 'PUT') {
      const user = requireAdmin(req, res); if (!user) return
      const body = await readJsonBody(req, res); if (body === null) return
      db.writeTemplateSections(name, body.sections)
      return json(res, 200, { ok: true })
    }
  }

  if (m = TPL_ID.exec(pathname)) {
    const name = decodeURIComponent(m[1])
    if (!/^[a-zA-Z0-9_\- ]{1,100}$/.test(name)) return json(res, 400, { error: 'Ungültiger Template-Name' })

    if (method === 'GET') {
      const channels = db.readTemplate(name).map(({ template_id: _, sort_order: __, ...ch }) => ch)
      return json(res, 200, channels)
    }
    if (method === 'PUT') {
      const user = requireAdmin(req, res); if (!user) return
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
    if (method === 'DELETE') {
      const user = requireAdmin(req, res); if (!user) return
      db.deleteTemplate(name)
      db.deleteTemplateSections(name)
      return json(res, 200, { ok: true })
    }
  }

  return null
}
