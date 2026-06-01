import { dbContainer } from '../db-init.js'
import { readShow } from './shows.js'
import { randomUUID } from 'node:crypto'

function now() { return Date.now() }

export function readBars(slug) {
  const show = readShow(slug)
  if (!show) return []
  const bars = dbContainer.db.prepare(
    'SELECT * FROM bars WHERE show_id = ? ORDER BY sort_order'
  ).all(show.id)
  for (const bar of bars) {
    bar.fixtures = dbContainer.db.prepare(
      'SELECT * FROM bar_fixtures WHERE bar_id = ? ORDER BY position'
    ).all(bar.id)
  }
  return bars
}

export function writeBar(slug, data) {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)
  const id = data.id || randomUUID()
  const existing = dbContainer.db.prepare('SELECT id, length_cm FROM bars WHERE id = ?').get(id)
  if (existing) {
    const currentSortOrder = dbContainer.db.prepare('SELECT sort_order FROM bars WHERE id = ?').get(id)?.sort_order ?? 0
    const newLength = data.length_cm ?? 600
    dbContainer.db.prepare(`
      UPDATE bars SET name=?, zug_nr=?, length_cm=?, height_cm=?, notes=?, sort_order=?, hide_scale=? WHERE id=?
    `).run(data.name ?? '', data.zug_nr ?? '', newLength, data.height_cm ?? null, data.notes ?? '', data.sort_order ?? currentSortOrder, data.hide_scale ? 1 : 0, id)
    const oldLength = existing.length_cm
    if (oldLength && newLength && oldLength !== newLength) {
      const scale = newLength / oldLength
      dbContainer.db.prepare(
        'UPDATE bar_fixtures SET position = ROUND(position * ?, 1) WHERE bar_id = ?'
      ).run(scale, id)
    }
  } else {
    const count = dbContainer.db.prepare('SELECT COUNT(*) as n FROM bars WHERE show_id = ?').get(show.id).n
    dbContainer.db.prepare(`
      INSERT INTO bars (id, show_id, name, zug_nr, length_cm, height_cm, notes, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, show.id, data.name ?? '', data.zug_nr ?? '', data.length_cm ?? 600, data.height_cm ?? null, data.notes ?? '', data.sort_order ?? count, now())
  }
  return id
}

export function deleteBar(barId) {
  dbContainer.db.prepare('DELETE FROM bars WHERE id = ?').run(barId)
}

export function reorderBars(slug, orderedIds) {
  const show = readShow(slug)
  if (!show) return
  const update = dbContainer.db.prepare('UPDATE bars SET sort_order = ? WHERE id = ? AND show_id = ?')
  const tx = dbContainer.db.transaction(() => {
    orderedIds.forEach((id, i) => update.run(i, id, show.id))
  })
  tx()
}

export function writeBarFixture(barId, channelId, position, notes) {
  const id = randomUUID()
  dbContainer.db.prepare(`
    INSERT INTO bar_fixtures (id, bar_id, channel_id, position, notes)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(bar_id, channel_id) DO UPDATE SET position = excluded.position, notes = excluded.notes
  `).run(id, barId, channelId, position ?? 0, notes ?? '')

  const bar = dbContainer.db.prepare('SELECT * FROM bars WHERE id = ?').get(barId)
  if (bar) {
    const mountRef = JSON.stringify({ type: 'bar', barId, barName: bar.name, zugNr: bar.zug_nr, position: position ?? 0 })
    dbContainer.db.prepare('UPDATE channels SET mount_ref = ? WHERE id = ?').run(mountRef, channelId)
  }
}

export function updateBarFixtureNotes(barId, channelId, notes) {
  dbContainer.db.prepare(
    'UPDATE bar_fixtures SET notes = ? WHERE bar_id = ? AND channel_id = ?'
  ).run(notes ?? '', barId, channelId)
}

export function removeBarFixture(barId, channelId) {
  dbContainer.db.prepare(
    'DELETE FROM bar_fixtures WHERE bar_id = ? AND channel_id = ?'
  ).run(barId, channelId)
  dbContainer.db.prepare('UPDATE channels SET mount_ref = NULL WHERE id = ?').run(channelId)
}
