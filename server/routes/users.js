import * as db from '../db.js'
import { requireAdmin } from '../auth.js'
import { readJsonBody, json } from '../helpers.js'

const USER_ID = /^\/api\/users\/([^/]+)$/

export async function userRoutes(req, res, pathname) {
  const { method } = req

  if (method === 'GET' && pathname === '/api/users') {
    const admin = requireAdmin(req, res); if (!admin) return
    return json(res, 200, db.listUsers())
  }

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

  let m
  if (method === 'DELETE' && (m = USER_ID.exec(pathname))) {
    const admin = requireAdmin(req, res); if (!admin) return
    const username = m[1]
    if (username === admin.username) return json(res, 400, { error: 'Eigenen Account kann man nicht löschen' })
    db.deleteUser(username)
    return json(res, 200, { ok: true })
  }

  return null
}
