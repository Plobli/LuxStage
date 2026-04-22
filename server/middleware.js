import { readJsonBody, json } from './helpers.js'
import { requireAuth, requireAdmin } from './auth.js'

// Rate Limiter for login attempts
const loginAttempts = new Map()
const MAX_LOGIN_ATTEMPTS = 10
const LOGIN_WINDOW_MS = 15 * 60 * 1000

function isRateLimited(ip) {
  const now = Date.now()
  const entry = loginAttempts.get(ip)
  if (!entry) return false
  if (now - entry.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(ip)
    return false
  }
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

function extractIp(req) {
  let ip = req.socket.remoteAddress || 'unknown'
  if ((ip === '127.0.0.1' || ip === '::1') && req.headers['x-forwarded-for']) {
    ip = req.headers['x-forwarded-for'].split(',')[0].trim()
  }
  return ip
}

export async function auth(req, res, next) {
  const user = requireAuth(req, res)
  if (!user) return
  req.user = user
  await next()
}

export async function admin(req, res, next) {
  const user = requireAdmin(req, res)
  if (!user) return
  req.user = user
  await next()
}

export async function parseJson(req, res, next) {
  const body = await readJsonBody(req, res)
  if (body === null) return
  req.body = body
  await next()
}

export function loginRateLimit(req, res, next) {
  const ip = extractIp(req)
  if (isRateLimited(ip)) {
    return json(res, 429, { error: 'Zu viele Versuche. Bitte warten.' })
  }
  req.recordFailedLogin = () => recordFailedLogin(ip)
  return next()
}
