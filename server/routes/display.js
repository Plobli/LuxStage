import { readJsonBody, json } from '../helpers.js'
import { dbContainer } from '../db-init.js'

const VALID_UNITS = ['m', 'cm', 'mm']

function getUnit() {
  const row = dbContainer.db.prepare("SELECT value FROM settings WHERE key = 'display.measure_unit'").get()
  return row?.value ?? 'm'
}

export async function displayRoutes(req, res, pathname) {
  const { method } = req

  if (pathname === '/api/settings/display') {
    if (method === 'GET') {
      return json(res, 200, { measure_unit: getUnit() })
    }
    if (method === 'POST') {
      const body = await readJsonBody(req, res); if (body === null) return
      const unit = body.measure_unit
      if (!VALID_UNITS.includes(unit)) return json(res, 400, { error: 'Ungültige Einheit' })
      dbContainer.db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .run('display.measure_unit', unit)
      return json(res, 200, { ok: true })
    }
  }

  return null
}

export { getUnit as getDisplayUnit }
