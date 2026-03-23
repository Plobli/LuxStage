// LuxStage/server/db.js
import { db } from './db-init.js'
import { config } from './config.js'

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
  const allowed = ['name', 'datum', 'template', 'untertitel', 'spielzeit']
  const updates = Object.fromEntries(
    Object.entries(fields).filter(([k]) => allowed.includes(k))
  )
  const sets = Object.keys(updates).map(k => `${k} = @${k}`).join(', ')
  db.prepare(`UPDATE shows SET ${sets}, updated_at = @updated_at WHERE slug = @slug`)
    .run({ ...updates, updated_at: now(), slug })
}

export function createShow(slug, fields) {
  const id = crypto.randomUUID()
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
}

function _copyTemplateToShow(templateId, showId) {
  const tDefs = db.prepare('SELECT * FROM template_section_defs WHERE template_id = ? ORDER BY sort_order').all(templateId)
  for (const tDef of tDefs) {
    const newDefId = crypto.randomUUID()
    db.prepare(`
      INSERT INTO section_defs (id, show_id, title, type, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).run(newDefId, showId, tDef.title, tDef.type, tDef.sort_order)

    const tFields = db.prepare('SELECT * FROM template_section_fields WHERE section_id = ? ORDER BY sort_order').all(tDef.id)
    for (const tField of tFields) {
      db.prepare(`
        INSERT INTO section_fields (id, section_id, key, label, unit, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), newDefId, tField.key, tField.label, tField.unit, tField.sort_order)
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
        ch.id ?? crypto.randomUUID(),
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
