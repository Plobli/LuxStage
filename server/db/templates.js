import { dbContainer } from '../db-init.js'
import { randomUUID } from 'node:crypto'

export function listTemplates() {
  return dbContainer.db.prepare(`
    SELECT t.name, t.osc_host, t.updated_at,
           COUNT(tc.id) AS channel_count
    FROM templates t
    LEFT JOIN template_channels tc ON tc.template_id = t.id
    GROUP BY t.id
    ORDER BY t.name
  `).all().map(r => ({
    name: r.name,
    oscHost: r.osc_host ?? '',
    channelCount: r.channel_count,
    updatedAt: r.updated_at || null,
  }))
}

export function getTemplateByName(name) {
  return dbContainer.db.prepare('SELECT * FROM templates WHERE name = ?').get(name) ?? null
}

export function updateTemplateOscHost(name, oscHost) {
  dbContainer.db.prepare('UPDATE templates SET osc_host = ? WHERE name = ?').run(oscHost, name)
}

export function renameTemplate(oldName, newName) {
  const tx = dbContainer.db.transaction(() => {
    dbContainer.db.prepare('UPDATE templates SET name = ? WHERE name = ?').run(newName, oldName)
    dbContainer.db.prepare('UPDATE shows SET template = ? WHERE template = ?').run(newName, oldName)
  })
  tx()
}

export function readTemplate(name) {
  const tpl = dbContainer.db.prepare('SELECT * FROM templates WHERE name = ?').get(name)
  if (!tpl) return []
  return dbContainer.db.prepare('SELECT * FROM template_channels WHERE template_id = ? ORDER BY sort_order').all(tpl.id)
}

