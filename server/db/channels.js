import { dbContainer } from '../db-init.js'
import { readShow, touchLastEdited } from './shows.js'
import { randomUUID } from 'node:crypto'

function now() { return Date.now() }

export function readChannels(slug) {
  const show = readShow(slug)
  if (!show) return []
  return dbContainer.db.prepare('SELECT * FROM channels WHERE show_id = ? ORDER BY sort_order').all(show.id)
}

export function writeChannels(slug, channels, editedBy = null) {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)

  const upsert = dbContainer.db.prepare(`
    INSERT INTO channels (id, show_id, channel, address, device, position, color, notes, mount_ref, quantity, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      channel = excluded.channel, address = excluded.address, device = excluded.device,
      position = excluded.position, color = excluded.color, notes = excluded.notes,
      mount_ref = excluded.mount_ref, quantity = excluded.quantity, sort_order = excluded.sort_order
  `)

  const tx = dbContainer.db.transaction(() => {
    // Bestehende Kanäle nach Kanalnummer indexieren, um IDs zu erhalten
    const existing = dbContainer.db.prepare('SELECT id, channel FROM channels WHERE show_id = ?').all(show.id)
    const idByNumber = new Map(existing.map(r => [r.channel, r.id]))
    const incomingIds = new Set()

    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i]
      const id = idByNumber.get(ch.channel) ?? (ch.id || randomUUID())
      incomingIds.add(id)
      const mountRef = ch.mount_ref ? (typeof ch.mount_ref === 'string' ? ch.mount_ref : JSON.stringify(ch.mount_ref)) : null
      upsert.run(id, show.id, ch.channel ?? '', ch.address ?? '', ch.device ?? '', ch.position ?? '', ch.color ?? '', ch.notes ?? '', mountRef, ch.quantity ?? 1, i)
    }

    // Kanäle löschen, die nicht mehr in der Liste sind
    for (const { id } of existing) {
      if (!incomingIds.has(id)) {
        dbContainer.db.prepare('DELETE FROM channels WHERE id = ?').run(id)
      }
    }

    dbContainer.db.prepare('UPDATE shows SET updated_at = ? WHERE id = ?').run(now(), show.id)
    if (editedBy) touchLastEdited(show.id, editedBy)
  })
  tx()
}

export function getChecks(showSlug) {
  const CHECK_TTL_MS = 6 * 60 * 60 * 1000
  const cutoff = now() - CHECK_TTL_MS
  return dbContainer.db.prepare(
    'SELECT channel_id FROM lighting_checks WHERE show_id = ? AND checked_at >= ?'
  ).all(showSlug, cutoff).map(r => r.channel_id)
}

export function clearChecks(showSlug) {
  dbContainer.db.prepare('DELETE FROM lighting_checks WHERE show_id = ?').run(showSlug)
}

export function setCheck(showSlug, channelId, checked, username) {
  if (checked) {
    dbContainer.db.prepare(`
      INSERT INTO lighting_checks (show_id, channel_id, checked_by, checked_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(show_id, channel_id) DO UPDATE SET checked_by = excluded.checked_by, checked_at = excluded.checked_at
    `).run(showSlug, channelId, username, now())
  } else {
    dbContainer.db.prepare(
      'DELETE FROM lighting_checks WHERE show_id = ? AND channel_id = ?'
    ).run(showSlug, channelId)
  }
}
