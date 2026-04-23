import { dbContainer } from '../db-init.js'
import { readShow, touchLastEdited } from './shows.js'
import { randomUUID } from 'node:crypto'

function now() { return Date.now() }

export function readShowSectionDefs(slug) {
  const show = readShow(slug)
  if (!show) return []
  const defs = dbContainer.db.prepare('SELECT * FROM section_defs WHERE show_id = ? ORDER BY sort_order').all(show.id)
  if (!defs.length) return []
  const defIds = defs.map(d => d.id)
  const ph = defIds.map(() => '?').join(',')
  const rowsAll = dbContainer.db.prepare(`SELECT * FROM section_kv_rows WHERE section_id IN (${ph}) ORDER BY sort_order`).all(defIds)
  const fieldsAll = dbContainer.db.prepare(`SELECT * FROM section_fields WHERE section_id IN (${ph}) ORDER BY sort_order`).all(defIds)
  const rowsBySection = Map.groupBy(rowsAll, r => r.section_id)
  const fieldsBySection = Map.groupBy(fieldsAll, f => f.section_id)
  return defs.map(def => {
    if (def.type === 'kv-table') {
      return {
        id: def.id, title: def.title, type: def.type, order: def.sort_order,
        rows: (rowsBySection.get(def.id) ?? []).map(r => ({ id: r.id, label: r.label, value: r.value, sort_order: r.sort_order })),
      }
    }
    return {
      id: def.id, title: def.title, type: def.type, order: def.sort_order,
      fields: (fieldsBySection.get(def.id) ?? []).map(f => ({ id: f.id, key: f.key, label: f.label, unit: f.unit })),
    }
  })
}

export function writeShowSectionDefs(slug, defs, editedBy = null) {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)
  const insertDef     = dbContainer.db.prepare('INSERT INTO section_defs (id, show_id, title, type, sort_order) VALUES (?, ?, ?, ?, ?)')
  const insertKvRow   = dbContainer.db.prepare('INSERT INTO section_kv_rows (id, section_id, label, value, sort_order) VALUES (?, ?, ?, ?, ?)')
  const insertField   = dbContainer.db.prepare('INSERT INTO section_fields (id, section_id, key, label, unit, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
  const insertContent = dbContainer.db.prepare('INSERT INTO section_contents (section_id, show_id, content) VALUES (?, ?, ?)')
  const tx = dbContainer.db.transaction(() => {
    const savedContents = dbContainer.db.prepare('SELECT section_id, content FROM section_contents WHERE show_id = ?').all(show.id)
    const contentMap = new Map(savedContents.map(r => [r.section_id, r.content]))
    dbContainer.db.prepare('DELETE FROM section_defs WHERE show_id = ?').run(show.id)
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i]
      insertDef.run(def.id, show.id, def.title, def.type, def.order ?? i)
      if (def.type === 'kv-table') {
        const rows = def.rows ?? []
        for (let j = 0; j < rows.length; j++) {
          const r = rows[j]
          insertKvRow.run(r.id ?? randomUUID(), def.id, r.label ?? '', r.value ?? '', r.sort_order ?? j)
        }
      } else {
        const fields = def.fields ?? []
        for (let j = 0; j < fields.length; j++) {
          const f = fields[j]
          insertField.run(f.id ?? randomUUID(), def.id, f.key, f.label ?? '', f.unit ?? '', j)
        }
        insertContent.run(def.id, show.id, contentMap.get(def.id) ?? (def.type === 'fields' ? '{}' : ''))
      }
    }
    dbContainer.db.prepare('UPDATE shows SET updated_at = ? WHERE id = ?').run(now(), show.id)
    if (editedBy) touchLastEdited(show.id, editedBy)
  })
  tx()
}

export function readShowSections(slug) {
  const show = readShow(slug)
  if (!show) return new Map()
  const rows = dbContainer.db.prepare(`
    SELECT sc.section_id, sc.content FROM section_contents sc
    WHERE sc.show_id = ?
  `).all(show.id)
  return new Map(rows.map(r => [r.section_id, r.content ?? '']))
}

export function writeShowSections(slug, map, editedBy = null) {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)
  const upsertContent = dbContainer.db.prepare('INSERT OR REPLACE INTO section_contents (section_id, show_id, content) VALUES (?, ?, ?)')
  const tx = dbContainer.db.transaction(() => {
    for (const [sectionId, content] of map) upsertContent.run(sectionId, show.id, content)
    dbContainer.db.prepare('UPDATE shows SET updated_at = ? WHERE id = ?').run(now(), show.id)
    if (editedBy) touchLastEdited(show.id, editedBy)
  })
  tx()
}
