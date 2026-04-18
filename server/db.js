// LuxStage/server/db.js
import { dbContainer } from './db-init.js'
import { config } from './config.js'
import { randomUUID } from 'node:crypto'
import { hashPassword } from './auth.js'

// ── Hilfsfunktionen ────────────────────────────────────────────────────────

function now() { return Date.now() }

// ── Shows ──────────────────────────────────────────────────────────────────

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

function touchLastEdited(showId, username) {
  dbContainer.db.prepare('UPDATE shows SET last_edited_by = ?, last_edited_at = ? WHERE id = ?')
    .run(username, now(), showId)
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

    // Template-Sections kopieren wenn Template angegeben
    if (fields.template) {
      const tpl = dbContainer.db.prepare('SELECT * FROM templates WHERE name = ?').get(fields.template)
      if (tpl) {
        _copyTemplateToShow(tpl.id, id)
      }
    }
  })
  tx()
}

function _copyTemplateToShow(templateId, showId) {
  const tDefs = dbContainer.db.prepare('SELECT * FROM template_section_defs WHERE template_id = ? ORDER BY sort_order').all(templateId)
  for (const tDef of tDefs) {
    const newDefId = randomUUID()
    dbContainer.db.prepare(`
      INSERT INTO section_defs (id, show_id, title, type, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).run(newDefId, showId, tDef.title, tDef.type, tDef.sort_order)

    if (tDef.type === 'kv-table') {
      const tRows = dbContainer.db.prepare('SELECT * FROM template_section_kv_rows WHERE section_id = ? ORDER BY sort_order').all(tDef.id)
      for (const tRow of tRows) {
        dbContainer.db.prepare(`
          INSERT INTO section_kv_rows (id, section_id, label, value, sort_order)
          VALUES (?, ?, ?, ?, ?)
        `).run(randomUUID(), newDefId, tRow.label, tRow.value, tRow.sort_order)
      }
    } else {
      const tFields = dbContainer.db.prepare('SELECT * FROM template_section_fields WHERE section_id = ? ORDER BY sort_order').all(tDef.id)
      for (const tField of tFields) {
        dbContainer.db.prepare(`
          INSERT INTO section_fields (id, section_id, key, label, unit, sort_order)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(randomUUID(), newDefId, tField.key, tField.label, tField.unit, tField.sort_order)
      }
      // Leerer Content-Eintrag nur für markdown/fields
      dbContainer.db.prepare('INSERT INTO section_contents (section_id, show_id, content) VALUES (?, ?, ?)')
        .run(newDefId, showId, tDef.type === 'fields' ? '{}' : '')
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

// ── Channels ────────────────────────────────────────────────────────────────

export function readChannels(slug) {
  const show = readShow(slug)
  if (!show) return []
  return dbContainer.db.prepare('SELECT * FROM channels WHERE show_id = ? ORDER BY sort_order').all(show.id)
}

export function writeChannels(slug, channels, editedBy = null) {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)
  const tx = dbContainer.db.transaction(() => {
    dbContainer.db.prepare('DELETE FROM channels WHERE show_id = ?').run(show.id)
    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i]
      dbContainer.db.prepare(`
        INSERT INTO channels (id, show_id, channel, address, device, position, color, notes, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        show.id,
        ch.channel ?? '', ch.address ?? '', ch.device ?? '',
        ch.position ?? '', ch.color ?? '', ch.notes ?? '',
        i
      )
    }
    const ts = now()
    dbContainer.db.prepare('UPDATE shows SET updated_at = ? WHERE id = ?').run(ts, show.id)
    if (editedBy) touchLastEdited(show.id, editedBy)
  })
  tx()
}

// ── Locking ─────────────────────────────────────────────────────────────────

export function acquireLock(slug, username) {
  const show = readShow(slug)
  if (!show) return { ok: false }
  const existing = dbContainer.db.prepare('SELECT * FROM locks WHERE show_id = ?').get(show.id)
  if (existing) {
    const age = Date.now() - existing.since
    if (age < config.lockTimeout && existing.username !== username) {
      return { ok: false, lockedBy: existing.username, since: existing.since }
    }
  }
  dbContainer.db.prepare('INSERT OR REPLACE INTO locks (show_id, username, since) VALUES (?, ?, ?)')
    .run(show.id, username, Date.now())
  return { ok: true }
}

export function releaseLock(slug, username) {
  const show = readShow(slug)
  if (!show) return
  const lock = dbContainer.db.prepare('SELECT * FROM locks WHERE show_id = ?').get(show.id)
  if (lock?.username === username) {
    dbContainer.db.prepare('DELETE FROM locks WHERE show_id = ?').run(show.id)
  }
}

export function touchLock(slug, username) {
  const show = readShow(slug)
  if (!show) return
  dbContainer.db.prepare('UPDATE locks SET since = ? WHERE show_id = ? AND username = ?')
    .run(Date.now(), show.id, username)
}

export function getLock(slug) {
  const show = readShow(slug)
  if (!show) return null
  const lock = dbContainer.db.prepare('SELECT * FROM locks WHERE show_id = ?').get(show.id)
  if (!lock) return null
  if (Date.now() - lock.since >= config.lockTimeout) {
    dbContainer.db.prepare('DELETE FROM locks WHERE show_id = ?').run(show.id)
    return null
  }
  return { user: lock.username, since: lock.since }
}

// ── Sections ────────────────────────────────────────────────────────────────

export function readShowSectionDefs(slug) {
  const show = readShow(slug)
  if (!show) return []
  const defs = dbContainer.db.prepare('SELECT * FROM section_defs WHERE show_id = ? ORDER BY sort_order').all(show.id)
  return defs.map(def => {
    if (def.type === 'kv-table') {
      return {
        id: def.id,
        title: def.title,
        type: def.type,
        order: def.sort_order,
        rows: dbContainer.db.prepare('SELECT * FROM section_kv_rows WHERE section_id = ? ORDER BY sort_order')
          .all(def.id)
          .map(r => ({ id: r.id, label: r.label, value: r.value, sort_order: r.sort_order })),
      }
    }
    return {
      id: def.id,
      title: def.title,
      type: def.type,
      order: def.sort_order,
      fields: dbContainer.db.prepare('SELECT * FROM section_fields WHERE section_id = ? ORDER BY sort_order')
        .all(def.id)
        .map(f => ({ id: f.id, key: f.key, label: f.label, unit: f.unit })),
    }
  })
}

export function writeShowSectionDefs(slug, defs, editedBy = null) {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)
  const tx = dbContainer.db.transaction(() => {
    // Bestehende section_contents retten, bevor CASCADE sie löscht
    const savedContents = dbContainer.db.prepare(
      'SELECT section_id, content FROM section_contents WHERE show_id = ?'
    ).all(show.id)
    const contentMap = new Map(savedContents.map(r => [r.section_id, r.content]))

    dbContainer.db.prepare('DELETE FROM section_defs WHERE show_id = ?').run(show.id)
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i]
      dbContainer.db.prepare('INSERT INTO section_defs (id, show_id, title, type, sort_order) VALUES (?, ?, ?, ?, ?)')
        .run(def.id, show.id, def.title, def.type, def.order ?? i)
      if (def.type === 'kv-table') {
        const rows = def.rows ?? []
        for (let j = 0; j < rows.length; j++) {
          const r = rows[j]
          dbContainer.db.prepare('INSERT INTO section_kv_rows (id, section_id, label, value, sort_order) VALUES (?, ?, ?, ?, ?)')
            .run(r.id ?? randomUUID(), def.id, r.label ?? '', r.value ?? '', r.sort_order ?? j)
        }
      } else {
        const fields = def.fields ?? []
        for (let j = 0; j < fields.length; j++) {
          const f = fields[j]
          dbContainer.db.prepare('INSERT INTO section_fields (id, section_id, key, label, unit, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
            .run(f.id ?? randomUUID(), def.id, f.key, f.label ?? '', f.unit ?? '', j)
        }
        // Vorhandenen Content wiederherstellen; nur wenn neu, leeren Eintrag anlegen
        const existingContent = contentMap.get(def.id)
        const fallback = def.type === 'fields' ? '{}' : ''
        dbContainer.db.prepare('INSERT INTO section_contents (section_id, show_id, content) VALUES (?, ?, ?)')
          .run(def.id, show.id, existingContent ?? fallback)
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
  const tx = dbContainer.db.transaction(() => {
    for (const [sectionId, content] of map) {
      dbContainer.db.prepare('INSERT OR REPLACE INTO section_contents (section_id, show_id, content) VALUES (?, ?, ?)')
        .run(sectionId, show.id, content)
    }
    dbContainer.db.prepare('UPDATE shows SET updated_at = ? WHERE id = ?').run(now(), show.id)
    if (editedBy) touchLastEdited(show.id, editedBy)
  })
  tx()
}

// ── Templates ────────────────────────────────────────────────────────────────

export function listTemplates() {
  // Gibt Namen ohne .csv zurück (z.B. "kammer-1")
  return dbContainer.db.prepare('SELECT name FROM templates ORDER BY name').all().map(r => r.name)
}

export function getTemplateByName(name) {
  return dbContainer.db.prepare('SELECT * FROM templates WHERE name = ?').get(name) ?? null
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
  return defs.map(def => {
    if (def.type === 'kv-table') {
      return {
        id: def.id,
        title: def.title,
        type: def.type,
        order: def.sort_order,
        rows: dbContainer.db.prepare('SELECT * FROM template_section_kv_rows WHERE section_id = ? ORDER BY sort_order')
          .all(def.id)
          .map(r => ({ id: r.id, label: r.label, value: r.value, sort_order: r.sort_order })),
      }
    }
    return {
      id: def.id,
      title: def.title,
      type: def.type,
      order: def.sort_order,
      fields: dbContainer.db.prepare('SELECT * FROM template_section_fields WHERE section_id = ? ORDER BY sort_order')
        .all(def.id)
        .map(f => ({ id: f.id, key: f.key, label: f.label, unit: f.unit })),
    }
  })
}

export function writeTemplateSections(name, defs) {
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
      dbContainer.db.prepare('INSERT INTO template_section_defs (id, template_id, title, type, sort_order) VALUES (?, ?, ?, ?, ?)')
        .run(def.id ?? randomUUID(), tpl.id, def.title, def.type, def.order ?? i)
      if (def.type === 'kv-table') {
        for (let j = 0; j < (def.rows ?? []).length; j++) {
          const r = def.rows[j]
          dbContainer.db.prepare('INSERT INTO template_section_kv_rows (id, section_id, label, value, sort_order) VALUES (?, ?, ?, ?, ?)')
            .run(r.id ?? randomUUID(), def.id, r.label ?? '', r.value ?? '', r.sort_order ?? j)
        }
      } else {
        for (let j = 0; j < (def.fields ?? []).length; j++) {
          const f = def.fields[j]
          dbContainer.db.prepare('INSERT INTO template_section_fields (id, section_id, key, label, unit, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
            .run(f.id ?? randomUUID(), def.id, f.key, f.label ?? '', f.unit ?? '', j)
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

// ── Foto-Beschreibungen ────────────────────────────────────────────────────

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
  const tx = dbContainer.db.transaction(() => {
    dbContainer.db.prepare('DELETE FROM photo_order WHERE show_id = ?').run(show.id)
    for (let i = 0; i < order.length; i++) {
      dbContainer.db.prepare('INSERT INTO photo_order (show_id, filename, sort_order) VALUES (?, ?, ?)')
        .run(show.id, order[i], i)
    }
    dbContainer.db.prepare('UPDATE shows SET updated_at = ? WHERE id = ?').run(now(), show.id)
  })
  tx()
}

export function deletePhotoOrderEntry(slug, filename) {
  const show = readShow(slug)
  if (!show) return
  dbContainer.db.prepare('DELETE FROM photo_order WHERE show_id = ? AND filename = ?').run(show.id, filename)
}

// ── Benutzer-Passwörter ────────────────────────────────────────────────────

/** Gibt das Passwort aus der DB zurück, oder null wenn keins gesetzt. */
export function getDbPassword(username) {
  const row = dbContainer.db.prepare('SELECT password FROM users WHERE username = ?').get(username)
  return row?.password ?? null
}

/** Setzt das Passwort eines Benutzers in der DB (überschreibt Env-Passwort). */
export async function changePassword(username, newPassword, requiresChange = 0) {
  const hash = await hashPassword(newPassword)
  dbContainer.db.prepare(`
    INSERT INTO users (username, password, requires_password_change)
    VALUES (?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET
      password = excluded.password,
      requires_password_change = excluded.requires_password_change
  `).run(username, hash, requiresChange ? 1 : 0)
}

/** Alle Benutzer aus der DB. */
export function listUsers() {
  return dbContainer.db.prepare('SELECT username, role FROM users').all()
    .map(u => ({ username: u.username, role: u.role, source: 'db' }))
}

/** Legt einen neuen Benutzer in der DB an (oder überschreibt bestehenden). */
export async function createUser(username, password, role) {
  const hash = await hashPassword(password)
  dbContainer.db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?) ON CONFLICT(username) DO UPDATE SET password = excluded.password, role = excluded.role')
    .run(username, hash, role)
}

/** Löscht einen Benutzer aus der DB. Env-User können nicht gelöscht werden. */
export function deleteUser(username) {
  dbContainer.db.prepare('DELETE FROM users WHERE username = ?').run(username)
}

// ── Grundriss ──────────────────────────────────────────────────────────────

export function getTemplateFloorplan(templateId) {
  return dbContainer.db.prepare(
    'SELECT * FROM template_floorplans WHERE template_id = ?'
  ).get(templateId) ?? null
}

export function upsertTemplateFloorplan(templateId, imagePath) {
  const existing = getTemplateFloorplan(templateId)
  if (existing) {
    dbContainer.db.prepare(
      'UPDATE template_floorplans SET image_path = ? WHERE template_id = ?'
    ).run(imagePath, templateId)
  } else {
    dbContainer.db.prepare(
      'INSERT INTO template_floorplans (id, template_id, image_path, created_at) VALUES (?, ?, ?, ?)'
    ).run(randomUUID(), templateId, imagePath, now())
  }
}

export function getShowFloorplan(showId) {
  return dbContainer.db.prepare(
    'SELECT * FROM show_floorplan_layers WHERE show_id = ?'
  ).get(showId) ?? null
}

export function upsertShowFloorplanImage(showId, imagePath) {
  const existing = getShowFloorplan(showId)
  if (existing) {
    dbContainer.db.prepare(
      'UPDATE show_floorplan_layers SET image_path = ?, updated_at = ? WHERE show_id = ?'
    ).run(imagePath, now(), showId)
  } else {
    dbContainer.db.prepare(
      'INSERT INTO show_floorplan_layers (id, show_id, image_path, updated_at) VALUES (?, ?, ?, ?)'
    ).run(randomUUID(), showId, imagePath, now())
  }
}

export function upsertShowFloorplanData(showId, canvasData) {
  const existing = getShowFloorplan(showId)
  if (existing) {
    dbContainer.db.prepare(
      'UPDATE show_floorplan_layers SET canvas_data = ?, updated_at = ? WHERE show_id = ?'
    ).run(canvasData, now(), showId)
  } else {
    dbContainer.db.prepare(
      'INSERT INTO show_floorplan_layers (id, show_id, canvas_data, updated_at) VALUES (?, ?, ?, ?)'
    ).run(randomUUID(), showId, canvasData, now())
  }
}
