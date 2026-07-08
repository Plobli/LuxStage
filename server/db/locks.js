import { getDb } from '../db-context.js'
import { config } from '../config.js'
import { readShow } from './shows.js'

export function acquireLock(slug, username) {
  const show = readShow(slug)
  if (!show) return { ok: false }
  const existing = getDb().prepare('SELECT * FROM locks WHERE show_id = ?').get(show.id)
  if (existing) {
    const age = Date.now() - existing.since
    if (age < config.lockTimeout && existing.username !== username) {
      return { ok: false, lockedBy: existing.username, since: existing.since }
    }
  }
  getDb().prepare('INSERT OR REPLACE INTO locks (show_id, username, since) VALUES (?, ?, ?)')
    .run(show.id, username, Date.now())
  return { ok: true }
}

export function releaseLock(slug, username) {
  const show = readShow(slug)
  if (!show) return
  const lock = getDb().prepare('SELECT * FROM locks WHERE show_id = ?').get(show.id)
  if (lock?.username === username) {
    getDb().prepare('DELETE FROM locks WHERE show_id = ?').run(show.id)
  }
}

export function touchLock(slug, username) {
  const show = readShow(slug)
  if (!show) return
  getDb().prepare('UPDATE locks SET since = ? WHERE show_id = ? AND username = ?')
    .run(Date.now(), show.id, username)
}

export function getLock(slug) {
  const show = readShow(slug)
  if (!show) return null
  const lock = getDb().prepare('SELECT * FROM locks WHERE show_id = ?').get(show.id)
  if (!lock) return null
  if (Date.now() - lock.since >= config.lockTimeout) {
    getDb().prepare('DELETE FROM locks WHERE show_id = ?').run(show.id)
    return null
  }
  return { user: lock.username, since: lock.since }
}
