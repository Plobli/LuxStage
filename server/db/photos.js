import { dbContainer } from '../db-init.js'
import { readShow } from './shows.js'
import { randomUUID } from 'node:crypto'

function now() { return Date.now() }

export function readPhotoDescriptions(slug) {
  const show = readShow(slug)
  if (!show) return {}
  const rows = dbContainer.db.prepare('SELECT filename, caption, channel_number FROM photo_descriptions WHERE show_id = ?').all(show.id)
  return Object.fromEntries(rows.map(r => [r.filename, { caption: r.caption, channelNumber: r.channel_number ?? '' }]))
}

export function writePhotoDescription(slug, filename, caption, channelNumber = '') {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)
  dbContainer.db.prepare(`
    INSERT INTO photo_descriptions (show_id, filename, caption, channel_number)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(show_id, filename) DO UPDATE SET
      caption = excluded.caption,
      channel_number = excluded.channel_number
  `).run(show.id, filename, caption, channelNumber)
}

export function deletePhotoDescription(slug, filename) {
  const show = readShow(slug)
  if (!show) return
  dbContainer.db.prepare('DELETE FROM photo_descriptions WHERE show_id = ? AND filename = ?').run(show.id, filename)
}

export function readPhotoOrder(slug) {
  const show = readShow(slug)
  if (!show) return []
  return dbContainer.db.prepare('SELECT filename FROM photo_order WHERE show_id = ? ORDER BY sort_order')
    .all(show.id)
    .map(r => r.filename)
}

export function writePhotoOrder(slug, order) {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)
  const insertOrder = dbContainer.db.prepare('INSERT INTO photo_order (show_id, filename, sort_order) VALUES (?, ?, ?)')
  const tx = dbContainer.db.transaction(() => {
    dbContainer.db.prepare('DELETE FROM photo_order WHERE show_id = ?').run(show.id)
    for (let i = 0; i < order.length; i++) insertOrder.run(show.id, order[i], i)
    dbContainer.db.prepare('UPDATE shows SET updated_at = ? WHERE id = ?').run(now(), show.id)
  })
  tx()
}

export function deletePhotoOrderEntry(slug, filename) {
  const show = readShow(slug)
  if (!show) return
  dbContainer.db.prepare('DELETE FROM photo_order WHERE show_id = ? AND filename = ?').run(show.id, filename)
}

export function readChannelPhotos(channelId) {
  return dbContainer.db.prepare(
    'SELECT filename FROM channel_photos WHERE channel_id = ? ORDER BY sort_order'
  ).all(channelId).map(r => r.filename)
}

export function addChannelPhoto(channelId, filename) {
  dbContainer.db.prepare(`
    INSERT OR IGNORE INTO channel_photos (id, channel_id, filename, sort_order)
    VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM channel_photos WHERE channel_id = ?))
  `).run(randomUUID(), channelId, filename, channelId)
}

export function removeChannelPhoto(channelId, filename) {
  dbContainer.db.prepare(
    'DELETE FROM channel_photos WHERE channel_id = ? AND filename = ?'
  ).run(channelId, filename)
}

export function reorderChannelPhotos(channelId, filenames) {
  const updateOrder = dbContainer.db.prepare('UPDATE channel_photos SET sort_order = ? WHERE channel_id = ? AND filename = ?')
  const tx = dbContainer.db.transaction(() => {
    for (let i = 0; i < filenames.length; i++) updateOrder.run(i, channelId, filenames[i])
  })
  tx()
}
