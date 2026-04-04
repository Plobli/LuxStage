import jwt from 'jsonwebtoken'
import { config } from './config.js'
import { db } from './db-init.js'

export function login(username, password) {
  // DB-User (dynamisch angelegt) haben Vorrang vor Env-Usern
  const dbRow = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
  if (dbRow) {
    if (dbRow.password !== password) return null
    return jwt.sign({ username: dbRow.username, role: dbRow.role }, config.jwtSecret, { expiresIn: '7d' })
  }
  // Fallback: Env-User
  const user = config.users.find(u => u.username === username)
  if (!user) return null
  if (user.password !== password) return null
  return jwt.sign({ username: user.username, role: user.role }, config.jwtSecret, { expiresIn: '7d' })
}

export function authenticate(req) {
  const header = req.headers['authorization'] || ''
  let token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    // Fallback: ?token= query param (für SSE, PDF, Foto- und Backup-URLs)
    const url = new URL(req.url, 'http://localhost')
    token = url.searchParams.get('token')
  }
  if (!token) return null
  try {
    return jwt.verify(token, config.jwtSecret)
  } catch {
    return null
  }
}

export function requireAuth(req, res) {
  const user = authenticate(req)
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Nicht angemeldet' }))
    return null
  }
  return user
}

export function requireAdmin(req, res) {
  const user = requireAuth(req, res)
  if (!user) return null
  if (user.role !== 'admin') {
    res.writeHead(403, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Keine Berechtigung' }))
    return null
  }
  return user
}
