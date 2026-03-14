/**
 * io.js — Dateisystem-Zugriff, Locking, Atomic Writes, Versionierung
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from './config.js'

// ── Pfade ──────────────────────────────────────────────────────────────────

export const paths = {
  shows:     () => path.join(config.dataPath, 'shows'),
  archiv:    () => path.join(config.dataPath, 'shows', 'archiv'),
  templates: () => path.join(config.dataPath, 'templates'),
  showDir:   (id) => path.join(config.dataPath, 'shows', id),
  showMd:    (id) => path.join(config.dataPath, 'shows', id, 'show.md'),
  showCsv:   (id) => path.join(config.dataPath, 'shows', id, 'channels.csv'),
  showLock:  (id) => path.join(config.dataPath, 'shows', id, 'show.lock'),
  showPhotos:(id) => path.join(config.dataPath, 'shows', id),
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

/** Versionierung: .bak1 … .bakN rotieren, dann aktuelle Datei als .bak1 */
export async function rotateBackup(filePath) {
  for (let i = config.versionCount - 1; i >= 1; i--) {
    const older = `${filePath}.bak${i + 1}`
    const newer = `${filePath}.bak${i}`
    try { await fs.rename(newer, older) } catch { /* existiert nicht */ }
  }
  try { await fs.copyFile(filePath, `${filePath}.bak1`) } catch { /* neue Datei */ }
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
  await rotateBackup(paths.showMd(id))
  await writeAtomic(paths.showMd(id), content)
}

export async function readChannels(id) {
  try { return await fs.readFile(paths.showCsv(id), 'utf8') }
  catch { return 'channel;device;color;address;category;position;notes\n' }
}

export async function writeChannels(id, content) {
  await rotateBackup(paths.showCsv(id))
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
