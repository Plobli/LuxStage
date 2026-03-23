// LuxStage/server/history.js
import { createHash, randomUUID } from 'node:crypto'
import { db as sqliteDb } from './db-init.js'
import * as db from './db.js'

const INTERVAL_MS = 10 * 60 * 1000  // 10 Minuten
const MAX_HISTORY = 50

// Map<showId, lastSnapshotHash>
const snapshotHashes = new Map()

function computeHash(channels, sections) {
  // sections als Objekt mit sortierten Keys für Determinismus
  const sortedSections = Object.fromEntries(
    [...sections.entries()].sort(([a], [b]) => a.localeCompare(b))
  )
  const data = JSON.stringify({ channels, sections: sortedSections })
  return createHash('sha256').update(data).digest('hex')
}

function initHashes() {
  const shows = sqliteDb.prepare('SELECT id, slug FROM shows WHERE archived = 0').all()
  for (const show of shows) {
    const channels = db.readChannels(show.slug)
    const sections = db.readShowSections(show.slug)
    snapshotHashes.set(show.id, computeHash(channels, sections))
  }
}

function takeSnapshots() {
  const shows = sqliteDb.prepare('SELECT id, slug FROM shows WHERE archived = 0').all()
  for (const show of shows) {
    const channels = db.readChannels(show.slug)
    const sections = db.readShowSections(show.slug)
    const currentHash = computeHash(channels, sections)
    if (currentHash === snapshotHashes.get(show.id)) continue

    // Snapshot speichern
    const id = randomUUID()
    const sectionsObj = Object.fromEntries(sections)
    sqliteDb.prepare(`
      INSERT INTO history (id, show_id, created_at, channels, sections)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, show.id, Date.now(), JSON.stringify(channels), JSON.stringify(sectionsObj))

    // Älteste über MAX_HISTORY löschen
    sqliteDb.prepare(`
      DELETE FROM history WHERE show_id = ? AND id NOT IN (
        SELECT id FROM history WHERE show_id = ? ORDER BY created_at DESC LIMIT ?
      )
    `).run(show.id, show.id, MAX_HISTORY)

    snapshotHashes.set(show.id, currentHash)
  }
}

export function startHistoryJob() {
  initHashes()
  setInterval(takeSnapshots, INTERVAL_MS)
}

// History-Abfragen für API
export function listHistory(slug) {
  const show = sqliteDb.prepare('SELECT id FROM shows WHERE slug = ?').get(slug)
  if (!show) return []
  return sqliteDb.prepare('SELECT id, created_at FROM history WHERE show_id = ? ORDER BY created_at DESC').all(show.id)
}

export function getHistoryEntry(slug, historyId) {
  const show = sqliteDb.prepare('SELECT id FROM shows WHERE slug = ?').get(slug)
  if (!show) return null
  return sqliteDb.prepare('SELECT * FROM history WHERE id = ? AND show_id = ?').get(historyId, show.id) ?? null
}

export function restoreHistoryEntry(slug, historyId) {
  const show = sqliteDb.prepare('SELECT id FROM shows WHERE slug = ?').get(slug)
  if (!show) return false
  const entry = sqliteDb.prepare('SELECT * FROM history WHERE id = ? AND show_id = ?').get(historyId, show.id)
  if (!entry) return false

  const channels = JSON.parse(entry.channels)
  const sections = new Map(Object.entries(JSON.parse(entry.sections)))
  db.writeChannels(slug, channels)
  db.writeShowSections(slug, sections)
  return true
}
