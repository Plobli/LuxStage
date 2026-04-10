// LuxStage/server/db.js
import { db } from './db-init.js'
import { config } from './config.js'
import { randomUUID } from 'node:crypto'
import { hashPassword } from './auth.js'

// ── Hilfsfunktionen ────────────────────────────────────────────────────────

function now() { return Date.now() }

// ── Shows ──────────────────────────────────────────────────────────────────

export function listShows() {
  return db.prepare('SELECT * FROM shows WHERE archived = 0 ORDER BY created_at DESC').all()
}

export function listArchivedShows() {
  return db.prepare('SELECT * FROM shows WHERE archived = 1 ORDER BY created_at DESC').all()
}

export function readShow(slug) {
  return db.prepare('SELECT * FROM shows WHERE slug = ?').get(slug) ?? null
}

export function writeShow(slug, fields) {
  const allowed = ['name', 'datum', 'template', 'untertitel', 'spielzeit', 'setup_markdown', 'eos_active_channels']
  const updates = Object.fromEntries(
    Object.entries(fields).filter(([k]) => allowed.includes(k))
  )
  if (!Object.keys(updates).length) return
  const sets = Object.keys(updates).map(k => `${k} = @${k}`).join(', ')
  db.prepare(`UPDATE shows SET ${sets}, updated_at = @updated_at WHERE slug = @slug`)
    .run({ ...updates, updated_at: now(), slug })
}

export function createShow(slug, fields) {
  const tx = db.transaction(() => {
    const id = randomUUID()
    const ts = now()
    db.prepare(`
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
      const tpl = db.prepare('SELECT * FROM templates WHERE name = ?').get(fields.template)
      if (tpl) {
        _copyTemplateToShow(tpl.id, id)
      }
    }
  })
  tx()
}

function _copyTemplateToShow(templateId, showId) {
  const tDefs = db.prepare('SELECT * FROM template_section_defs WHERE template_id = ? ORDER BY sort_order').all(templateId)
  for (const tDef of tDefs) {
    const newDefId = randomUUID()
    db.prepare(`
      INSERT INTO section_defs (id, show_id, title, type, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).run(newDefId, showId, tDef.title, tDef.type, tDef.sort_order)

    const tFields = db.prepare('SELECT * FROM template_section_fields WHERE section_id = ? ORDER BY sort_order').all(tDef.id)
    for (const tField of tFields) {
      db.prepare(`
        INSERT INTO section_fields (id, section_id, key, label, unit, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), newDefId, tField.key, tField.label, tField.unit, tField.sort_order)
    }

    // Leerer Content-Eintrag
    db.prepare('INSERT INTO section_contents (section_id, show_id, content) VALUES (?, ?, ?)')
      .run(newDefId, showId, tDef.type === 'fields' ? '{}' : '')
  }
}

export function archiveShow(slug) {
  db.prepare('UPDATE shows SET archived = 1, updated_at = ? WHERE slug = ?').run(now(), slug)
}

export function restoreShow(slug) {
  db.prepare('UPDATE shows SET archived = 0, updated_at = ? WHERE slug = ?').run(now(), slug)
}

export function deleteShow(slug) {
  db.prepare('DELETE FROM shows WHERE slug = ?').run(slug)
}

// ── Channels ────────────────────────────────────────────────────────────────

export function readChannels(slug) {
  const show = readShow(slug)
  if (!show) return []
  return db.prepare('SELECT * FROM channels WHERE show_id = ? ORDER BY sort_order').all(show.id)
}

export function writeChannels(slug, channels) {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM channels WHERE show_id = ?').run(show.id)
    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i]
      db.prepare(`
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
    db.prepare('UPDATE shows SET updated_at = ? WHERE id = ?').run(now(), show.id)
  })
  tx()
}

// ── Locking ─────────────────────────────────────────────────────────────────

export function acquireLock(slug, username) {
  const show = readShow(slug)
  if (!show) return { ok: false }
  const existing = db.prepare('SELECT * FROM locks WHERE show_id = ?').get(show.id)
  if (existing) {
    const age = Date.now() - existing.since
    if (age < config.lockTimeout && existing.username !== username) {
      return { ok: false, lockedBy: existing.username, since: existing.since }
    }
  }
  db.prepare('INSERT OR REPLACE INTO locks (show_id, username, since) VALUES (?, ?, ?)')
    .run(show.id, username, Date.now())
  return { ok: true }
}

export function releaseLock(slug, username) {
  const show = readShow(slug)
  if (!show) return
  const lock = db.prepare('SELECT * FROM locks WHERE show_id = ?').get(show.id)
  if (lock?.username === username) {
    db.prepare('DELETE FROM locks WHERE show_id = ?').run(show.id)
  }
}

export function touchLock(slug, username) {
  const show = readShow(slug)
  if (!show) return
  db.prepare('UPDATE locks SET since = ? WHERE show_id = ? AND username = ?')
    .run(Date.now(), show.id, username)
}

export function getLock(slug) {
  const show = readShow(slug)
  if (!show) return null
  const lock = db.prepare('SELECT * FROM locks WHERE show_id = ?').get(show.id)
  if (!lock) return null
  if (Date.now() - lock.since >= config.lockTimeout) {
    db.prepare('DELETE FROM locks WHERE show_id = ?').run(show.id)
    return null
  }
  return { user: lock.username, since: lock.since }
}

// ── Sections ────────────────────────────────────────────────────────────────

export function readShowSectionDefs(slug) {
  const show = readShow(slug)
  if (!show) return []
  const defs = db.prepare('SELECT * FROM section_defs WHERE show_id = ? ORDER BY sort_order').all(show.id)
  return defs.map(def => ({
    id: def.id,
    title: def.title,
    type: def.type,
    order: def.sort_order,
    fields: db.prepare('SELECT * FROM section_fields WHERE section_id = ? ORDER BY sort_order')
      .all(def.id)
      .map(f => ({ id: f.id, key: f.key, label: f.label, unit: f.unit })),
  }))
}

export function writeShowSectionDefs(slug, defs) {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM section_defs WHERE show_id = ?').run(show.id)
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i]
      db.prepare('INSERT INTO section_defs (id, show_id, title, type, sort_order) VALUES (?, ?, ?, ?, ?)')
        .run(def.id, show.id, def.title, def.type, def.order ?? i)
      const fields = def.fields ?? []
      for (let j = 0; j < fields.length; j++) {
        const f = fields[j]
        db.prepare('INSERT INTO section_fields (id, section_id, key, label, unit, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
          .run(f.id ?? randomUUID(), def.id, f.key, f.label ?? '', f.unit ?? '', j)
      }
      db.prepare('INSERT OR IGNORE INTO section_contents (section_id, show_id, content) VALUES (?, ?, ?)')
        .run(def.id, show.id, def.type === 'fields' ? '{}' : '')
    }
    db.prepare('UPDATE shows SET updated_at = ? WHERE id = ?').run(now(), show.id)
  })
  tx()
}

