/**
 * io.js — Dateisystem-Zugriff, Locking, Atomic Writes, Versionierung
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from './config.js'

// ── Pfade ──────────────────────────────────────────────────────────────────

export const paths = {
  shows:       () => path.join(config.dataPath, 'shows'),
  archiv:      () => path.join(config.dataPath, 'shows', 'archiv'),
  templates:   () => path.join(config.dataPath, 'templates'),
  showDir:     (id) => path.join(config.dataPath, 'shows', id),
  showMd:      (id) => path.join(config.dataPath, 'shows', id, 'show.md'),
  showCsv:     (id) => path.join(config.dataPath, 'shows', id, 'channels.csv'),
  showLock:    (id) => path.join(config.dataPath, 'shows', id, 'show.lock'),
  showPhotos:  (id) => path.join(config.dataPath, 'shows', id),
  sectionsTpl: (name) => path.join(config.dataPath, 'templates', name + '.sections.json'),
  sectionsMd:  (id) => path.join(config.dataPath, 'shows', id, 'sections.md'),
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

/** Atomares Schreiben: erst in .tmp, dann umbenennen */
export async function writeAtomic(filePath, content) {
  const tmp = filePath + '.tmp'
  await fs.writeFile(tmp, content, 'utf8')
  await fs.rename(tmp, filePath)
}


// ── Locking ────────────────────────────────────────────────────────────────

export async function acquireLock(showId, username) {
  const lockPath = paths.showLock(showId)
  try {
    const raw = await fs.readFile(lockPath, 'utf8')
    const lock = JSON.parse(raw)
    const age = Date.now() - lock.since
    if (age < config.lockTimeout && lock.user !== username) {
      return { ok: false, lockedBy: lock.user, since: lock.since }
    }
  } catch { /* kein Lock vorhanden */ }
  await writeAtomic(lockPath, JSON.stringify({ user: username, since: Date.now() }))
  return { ok: true }
}

export async function releaseLock(showId, username) {
  const lockPath = paths.showLock(showId)
  try {
    const raw = await fs.readFile(lockPath, 'utf8')
    const lock = JSON.parse(raw)
    if (lock.user === username) await fs.unlink(lockPath)
  } catch { /* ignorieren */ }
}

export async function touchLock(showId, username) {
  const lockPath = paths.showLock(showId)
  try {
    const raw = await fs.readFile(lockPath, 'utf8')
    const lock = JSON.parse(raw)
    if (lock.user === username) {
      await writeAtomic(lockPath, JSON.stringify({ user: username, since: Date.now() }))
    }
  } catch { /* ignorieren */ }
}

export async function getLock(showId) {
  try {
    const raw = await fs.readFile(paths.showLock(showId), 'utf8')
    const lock = JSON.parse(raw)
    const age = Date.now() - lock.since
    if (age >= config.lockTimeout) { await fs.unlink(paths.showLock(showId)); return null }
    return lock
  } catch { return null }
}

// ── Shows ──────────────────────────────────────────────────────────────────

export async function listShows() {
  await ensureDir(paths.shows())
  const entries = await fs.readdir(paths.shows(), { withFileTypes: true })
  return entries
    .filter(e => e.isDirectory() && e.name !== 'archiv' && !e.name.startsWith('.'))
    .map(e => e.name)
}

export async function readShow(id) {
  return fs.readFile(paths.showMd(id), 'utf8')
}

export async function writeShow(id, content) {
  await writeAtomic(paths.showMd(id), content)
}

export async function readChannels(id) {
  try { return await fs.readFile(paths.showCsv(id), 'utf8') }
  catch { return 'channel;address;device;position;color;notes\n' }
}

export async function writeChannels(id, content) {
  await writeAtomic(paths.showCsv(id), content)
}

export async function archiveShow(id) {
  await ensureDir(paths.archiv())
  await fs.rename(paths.showDir(id), path.join(paths.archiv(), id))
}

// ── Templates ─────────────────────────────────────────────────────────────

export async function listTemplates() {
  await ensureDir(paths.templates())
  const files = await fs.readdir(paths.templates())
  return files.filter(f => f.endsWith('.csv'))
}

export async function readTemplate(name) {
  return fs.readFile(path.join(paths.templates(), name), 'utf8')
}

export async function writeTemplate(name, content) {
  await writeAtomic(path.join(paths.templates(), name), content)
}

export async function deleteTemplate(name) {
  await fs.unlink(path.join(paths.templates(), name))
}

// ── Template Sections ──────────────────────────────────────────────────────

export async function readTemplateSections(name) {
  try {
    const raw = await fs.readFile(paths.sectionsTpl(name), 'utf8')
    return JSON.parse(raw)
  } catch { return [] }
}

export async function writeTemplateSections(name, sections) {
  await writeAtomic(paths.sectionsTpl(name), JSON.stringify(sections, null, 2))
}

export async function deleteTemplateSections(name) {
  try { await fs.unlink(paths.sectionsTpl(name)) } catch { /* ignorieren */ }
}

// ── Show Sections ──────────────────────────────────────────────────────────

export async function readShowSections(id) {
  try { return await fs.readFile(paths.sectionsMd(id), 'utf8') }
  catch { return '' }
}

export async function writeShowSections(id, raw) {
  await writeAtomic(paths.sectionsMd(id), raw)
}

// ── Sections Format (pure) ─────────────────────────────────────────────────

/** Parst sections.md in eine Map<sectionId, string> */
export function parseSectionsMd(raw) {
  const map = new Map()
  const parts = raw.split(/^---section: [^\s]+---$/m)
  const ids = [...raw.matchAll(/^---section: ([^\s]+)---$/mg)].map(m => m[1])
  // Erster Teil (vor dem ersten Delimiter) ist Preamble — ignorieren
  for (let i = 0; i < ids.length; i++) {
    map.set(ids[i], (parts[i + 1] ?? '').trim())
  }
  return map
}

/** Serialisiert eine Map<sectionId, string> zu sections.md */
export function serializeSectionsMd(map) {
  const parts = []
  for (const [id, content] of map) {
    parts.push(`---section: ${id}---\n${content}`)
  }
  return parts.join('\n')
}
