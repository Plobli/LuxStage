import { randomBytes } from 'node:crypto'
import { login, signToken, requireAdmin, issueDownloadToken } from '../auth.js'
import * as db from '../db.js'
import { readJsonBody, json } from '../helpers.js'
import { sendPasswordResetEmail } from '../email.js'

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

export async function authRoutes(req, res, pathname) {
  const { method } = req

  if (method === 'POST' && pathname === '/api/auth/login') {
    let ip = req.socket.remoteAddress || 'unknown'
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

  if (method === 'POST' && pathname === '/api/auth/refresh') {
    const user = req.user
    return json(res, 200, { token: signToken(user.username, user.role) })
  }

  if (method === 'POST' && pathname === '/api/auth/download-token') {
    const user = req.user
    return json(res, 200, { token: issueDownloadToken(user.username, user.role) })
  }

  if (method === 'POST' && pathname === '/api/auth/change-password') {
    const user = req.user
    const body = await readJsonBody(req, res); if (body === null) return
    const { currentPassword, newPassword } = body
    if (!newPassword || newPassword.length < 8) return json(res, 400, { error: 'Passwort zu kurz (min. 8 Zeichen)' })
    const storedPassword = db.getDbPassword(user.username)
    const pwOk = storedPassword?.startsWith('$2')
      ? await (await import('bcrypt')).compare(currentPassword, storedPassword)
      : currentPassword === storedPassword
    if (!pwOk) return json(res, 403, { error: 'Aktuelles Passwort falsch' })
    await db.changePassword(user.username, newPassword, 0)
    return json(res, 200, { ok: true })
  }

  if (method === 'POST' && pathname === '/api/auth/reset-password') {
    const admin = requireAdmin(req, res); if (!admin) return
    const body = await readJsonBody(req, res); if (body === null) return
    const { username } = body
    const allUsers = db.listUsers()
    if (!allUsers.find(u => u.username === username)) return json(res, 404, { error: 'Benutzer nicht gefunden' })
    const newPassword = randomBytes(6).toString('hex')
    await db.changePassword(username, newPassword, 1)
    const email = db.getUserEmail(username)
    if (email) {
      sendPasswordResetEmail(email, username, newPassword).catch(err => console.error('[email] Reset-Email fehlgeschlagen:', err))
    }
    return json(res, 200, { newPassword })
  }

  return null
}
