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
    let newHash = null
    const tx = sqliteDb.transaction(() => {
      const channels = db.readChannels(show.slug)
      const sections = db.readShowSections(show.slug)
      const currentHash = computeHash(channels, sections)
      if (currentHash === snapshotHashes.get(show.id)) return  // early return from transaction

      const id = randomUUID()
      const sectionsObj = Object.fromEntries(sections)
      sqliteDb.prepare(`
        INSERT INTO history (id, show_id, created_at, channels, sections)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, show.id, Date.now(), JSON.stringify(channels), JSON.stringify(sectionsObj))

      sqliteDb.prepare(`
        DELETE FROM history WHERE show_id = ? AND id NOT IN (
          SELECT id FROM history WHERE show_id = ? ORDER BY created_at DESC LIMIT ?
        )
      `).run(show.id, show.id, MAX_HISTORY)

      newHash = currentHash
    })
    tx()
    if (newHash) snapshotHashes.set(show.id, newHash)
  }
}

export function startHistoryJob() {
  initHashes()
  // Automatische Snapshots laufen weiter als Fallback (z.B. für Änderungen via API ohne Browser)
  setInterval(takeSnapshots, INTERVAL_MS)
}

/** Erzeugt sofort einen Snapshot für eine Show — unabhängig vom Hash-Vergleich.
 *  Wird beim Öffnen einer Show aufgerufen, um einen Ausgangspunkt zu sichern. */
export function takeSnapshotNow(slug) {
  const show = sqliteDb.prepare('SELECT id, slug FROM shows WHERE slug = ? AND archived = 0').get(slug)
  if (!show) return false

  let newHash = null
  const tx = sqliteDb.transaction(() => {
    const channels = db.readChannels(slug)
    const sections = db.readShowSections(slug)
    const currentHash = computeHash(channels, sections)

    // Keinen doppelten Snapshot erstellen wenn sich seit dem letzten nichts geändert hat
    const lastEntry = sqliteDb.prepare(
      'SELECT id FROM history WHERE show_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(show.id)
    if (lastEntry) {
      const lastFull = sqliteDb.prepare('SELECT channels, sections FROM history WHERE id = ?').get(lastEntry.id)
      const lastChannels = JSON.parse(lastFull.channels)
      const lastSections = new Map(Object.entries(JSON.parse(lastFull.sections)))
      if (computeHash(lastChannels, lastSections) === currentHash) return  // early return, no snapshot needed
    }

    const id = randomUUID()
    const sectionsObj = Object.fromEntries(sections)
    sqliteDb.prepare(`
      INSERT INTO history (id, show_id, created_at, channels, sections)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, show.id, Date.now(), JSON.stringify(channels), JSON.stringify(sectionsObj))

    sqliteDb.prepare(`
      DELETE FROM history WHERE show_id = ? AND id NOT IN (
        SELECT id FROM history WHERE show_id = ? ORDER BY created_at DESC LIMIT ?
      )
    `).run(show.id, show.id, MAX_HISTORY)

    newHash = currentHash
  })
  tx()
  if (newHash) snapshotHashes.set(show.id, newHash)
  return true
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

  const tx = sqliteDb.transaction(() => {
    db.writeChannels(slug, channels)
    db.writeShowSections(slug, sections)
  })
  tx()

  snapshotHashes.set(show.id, computeHash(channels, sections))
  return true
}
