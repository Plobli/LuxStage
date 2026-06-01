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

// Wendet Template-Bars oder Template-Towers auf eine einzelne Show an.
// withChannels: true → Kanal-Info aus Template-Slots/-Fixtures wird NICHT übertragen (Kanäle sind show-spezifisch).
// Die Funktion fügt nur fehlende Einträge hinzu (nach Name/Position).
export function applyTemplateToShow(templateName, showSlug, scope, withChannels, selectedIds = null) {
  const tpl = dbContainer.db.prepare('SELECT * FROM templates WHERE name = ?').get(templateName)
  if (!tpl) throw new Error('Template not found')
  const show = dbContainer.db.prepare('SELECT * FROM shows WHERE slug = ?').get(showSlug)
  if (!show) throw new Error('Show not found')
  const idSet = selectedIds ? new Set(selectedIds) : null

  const tx = dbContainer.db.transaction(() => {
    if (scope === 'bars') {
      const tBars = dbContainer.db.prepare('SELECT * FROM template_bars WHERE template_id = ? ORDER BY sort_order').all(tpl.id)
      const existingBars = dbContainer.db.prepare('SELECT * FROM bars WHERE show_id = ?').all(show.id)
      const existingByName = new Map(existingBars.map(b => [b.name, b]))
      let sortBase = existingBars.length

      for (const tb of tBars) {
        if (idSet && !idSet.has(tb.id)) continue
        if (!existingByName.has(tb.name)) {
          const newBarId = randomUUID()
          dbContainer.db.prepare(
            'INSERT INTO bars (id, show_id, name, zug_nr, length_cm, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).run(newBarId, show.id, tb.name, tb.zug_nr, tb.length_cm, sortBase++, Date.now())
          existingByName.set(tb.name, { id: newBarId })
        }
        if (withChannels) {
          const bar = existingByName.get(tb.name)
          const fixtures = dbContainer.db.prepare('SELECT * FROM template_bar_fixtures WHERE bar_id = ?').all(tb.id)
          for (const fx of fixtures) {
            dbContainer.db.prepare(`
              INSERT OR IGNORE INTO bar_fixtures (id, bar_id, channel_id, position, notes)
              SELECT ?, ?, c.id, ?, ?
              FROM channels c
              WHERE c.show_id = ? AND c.channel = ?
            `).run(randomUUID(), bar.id, fx.position, fx.notes ?? '', show.id, fx.channel ?? '')
          }
        }
      }
    }

    if (scope === 'towers') {
      const tTowers = dbContainer.db.prepare('SELECT * FROM template_towers WHERE template_id = ? ORDER BY sort_order').all(tpl.id)
      const existingTowers = dbContainer.db.prepare('SELECT * FROM towers WHERE show_id = ?').all(show.id)
      const existingByName = new Map(existingTowers.map(t => [t.name, t]))
      let sortBase = existingTowers.length

      for (const tt of tTowers) {
        if (idSet && !idSet.has(tt.id)) continue
        if (!existingByName.has(tt.name)) {
          const newTowerId = randomUUID()
          dbContainer.db.prepare(
            'INSERT INTO towers (id, show_id, name, side, stage_area, slot_count, sort_order, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).run(newTowerId, show.id, tt.name, tt.side, tt.stage_area, tt.slot_count, sortBase++, '', Date.now())
          for (let i = 1; i <= tt.slot_count; i++) {
            dbContainer.db.prepare(
              'INSERT OR IGNORE INTO tower_slots (id, tower_id, slot_index, channel_id) VALUES (?, ?, ?, NULL)'
            ).run(randomUUID(), newTowerId, i)
          }
          existingByName.set(tt.name, { id: newTowerId })
        }
        if (withChannels) {
          const tower = existingByName.get(tt.name)
          const tSlots = dbContainer.db.prepare('SELECT * FROM template_tower_slots WHERE tower_id = ?').all(tt.id)
          for (const ts of tSlots) {
            if (!ts.channel) continue
            const ch = dbContainer.db.prepare('SELECT id FROM channels WHERE show_id = ? AND channel = ?').get(show.id, ts.channel)
            if (ch) {
              dbContainer.db.prepare(
                'UPDATE tower_slots SET channel_id = ? WHERE tower_id = ? AND slot_index = ? AND channel_id IS NULL'
              ).run(ch.id, tower.id, ts.slot_index)
            }
          }
        }
      }
    }
  })
  tx()
}

// Speichert ausgewählte Show-Bars oder Show-Towers als Template-Einträge.
// fields: { channel, device, color, notes, position } — welche Felder übernommen werden
// Bestehende Template-Einträge gleichen Namens werden überschrieben.
export function saveShowItemsToTemplate(templateName, showSlug, scope, barOrTowerIds, fields = {}, overrideName = null) {
  const withChannels = !!(fields.channel || fields.device || fields.color || fields.notes || fields.position)
  const tpl = dbContainer.db.prepare('SELECT * FROM templates WHERE name = ?').get(templateName)
  if (!tpl) throw new Error('Template not found')
  const show = dbContainer.db.prepare('SELECT * FROM shows WHERE slug = ?').get(showSlug)
  if (!show) throw new Error('Show not found')
  const idSet = new Set(barOrTowerIds)

  const tx = dbContainer.db.transaction(() => {
    if (scope === 'bars') {
      const showBars = dbContainer.db.prepare('SELECT * FROM bars WHERE show_id = ? ORDER BY sort_order').all(show.id)
      const selectedBars = showBars.filter(b => idSet.has(b.id))
      const existingTplBars = dbContainer.db.prepare('SELECT * FROM template_bars WHERE template_id = ?').all(tpl.id)
      const tplBarByName = new Map(existingTplBars.map(b => [b.name, b]))
      const currentCount = existingTplBars.length

      let idx = 0
      for (const bar of selectedBars) {
        let tplBarId
        const barName = overrideName ?? bar.name
        if (tplBarByName.has(barName)) {
          tplBarId = tplBarByName.get(barName).id
          dbContainer.db.prepare(
            'UPDATE template_bars SET name=?, zug_nr=?, length_cm=?, sort_order=? WHERE id=?'
          ).run(barName, bar.zug_nr ?? '', bar.length_cm ?? 600, currentCount + idx, tplBarId)
        } else {
          tplBarId = randomUUID()
          dbContainer.db.prepare(
            'INSERT INTO template_bars (id, template_id, name, zug_nr, length_cm, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
          ).run(tplBarId, tpl.id, barName, bar.zug_nr ?? '', bar.length_cm ?? 600, currentCount + idx)
        }
        idx++

        if (withChannels) {
          dbContainer.db.prepare('DELETE FROM template_bar_fixtures WHERE bar_id = ?').run(tplBarId)
          const fixtures = dbContainer.db.prepare(`
            SELECT bf.*, c.channel, c.device, c.color
            FROM bar_fixtures bf LEFT JOIN channels c ON c.id = bf.channel_id
            WHERE bf.bar_id = ?
          `).all(bar.id)
          for (const fx of fixtures) {
            dbContainer.db.prepare(
              'INSERT INTO template_bar_fixtures (id, bar_id, position, channel, device, color, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
            ).run(
              randomUUID(), tplBarId,
              fields.position !== false ? fx.position : 0,
              fields.channel !== false ? (fx.channel ?? null) : null,
              fields.device  !== false ? (fx.device  ?? null) : null,
              fields.color   !== false ? (fx.color   ?? null) : null,
              fields.notes   !== false ? (fx.notes   ?? '')   : ''
            )
          }
        }
      }
    }

    if (scope === 'towers') {
      const showTowers = dbContainer.db.prepare('SELECT * FROM towers WHERE show_id = ? ORDER BY sort_order').all(show.id)
      const selectedTowers = showTowers.filter(t => idSet.has(t.id))
      const existingTplTowers = dbContainer.db.prepare('SELECT * FROM template_towers WHERE template_id = ?').all(tpl.id)
      const tplTowerByName = new Map(existingTplTowers.map(t => [t.name, t]))
      const currentCount = existingTplTowers.length

      let idx = 0
      for (const tower of selectedTowers) {
        let tplTowerId
        const towerName = overrideName ?? tower.name
        if (tplTowerByName.has(towerName)) {
          tplTowerId = tplTowerByName.get(towerName).id
          dbContainer.db.prepare(
            'UPDATE template_towers SET name=?, side=?, stage_area=?, slot_count=?, sort_order=? WHERE id=?'
          ).run(towerName, tower.side ?? '', tower.stage_area ?? '', tower.slot_count, currentCount + idx, tplTowerId)
        } else {
          tplTowerId = randomUUID()
          dbContainer.db.prepare(
            'INSERT INTO template_towers (id, template_id, name, side, stage_area, slot_count, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).run(tplTowerId, tpl.id, towerName, tower.side ?? '', tower.stage_area ?? '', tower.slot_count, currentCount + idx)
        }
        idx++

        ensureTemplateTowerSlots(tplTowerId, tower.slot_count)

        if (withChannels) {
          const slots = dbContainer.db.prepare('SELECT ts.*, c.channel, c.device, c.color FROM tower_slots ts LEFT JOIN channels c ON c.id = ts.channel_id WHERE ts.tower_id = ?').all(tower.id)
          for (const slot of slots) {
            dbContainer.db.prepare(
              'UPDATE template_tower_slots SET channel=?, device=?, color=? WHERE tower_id=? AND slot_index=?'
            ).run(
              fields.channel !== false ? (slot.channel ?? null) : null,
              fields.device  !== false ? (slot.device  ?? null) : null,
              fields.color   !== false ? (slot.color   ?? null) : null,
              tplTowerId, slot.slot_index
            )
          }
        }
      }
    }
  })
  tx()
}

// Wendet Template-Bars oder Sections-Struktur auf alle Shows mit diesem Template an.
// scope: 'bars' | 'sections' — bestehende Einträge werden nicht überschrieben.
// ── Template-Towers ──────────────────────────────────────────────────────────

export function readTemplateTowers(name) {
  const tpl = dbContainer.db.prepare('SELECT * FROM templates WHERE name = ?').get(name)
  if (!tpl) return []
  const towers = dbContainer.db.prepare('SELECT * FROM template_towers WHERE template_id = ? ORDER BY sort_order').all(tpl.id)
  for (const tower of towers) {
    tower.slots = dbContainer.db.prepare(
      'SELECT * FROM template_tower_slots WHERE tower_id = ? ORDER BY slot_index'
    ).all(tower.id)
  }
  return towers
}

export function writeTemplateTower(name, data) {
  const tpl = dbContainer.db.prepare('SELECT * FROM templates WHERE name = ?').get(name)
  if (!tpl) throw new Error(`Template not found: ${name}`)
  const id = data.id || randomUUID()
  const existing = dbContainer.db.prepare('SELECT id FROM template_towers WHERE id = ?').get(id)
  if (existing) {
    dbContainer.db.prepare(
      'UPDATE template_towers SET name=?, side=?, stage_area=?, slot_count=?, sort_order=? WHERE id=?'
    ).run(data.name ?? '', data.side ?? '', data.stage_area ?? '', data.slot_count ?? 4, data.sort_order ?? 0, id)
  } else {
    const count = dbContainer.db.prepare('SELECT COUNT(*) as n FROM template_towers WHERE template_id = ?').get(tpl.id).n
    dbContainer.db.prepare(
      'INSERT INTO template_towers (id, template_id, name, side, stage_area, slot_count, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, tpl.id, data.name ?? '', data.side ?? '', data.stage_area ?? '', data.slot_count ?? 4, data.sort_order ?? count)
  }
  return id
}

export function deleteTemplateTower(towerId) {
  dbContainer.db.prepare('DELETE FROM template_towers WHERE id = ?').run(towerId)
}

export function reorderTemplateTowers(templateId, orderedIds) {
  const update = dbContainer.db.prepare('UPDATE template_towers SET sort_order = ? WHERE id = ? AND template_id = ?')
  const tx = dbContainer.db.transaction(() => {
    orderedIds.forEach((id, i) => update.run(i, id, templateId))
  })
  tx()
}

export function writeTemplateTowerSlot(towerId, slotIndex, data) {
  const id = randomUUID()
  dbContainer.db.prepare(`
    INSERT INTO template_tower_slots (id, tower_id, slot_index, channel, device, color)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(tower_id, slot_index) DO UPDATE SET channel=excluded.channel, device=excluded.device, color=excluded.color
  `).run(id, towerId, slotIndex, data.channel ?? null, data.device ?? null, data.color ?? null)
}

export function clearTemplateTowerSlot(towerId, slotIndex) {
  dbContainer.db.prepare(
    'UPDATE template_tower_slots SET channel=NULL, device=NULL, color=NULL WHERE tower_id = ? AND slot_index = ?'
  ).run(towerId, slotIndex)
}

export function ensureTemplateTowerSlots(towerId, slotCount) {
  for (let i = 1; i <= slotCount; i++) {
    const exists = dbContainer.db.prepare(
      'SELECT id FROM template_tower_slots WHERE tower_id = ? AND slot_index = ?'
    ).get(towerId, i)
    if (!exists) {
      dbContainer.db.prepare(
        'INSERT INTO template_tower_slots (id, tower_id, slot_index) VALUES (?, ?, ?)'
      ).run(randomUUID(), towerId, i)
    }
  }
  dbContainer.db.prepare(
    'DELETE FROM template_tower_slots WHERE tower_id = ? AND slot_index > ?'
  ).run(towerId, slotCount)
}

// ── Template-Bar-Fixtures ────────────────────────────────────────────────────

export function readTemplateBarFixtures(barId) {
  return dbContainer.db.prepare('SELECT * FROM template_bar_fixtures WHERE bar_id = ? ORDER BY position').all(barId)
}

export function writeTemplateBarFixture(barId, data) {
  const id = data.id || randomUUID()
  const existing = dbContainer.db.prepare('SELECT id FROM template_bar_fixtures WHERE id = ?').get(id)
  if (existing) {
    dbContainer.db.prepare(
      'UPDATE template_bar_fixtures SET position=?, channel=?, device=?, color=?, notes=? WHERE id=?'
    ).run(data.position ?? 0, data.channel ?? null, data.device ?? null, data.color ?? null, data.notes ?? '', id)
  } else {
    dbContainer.db.prepare(
      'INSERT INTO template_bar_fixtures (id, bar_id, position, channel, device, color, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, barId, data.position ?? 0, data.channel ?? null, data.device ?? null, data.color ?? null, data.notes ?? '')
  }
  return id
}

export function deleteTemplateBarFixture(fixtureId) {
  dbContainer.db.prepare('DELETE FROM template_bar_fixtures WHERE id = ?').run(fixtureId)
}

export function applyTemplateToAllShows(templateName, scope) {
  const tpl = dbContainer.db.prepare('SELECT * FROM templates WHERE name = ?').get(templateName)
  if (!tpl) throw new Error('Template not found')

  const shows = dbContainer.db.prepare('SELECT * FROM shows WHERE template = ? AND archived = 0').all(templateName)

  const tBars    = scope === 'bars'    ? dbContainer.db.prepare('SELECT * FROM template_bars WHERE template_id = ? ORDER BY sort_order').all(tpl.id) : []
  const tTowers  = scope === 'towers'  ? dbContainer.db.prepare('SELECT * FROM template_towers WHERE template_id = ? ORDER BY sort_order').all(tpl.id) : []
  const tDefs    = scope === 'sections' ? dbContainer.db.prepare('SELECT * FROM template_section_defs WHERE template_id = ? ORDER BY sort_order').all(tpl.id) : []

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

  // Slot-Infos für Template-Towers vorab laden
  const tTowerSlotsByTower = new Map()
  if (tTowers.length) {
    const tSlots = dbContainer.db.prepare(
      `SELECT * FROM template_tower_slots WHERE tower_id IN (${tTowers.map(() => '?').join(',')})`
    ).all(tTowers.map(t => t.id))
    for (const s of tSlots) {
      if (!tTowerSlotsByTower.has(s.tower_id)) tTowerSlotsByTower.set(s.tower_id, [])
      tTowerSlotsByTower.get(s.tower_id).push(s)
    }
  }

  const insertBar     = dbContainer.db.prepare('INSERT INTO bars (id, show_id, name, zug_nr, length_cm, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const insertTower   = dbContainer.db.prepare('INSERT INTO towers (id, show_id, name, side, stage_area, slot_count, sort_order, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const insertSlot    = dbContainer.db.prepare('INSERT OR IGNORE INTO tower_slots (id, tower_id, slot_index, channel_id) VALUES (?, ?, ?, NULL)')
  const insertDef     = dbContainer.db.prepare('INSERT INTO section_defs (id, show_id, title, type, sort_order) VALUES (?, ?, ?, ?, ?)')
  const insertKvRow   = dbContainer.db.prepare('INSERT INTO section_kv_rows (id, section_id, label, value, sort_order) VALUES (?, ?, ?, ?, ?)')
  const insertField   = dbContainer.db.prepare('INSERT INTO section_fields (id, section_id, key, label, unit, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
  const insertContent = dbContainer.db.prepare('INSERT INTO section_contents (section_id, show_id, content) VALUES (?, ?, ?)')

  const stats = { shows: shows.length, barsAdded: 0, towersAdded: 0, sectionsAdded: 0 }

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

      // Towers: fehlende nach Name hinzufügen
      const existingTowers = dbContainer.db.prepare('SELECT name FROM towers WHERE show_id = ?').all(show.id)
      const existingTowerNames = new Set(existingTowers.map(t => t.name))
      const existingTowerCount = existingTowers.length

      for (const tt of tTowers) {
        if (!existingTowerNames.has(tt.name)) {
          const newTowerId = randomUUID()
          insertTower.run(newTowerId, show.id, tt.name, tt.side, tt.stage_area, tt.slot_count, existingTowerCount + stats.towersAdded, '', Date.now())
          for (let i = 1; i <= tt.slot_count; i++) {
            insertSlot.run(randomUUID(), newTowerId, i)
          }
          stats.towersAdded++
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
