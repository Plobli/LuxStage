import { dbContainer } from '../db-init.js'
import { hashPassword } from '../auth.js'

export function getDbPassword(username) {
  const row = dbContainer.db.prepare('SELECT password FROM users WHERE username = ?').get(username)
  return row?.password ?? null
}

export async function changePassword(username, newPassword, requiresChange = 0) {
  const hash = await hashPassword(newPassword)
  dbContainer.db.prepare(`
    INSERT INTO users (username, password, requires_password_change)
    VALUES (?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET
      password = excluded.password,
      requires_password_change = excluded.requires_password_change
  `).run(username, hash, requiresChange ? 1 : 0)
}

export function listUsers() {
  return dbContainer.db.prepare('SELECT username, role, email FROM users').all()
    .map(u => ({ username: u.username, role: u.role, email: u.email || '', source: 'db' }))
}

export function getUserEmail(username) {
  const row = dbContainer.db.prepare('SELECT email FROM users WHERE username = ?').get(username)
  return row?.email || null
}

export async function createUser(username, password, role, email = '') {
  const hash = await hashPassword(password)
  dbContainer.db.prepare('INSERT INTO users (username, password, role, email, requires_password_change) VALUES (?, ?, ?, ?, 1) ON CONFLICT(username) DO UPDATE SET password = excluded.password, role = excluded.role, email = excluded.email, requires_password_change = 1')
    .run(username, hash, role, email)
}

export function deleteUser(username) {
  dbContainer.db.prepare('DELETE FROM users WHERE username = ?').run(username)
}

export function getUserPreferences(username) {
  const row = dbContainer.db.prepare('SELECT sidebar_pinned FROM users WHERE username = ?').get(username)
  return { sidebarPinned: row?.sidebar_pinned === 1 }
}

export function setUserPreferences(username, { sidebarPinned }) {
  dbContainer.db.prepare('UPDATE users SET sidebar_pinned = ? WHERE username = ?')
    .run(sidebarPinned ? 1 : 0, username)
}

export function getGridDeckConfig(username) {
  const row = dbContainer.db.prepare('SELECT griddeck_config FROM users WHERE username = ?').get(username)
  if (!row?.griddeck_config) return null
  try { return JSON.parse(row.griddeck_config) } catch { return null }
}

export function setGridDeckConfig(username, config) {
  const json = JSON.stringify(config)
  dbContainer.db.prepare('UPDATE users SET griddeck_config = ? WHERE username = ?').run(json, username)
}
