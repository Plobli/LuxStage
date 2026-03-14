import jwt from 'jsonwebtoken'
import { config } from './config.js'

export function login(username, password) {
  const user = config.users.find(u => u.username === username && u.password === password)
  if (!user) return null
  return jwt.sign({ username: user.username, role: user.role }, config.jwtSecret, { expiresIn: '7d' })
}

export function authenticate(req) {
  const header = req.headers['authorization'] || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
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
