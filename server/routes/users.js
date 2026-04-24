import { randomBytes } from 'node:crypto'
import * as db from '../db.js'
import { requireAdmin } from '../auth.js'
import { readJsonBody, json } from '../helpers.js'
import { sendWelcomeEmail } from '../email.js'

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
    const { username, role } = body
    if (!username || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) return json(res, 400, { error: 'Ungültige E-Mail-Adresse' })
    if (!['admin', 'techniker'].includes(role)) return json(res, 400, { error: 'Ungültige Rolle' })
    const password = randomBytes(8).toString('hex')
    await db.createUser(username, password, role, username)
    sendWelcomeEmail(username, username, password).catch(err => console.error('[email] Willkommens-Email fehlgeschlagen:', err))
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
