// LuxStage/server/migrate.js
/**
 * Einmaliges Migrations-Skript: Liest alle bestehenden Show-Verzeichnisse
 * und importiert die Daten in SQLite. Idempotent — kann mehrfach ausgeführt werden.
 *
 * Aufruf: node server/migrate.js
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { config } from './config.js'
import { db as sqliteDb } from './db-init.js'
import * as db from './db.js'

const dataPath = config.dataPath
const showsPath = path.join(dataPath, 'shows')
const archivPath = path.join(dataPath, 'shows', 'archiv')
const templatesPath = path.join(dataPath, 'templates')

let migratedShows = 0, migratedArchived = 0, migratedTemplates = 0, migratedPhotos = 0

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const result = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    result[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^"|"$/g, '')
  }
  return result
}

function parseCsv(csv) {
  const lines = csv.split('\n').filter(Boolean)
  if (lines.length <= 1) return []
  return lines.slice(1).map((line, i) => {
    const [channel, address, device, position, color, notes] = line.split(';')
    return { id: randomUUID(), channel: channel ?? '', address: address ?? '',
      device: device ?? '', position: position ?? '', color: color ?? '', notes: notes ?? '', sort_order: i }
  })
}

function parseSectionsMd(raw) {
  const map = new Map()
  const parts = raw.split(/^---section: [^\s]+---$/m)
  const ids = [...raw.matchAll(/^---section: ([^\s]+)---$/mg)].map(m => m[1])
  for (let i = 0; i < ids.length; i++) {
    map.set(ids[i], (parts[i + 1] ?? '').trim())
  }
  return map
}

function parseFieldsContent(rawContent) {
  // Konvertiert "key: value\nkey2: value2" → {"key":"value","key2":"value2"}
  const result = {}
  for (const line of rawContent.split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    result[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return JSON.stringify(result)
}

// ── Shows migrieren ──────────────────────────────────────────────────────────

async function migrateShow(slug, archived = false) {
  // Idempotenz-Check
  const existing = sqliteDb.prepare('SELECT id FROM shows WHERE slug = ?').get(slug)
  if (existing) return false  // bereits migriert

  const dir = archived
    ? path.join(archivPath, slug)
    : path.join(showsPath, slug)

  // Frontmatter
  let fm = {}
  try {
    const mdContent = await fs.readFile(path.join(dir, 'show.md'), 'utf8')
    fm = parseFrontmatter(mdContent)
  } catch {}

  const id = randomUUID()
  const ts = Date.now()
  sqliteDb.prepare(`
    INSERT INTO shows (id, slug, name, datum, template, untertitel, spielzeit, archived, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, slug, fm.name ?? slug, fm.datum ?? null, fm.template ?? null,
         fm.untertitel ?? null, fm.spielzeit ?? null, archived ? 1 : 0, ts, ts)

  // Channels
  try {
    const csv = await fs.readFile(path.join(dir, 'channels.csv'), 'utf8')
    const channels = parseCsv(csv)
    for (const ch of channels) {
      sqliteDb.prepare(`
        INSERT INTO channels (id, show_id, channel, address, device, position, color, notes, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(ch.id, id, ch.channel, ch.address, ch.device, ch.position, ch.color, ch.notes, ch.sort_order)
    }
  } catch {}

  // Section Defs
  let sectionDefs = []
  try {
    const raw = await fs.readFile(path.join(dir, 'sections.json'), 'utf8')
    sectionDefs = JSON.parse(raw)
    for (const def of sectionDefs) {
      sqliteDb.prepare('INSERT INTO section_defs (id, show_id, title, type, sort_order) VALUES (?, ?, ?, ?, ?)')
        .run(def.id, id, def.title, def.type, def.order ?? 0)
      for (let j = 0; j < (def.fields ?? []).length; j++) {
        const f = def.fields[j]
        sqliteDb.prepare('INSERT INTO section_fields (id, section_id, key, label, unit, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
          .run(f.id ?? randomUUID(), def.id, f.key, f.label ?? '', f.unit ?? '', j)
      }
    }
  } catch {}

  // Section Contents
  try {
    const raw = await fs.readFile(path.join(dir, 'sections.md'), 'utf8')
    const contentMap = parseSectionsMd(raw)
    for (const def of sectionDefs) {
      const rawContent = contentMap.get(def.id) ?? ''
      const content = def.type === 'fields'
        ? parseFieldsContent(rawContent)
        : rawContent
      sqliteDb.prepare('INSERT OR REPLACE INTO section_contents (section_id, show_id, content) VALUES (?, ?, ?)')
        .run(def.id, id, content)
    }
  } catch {}
}

// ── Templates migrieren ──────────────────────────────────────────────────────

async function migrateTemplate(csvFilename) {
  const templateName = csvFilename.replace(/\.csv$/, '')
  const existing = sqliteDb.prepare('SELECT id FROM templates WHERE name = ?').get(templateName)
  if (existing) return

  const tplId = randomUUID()
  sqliteDb.prepare('INSERT INTO templates (id, name) VALUES (?, ?)').run(tplId, templateName)

  // Channels
  try {
    const csv = await fs.readFile(path.join(templatesPath, csvFilename), 'utf8')
    const channels = parseCsv(csv)
    for (const ch of channels) {
      sqliteDb.prepare(`
        INSERT INTO template_channels (id, template_id, channel, address, device, position, color, notes, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), tplId, ch.channel, ch.address, ch.device, ch.position, ch.color, ch.notes, ch.sort_order)
    }
  } catch {}

  // Sections — Dateiname ist z.B. "kammer-1.csv.sections.json"
  try {
    const sectionsFile = path.join(templatesPath, csvFilename + '.sections.json')
    const raw = await fs.readFile(sectionsFile, 'utf8')
    const defs = JSON.parse(raw)
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i]
      const defId = def.id ?? randomUUID()
      sqliteDb.prepare('INSERT INTO template_section_defs (id, template_id, title, type, sort_order) VALUES (?, ?, ?, ?, ?)')
        .run(defId, tplId, def.title, def.type, def.order ?? i)
      for (let j = 0; j < (def.fields ?? []).length; j++) {
        const f = def.fields[j]
        sqliteDb.prepare('INSERT INTO template_section_fields (id, section_id, key, label, unit, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
          .run(f.id ?? randomUUID(), defId, f.key, f.label ?? '', f.unit ?? '', j)
      }
    }
  } catch {}
}

// ── Fotos migrieren ──────────────────────────────────────────────────────────

async function migratePhotos(slug, archived = false) {
  const srcDir = archived
    ? path.join(archivPath, slug)
    : path.join(showsPath, slug)
  const destDir = path.join(dataPath, 'photos', slug)

  let files
  try {
    files = await fs.readdir(srcDir)
  } catch { return }

  const photos = files.filter(f => /^foto-.*\.(jpg|jpeg)$/i.test(f))
  if (!photos.length) return

  await fs.mkdir(destDir, { recursive: true })
  for (const photo of photos) {
    const src = path.join(srcDir, photo)
    const dest = path.join(destDir, photo)
    try {
      await fs.access(dest)
      // Datei existiert bereits — überspringen
    } catch {
      await fs.copyFile(src, dest)
      await fs.unlink(src)
      migratedPhotos++
    }
  }
}

// ── Hauptprogramm ────────────────────────────────────────────────────────────

async function main() {
  // Shows
  let showDirs = []
  try {
    const entries = await fs.readdir(showsPath, { withFileTypes: true })
    showDirs = entries
      .filter(e => e.isDirectory() && e.name !== 'archiv' && !e.name.startsWith('.'))
      .map(e => e.name)
  } catch {}

  for (const slug of showDirs) {
    const inserted = await migrateShow(slug, false)
    await migratePhotos(slug, false)
    if (inserted !== false) migratedShows++
  }

  // Archivierte Shows
  let archivDirs = []
  try {
    const entries = await fs.readdir(archivPath, { withFileTypes: true })
    archivDirs = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => e.name)
  } catch {}

  for (const slug of archivDirs) {
    const inserted = await migrateShow(slug, true)
    await migratePhotos(slug, true)
    if (inserted !== false) migratedArchived++
  }

  // Templates
  let tplFiles = []
  try {
    const files = await fs.readdir(templatesPath)
    tplFiles = files.filter(f => f.endsWith('.csv'))
  } catch {}

  for (const csvFile of tplFiles) {
    await migrateTemplate(csvFile)
    migratedTemplates++
  }

  console.log(`✓ ${migratedShows} Shows migriert`)
  console.log(`✓ ${migratedArchived} Shows archiviert`)
  console.log(`✓ ${migratedTemplates} Templates migriert`)
  console.log(`✓ ${migratedPhotos} Fotos verschoben`)
}

main().catch(err => { console.error(err); process.exit(1) })
