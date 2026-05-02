import { dbContainer } from '../db-init.js'
import { randomUUID } from 'node:crypto'

export function listTemplates() {
  return dbContainer.db.prepare('SELECT name, osc_host FROM templates ORDER BY name').all()
    .map(r => ({ name: r.name, oscHost: r.osc_host ?? '' }))
}

export function getTemplateByName(name) {
  return dbContainer.db.prepare('SELECT * FROM templates WHERE name = ?').get(name) ?? null
}

export function updateTemplateOscHost(name, oscHost) {
  dbContainer.db.prepare('UPDATE templates SET osc_host = ? WHERE name = ?').run(oscHost, name)
}

export function readTemplate(name) {
  const tpl = dbContainer.db.prepare('SELECT * FROM templates WHERE name = ?').get(name)
  if (!tpl) return []
  return dbContainer.db.prepare('SELECT * FROM template_channels WHERE template_id = ? ORDER BY sort_order').all(tpl.id)
}

export function writeTemplate(name, channels) {
  const tx = dbContainer.db.transaction(() => {
    let tpl = dbContainer.db.prepare('SELECT * FROM templates WHERE name = ?').get(name)
    if (!tpl) {
      const id = randomUUID()
      dbContainer.db.prepare('INSERT INTO templates (id, name) VALUES (?, ?)').run(id, name)
      tpl = { id }
    }
    dbContainer.db.prepare('DELETE FROM template_channels WHERE template_id = ?').run(tpl.id)
    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i]
      dbContainer.db.prepare(`
        INSERT INTO template_channels (id, template_id, channel, address, device, position, color, notes, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(), tpl.id,
        ch.channel ?? '', ch.address ?? '', ch.device ?? '',
        ch.position ?? '', ch.color ?? '', ch.notes ?? '',
        i
      )
    }
  })
  tx()
}

export function deleteTemplate(name) {
  dbContainer.db.prepare('DELETE FROM templates WHERE name = ?').run(name)
}

export function readTemplateSections(name) {
  const tpl = dbContainer.db.prepare('SELECT * FROM templates WHERE name = ?').get(name)
  if (!tpl) return []
  const defs = dbContainer.db.prepare('SELECT * FROM template_section_defs WHERE template_id = ? ORDER BY sort_order').all(tpl.id)
  if (!defs.length) return []
  const defIds = defs.map(d => d.id)
  const ph = defIds.map(() => '?').join(',')
  const rowsAll = dbContainer.db.prepare(`SELECT * FROM template_section_kv_rows WHERE section_id IN (${ph}) ORDER BY sort_order`).all(defIds)
  const fieldsAll = dbContainer.db.prepare(`SELECT * FROM template_section_fields WHERE section_id IN (${ph}) ORDER BY sort_order`).all(defIds)
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

export function writeTemplateSections(name, defs) {
  const insertDef   = dbContainer.db.prepare('INSERT INTO template_section_defs (id, template_id, title, type, sort_order) VALUES (?, ?, ?, ?, ?)')
  const insertKvRow = dbContainer.db.prepare('INSERT INTO template_section_kv_rows (id, section_id, label, value, sort_order) VALUES (?, ?, ?, ?, ?)')
  const insertField = dbContainer.db.prepare('INSERT INTO template_section_fields (id, section_id, key, label, unit, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
  const tx = dbContainer.db.transaction(() => {
    let tpl = dbContainer.db.prepare('SELECT * FROM templates WHERE name = ?').get(name)
    if (!tpl) {
      const id = randomUUID()
      dbContainer.db.prepare('INSERT INTO templates (id, name) VALUES (?, ?)').run(id, name)
      tpl = { id }
    }
    dbContainer.db.prepare('DELETE FROM template_section_defs WHERE template_id = ?').run(tpl.id)
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i]
      insertDef.run(def.id ?? randomUUID(), tpl.id, def.title, def.type, def.order ?? i)
      if (def.type === 'kv-table') {
        for (let j = 0; j < (def.rows ?? []).length; j++) {
          const r = def.rows[j]
          insertKvRow.run(r.id ?? randomUUID(), def.id, r.label ?? '', r.value ?? '', r.sort_order ?? j)
        }
      } else {
        for (let j = 0; j < (def.fields ?? []).length; j++) {
          const f = def.fields[j]
          insertField.run(f.id ?? randomUUID(), def.id, f.key, f.label ?? '', f.unit ?? '', j)
        }
      }
    }
  })
  tx()
}

export function deleteTemplateSections(name) {
  const tpl = dbContainer.db.prepare('SELECT * FROM templates WHERE name = ?').get(name)
  if (!tpl) return
  dbContainer.db.prepare('DELETE FROM template_section_defs WHERE template_id = ?').run(tpl.id)
}
