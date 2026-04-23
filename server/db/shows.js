import { dbContainer } from '../db-init.js'
import { randomUUID } from 'node:crypto'

function now() { return Date.now() }

export function touchLastEdited(showId, username) {
  dbContainer.db.prepare('UPDATE shows SET last_edited_by = ?, last_edited_at = ? WHERE id = ?')
    .run(username, now(), showId)
}

export function listShows() {
  return dbContainer.db.prepare('SELECT * FROM shows WHERE archived = 0 ORDER BY created_at DESC').all()
}

export function listArchivedShows() {
  return dbContainer.db.prepare('SELECT * FROM shows WHERE archived = 1 ORDER BY created_at DESC').all()
}

export function readShow(slug) {
  return dbContainer.db.prepare('SELECT * FROM shows WHERE slug = ?').get(slug) ?? null
}

export function writeShow(slug, fields) {
  const allowed = ['name', 'datum', 'template', 'untertitel', 'spielzeit', 'setup_markdown', 'eos_active_channels', 'last_edited_by', 'last_edited_at']
  const updates = Object.fromEntries(
    Object.entries(fields).filter(([k]) => allowed.includes(k))
  )
  if (!Object.keys(updates).length) return
  const sets = Object.keys(updates).map(k => `${k} = @${k}`).join(', ')
  dbContainer.db.prepare(`UPDATE shows SET ${sets}, updated_at = @updated_at WHERE slug = @slug`)
    .run({ ...updates, updated_at: now(), slug })
}

export function createShow(slug, fields) {
  const tx = dbContainer.db.transaction(() => {
    const id = randomUUID()
    const ts = now()
    dbContainer.db.prepare(`
      INSERT INTO shows (id, slug, name, datum, template, untertitel, spielzeit, archived, created_at, updated_at)
      VALUES (@id, @slug, @name, @datum, @template, @untertitel, @spielzeit, 0, @ts, @ts)
    `).run({
      id, slug,
      name: fields.name ?? slug,
      datum: fields.datum ?? new Date().toISOString().slice(0, 10),
      template: fields.template ?? null,
      untertitel: fields.untertitel ?? null,
      spielzeit: fields.spielzeit ?? null,
      ts,
    })

    if (fields.template) {
      const tpl = dbContainer.db.prepare('SELECT * FROM templates WHERE name = ?').get(fields.template)
      if (tpl) _copyTemplateToShow(tpl.id, id)
    }
  })
  tx()
}

function _copyTemplateToShow(templateId, showId) {
  const tDefs = dbContainer.db.prepare('SELECT * FROM template_section_defs WHERE template_id = ? ORDER BY sort_order').all(templateId)
  if (!tDefs.length) return
  const defIds = tDefs.map(d => d.id)
  const ph = defIds.map(() => '?').join(',')
  const tRowsAll   = dbContainer.db.prepare(`SELECT * FROM template_section_kv_rows WHERE section_id IN (${ph}) ORDER BY sort_order`).all(defIds)
  const tFieldsAll = dbContainer.db.prepare(`SELECT * FROM template_section_fields WHERE section_id IN (${ph}) ORDER BY sort_order`).all(defIds)
  const tRowsBySection   = Map.groupBy(tRowsAll, r => r.section_id)
  const tFieldsBySection = Map.groupBy(tFieldsAll, f => f.section_id)

  const insertDef     = dbContainer.db.prepare('INSERT INTO section_defs (id, show_id, title, type, sort_order) VALUES (?, ?, ?, ?, ?)')
  const insertKvRow   = dbContainer.db.prepare('INSERT INTO section_kv_rows (id, section_id, label, value, sort_order) VALUES (?, ?, ?, ?, ?)')
  const insertField   = dbContainer.db.prepare('INSERT INTO section_fields (id, section_id, key, label, unit, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
  const insertContent = dbContainer.db.prepare('INSERT INTO section_contents (section_id, show_id, content) VALUES (?, ?, ?)')

  for (const tDef of tDefs) {
    const newDefId = randomUUID()
    insertDef.run(newDefId, showId, tDef.title, tDef.type, tDef.sort_order)
    if (tDef.type === 'kv-table') {
      for (const tRow of (tRowsBySection.get(tDef.id) ?? [])) {
        insertKvRow.run(randomUUID(), newDefId, tRow.label, tRow.value, tRow.sort_order)
      }
    } else {
      for (const tField of (tFieldsBySection.get(tDef.id) ?? [])) {
        insertField.run(randomUUID(), newDefId, tField.key, tField.label, tField.unit, tField.sort_order)
      }
      insertContent.run(newDefId, showId, tDef.type === 'fields' ? '{}' : '')
    }
  }
}

export function archiveShow(slug) {
  dbContainer.db.prepare('UPDATE shows SET archived = 1, updated_at = ? WHERE slug = ?').run(now(), slug)
}

export function restoreShow(slug) {
  dbContainer.db.prepare('UPDATE shows SET archived = 0, updated_at = ? WHERE slug = ?').run(now(), slug)
}

export function deleteShow(slug) {
  dbContainer.db.prepare('DELETE FROM shows WHERE slug = ?').run(slug)
}