export function writeTemplate(name, channels) {
  const tx = dbContainer.db.transaction(() => {
    const now = Date.now()
    let tpl = dbContainer.db.prepare('SELECT * FROM templates WHERE name = ?').get(name)
    if (!tpl) {
      const id = randomUUID()
      dbContainer.db.prepare('INSERT INTO templates (id, name, updated_at) VALUES (?, ?, ?)').run(id, name, now)
      tpl = { id }
    } else {
      dbContainer.db.prepare('UPDATE templates SET updated_at = ? WHERE id = ?').run(now, tpl.id)
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
    const now = Date.now()
    let tpl = dbContainer.db.prepare('SELECT * FROM templates WHERE name = ?').get(name)
    if (!tpl) {
      const id = randomUUID()
      dbContainer.db.prepare('INSERT INTO templates (id, name, updated_at) VALUES (?, ?, ?)').run(id, name, now)
      tpl = { id }
    } else {
      dbContainer.db.prepare('UPDATE templates SET updated_at = ? WHERE id = ?').run(now, tpl.id)
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

export function readTemplateBars(name) {
  const tpl = dbContainer.db.prepare('SELECT * FROM templates WHERE name = ?').get(name)
  if (!tpl) return []
  return dbContainer.db.prepare('SELECT * FROM template_bars WHERE template_id = ? ORDER BY sort_order').all(tpl.id)
}

export function writeTemplateBar(name, data) {
  const tpl = dbContainer.db.prepare('SELECT * FROM templates WHERE name = ?').get(name)
  if (!tpl) throw new Error(`Template not found: ${name}`)
  const id = data.id || randomUUID()
  const existing = dbContainer.db.prepare('SELECT id FROM template_bars WHERE id = ?').get(id)
  if (existing) {
    dbContainer.db.prepare(
      'UPDATE template_bars SET name=?, zug_nr=?, length_cm=?, sort_order=? WHERE id=?'
    ).run(data.name ?? '', data.zug_nr ?? '', data.length_cm ?? 600, data.sort_order ?? 0, id)
  } else {
    const count = dbContainer.db.prepare('SELECT COUNT(*) as n FROM template_bars WHERE template_id = ?').get(tpl.id).n
    dbContainer.db.prepare(
      'INSERT INTO template_bars (id, template_id, name, zug_nr, length_cm, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, tpl.id, data.name ?? '', data.zug_nr ?? '', data.length_cm ?? 600, data.sort_order ?? count)
  }
  return id
}

export function deleteTemplateBar(barId) {
  dbContainer.db.prepare('DELETE FROM template_bars WHERE id = ?').run(barId)
}

export function reorderTemplateBars(templateId, orderedIds) {
  const update = dbContainer.db.prepare('UPDATE template_bars SET sort_order = ? WHERE id = ? AND template_id = ?')
  const tx = dbContainer.db.transaction(() => {
    orderedIds.forEach((id, i) => update.run(i, id, templateId))
  })
  tx()
}

// Wendet Template-Bars oder Sections-Struktur auf alle Shows mit diesem Template an.
// scope: 'bars' | 'sections' — bestehende Einträge werden nicht überschrieben.
export function applyTemplateToAllShows(templateName, scope) {
  const tpl = dbContainer.db.prepare('SELECT * FROM templates WHERE name = ?').get(templateName)
  if (!tpl) throw new Error('Template not found')

  const shows = dbContainer.db.prepare('SELECT * FROM shows WHERE template = ? AND archived = 0').all(templateName)

  const tBars = scope === 'bars' ? dbContainer.db.prepare('SELECT * FROM template_bars WHERE template_id = ? ORDER BY sort_order').all(tpl.id) : []
  const tDefs = scope === 'sections' ? dbContainer.db.prepare('SELECT * FROM template_section_defs WHERE template_id = ? ORDER BY sort_order').all(tpl.id) : []

  let defIds = tDefs.map(d => d.id)
  let tRowsBySection = new Map()
  let tFieldsBySection = new Map()
  if (defIds.length) {
    const ph = defIds.map(() => '?').join(',')
    const tRowsAll   = dbContainer.db.prepare(`SELECT * FROM template_section_kv_rows WHERE section_id IN (${ph}) ORDER BY sort_order`).all(defIds)
    const tFieldsAll = dbContainer.db.prepare(`SELECT * FROM template_section_fields WHERE section_id IN (${ph}) ORDER BY sort_order`).all(defIds)
    tRowsBySection   = Map.groupBy(tRowsAll, r => r.section_id)
    tFieldsBySection = Map.groupBy(tFieldsAll, f => f.section_id)
  }

  const insertBar     = dbContainer.db.prepare('INSERT INTO bars (id, show_id, name, zug_nr, length_cm, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const insertDef     = dbContainer.db.prepare('INSERT INTO section_defs (id, show_id, title, type, sort_order) VALUES (?, ?, ?, ?, ?)')
  const insertKvRow   = dbContainer.db.prepare('INSERT INTO section_kv_rows (id, section_id, label, value, sort_order) VALUES (?, ?, ?, ?, ?)')
  const insertField   = dbContainer.db.prepare('INSERT INTO section_fields (id, section_id, key, label, unit, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
  const insertContent = dbContainer.db.prepare('INSERT INTO section_contents (section_id, show_id, content) VALUES (?, ?, ?)')

  const stats = { shows: shows.length, barsAdded: 0, sectionsAdded: 0 }

  const tx = dbContainer.db.transaction(() => {
    for (const show of shows) {
      // Bars: fehlende nach Name hinzufügen
      const existingBars = dbContainer.db.prepare('SELECT name FROM bars WHERE show_id = ?').all(show.id)
      const existingBarNames = new Set(existingBars.map(b => b.name))
      const existingBarCount = existingBars.length

      for (const tb of tBars) {
        if (!existingBarNames.has(tb.name)) {
          const sortOrder = existingBarCount + stats.barsAdded
          insertBar.run(randomUUID(), show.id, tb.name, tb.zug_nr, tb.length_cm, sortOrder, Date.now())
          stats.barsAdded++
        }
      }

      // Sections: fehlende nach Titel hinzufügen
      const existingDefs = dbContainer.db.prepare('SELECT title FROM section_defs WHERE show_id = ?').all(show.id)
      const existingTitles = new Set(existingDefs.map(d => d.title))
      const existingDefCount = existingDefs.length

      let secIdx = 0
      for (const tDef of tDefs) {
        if (!existingTitles.has(tDef.title)) {
          const newDefId = randomUUID()
          insertDef.run(newDefId, show.id, tDef.title, tDef.type, existingDefCount + secIdx)
          if (tDef.type === 'kv-table') {
            for (const tRow of (tRowsBySection.get(tDef.id) ?? [])) {
              insertKvRow.run(randomUUID(), newDefId, tRow.label, tRow.value, tRow.sort_order)
            }
          } else {
            for (const tField of (tFieldsBySection.get(tDef.id) ?? [])) {
              insertField.run(randomUUID(), newDefId, tField.key, tField.label, tField.unit, tField.sort_order)
            }
            insertContent.run(newDefId, show.id, tDef.type === 'fields' ? '{}' : '')
          }
          secIdx++
          stats.sectionsAdded++
        }
      }
    }
  })
  tx()
  return stats
}
