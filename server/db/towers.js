import { dbContainer } from '../db-init.js'
import { readShow } from './shows.js'
import { randomUUID } from 'node:crypto'

function now() { return Date.now() }

export function readTowers(slug) {
  const show = readShow(slug)
  if (!show) return []
  const towers = dbContainer.db.prepare(
    'SELECT * FROM towers WHERE show_id = ? ORDER BY sort_order'
  ).all(show.id)
  for (const tower of towers) {
    tower.slots = dbContainer.db.prepare(
      'SELECT * FROM tower_slots WHERE tower_id = ? ORDER BY slot_index'
    ).all(tower.id)
  }
  return towers
}

export function writeTower(slug, data) {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)
  const id = data.id || randomUUID()
  const existing = dbContainer.db.prepare('SELECT id FROM towers WHERE id = ?').get(id)
  if (existing) {
    dbContainer.db.prepare(`
      UPDATE towers SET name=?, side=?, stage_area=?, slot_count=?, sort_order=? WHERE id=?
    `).run(data.name ?? '', data.side ?? '', data.stage_area ?? '', data.slot_count ?? 4, data.sort_order ?? 0, id)
  } else {
    const count = dbContainer.db.prepare('SELECT COUNT(*) as n FROM towers WHERE show_id = ?').get(show.id).n
    dbContainer.db.prepare(`
      INSERT INTO towers (id, show_id, name, side, stage_area, slot_count, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, show.id, data.name ?? '', data.side ?? '', data.stage_area ?? '', data.slot_count ?? 4, data.sort_order ?? count, now())
  }
  return id
}

export function deleteTower(towerId) {
  dbContainer.db.prepare('DELETE FROM towers WHERE id = ?').run(towerId)
}

export function writeTowerSlot(towerId, slotIndex, channelId) {
  const id = randomUUID()
  dbContainer.db.prepare(`
    INSERT INTO tower_slots (id, tower_id, slot_index, channel_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(tower_id, slot_index) DO UPDATE SET channel_id = excluded.channel_id
  `).run(id, towerId, slotIndex, channelId || null)
}

export function clearTowerSlot(towerId, slotIndex) {
  dbContainer.db.prepare(
    'UPDATE tower_slots SET channel_id = NULL WHERE tower_id = ? AND slot_index = ?'
  ).run(towerId, slotIndex)
}

export function ensureTowerSlots(towerId, slotCount) {
  for (let i = 1; i <= slotCount; i++) {
    const exists = dbContainer.db.prepare(
      'SELECT id FROM tower_slots WHERE tower_id = ? AND slot_index = ?'
    ).get(towerId, i)
    if (!exists) {
      dbContainer.db.prepare(
        'INSERT INTO tower_slots (id, tower_id, slot_index, channel_id) VALUES (?, ?, ?, NULL)'
      ).run(randomUUID(), towerId, i)
    }
  }
}
