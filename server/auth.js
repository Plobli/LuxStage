import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { config } from './config.js'
import { db } from './db-init.js'
import { randomBytes } from 'node:crypto'

// ── Kurzlebige Einmal-Token für URL-basierte Ressourcen (PDF, Fotos, Backup) ──
// Speichert: token → { username, role, expiresAt }
const downloadTokens = new Map()
const DOWNLOAD_TOKEN_TTL_MS = 60 * 1000 // 60 Sekunden

export function issueDownloadToken(username, role) {
  const token = randomBytes(24).toString('hex')
  downloadTokens.set(token, { username, role, expiresAt: Date.now() + DOWNLOAD_TOKEN_TTL_MS })
  return token
}

// Abgelaufene Token periodisch bereinigen (verhindert Memory-Leak bei abgebrochenen Downloads)
setInterval(() => {
  const now = Date.now()
  for (const [token, entry] of downloadTokens) {
    if (now > entry.expiresAt) downloadTokens.delete(token)
  }
}, 60_000)

function redeemDownloadToken(token) {
  const entry = downloadTokens.get(token)
  if (!entry) return null
  downloadTokens.delete(token) // Einmalnutzung
  if (Date.now() > entry.expiresAt) return null
  return { username: entry.username, role: entry.role }
}

const BCRYPT_COST = 12

export async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_COST)
}

async function verifyPassword(plain, stored) {
  // Klartext-Migration: gespeichertes Passwort ist noch kein bcrypt-Hash
  if (!stored.startsWith('$2')) {
    if (plain !== stored) return false
    return true // caller must rehash
  }
  return bcrypt.compare(plain, stored)
}

export function signToken(username, role) {
  return jwt.sign({ username, role }, config.jwtSecret, { expiresIn: '72h' })
}

export async function login(username, password) {
  // DB-User (dynamisch angelegt) haben Vorrang vor Env-Usern
  const dbRow = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
  if (dbRow) {
    const ok = await verifyPassword(password, dbRow.password)
    if (!ok) return null
    // Klartext-Migration: bei Erfolg sofort hashen
    if (!dbRow.password.startsWith('$2')) {
      const hash = await hashPassword(password)
      db.prepare('UPDATE users SET password = ? WHERE username = ?').run(hash, dbRow.username)
    }
    return signToken(dbRow.username, dbRow.role)
  }
  // Fallback: Env-User
  const user = config.users.find(u => u.username === username)
  if (!user) return null
  const envOk = await verifyPassword(password, user.password)
  if (!envOk) return null
  // Klartext-Migration: Env-User-Passwort beim ersten Login in DB hashen
  if (!user.password.startsWith('$2')) {
    const hash = await hashPassword(password)
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?) ON CONFLICT(username) DO UPDATE SET password = excluded.password, role = excluded.role')
      .run(user.username, hash, user.role)
    // Klartext aus dem In-Memory-Config-Objekt entfernen
    user.password = null
  }
  return signToken(user.username, user.role)
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
  // Einmal-Download-Token zuerst prüfen
  const dtUser = redeemDownloadToken(token)
  if (dtUser) return dtUser
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