export function readShowSections(slug) {
  const show = readShow(slug)
  if (!show) return new Map()
  const rows = db.prepare(`
    SELECT sc.section_id, sc.content FROM section_contents sc
    WHERE sc.show_id = ?
  `).all(show.id)
  return new Map(rows.map(r => [r.section_id, r.content ?? '']))
}

export function writeShowSections(slug, map) {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)
  const tx = db.transaction(() => {
    for (const [sectionId, content] of map) {
      db.prepare('INSERT OR REPLACE INTO section_contents (section_id, show_id, content) VALUES (?, ?, ?)')
        .run(sectionId, show.id, content)
    }
    db.prepare('UPDATE shows SET updated_at = ? WHERE id = ?').run(now(), show.id)
  })
  tx()
}

// ── Templates ────────────────────────────────────────────────────────────────

export function listTemplates() {
  // Gibt Namen ohne .csv zurück (z.B. "kammer-1")
  return db.prepare('SELECT name FROM templates ORDER BY name').all().map(r => r.name)
}

export function readTemplate(name) {
  const tpl = db.prepare('SELECT * FROM templates WHERE name = ?').get(name)
  if (!tpl) return []
  return db.prepare('SELECT * FROM template_channels WHERE template_id = ? ORDER BY sort_order').all(tpl.id)
}

