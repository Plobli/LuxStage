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
  return dbContainer.db.prepare('SELECT username, role FROM users').all()
    .map(u => ({ username: u.username, role: u.role, source: 'db' }))
}

export async function createUser(username, password, role) {
  const hash = await hashPassword(password)
  dbContainer.db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?) ON CONFLICT(username) DO UPDATE SET password = excluded.password, role = excluded.role')
    .run(username, hash, role)
}

export function deleteUser(username) {
  dbContainer.db.prepare('DELETE FROM users WHERE username = ?').run(username)
}