export function writeTemplate(name, channels) {
  const tx = db.transaction(() => {
    let tpl = db.prepare('SELECT * FROM templates WHERE name = ?').get(name)
    if (!tpl) {
      const id = randomUUID()
      db.prepare('INSERT INTO templates (id, name) VALUES (?, ?)').run(id, name)
      tpl = { id }
    }
    db.prepare('DELETE FROM template_channels WHERE template_id = ?').run(tpl.id)
    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i]
      db.prepare(`
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
  db.prepare('DELETE FROM templates WHERE name = ?').run(name)
}

export function readTemplateSections(name) {
  const tpl = db.prepare('SELECT * FROM templates WHERE name = ?').get(name)
  if (!tpl) return []
  const defs = db.prepare('SELECT * FROM template_section_defs WHERE template_id = ? ORDER BY sort_order').all(tpl.id)
  return defs.map(def => ({
    id: def.id,
    title: def.title,
    type: def.type,
    order: def.sort_order,
    fields: db.prepare('SELECT * FROM template_section_fields WHERE section_id = ? ORDER BY sort_order')
      .all(def.id)
      .map(f => ({ id: f.id, key: f.key, label: f.label, unit: f.unit })),
  }))
}

export function writeTemplateSections(name, defs) {
  const tx = db.transaction(() => {
    let tpl = db.prepare('SELECT * FROM templates WHERE name = ?').get(name)
    if (!tpl) {
      const id = randomUUID()
      db.prepare('INSERT INTO templates (id, name) VALUES (?, ?)').run(id, name)
      tpl = { id }
    }
    db.prepare('DELETE FROM template_section_defs WHERE template_id = ?').run(tpl.id)
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i]
      db.prepare('INSERT INTO template_section_defs (id, template_id, title, type, sort_order) VALUES (?, ?, ?, ?, ?)')
        .run(def.id ?? randomUUID(), tpl.id, def.title, def.type, def.order ?? i)
      for (let j = 0; j < (def.fields ?? []).length; j++) {
        const f = def.fields[j]
        db.prepare('INSERT INTO template_section_fields (id, section_id, key, label, unit, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
          .run(f.id ?? randomUUID(), def.id, f.key, f.label ?? '', f.unit ?? '', j)
      }
    }
  })
  tx()
}

export function deleteTemplateSections(name) {
  const tpl = db.prepare('SELECT * FROM templates WHERE name = ?').get(name)
  if (!tpl) return
  db.prepare('DELETE FROM template_section_defs WHERE template_id = ?').run(tpl.id)
}

// ── Foto-Beschreibungen ────────────────────────────────────────────────────

export function readPhotoDescriptions(slug) {
  const show = readShow(slug)
  if (!show) return {}
  const rows = db.prepare('SELECT filename, caption, channel_number FROM photo_descriptions WHERE show_id = ?').all(show.id)
  return Object.fromEntries(rows.map(r => [r.filename, { caption: r.caption, channelNumber: r.channel_number ?? '' }]))
}

export function writePhotoDescription(slug, filename, caption, channelNumber = '') {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)
  db.prepare(`
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
  db.prepare('DELETE FROM photo_descriptions WHERE show_id = ? AND filename = ?').run(show.id, filename)
}

export function readPhotoOrder(slug) {
  const show = readShow(slug)
  if (!show) return []
  return db.prepare('SELECT filename FROM photo_order WHERE show_id = ? ORDER BY sort_order')
    .all(show.id)
    .map(r => r.filename)
}

export function writePhotoOrder(slug, order) {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM photo_order WHERE show_id = ?').run(show.id)
    for (let i = 0; i < order.length; i++) {
      db.prepare('INSERT INTO photo_order (show_id, filename, sort_order) VALUES (?, ?, ?)')
        .run(show.id, order[i], i)
    }
  })
  tx()
}

export function deletePhotoOrderEntry(slug, filename) {
  const show = readShow(slug)
  if (!show) return
  db.prepare('DELETE FROM photo_order WHERE show_id = ? AND filename = ?').run(show.id, filename)
}

// ── Benutzer-Passwörter ────────────────────────────────────────────────────

/** Gibt das Passwort aus der DB zurück, oder null wenn keins gesetzt. */
export function getDbPassword(username) {
  const row = db.prepare('SELECT password FROM users WHERE username = ?').get(username)
  return row?.password ?? null
}

/** Setzt das Passwort eines Benutzers in der DB (überschreibt Env-Passwort). */
export async function changePassword(username, newPassword) {
  const hash = await hashPassword(newPassword)
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET password = excluded.password')
    .run(username, hash)
}

/** Alle Benutzer aus DB + Env zusammengeführt (DB hat Vorrang). */
export function listUsers(configUsers) {
  const dbUsers = db.prepare('SELECT username, role FROM users').all()
  const dbMap = new Map(dbUsers.map(u => [u.username, u]))
  // Env-User, die nicht in DB sind
  const envOnly = configUsers
    .filter(u => !dbMap.has(u.username))
    .map(u => ({ username: u.username, role: u.role, source: 'env' }))
  const dbList = dbUsers.map(u => ({ username: u.username, role: u.role, source: 'db' }))
  return [...dbList, ...envOnly]
}

/** Legt einen neuen Benutzer in der DB an (oder überschreibt bestehenden). */
export async function createUser(username, password, role) {
  const hash = await hashPassword(password)
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?) ON CONFLICT(username) DO UPDATE SET password = excluded.password, role = excluded.role')
    .run(username, hash, role)
}

/** Löscht einen Benutzer aus der DB. Env-User können nicht gelöscht werden. */
export function deleteUser(username) {
  db.prepare('DELETE FROM users WHERE username = ?').run(username)
}
